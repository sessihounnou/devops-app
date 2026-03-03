"""
Celery tasks for backup operations.
"""
import asyncio
import logging
from datetime import datetime, timezone

from tasks.celery_app import celery_app
from core.database import AsyncSessionLocal
from models.backup import Backup, BackupStatus
from models.project import Project
from services import ansible_runner as ar
from services.notification import notify_job_result

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="tasks.backup_tasks.run_backup")
def run_backup(self, backup_id: int, project_id: int) -> dict:
    """
    Celery task: run an Ansible backup playbook for a project.
    Updates Backup record status and streams logs to Redis.
    """
    return asyncio.run(_run_backup_async(self, backup_id, project_id))


async def _run_backup_async(task, backup_id: int, project_id: int) -> dict:
    async with AsyncSessionLocal() as db:
        backup = await db.get(Backup, backup_id)
        project = await db.get(Project, project_id)

        if not backup or not project:
            logger.error("Backup %s or project %s not found", backup_id, project_id)
            return {"status": "failed", "error": "Not found"}

        backup.status = BackupStatus.running
        backup.ansible_job_id = task.request.id
        await db.commit()

        extra_vars = {
            "project_name": project.name,
            "project_domain": project.domain,
            "backup_storage_path": "/backups",
            "backup_id": backup_id,
            **(project.ansible_extra_vars or {}),
        }

        try:
            job_id = await ar.run_playbook(
                playbook="backup.yml",
                host=project.server_ip,
                ssh_user=project.ssh_user,
                ssh_port=project.ssh_port,
                extra_vars=extra_vars,
                job_id=str(backup_id),
            )
            await ar.publish_done(job_id)

            backup.status = BackupStatus.success
            backup.finished_at = datetime.now(timezone.utc)
            # Update project last_backup_at
            project.last_backup_at = backup.finished_at
            await db.commit()

            await notify_job_result("Backup", project.name, "success")
            return {"status": "success", "backup_id": backup_id}

        except Exception as exc:
            logger.exception("Backup %s failed: %s", backup_id, exc)
            backup.status = BackupStatus.failed
            backup.error_message = str(exc)
            backup.finished_at = datetime.now(timezone.utc)
            await db.commit()

            try:
                await ar.publish_done(str(backup_id))
            except Exception:
                pass

            await notify_job_result("Backup", project.name, "failed")
            return {"status": "failed", "error": str(exc)}
