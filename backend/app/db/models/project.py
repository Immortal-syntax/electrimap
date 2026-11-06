"""Project and Area of Interest (AOI) spatial models."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.db.types import SpatialGeometry


class Project(Base, TimestampMixin):
    """Rural/tribal electrification assessment project with optimistic concurrency lock."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheme: Mapped[str] = mapped_column(
        String(64), default="DA-JGUA / RDSS", nullable=False
    )
    target_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_block: Mapped[str | None] = mapped_column(String(100), nullable=True)
    village_names: Mapped[str | None] = mapped_column(String(300), nullable=True)
    base_year: Mapped[int] = mapped_column(Integer, default=2026, nullable=False)
    horizon_years: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    discount_rate: Mapped[float] = mapped_column(Float, default=0.08, nullable=False)
    load_tier: Mapped[str] = mapped_column(
        String(32), default="TIER_3_STANDARD", nullable=False
    )
    metric_epsg: Mapped[int] = mapped_column(Integer, default=32644, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), default="DRAFT", nullable=False
    )  # DRAFT, AOI_SET, DATA_READY, ANALYZED
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ProjectAoi(Base, TimestampMixin):
    """Project Area of Interest (AOI) normalized MultiPolygon in WGS 84 (EPSG:4326)."""

    __tablename__ = "project_aoi"

    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    geom: Mapped[Any] = mapped_column(
        SpatialGeometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=False
    )
    boundary_source: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # HARMONISED, APPROXIMATE_BUFFER, USER_DRAWN, USER_UPLOADED
    area_km2: Mapped[float] = mapped_column(Float, nullable=False)
    lgd_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    census2011_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    upload_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    original_crs: Mapped[str | None] = mapped_column(String(64), nullable=True)
    warnings: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

