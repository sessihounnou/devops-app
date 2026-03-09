"""
Celery tasks for deployment operations.
"""
import asyncio
import logging
from datetime import datetime, timezone

from tasks.celery_app import celery_app
from core.database import AsyncSessionLocal
from models.deployment import Deployment, DeploymentStatus
from models.project import Project
from services import ansible_runner as ar
from services.notification import notify_job_result

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="tasks.deploy_tasks.run_deployment")
def run_deployment(self, deployment_id: int) -> dict:
    return asyncio.run(_run_deployment_async(self, deployment_id))


async def _run_deployment_async(task, deployment_id: int) -> dict:
    async with AsyncSessionLocal() as db:
        deployment = await db.get(Deployment, deployment_id)
        if not deployment:
            return {"status": "failed", "error": "Deployment not found"}

        project = await db.get(Project, deployment.project_id)
        if not project:
            return {"status": "failed", "error": "Project not found"}

        deployment.status = DeploymentStatus.running
        deployment.started_at = datetime.now(timezone.utc)
        deployment.ansible_job_id = task.request.id
        await db.commit()

        extra_vars = {
            "project_name": project.name,
            "project_domain": project.domain,
            "target_host": deployment.target_host,
            "target_ssh_user": deployment.target_ssh_user,
            "target_environment": deployment.target_environment or project.environment.value,
            "components": deployment.components or [],
            "git_repo": project.repo_url or "",
            "git_branch": project.repo_branch or "main",
            "env_file_content": project.env_file_content or "",
            **(project.ansible_extra_vars or {}),
        }

        job_id = f"deploy-{deployment_id}"

        try:
            await ar.run_playbook(
                playbook="deploy.yml",
                host=deployment.target_host,
                ssh_user=deployment.target_ssh_user,
                ssh_private_key=project.ssh_private_key or None,
                extra_vars=extra_vars,
                job_id=job_id,
            )
            await ar.publish_done(job_id)

            deployment.status = DeploymentStatus.success
            deployment.finished_at = datetime.now(timezone.utc)
            project.last_deploy_status = "success"
            await db.commit()

            await notify_job_result("Deployment", project.name, "success")
            return {"status": "success", "deployment_id": deployment_id}

        except Exception as exc:
            logger.exception("Deployment %s failed: %s", deployment_id, exc)

            # Attempt automatic rollback
            rollback_ok = await _attempt_rollback(project, deployment)

            deployment.status = (
                DeploymentStatus.rolled_back if rollback_ok else DeploymentStatus.failed
            )
            deployment.error_message = str(exc)
            deployment.finished_at = datetime.now(timezone.utc)
            project.last_deploy_status = deployment.status.value
            await db.commit()

            try:
                await ar.publish_done(job_id)
            except Exception:
                pass

            await notify_job_result("Deployment", project.name, deployment.status.value)
            return {"status": deployment.status.value, "error": str(exc)}


async def _attempt_rollback(project: "Project", deployment: "Deployment") -> bool:
    """Try to run the restore playbook as a rollback."""
    try:
        rollback_vars = {
            "project_name": project.name,
            "target_host": deployment.target_host,
            "target_ssh_user": deployment.target_ssh_user,
        }
        job_id = f"rollback-{deployment.id}"
        await ar.run_playbook(
            playbook="restore.yml",
            host=deployment.target_host,
            ssh_user=deployment.target_ssh_user,
            ssh_private_key=project.ssh_private_key or None,
            extra_vars=rollback_vars,
            job_id=job_id,
        )
        await ar.publish_done(job_id)
        return True
    except Exception as exc:
        logger.error("Rollback for deployment %s failed: %s", deployment.id, exc)
        return False
