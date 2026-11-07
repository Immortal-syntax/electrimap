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

"""API endpoints for Milestone M7: Pre-Flight Audit, 24-Section DPR, Excel BOQ & GIS Package."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.models.auth import User
from app.db.session import get_db
from app.schemas.reports import PreFlightReportResponse, ProjectExportListResponse
from app.services.report_service import (
    export_and_log_boq_xlsx,
    export_and_log_dpr_pdf,
    export_and_log_gis_package,
    get_project_preflight_report,
    list_project_export_records,
)

router = APIRouter(prefix="/api/v1/projects", tags=["Reports & Exports"])


@router.get("/{project_id}/report/preflight", response_model=PreFlightReportResponse)
def get_preflight_endpoint(
    project_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PreFlightReportResponse:
    """Evaluate pre-flight engineering & data integrity audit and 24-section DPR readiness."""
    return get_project_preflight_report(db, project_id, user)


@router.get("/{project_id}/exports", response_model=ProjectExportListResponse)
def list_exports_endpoint(
    project_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectExportListResponse:
    """List logged DPR PDF, Excel BOQ, and GIS Package exports with SHA-256 hashes."""
    return list_project_export_records(db, project_id, user)


@router.get("/{project_id}/exports/dpr-pdf")
def download_dpr_pdf_endpoint(
    project_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """Generate and download the complete 24-section Preliminary DPR PDF and log SHA-256."""
    pdf_bytes, rec = export_and_log_dpr_pdf(db, project_id, user)
    return Response(
        content=pdf_bytes,
        media_type=rec.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{rec.filename}"',
            "X-Export-SHA256": rec.file_sha256,
            "X-Snapshot-SHA256": rec.snapshot_hash,
        },
    )


@router.get("/{project_id}/exports/boq-xlsx")
def download_boq_xlsx_endpoint(
    project_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """Generate and download the formula-driven 5-sheet Excel BOQ workbook and log SHA-256."""
    xlsx_bytes, rec = export_and_log_boq_xlsx(db, project_id, user)
    return Response(
        content=xlsx_bytes,
        media_type=rec.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{rec.filename}"',
            "X-Export-SHA256": rec.file_sha256,
            "X-Snapshot-SHA256": rec.snapshot_hash,
        },
    )


@router.get("/{project_id}/exports/gis-package")
def download_gis_package_endpoint(
    project_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """Generate and download the cleaned GIS vector & schedule ZIP archive and log SHA-256."""
    zip_bytes, rec = export_and_log_gis_package(db, project_id, user)
    return Response(
        content=zip_bytes,
        media_type=rec.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{rec.filename}"',
            "X-Export-SHA256": rec.file_sha256,
            "X-Snapshot-SHA256": rec.snapshot_hash,
        },
    )
