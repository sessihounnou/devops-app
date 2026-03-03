import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Text, DateTime, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Environment(str, enum.Enum):
    production = "production"
    staging = "staging"
    development = "development"


class TechStack(str, enum.Enum):
    nodejs = "nodejs"
    php = "php"
    python = "python"
    ruby = "ruby"
    java = "java"
    go = "go"
    static = "static"
    other = "other"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    domain: Mapped[str] = mapped_column(String(255), nullable=False)
    server_ip: Mapped[str] = mapped_column(String(45), nullable=False)
    tech_stack: Mapped[TechStack] = mapped_column(Enum(TechStack), nullable=False)
    environment: Mapped[Environment] = mapped_column(Enum(Environment), nullable=False)
    ssh_user: Mapped[str] = mapped_column(String(100), default="root", nullable=False)
    ssh_port: Mapped[int] = mapped_column(default=22, nullable=False)
    # SSH key stored encrypted via Ansible Vault — path to vault-encrypted file
    ssh_key_vault_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # Arbitrary extra vars passed to Ansible playbooks
    ansible_extra_vars: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Deployment status from last run
    last_deploy_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_backup_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    backups: Mapped[list["Backup"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    deployments: Mapped[list["Deployment"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    dns_records: Mapped[list["DNSRecord"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Project {self.name} ({self.environment})>"
