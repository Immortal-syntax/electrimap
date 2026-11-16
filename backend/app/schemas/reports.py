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

"""Pydantic v2 schemas for Milestone M7: Pre-Flight Audit, 24-Section DPR & Export Logs."""

from datetime import datetime

from pydantic import BaseModel


class PreFlightCheckItemDto(BaseModel):
    """Single pre-flight check result (Hard Blocker or Soft Warning)."""

    check_code: str
    title: str
    category: str
    status: str
    detail: str
    remediation: str


class DprSectionStatusItemDto(BaseModel):
    """Status of one of the 24 numbered DPR sections."""

    section_number: int
    section_key: str
    title: str
    group: str
    is_populated: bool
    data_status_note: str


class PreFlightReportResponse(BaseModel):
    """Complete pre-flight engineering and data integrity audit response."""

    project_id: str
    project_version: int
    active_scenario_key: str
    can_export: bool
    hard_blockers_failed: int
    soft_warnings_count: int
    requires_not_field_verified_watermark: bool
    watermark_text: str
    snapshot_hash: str
    checks: list[PreFlightCheckItemDto]
    sections: list[DprSectionStatusItemDto]


class ProjectExportRecordDto(BaseModel):
    """Logged export artifact with SHA-256 hash and snapshot hash."""

    id: str
    project_id: str
    scenario_id: str
    scenario_key: str
    export_kind: str
    filename: str
    mime_type: str
    file_size_bytes: int
    file_sha256: str
    snapshot_hash: str
    preflight_passed: bool
    preflight_warnings_count: int
    created_by: str | None
    notes: str
    created_at: datetime


class ProjectExportListResponse(BaseModel):
    """List of logged export records for a project."""

    project_id: str
    total_exports: int
    items: list[ProjectExportRecordDto]

