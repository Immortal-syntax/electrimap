"""FastAPI application entry point for ElectriMap DPR."""

from typing import Any

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.db import models as _db_models  # noqa: F401
from app.db.session import check_db_readiness, get_db

settings = get_settings()
configure_logging(settings.log_level)

app = FastAPI(
    title="ElectriMap DPR API",
    version=settings.app_version,
    description=(
        "GIS and Satellite-Based Assessment and Preliminary Detailed Project Report (DPR) "
        "Workbench for Rural and Tribal Electrification in India."
    ),
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)


@app.get("/api/v1/health", tags=["System"])
def get_health() -> dict[str, Any]:
    """Liveness endpoint returning application environment and version."""
    return {
        "status": "ok",
        "service": "electrimap-backend",
        "version": settings.app_version,
        "environment": settings.app_env,
        "offline_mode": settings.offline_mode,
    }


@app.get("/api/v1/health/ready", tags=["System"])
def get_readiness(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Readiness endpoint verifying database connectivity and spatial runtime."""
    return check_db_readiness(db)
