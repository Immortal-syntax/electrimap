"""Database engine, session factory, and readiness checks."""

from collections.abc import Generator
from pathlib import Path
from typing import Any

import pyproj
import shapely
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


def build_engine(database_url: str | None = None) -> Engine:
    """Create a SQLAlchemy engine for PostgreSQL/PostGIS or local SQLite."""
    settings = get_settings()
    url = database_url or settings.database_url
    connect_args: dict[str, Any] = {}
    if url.startswith("sqlite:///"):
        db_file = url.replace("sqlite:///", "", 1)
        if db_file and db_file != ":memory:":
            Path(db_file).parent.mkdir(parents=True, exist_ok=True)
        connect_args["check_same_thread"] = False
    return create_engine(url, connect_args=connect_args, future=True, pool_pre_ping=True)


engine = build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_readiness(db: Session) -> dict[str, Any]:
    """Verify database connectivity and report spatial runtime versions."""
    dialect_name = db.bind.dialect.name if db.bind is not None else "unknown"
    spatial_runtime: str
    if dialect_name == "postgresql":
        row = db.execute(text("SELECT postgis_full_version()")).scalar_one_or_none()
        spatial_runtime = str(row or "PostGIS enabled")
    else:
        db.execute(text("SELECT 1")).scalar_one()
        spatial_runtime = (
            f"Shapely {shapely.__version__} (GEOS {shapely.geos_version_string}) / "
            f"PyProj {pyproj.__version__}"
        )
    return {
        "status": "ready",
        "database_dialect": dialect_name,
        "spatial_runtime": spatial_runtime,
    }

