# Copyright 2026 Swayam Kumar
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""FastAPI application entry point for ElectriMap DPR."""

from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.api.v1 import (
    admin_units,
    aoi,
    auth,
    costing,
    data,
    diagnostics,
    infrastructure,
    jobs,
    planning,
    projects,
    reports,
    settlements,
    spikes,
    tiles,
    verification,
)
from app.api.v1 import settings as project_settings_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.db import models as _db_models  # noqa: F401
from app.db.base import Base
from app.db.session import SessionLocal, check_db_readiness, engine, get_db
from app.services.seed_service import ensure_seed_data

settings = get_settings()
configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Ensure database tables and seed data exist on startup."""
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_seed_data(db)
    yield


app = FastAPI(
    title="ElectriMap DPR API",
    version=settings.app_version,
    description=(
        "GIS and Satellite-Based Assessment and Preliminary Detailed Project Report (DPR) "
        "Workbench for Rural and Tribal Electrification in India."
    ),
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)


@app.middleware("http")
async def add_security_headers(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Attach hardened HTTP security headers to every API response (Task M8-4)."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "geolocation=(), microphone=(), camera=()",
    )
    response.headers.setdefault(
        "Content-Security-Policy",
        (
            "default-src 'self'; "
            "img-src 'self' data: blob: https://*.openstreetmap.org https://*.maps.eox.at; "
            "style-src 'self' 'unsafe-inline'; "
            "script-src 'self'; "
            "connect-src 'self' https://*.openstreetmap.org https://*.maps.eox.at"
        ),
    )
    return response


app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(admin_units.router)
app.include_router(aoi.router)
app.include_router(data.router)
app.include_router(settlements.router)
app.include_router(verification.router)
app.include_router(infrastructure.router)
app.include_router(project_settings_router.router)
app.include_router(planning.router)
app.include_router(costing.router)
app.include_router(reports.router)
app.include_router(jobs.router)
app.include_router(tiles.router)
app.include_router(spikes.router)
app.include_router(diagnostics.router)


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
