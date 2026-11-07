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

"""ORM model for Milestone M7: Project DPR, Excel BOQ, and GIS Package Export Audit Log."""

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ProjectExportRecord(Base, TimestampMixin):
    """Append-only record of generated DPR PDF, Excel BOQ, and GIS ZIP exports with SHA-256."""

    __tablename__ = "project_exports"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    scenario_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    scenario_key: Mapped[str] = mapped_column(String(48), nullable=False)
    export_kind: Mapped[str] = mapped_column(
        String(32), index=True, nullable=False
    )  # PDF_DPR_24 | XLSX_BOQ | GIS_PACKAGE_ZIP
    filename: Mapped[str] = mapped_column(String(160), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(96), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    file_sha256: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    snapshot_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    preflight_passed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    preflight_warnings_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

