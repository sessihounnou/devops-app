"""
Notification service: send alerts via email (SMTP) and/or Slack webhook.
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


async def send_slack(message: str, channel: Optional[str] = None) -> None:
    if not settings.SLACK_WEBHOOK_URL:
        logger.debug("Slack webhook not configured, skipping notification")
        return

    payload = {"text": message}
    if channel:
        payload["channel"] = channel

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(settings.SLACK_WEBHOOK_URL, json=payload, timeout=10)
            resp.raise_for_status()
        except Exception as exc:
            logger.error("Failed to send Slack notification: %s", exc)


def send_email(to: str, subject: str, body: str) -> None:
    if not settings.SMTP_HOST:
        logger.debug("SMTP not configured, skipping email notification")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, to, msg.as_string())
    except Exception as exc:
        logger.error("Failed to send email notification: %s", exc)


async def notify_job_result(
    job_type: str,
    project_name: str,
    status: str,
    user_email: Optional[str] = None,
) -> None:
    """Send notification for backup / deployment job completion."""
    icon = "✅" if status == "success" else "❌"
    message = f"{icon} *AnsibleFlow* — {job_type} for project *{project_name}*: `{status}`"

    await send_slack(message)

    if user_email:
        subject = f"[AnsibleFlow] {job_type} {status} — {project_name}"
        body = f"The {job_type} operation for project '{project_name}' finished with status: {status}."
        send_email(user_email, subject, body)
