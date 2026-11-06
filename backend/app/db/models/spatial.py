"""Spatial evidence models for Milestone M2: Building, OsmFeature, and SolarResource."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, utc_now
from app.db.types import SpatialGeometry


class Building(Base, TimestampMixin):
    """Detected or manually added building footprint within a project AOI."""

    __tablename__ = "buildings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    dataset_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True
    )
    source_feature_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    geom: Mapped[Any] = mapped_column(
        SpatialGeometry(geometry_type="POLYGON", srid=4326), nullable=False
    )
    centroid: Mapped[Any] = mapped_column(
        SpatialGeometry(geometry_type="POINT", srid=4326), nullable=False
    )
    area_m2: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.85, nullable=False)
    size_class: Mapped[str] = mapped_column(
        String(32), default="RESIDENTIAL", nullable=False
    )  # NOISE, OUTBUILDING, RESIDENTIAL, NON_RESIDENTIAL
    cluster_run_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    cluster_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    is_user_added: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_excluded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class OsmFeature(Base, TimestampMixin):
    """OpenStreetMap road, water body, or community amenity within a project AOI."""

    __tablename__ = "osm_features"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    category: Mapped[str] = mapped_column(
        String(32), index=True, nullable=False
    )  # ROAD, WATER, AMENITY
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tags: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    geom: Mapped[Any] = mapped_column(
        SpatialGeometry(geometry_type="GEOMETRY", srid=4326), nullable=False
    )


class SolarResource(Base, TimestampMixin):
    """NASA POWER monthly solar irradiance (GHI kWh/m^2/day) and 2m temperature (C) profile."""

    __tablename__ = "solar_resource"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    monthly_ghi_kwh_m2_day: Mapped[dict[str, float]] = mapped_column(JSON, nullable=False)
    monthly_t2m_c: Mapped[dict[str, float]] = mapped_column(JSON, nullable=False)
    annual_mean_ghi_kwh_m2_day: Mapped[float] = mapped_column(Float, nullable=False)
    worst_month: Mapped[str] = mapped_column(String(16), nullable=False)
    worst_ghi_kwh_m2_day: Mapped[float] = mapped_column(Float, nullable=False)
    optimal_tilt_deg: Mapped[float] = mapped_column(Float, nullable=False)
    source_dataset_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True
    )
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

