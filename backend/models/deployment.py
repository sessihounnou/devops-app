import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Enum, ForeignKey, Text, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class DeploymentStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"
    rolled_back = "rolled_back"


class Deployment(Base):
    __tablename__ = "deployments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    triggered_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    target_host: Mapped[str] = mapped_column(String(255), nullable=False)
    target_ssh_user: Mapped[str] = mapped_column(String(100), default="root", nullable=False)
    target_environment: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # Components selected for deployment (stored as JSON list)
    components: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    status: Mapped[DeploymentStatus] = mapped_column(
        Enum(DeploymentStatus), default=DeploymentStatus.pending, nullable=False
    )
    ansible_job_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    logs: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    project: Mapped["Project"] = relationship(back_populates="deployments")
    triggered_by_user: Mapped[Optional["User"]] = relationship(back_populates="deployments")

    def __repr__(self) -> str:
        return f"<Deployment {self.id} project={self.project_id} status={self.status}>"
