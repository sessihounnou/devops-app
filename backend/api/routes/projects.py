from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_operator
from models.project import Project, Environment, TechStack
from models.user import User

router = APIRouter(prefix="/projects", tags=["projects"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    domain: str
    server_ip: str
    tech_stack: TechStack
    environment: Environment
    ssh_user: str = "root"
    ssh_port: int = 22
    ansible_extra_vars: Optional[dict] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    domain: Optional[str] = None
    server_ip: Optional[str] = None
    tech_stack: Optional[TechStack] = None
    environment: Optional[Environment] = None
    ssh_user: Optional[str] = None
    ssh_port: Optional[int] = None
    ansible_extra_vars: Optional[dict] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    domain: str
    server_ip: str
    tech_stack: TechStack
    environment: Environment
    ssh_user: str
    ssh_port: int
    last_deploy_status: Optional[str]
    last_backup_at: Optional[str]
    ansible_extra_vars: Optional[dict]

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    total: int
    items: list[ProjectResponse]


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=ProjectListResponse)
async def list_projects(
    environment: Optional[Environment] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Project)
    if environment:
        query = query.where(Project.environment == environment)
    if search:
        query = query.where(Project.name.ilike(f"%{search}%"))

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    query = query.order_by(Project.name).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return ProjectListResponse(total=total, items=result.scalars().all())


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator),
):
    existing = await db.execute(select(Project).where(Project.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Project name already exists")

    project = Project(**body.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)

    # Generate Ansible file structure for the new project
    _generate_ansible_structure(project)

    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _generate_ansible_structure(project: Project) -> None:
    """
    Generate the minimal Ansible file structure (inventory + host_vars) for a new project.
    Errors are logged but do not block the API response.
    """
    import os
    from pathlib import Path
    from core.config import settings
    import logging

    logger = logging.getLogger(__name__)

    base = Path(settings.ANSIBLE_BASE_PATH)
    host_vars_dir = base / "inventory" / "host_vars" / project.server_ip
    host_vars_dir.mkdir(parents=True, exist_ok=True)

    host_vars_file = host_vars_dir / "vars.yml"
    try:
        host_vars_file.write_text(
            f"---\n"
            f"project_name: {project.name}\n"
            f"project_domain: {project.domain}\n"
            f"project_environment: {project.environment.value}\n"
            f"project_tech_stack: {project.tech_stack.value}\n"
            f"ansible_user: {project.ssh_user}\n"
            f"ansible_port: {project.ssh_port}\n"
        )
    except Exception as exc:
        logger.error("Failed to generate Ansible host_vars for project %s: %s", project.name, exc)
