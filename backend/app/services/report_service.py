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

"""Service layer for Milestone M7: Pre-Flight Audit, Export Generation & SHA-256 Logging."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.auth import User
from app.db.models.export_record import ProjectExportRecord
from app.db.models.ops import AuditEvent
from app.db.models.project import ProjectAoi
from app.domain.reporting.preflight import compute_file_sha256, evaluate_dpr_preflight
from app.schemas.reports import (
    DprSectionStatusItemDto,
    PreFlightCheckItemDto,
    PreFlightReportResponse,
    ProjectExportListResponse,
    ProjectExportRecordDto,
)
from app.services.costing_service import get_project_scenario_comparison
from app.services.excel_export_service import generate_project_boq_xlsx
from app.services.gis_export_service import generate_project_gis_package_zip
from app.services.infrastructure_service import list_project_infrastructure
from app.services.planning_service import get_project_scenarios
from app.services.project_service import get_owned_project_or_404
from app.services.settlement_pdf_service import generate_preliminary_settlement_pdf
from app.services.settlement_service import (
    get_project_settlement_state,
    get_project_verification_ledger,
)


def get_project_preflight_report(
    db: Session,
    project_id: str,
    user: User,
) -> PreFlightReportResponse:
    """Evaluate all pre-flight checks and 24-section readiness for a project."""
    proj = get_owned_project_or_404(db, project_id, user)
    settlements = get_project_settlement_state(db, project_id=proj.id, user=user)
    ledger = get_project_verification_ledger(db, project_id=proj.id, user=user)
    infra = list_project_infrastructure(db, project_id=proj.id, user=user)
    scenarios_state = get_project_scenarios(db, project_id=proj.id, user=user)
    active_scenario = scenarios_state.active_scenario
    comparison = get_project_scenario_comparison(db, project_id=proj.id, user=user)

    aoi_row = db.execute(
        select(ProjectAoi).where(ProjectAoi.project_id == proj.id)
    ).scalar_one_or_none()

    grid_missing_tie_in = [
        cl.cluster_label
        for cl in active_scenario.clusters
        if cl.modality in {"GRID_EXTENSION", "GRID_AUGMENTATION"} and cl.requires_tie_in
    ]

    report = evaluate_dpr_preflight(
        project_id=proj.id,
        project_version=proj.version,
        scenario_key=active_scenario.scenario_key,
        clusters_count=len(settlements.items),
        unset_rate_codes=comparison.unset_item_codes,
        grid_clusters_missing_tie_in=grid_missing_tie_in,
        vdrop_compliance_ok=active_scenario.vdrop_compliance_ok,
        max_ht_vdrop_pct=active_scenario.max_ht_vdrop_pct,
        max_lt_vdrop_pct=active_scenario.max_lt_vdrop_pct,
        verification_coverage_pct=settlements.verification_coverage_pct,
        verified_records_count=len(ledger.records),
        has_existing_infra=infra.has_existing_infra,
        boundary_source=aoi_row.boundary_source if aoi_row else "UNSET",
        census_delta_pct=settlements.census_reconciliation.delta_pct,
        total_capex_inr=comparison.active_scenario_boq.total_capex_inr,
        npc_inr=comparison.active_scenario_boq.economics.npc_inr,
        lcoe_inr_kwh=comparison.active_scenario_boq.economics.lcoe_inr_kwh,
    )

    return PreFlightReportResponse(
        project_id=proj.id,
        project_version=proj.version,
        active_scenario_key=active_scenario.scenario_key,
        can_export=report.can_export,
        hard_blockers_failed=report.hard_blockers_failed,
        soft_warnings_count=report.soft_warnings_count,
        requires_not_field_verified_watermark=report.requires_not_field_verified_watermark,
        watermark_text=report.watermark_text,
        snapshot_hash=report.snapshot_hash,
        checks=[
            PreFlightCheckItemDto(
                check_code=c.check_code,
                title=c.title,
                category=c.category,
                status=c.status,
                detail=c.detail,
                remediation=c.remediation,
            )
            for c in report.checks
        ],
        sections=[
            DprSectionStatusItemDto(
                section_number=s.section_number,
                section_key=s.section_key,
                title=s.title,
                group=s.group,
                is_populated=s.is_populated,
                data_status_note=s.data_status_note,
            )
            for s in report.sections
        ],
    )


def _record_export_artifact(
    db: Session,
    *,
    project_id: str,
    scenario_id: str,
    scenario_key: str,
    export_kind: str,
    filename: str,
    mime_type: str,
    file_bytes: bytes,
    snapshot_hash: str,
    preflight_passed: bool,
    preflight_warnings_count: int,
    user: User,
    notes: str,
) -> ProjectExportRecord:
    file_sha256 = compute_file_sha256(file_bytes)
    rec = ProjectExportRecord(
        project_id=project_id,
        scenario_id=scenario_id,
        scenario_key=scenario_key,
        export_kind=export_kind,
        filename=filename,
        mime_type=mime_type,
        file_size_bytes=len(file_bytes),
        file_sha256=file_sha256,
        snapshot_hash=snapshot_hash,
        preflight_passed=preflight_passed,
        preflight_warnings_count=preflight_warnings_count,
        created_by=user.id,
        notes=notes,
    )
    db.add(rec)
    db.add(
        AuditEvent(
            project_id=project_id,
            actor_id=user.id,
            event_type=f"EXPORT_{export_kind}",
            entity="project_export",
            entity_id=filename,
            diff={
                "export_kind": export_kind,
                "scenario_key": scenario_key,
                "file_sha256": file_sha256,
                "snapshot_hash": snapshot_hash,
                "file_size_bytes": len(file_bytes),
            },
        )
    )
    db.commit()
    db.refresh(rec)
    return rec


def list_project_export_records(
    db: Session,
    project_id: str,
    user: User,
) -> ProjectExportListResponse:
    """Return all logged export records for a project ordered newest first."""
    proj = get_owned_project_or_404(db, project_id, user)
    rows = list(
        db.execute(
            select(ProjectExportRecord)
            .where(ProjectExportRecord.project_id == proj.id)
            .order_by(ProjectExportRecord.created_at.desc())
        )
        .scalars()
        .all()
    )
    items = [
        ProjectExportRecordDto(
            id=r.id,
            project_id=r.project_id,
            scenario_id=r.scenario_id,
            scenario_key=r.scenario_key,
            export_kind=r.export_kind,
            filename=r.filename,
            mime_type=r.mime_type,
            file_size_bytes=r.file_size_bytes,
            file_sha256=r.file_sha256,
            snapshot_hash=r.snapshot_hash,
            preflight_passed=r.preflight_passed,
            preflight_warnings_count=r.preflight_warnings_count,
            created_by=r.created_by,
            notes=r.notes,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return ProjectExportListResponse(
        project_id=proj.id,
        total_exports=len(items),
        items=items,
    )


def export_and_log_dpr_pdf(
    db: Session,
    project_id: str,
    user: User,
) -> tuple[bytes, ProjectExportRecord]:
    """Generate the complete 24-section PDF DPR and log its SHA-256 export record."""
    preflight = get_project_preflight_report(db, project_id, user)
    scenarios_state = get_project_scenarios(db, project_id=project_id, user=user)
    active_scen = scenarios_state.active_scenario
    pdf_bytes = generate_preliminary_settlement_pdf(db, project_id=project_id, user=user)
    filename = f"electrimap_dpr_24sec_{project_id[:8]}_{active_scen.scenario_key.lower()}.pdf"
    rec = _record_export_artifact(
        db,
        project_id=project_id,
        scenario_id=active_scen.id,
        scenario_key=active_scen.scenario_key,
        export_kind="PDF_DPR_24",
        filename=filename,
        mime_type="application/pdf",
        file_bytes=pdf_bytes,
        snapshot_hash=preflight.snapshot_hash,
        preflight_passed=preflight.can_export,
        preflight_warnings_count=preflight.soft_warnings_count,
        user=user,
        notes=f"Complete 24-Section Preliminary DPR ({preflight.watermark_text})",
    )
    return pdf_bytes, rec


def export_and_log_boq_xlsx(
    db: Session,
    project_id: str,
    user: User,
) -> tuple[bytes, ProjectExportRecord]:
    """Generate the formula-driven 5-sheet Excel BOQ workbook and log its SHA-256 record."""
    preflight = get_project_preflight_report(db, project_id, user)
    scenarios_state = get_project_scenarios(db, project_id=project_id, user=user)
    active_scen = scenarios_state.active_scenario
    xlsx_bytes = generate_project_boq_xlsx(db, project_id=project_id, user=user)
    filename = f"electrimap_boq_{project_id[:8]}_{active_scen.scenario_key.lower()}.xlsx"
    rec = _record_export_artifact(
        db,
        project_id=project_id,
        scenario_id=active_scen.id,
        scenario_key=active_scen.scenario_key,
        export_kind="XLSX_BOQ",
        filename=filename,
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        file_bytes=xlsx_bytes,
        snapshot_hash=preflight.snapshot_hash,
        preflight_passed=preflight.can_export,
        preflight_warnings_count=preflight.soft_warnings_count,
        user=user,
        notes="5-Sheet Formula-Driven Excel BOQ & Scenario Workbook",
    )
    return xlsx_bytes, rec


def export_and_log_gis_package(
    db: Session,
    project_id: str,
    user: User,
) -> tuple[bytes, ProjectExportRecord]:
    """Generate the cleaned GIS vector & schedule ZIP package and log its SHA-256 record."""
    preflight = get_project_preflight_report(db, project_id, user)
    scenarios_state = get_project_scenarios(db, project_id=project_id, user=user)
    active_scen = scenarios_state.active_scenario
    zip_bytes = generate_project_gis_package_zip(db, project_id=project_id, user=user)
    filename = f"electrimap_gis_package_{project_id[:8]}_{active_scen.scenario_key.lower()}.zip"
    rec = _record_export_artifact(
        db,
        project_id=project_id,
        scenario_id=active_scen.id,
        scenario_key=active_scen.scenario_key,
        export_kind="GIS_PACKAGE_ZIP",
        filename=filename,
        mime_type="application/zip",
        file_bytes=zip_bytes,
        snapshot_hash=preflight.snapshot_hash,
        preflight_passed=preflight.can_export,
        preflight_warnings_count=preflight.soft_warnings_count,
        user=user,
        notes="Cleaned GIS Vector Package (GeoJSON + Schedule CSV + Provenance Manifest)",
    )
    return zip_bytes, rec
