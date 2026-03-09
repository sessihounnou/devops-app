"""
Wrapper around ansible-runner for executing Ansible playbooks asynchronously.
Logs are streamed to Redis pub/sub so WebSocket clients can subscribe.
"""
import asyncio
import json
import os
import stat
import tempfile
import uuid
from pathlib import Path
from typing import AsyncIterator, Optional

import ansible_runner as _ansible_runner
import redis.asyncio as aioredis

from core.config import settings


class AnsibleJobError(Exception):
    pass


def _build_inventory(host: str, ssh_user: str, ssh_port: int = 22, key_file: Optional[str] = None) -> dict:
    """Build a minimal in-memory inventory for a single host."""
    host_vars: dict = {
        "ansible_host": host,
        "ansible_user": ssh_user,
        "ansible_port": ssh_port,
        "ansible_ssh_common_args": "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null",
    }
    if key_file:
        host_vars["ansible_ssh_private_key_file"] = key_file
    return {"all": {"hosts": {host: host_vars}}}


def _write_ssh_key(private_key: str) -> str:
    """Write an SSH private key to a secure temp file and return its path."""
    fd, path = tempfile.mkstemp(prefix="ansibleflow_key_", suffix=".pem")
    os.close(fd)
    Path(path).write_text(private_key.strip() + "\n")
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)  # 0600
    return path


async def run_playbook(
    playbook: str,
    host: str,
    ssh_user: str,
    ssh_port: int = 22,
    ssh_private_key: Optional[str] = None,
    extra_vars: Optional[dict] = None,
    job_id: Optional[str] = None,
    private_data_dir: Optional[str] = None,
) -> str:
    """
    Run an Ansible playbook asynchronously.

    Returns the job_id that can be used to stream logs via Redis.
    Publishes log lines to Redis channel `job:{job_id}:logs`.
    If ssh_private_key is provided, it is written to a secure temp file
    and passed to Ansible via ansible_ssh_private_key_file.
    """
    job_id = job_id or str(uuid.uuid4())
    pdd = private_data_dir or os.path.join(settings.ANSIBLE_BASE_PATH, "runner", job_id)
    Path(pdd).mkdir(parents=True, exist_ok=True)

    key_file: Optional[str] = None
    if ssh_private_key:
        key_file = _write_ssh_key(ssh_private_key)

    try:
        inventory = _build_inventory(host, ssh_user, ssh_port, key_file)
        ev = extra_vars or {}

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: _ansible_runner.run(
                private_data_dir=pdd,
                playbook=os.path.join(settings.ANSIBLE_BASE_PATH, "playbooks", playbook),
                inventory=inventory,
                extravars=ev,
                quiet=True,
                event_handler=_make_event_handler(job_id),
            ),
        )
    finally:
        # Always clean up the temp key file
        if key_file and os.path.exists(key_file):
            os.unlink(key_file)

    if result.rc != 0:
        raise AnsibleJobError(f"Playbook {playbook} failed with rc={result.rc}")

    return job_id


def _make_event_handler(job_id: str):
    """Return a synchronous event handler that publishes log lines to Redis."""
    import redis as sync_redis

    r = sync_redis.from_url(settings.REDIS_URL)
    channel = f"job:{job_id}:logs"

    def handler(event: dict):
        stdout = event.get("stdout", "")
        if stdout:
            r.publish(channel, json.dumps({"type": "log", "data": stdout}))

    return handler


async def stream_logs(job_id: str) -> AsyncIterator[str]:
    """
    Async generator that yields log lines from Redis pub/sub for a given job.
    Stops when the `done` sentinel message is received.
    """
    redis = aioredis.from_url(settings.REDIS_URL)
    pubsub = redis.pubsub()
    channel = f"job:{job_id}:logs"
    await pubsub.subscribe(channel)

    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = json.loads(message["data"])
            if data.get("type") == "done":
                break
            yield data.get("data", "")
    finally:
        await pubsub.unsubscribe(channel)
        await redis.aclose()


async def publish_done(job_id: str) -> None:
    """Signal that a job has finished streaming."""
    redis = aioredis.from_url(settings.REDIS_URL)
    await redis.publish(f"job:{job_id}:logs", json.dumps({"type": "done"}))
    await redis.aclose()
