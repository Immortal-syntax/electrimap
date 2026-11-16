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

"""SQLAlchemy ORM models for Milestone M6:
- `ProjectRateItem` (`project_rate_items`): Schedule of Rates (SoR) with UNSET support
- `ScenarioBoqLine` (`scenario_boq_lines`): Traceable BOQ line items per scenario
"""

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ProjectRateItem(Base, TimestampMixin):
    """Per-project Schedule of Rates (SoR) unit rate item with provenance and UNSET support."""

    __tablename__ = "project_rate_items"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    template_key: Mapped[str] = mapped_column(
        String(80), default="ODISHA_OPTCL_TPSODL_REC_2025", nullable=False
    )
    template_name: Mapped[str] = mapped_column(
        String(200),
        default="Odisha OPTCL / TPSODL & MNRE Reference Schedule of Rates (FY 2024-25)",
        nullable=False,
    )
    item_code: Mapped[str] = mapped_column(String(48), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(48), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    rate_inr: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )  # None => UNSET (blocks DPR export)
    source_type: Mapped[str] = mapped_column(
        String(48), default="REFERENCE_PUBLIC_DOCUMENT", nullable=False
    )  # REFERENCE_PUBLIC_DOCUMENT, USER_TEMPLATE, USER_EDITED, UNSET
    citation: Mapped[str] = mapped_column(Text, nullable=False)
    source_year: Mapped[int] = mapped_column(Integer, default=2025, nullable=False)
    is_user_edited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ScenarioBoqLine(Base, TimestampMixin):
    """Traceable Bill of Quantities (BOQ) line item generated for a planning scenario."""

    __tablename__ = "scenario_boq_lines"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    scenario_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("planning_scenarios.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cluster_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("clusters.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    cluster_label: Mapped[str | None] = mapped_column(String(32), nullable=True)
    item_code: Mapped[str] = mapped_column(String(48), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(48), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    quantity_basis: Mapped[str] = mapped_column(Text, nullable=False)
    rate_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    rate_source_type: Mapped[str] = mapped_column(String(48), nullable=False)
    citation: Mapped[str] = mapped_column(Text, nullable=False)
    is_unset: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    amount_inr: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
