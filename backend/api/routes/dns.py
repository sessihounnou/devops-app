from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_operator
from models.dns_record import DNSRecord, DNSType
from models.project import Project
from models.user import User
from tasks.dns_tasks import apply_dns_changes

router = APIRouter(prefix="/projects/{project_id}/dns", tags=["dns"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class DNSRecordCreate(BaseModel):
    record_type: DNSType
    name: str
    value: str
    ttl: int = 3600
    priority: Optional[int] = None


class DNSRecordUpdate(BaseModel):
    record_type: Optional[DNSType] = None
    name: Optional[str] = None
    value: Optional[str] = None
    ttl: Optional[int] = None
    priority: Optional[int] = None


class DNSRecordResponse(BaseModel):
    id: int
    project_id: int
    record_type: DNSType
    name: str
    value: str
    ttl: int
    priority: Optional[int]

    model_config = {"from_attributes": True}


class DNSApplyResponse(BaseModel):
    job_id: str
    message: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

async def _get_project_or_404(project_id: int, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("", response_model=list[DNSRecordResponse])
async def list_dns_records(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await _get_project_or_404(project_id, db)
    result = await db.execute(
        select(DNSRecord).where(DNSRecord.project_id == project_id).order_by(DNSRecord.id)
    )
    return result.scalars().all()


@router.post("", response_model=DNSRecordResponse, status_code=201)
async def create_dns_record(
    project_id: int,
    body: DNSRecordCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator),
):
    await _get_project_or_404(project_id, db)
    record = DNSRecord(project_id=project_id, **body.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.put("/{record_id}", response_model=DNSRecordResponse)
async def update_dns_record(
    project_id: int,
    record_id: int,
    body: DNSRecordUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator),
):
    await _get_project_or_404(project_id, db)
    record = await db.get(DNSRecord, record_id)
    if not record or record.project_id != project_id:
        raise HTTPException(status_code=404, detail="DNS record not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(record, field, value)

    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=204)
async def delete_dns_record(
    project_id: int,
    record_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator),
):
    await _get_project_or_404(project_id, db)
    record = await db.get(DNSRecord, record_id)
    if not record or record.project_id != project_id:
        raise HTTPException(status_code=404, detail="DNS record not found")
    await db.delete(record)
    await db.commit()


@router.post("/apply", response_model=DNSApplyResponse)
async def apply_dns(
    project_id: int,
    record_ids: list[int],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator),
):
    """Apply selected DNS records via Ansible playbook (async Celery task)."""
    await _get_project_or_404(project_id, db)

    task = apply_dns_changes.delay(project_id, record_ids)
    return DNSApplyResponse(
        job_id=task.id,
        message="DNS update task queued",
    )
