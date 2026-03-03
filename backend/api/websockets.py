"""
WebSocket endpoint for streaming real-time Ansible job logs to the frontend.

Connection URL: ws://<host>/ws/jobs/<job_id>/logs
The client must send the JWT access token as a query param: ?token=<jwt>
"""
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
import redis.asyncio as aioredis

from core.config import settings
from core.security import decode_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websockets"])


@router.websocket("/ws/jobs/{job_id}/logs")
async def stream_job_logs(
    websocket: WebSocket,
    job_id: str,
    token: str = Query(..., description="JWT access token"),
):
    """
    Stream live Ansible logs for `job_id` via WebSocket.

    The client authenticates by passing the JWT in the `token` query parameter.
    Log lines are published to Redis channel `job:{job_id}:logs` by the Celery tasks.
    """
    # Authenticate before accepting the connection
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    logger.info("WS client connected for job %s (user %s)", job_id, payload.get("sub"))

    redis = aioredis.from_url(settings.REDIS_URL)
    pubsub = redis.pubsub()
    channel = f"job:{job_id}:logs"

    try:
        await pubsub.subscribe(channel)
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue

            try:
                data = json.loads(message["data"])
            except (json.JSONDecodeError, TypeError):
                continue

            if data.get("type") == "done":
                await websocket.send_json({"type": "done"})
                break

            log_line = data.get("data", "")
            if log_line:
                await websocket.send_json({"type": "log", "data": log_line})

    except WebSocketDisconnect:
        logger.info("WS client disconnected for job %s", job_id)
    except Exception as exc:
        logger.error("WS error for job %s: %s", job_id, exc)
        try:
            await websocket.send_json({"type": "error", "data": str(exc)})
        except Exception:
            pass
    finally:
        await pubsub.unsubscribe(channel)
        await redis.aclose()
        try:
            await websocket.close()
        except Exception:
            pass
