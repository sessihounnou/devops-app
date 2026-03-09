import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_, select

from core.config import settings
from core.database import AsyncSessionLocal, init_db
from core.security import hash_password
from api.routes.auth import router as auth_router
from api.routes.projects import router as projects_router
from api.routes.dns import router as dns_router
from api.routes.backups import router as backups_router
from api.routes.deployments import router as deployments_router
from api.websockets import router as ws_router
from models.user import User, UserRole

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


async def _ensure_default_admin() -> None:
    username = settings.DEFAULT_ADMIN_USERNAME.strip()
    email = settings.DEFAULT_ADMIN_EMAIL.strip()
    password = settings.DEFAULT_ADMIN_PASSWORD

    if not (username and email and password):
        logger.info(
            "Default admin bootstrap skipped (DEFAULT_ADMIN_USERNAME/EMAIL/PASSWORD not fully set)"
        )
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(or_(User.username == username, User.email == email))
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.username = username
            existing.email = email
            existing.hashed_password = hash_password(password)
            existing.role = UserRole.administrator
            existing.is_active = True
            await db.commit()
            logger.info("Default admin account updated: %s", username)
            return

        user = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            role=UserRole.administrator,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        logger.info("Default admin account created: %s", username)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)
    await init_db()
    await _ensure_default_admin()
    yield
    logger.info("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "REST API for AnsibleFlow — centralised DevOps management platform. "
        "Manages projects, DNS records, backups, and deployments via Ansible playbooks."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — restrict in production via env vars
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
API_PREFIX = "/api"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(projects_router, prefix=API_PREFIX)
app.include_router(dns_router, prefix=API_PREFIX)
app.include_router(backups_router, prefix=API_PREFIX)
app.include_router(deployments_router, prefix=API_PREFIX)
app.include_router(ws_router)  # WebSocket — no /api prefix


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}
