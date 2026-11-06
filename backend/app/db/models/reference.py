"""Reference tables: Dataset provenance registry and EngineeringConstants."""

import uuid

from sqlalchemy import Boolean, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Dataset(Base, TimestampMixin):
    """Provenance registry record for an external or reference dataset (F-16)."""

    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    provider: Mapped[str] = mapped_column(String(200), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    licence: Mapped[str] = mapped_column(String(120), nullable=False)
    licence_url: Mapped[str] = mapped_column(String(500), nullable=True)
    attribution_text: Mapped[str] = mapped_column(Text, nullable=False)
    spatial_resolution: Mapped[str] = mapped_column(String(80), nullable=False)
    temporal_coverage: Mapped[str] = mapped_column(String(80), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    is_non_commercial: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class EngineeringConstant(Base, TimestampMixin):
    """Editable reference engineering constant with explicit citation and verification status."""

    __tablename__ = "engineering_constants"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    citation: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), default="PROVISIONAL", nullable=False
    )  # PROVISIONAL or SOURCE_VERIFIED
    updated_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
