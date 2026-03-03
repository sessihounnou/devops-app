from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_operator
from models.backup import Backup, BackupStatus
from models.project import Project
from models.user import User
from tasks.backup_tasks import run_backup

router = APIRouter(prefix="/projects/{project_id}/backups", tags=["backups"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class BackupResponse(BaseModel):
    id: int
    project_id: int
    status: BackupStatus
    size_mb: Optional[float]
    file_path: Optional[str]
    checksum: Optional[str]
    storage_server: Optional[str]
    ansible_job_id: Optional[str]
    error_message: Optional[str]
    created_at: str
    finished_at: Optional[str]

    model_config = {"from_attributes": True}


class BackupListResponse(BaseModel):
    total: int
    items: list[BackupResponse]


class BackupTriggerResponse(BaseModel):
    backup_id: int
    job_id: str
    message: str


class RestoreResponse(BaseModel):
    job_id: str
    message: str


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_project_or_404(project_id: int, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=BackupListResponse)
async def list_backups(
    project_id: int,
    status: Optional[BackupStatus] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await _get_project_or_404(project_id, db)

    query = select(Backup).where(Backup.project_id == project_id)
    if status:
        query = query.where(Backup.status == status)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    query = (
        query.order_by(Backup.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)
    return BackupListResponse(total=total, items=result.scalars().all())


@router.get("/{backup_id}", response_model=BackupResponse)
async def get_backup(
    project_id: int,
    backup_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await _get_project_or_404(project_id, db)
    backup = await db.get(Backup, backup_id)
    if not backup or backup.project_id != project_id:
        raise HTTPException(status_code=404, detail="Backup not found")
    return backup


@router.post("", response_model=BackupTriggerResponse, status_code=202)
async def trigger_backup(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator),
):
    """Trigger an on-demand backup via Celery (returns immediately)."""
    project = await _get_project_or_404(project_id, db)

    backup = Backup(project_id=project_id, status=BackupStatus.pending)
    db.add(backup)
    await db.commit()
    await db.refresh(backup)

    task = run_backup.delay(backup.id, project_id)

    return BackupTriggerResponse(
        backup_id=backup.id,
        job_id=task.id,
        message="Backup task queued",
    )


@router.post("/{backup_id}/restore", response_model=RestoreResponse, status_code=202)
async def restore_backup(
    project_id: int,
    backup_id: int,
    target_host: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator),
):
    """Trigger an Ansible restore playbook from a previous backup."""
    project = await _get_project_or_404(project_id, db)
    backup = await db.get(Backup, backup_id)
    if not backup or backup.project_id != project_id:
        raise HTTPException(status_code=404, detail="Backup not found")
    if backup.status != BackupStatus.success:
        raise HTTPException(status_code=400, detail="Only successful backups can be restored")

    from tasks.deploy_tasks import run_deployment
    from models.deployment import Deployment, DeploymentStatus

    restore_host = target_host or project.server_ip
    deployment = Deployment(
        project_id=project_id,
        target_host=restore_host,
        target_ssh_user=project.ssh_user,
        status=DeploymentStatus.pending,
        components=["restore"],
    )
    db.add(deployment)
    await db.commit()
    await db.refresh(deployment)

    # Reuse deploy task with restore component
    task = run_deployment.delay(deployment.id)

    return RestoreResponse(
        job_id=task.id,
        message=f"Restore from backup {backup_id} queued",
    )
