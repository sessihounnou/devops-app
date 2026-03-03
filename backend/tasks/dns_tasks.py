"""
Celery tasks for DNS operations.
"""
import asyncio
import logging

from tasks.celery_app import celery_app
from core.database import AsyncSessionLocal
from models.project import Project
from models.dns_record import DNSRecord
from services import ansible_runner as ar
from services.notification import notify_job_result

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="tasks.dns_tasks.apply_dns_changes")
def apply_dns_changes(self, project_id: int, dns_record_ids: list[int]) -> dict:
    return asyncio.run(_apply_dns_async(self, project_id, dns_record_ids))


async def _apply_dns_async(task, project_id: int, dns_record_ids: list[int]) -> dict:
    async with AsyncSessionLocal() as db:
        project = await db.get(Project, project_id)
        if not project:
            return {"status": "failed", "error": "Project not found"}

        # Collect the DNS records to apply
        records = []
        for rid in dns_record_ids:
            rec = await db.get(DNSRecord, rid)
            if rec:
                records.append(
                    {
                        "type": rec.record_type.value,
                        "name": rec.name,
                        "value": rec.value,
                        "ttl": rec.ttl,
                        "priority": rec.priority,
                    }
                )

        extra_vars = {
            "project_name": project.name,
            "project_domain": project.domain,
            "dns_records": records,
            **(project.ansible_extra_vars or {}),
        }

        job_id = f"dns-{project_id}-{task.request.id}"

        try:
            await ar.run_playbook(
                playbook="update_dns.yml",
                host=project.server_ip,
                ssh_user=project.ssh_user,
                ssh_port=project.ssh_port,
                extra_vars=extra_vars,
                job_id=job_id,
            )
            await ar.publish_done(job_id)

            await notify_job_result("DNS Update", project.name, "success")
            return {"status": "success", "job_id": job_id}

        except Exception as exc:
            logger.exception("DNS task for project %s failed: %s", project_id, exc)
            try:
                await ar.publish_done(job_id)
            except Exception:
                pass
            await notify_job_result("DNS Update", project.name, "failed")
            return {"status": "failed", "error": str(exc)}
