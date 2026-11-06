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

"""SQLAlchemy models for Milestone M3: ClusterRun, SettlementCluster,
VerificationRecord (append-only audit ledger), and VerificationImport.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    event,
)
from sqlalchemy.orm import Mapped, Mapper, mapped_column

from app.db.base import Base, TimestampMixin, utc_now
from app.db.types import SpatialGeometry


class ClusterRun(Base, TimestampMixin):
    """Parameter snapshot for a habitation clustering execution on a project."""

    __tablename__ = "cluster_runs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    params: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)


class SettlementCluster(Base, TimestampMixin):
    """Detected habitation cluster or grouped isolated-homestead unit (`clusters` table)."""

    __tablename__ = "clusters"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    cluster_run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cluster_runs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    label: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    geom: Mapped[Any] = mapped_column(
        SpatialGeometry(geometry_type="POLYGON", srid=4326), nullable=False
    )
    centroid: Mapped[Any] = mapped_column(
        SpatialGeometry(geometry_type="POINT", srid=4326), nullable=False
    )
    is_isolated_group: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    n_detected: Mapped[int] = mapped_column(Integer, nullable=False)
    n_residential: Mapped[int] = mapped_column(Integer, nullable=False)
    n_non_residential: Mapped[int] = mapped_column(Integer, nullable=False)
    est_households: Mapped[int] = mapped_column(Integer, nullable=False)
    census_hh_ref: Mapped[int | None] = mapped_column(Integer, nullable=True)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    proxy_class: Mapped[str] = mapped_column(
        String(40), nullable=False
    )  # LIKELY_ELECTRIFIED, POTENTIALLY_UNDERSERVED, POTENTIALLY_UNSERVED, UNKNOWN
    proxy_confidence: Mapped[str] = mapped_column(
        String(16), nullable=False
    )  # LOW, MEDIUM (never HIGH for proxy)
    verification_state: Mapped[str] = mapped_column(
        String(24), default="UNVERIFIED", nullable=False
    )  # UNVERIFIED, FIELD_VERIFIED, UTILITY_VERIFIED
    verified_class: Mapped[str | None] = mapped_column(String(40), nullable=True)
    d_infra_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    d_road_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    slope_mean_deg: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    canopy_share: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)


class VerificationRecord(Base):
    """Append-only verification audit ledger (`verification_records` table).

    Immutable by design: UPDATE and DELETE are blocked by SQLAlchemy mapper events.
    Corrections are recorded via new reversal entries (`reverses_id`).
    """

    __tablename__ = "verification_records"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    target_type: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # CLUSTER, BUILDING, HOUSEHOLD_POINT
    target_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    attribute: Mapped[str] = mapped_column(String(64), nullable=False)
    previous_value: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    new_value: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    evidence_type: Mapped[str] = mapped_column(
        String(40), nullable=False
    )  # FIELD_SURVEY, UTILITY_LEDGER, GRAM_SABHA_RESOLUTION, GEO_TAGGED_PHOTO, REVERSAL
    verifier_name: Mapped[str] = mapped_column(String(160), nullable=False)
    observed_on: Mapped[str] = mapped_column(String(32), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    geom: Mapped[Any | None] = mapped_column(
        SpatialGeometry(geometry_type="POINT", srid=4326), nullable=True
    )
    import_batch_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    reverses_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )


@event.listens_for(VerificationRecord, "before_update")
def _block_verification_update(
    _mapper: Mapper[Any], _connection: Any, _target: VerificationRecord
) -> None:
    raise RuntimeError(
        "VerificationRecord is an immutable append-only ledger; UPDATE is prohibited. "
        "Record a reversal entry instead."
    )


@event.listens_for(VerificationRecord, "before_delete")
def _block_verification_delete(
    _mapper: Mapper[Any], _connection: Any, _target: VerificationRecord
) -> None:
    raise RuntimeError(
        "VerificationRecord is an immutable append-only ledger; DELETE is prohibited."
    )


class VerificationImport(Base):
    """Batch import metadata for field verification CSV uploads."""

    __tablename__ = "verification_imports"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    matched: Mapped[int] = mapped_column(Integer, nullable=False)
    unmatched: Mapped[int] = mapped_column(Integer, nullable=False)
    report: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

