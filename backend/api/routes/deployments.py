from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_operator
from models.deployment import Deployment, DeploymentStatus
from models.project import Project
from models.user import User
from tasks.deploy_tasks import run_deployment

router = APIRouter(prefix="/projects/{project_id}/deployments", tags=["deployments"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class DeploymentCreate(BaseModel):
    target_host: str
    target_ssh_user: str = "root"
    target_environment: Optional[str] = None
    components: Optional[list[str]] = None


class DeploymentResponse(BaseModel):
    id: int
    project_id: int
    triggered_by: Optional[int]
    target_host: str
    target_ssh_user: str
    target_environment: Optional[str]
    components: Optional[list]
    status: DeploymentStatus
    ansible_job_id: Optional[str]
    error_message: Optional[str]
    started_at: Optional[str]
    finished_at: Optional[str]
    created_at: str

    model_config = {"from_attributes": True}


class DeploymentListResponse(BaseModel):
    total: int
    items: list[DeploymentResponse]


class DeployTriggerResponse(BaseModel):
    deployment_id: int
    job_id: str
    message: str


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_project_or_404(project_id: int, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=DeploymentListResponse)
async def list_deployments(
    project_id: int,
    status: Optional[DeploymentStatus] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await _get_project_or_404(project_id, db)

    query = select(Deployment).where(Deployment.project_id == project_id)
    if status:
        query = query.where(Deployment.status == status)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    query = (
        query.order_by(Deployment.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)
    return DeploymentListResponse(total=total, items=result.scalars().all())


@router.get("/{deployment_id}", response_model=DeploymentResponse)
async def get_deployment(
    project_id: int,
    deployment_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await _get_project_or_404(project_id, db)
    deployment = await db.get(Deployment, deployment_id)
    if not deployment or deployment.project_id != project_id:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return deployment


@router.post("", response_model=DeployTriggerResponse, status_code=202)
async def trigger_deployment(
    project_id: int,
    body: DeploymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    """Trigger a deployment to a new/target server via Celery (returns immediately)."""
    await _get_project_or_404(project_id, db)

    deployment = Deployment(
        project_id=project_id,
        triggered_by=current_user.id,
        status=DeploymentStatus.pending,
        **body.model_dump(),
    )
    db.add(deployment)
    await db.commit()
    await db.refresh(deployment)

    task = run_deployment.delay(deployment.id)

    return DeployTriggerResponse(
        deployment_id=deployment.id,
        job_id=task.id,
        message="Deployment task queued",
    )
