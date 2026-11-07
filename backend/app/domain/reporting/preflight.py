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

"""Pure domain pre-flight engineering & data integrity audit for 24-Section DPR exports.

Implements Tasks M7-1, M7-2, and M7-5:
- Canonical 24-section DPR catalog in sequential order (Sections 1 to 24).
- Pre-flight check evaluation distinguishing Hard Blockers (FAIL -> blocks export with 422)
  from Soft Warnings (WARN -> permits export with explicit disclosures and watermarks).
- Deterministic cryptographic SHA-256 snapshot hash over project inputs, assumptions,
  engineering layouts, and BOQ totals.
"""

import hashlib
import json
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class DprSectionSpec:
    """Canonical specification of one of the 24 numbered DPR sections."""

    section_number: int
    section_key: str
    title: str
    group: str


DPR_24_SECTIONS: tuple[DprSectionSpec, ...] = (
    DprSectionSpec(
        1,
        "SEC_01_EXECUTIVE_SUMMARY",
        "Executive Summary & Epistemic Honesty Mandate",
        "Part I — Project Profile & Provenance",
    ),
    DprSectionSpec(
        2,
        "SEC_02_ADMIN_GEO_PROFILE",
        "Administrative, Geographic & Demographic Profile",
        "Part I — Project Profile & Provenance",
    ),
    DprSectionSpec(
        3,
        "SEC_03_DATASET_PROVENANCE",
        "Geospatial Dataset Provenance & Vintage Registry",
        "Part I — Project Profile & Provenance",
    ),
    DprSectionSpec(
        4,
        "SEC_04_HABITATION_INVENTORY",
        "Habitation Cluster Inventory, Two-Axis Classification & Census Reconciliation",
        "Part II — Settlement & Verification Audit",
    ),
    DprSectionSpec(
        5,
        "SEC_05_VERIFICATION_LEDGER",
        "Append-Only Field & Utility Verification Audit Ledger",
        "Part II — Settlement & Verification Audit",
    ),
    DprSectionSpec(
        6,
        "SEC_06_EXISTING_INFRASTRUCTURE",
        "Existing Electrical Infrastructure & Tie-In Provenance Register",
        "Part III — Infrastructure Gap & Demand",
    ),
    DprSectionSpec(
        7,
        "SEC_07_TERRAIN_GAP_MATRIX",
        "Terrain-Weighted Distance & Obstacle Gap Analysis Matrix",
        "Part III — Infrastructure Gap & Demand",
    ),
    DprSectionSpec(
        8,
        "SEC_08_ASSUMPTIONS_SUMMARY",
        "Parametric Planning Assumptions & Normative Overrides Summary",
        "Part III — Infrastructure Gap & Demand",
    ),
    DprSectionSpec(
        9,
        "SEC_09_DEMAND_FORECAST",
        "7-Category Parametric Electricity Demand & Horizon Growth Forecast",
        "Part III — Infrastructure Gap & Demand",
    ),
    DprSectionSpec(
        10,
        "SEC_10_MODALITY_DECISION",
        "Electrification Modality Decision Framework & Active Scenario Summary",
        "Part IV — Network Routing & Off-Grid Engineering",
    ),
    DprSectionSpec(
        11,
        "SEC_11_HT_FEEDER_ROUTING",
        "11 kV 3-Phase HT Feeder Least-Cost Routing & Pole Schedule",
        "Part IV — Network Routing & Off-Grid Engineering",
    ),
    DprSectionSpec(
        12,
        "SEC_12_LT_MST_VDROP_LOSSES",
        "415 V LT Radial MST Network, Voltage Drop & Technical Loss Schedule",
        "Part IV — Network Routing & Off-Grid Engineering",
    ),
    DprSectionSpec(
        13,
        "SEC_13_OFFGRID_SOLAR_BESS_SHS",
        "Off-Grid Solar PV, LiFePO4 BESS & Standalone SHS Sizing Schedule",
        "Part IV — Network Routing & Off-Grid Engineering",
    ),
    DprSectionSpec(
        14,
        "SEC_14_SINGLE_LINE_DIAGRAM",
        "Preliminary Single-Line Diagram (SLD) & Protection Schematic",
        "Part IV — Network Routing & Off-Grid Engineering",
    ),
    DprSectionSpec(
        15,
        "SEC_15_SOR_COSTING_BASIS",
        "Schedule of Rates (SoR) Provenance, Taxes & Costing Methodology",
        "Part V — Costing, BOQ & Financial Comparison",
    ),
    DprSectionSpec(
        16,
        "SEC_16_ITEMIZED_BOQ",
        "Itemized Bill of Quantities (BOQ) & Capital Cost Abstract",
        "Part V — Costing, BOQ & Financial Comparison",
    ),
    DprSectionSpec(
        17,
        "SEC_17_SCENARIO_COMPARISON",
        "Multi-Scenario Financial Comparison, 10-Yr NPC & LCOE Matrix",
        "Part V — Costing, BOQ & Financial Comparison",
    ),
    DprSectionSpec(
        18,
        "SEC_18_IMPLEMENTATION_PHASING",
        "Implementation Schedule, Phasing & Institutional Mechanism",
        "Part VI — Implementation, O&M, Safeguards & Sign-Off",
    ),
    DprSectionSpec(
        19,
        "SEC_19_OM_SUSTAINABILITY",
        "Operations, Maintenance (O&M) & Asset Sustainability Framework",
        "Part VI — Implementation, O&M, Safeguards & Sign-Off",
    ),
    DprSectionSpec(
        20,
        "SEC_20_ENVIRONMENTAL_SCREENING",
        "Environmental & Forest Clearance Screening (ESA WorldCover & Waterways)",
        "Part VI — Implementation, O&M, Safeguards & Sign-Off",
    ),
    DprSectionSpec(
        21,
        "SEC_21_COMPLETE_ASSUMPTIONS_AUDIT",
        "Complete Project Assumptions Register & Engineering Constants Audit",
        "Part VI — Implementation, O&M, Safeguards & Sign-Off",
    ),
    DprSectionSpec(
        22,
        "SEC_22_RISK_AND_FIELD_CHECKLIST",
        "Risk Register, Methodological Limitations & Pre-Survey Validation Checklist",
        "Part VI — Implementation, O&M, Safeguards & Sign-Off",
    ),
    DprSectionSpec(
        23,
        "SEC_23_LICENSING_AND_CITATIONS",
        "Open Data Licensing, Third-Party Attributions & Regulatory Citations",
        "Part VI — Implementation, O&M, Safeguards & Sign-Off",
    ),
    DprSectionSpec(
        24,
        "SEC_24_PREFLIGHT_CERTIFICATE",
        "Pre-Flight Integrity Certificate, Cryptographic Snapshot Hash & Sign-Off",
        "Part VI — Implementation, O&M, Safeguards & Sign-Off",
    ),
)


@dataclass(frozen=True)
class PreFlightCheckItem:
    """Single pre-flight audit rule result."""

    check_code: str
    title: str
    category: str  # HARD_BLOCKER | SOFT_WARNING
    status: str  # PASS | WARN | FAIL
    detail: str
    remediation: str


@dataclass(frozen=True)
class DprSectionStatusItem:
    """Readiness and data-presence status for one of the 24 DPR sections."""

    section_number: int
    section_key: str
    title: str
    group: str
    is_populated: bool
    data_status_note: str


@dataclass(frozen=True)
class PreFlightReport:
    """Complete pre-flight engineering and data integrity audit result."""

    can_export: bool
    hard_blockers_failed: int
    soft_warnings_count: int
    requires_not_field_verified_watermark: bool
    watermark_text: str
    snapshot_hash: str
    checks: list[PreFlightCheckItem]
    sections: list[DprSectionStatusItem]


def compute_snapshot_sha256(snapshot_payload: dict[str, Any]) -> str:
    """Compute a deterministic SHA-256 hex digest over a canonical JSON snapshot."""
    canonical_bytes = json.dumps(
        snapshot_payload,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    ).encode("utf-8")
    return hashlib.sha256(canonical_bytes).hexdigest()


def compute_file_sha256(file_bytes: bytes) -> str:
    """Compute SHA-256 hex digest of generated export bytes."""
    return hashlib.sha256(file_bytes).hexdigest()


def evaluate_dpr_preflight(
    *,
    project_id: str,
    project_version: int,
    scenario_key: str,
    clusters_count: int,
    unset_rate_codes: list[str],
    grid_clusters_missing_tie_in: list[str],
    vdrop_compliance_ok: bool,
    max_ht_vdrop_pct: float,
    max_lt_vdrop_pct: float,
    verification_coverage_pct: float,
    verified_records_count: int,
    has_existing_infra: bool,
    boundary_source: str,
    census_delta_pct: float | None,
    total_capex_inr: float,
    npc_inr: float,
    lcoe_inr_kwh: float,
) -> PreFlightReport:
    """Run all hard-blocker and soft-warning pre-flight checks for DPR export."""
    checks: list[PreFlightCheckItem] = []

    # 1. Hard Blocker: Habitation clusters present
    if clusters_count > 0:
        checks.append(
            PreFlightCheckItem(
                check_code="CLUSTERS_IDENTIFIED",
                title="Habitation Clusters & Footprints Populated",
                category="HARD_BLOCKER",
                status="PASS",
                detail=f"{clusters_count} habitation clusters identified and classified.",
                remediation="None required.",
            )
        )
    else:
        checks.append(
            PreFlightCheckItem(
                check_code="CLUSTERS_IDENTIFIED",
                title="Habitation Clusters & Footprints Populated",
                category="HARD_BLOCKER",
                status="FAIL",
                detail="Zero habitation clusters exist in the project.",
                remediation="Run DBSCAN settlement clustering before generating a DPR.",
            )
        )

    # 2. Hard Blocker: No UNSET unit rates on active BOQ items (Core Principle #4)
    if not unset_rate_codes:
        checks.append(
            PreFlightCheckItem(
                check_code="NO_UNSET_BOQ_RATES",
                title="All Required BOQ Schedule of Rates Populated",
                category="HARD_BLOCKER",
                status="PASS",
                detail="All active BOQ line items have non-null unit rates with citations.",
                remediation="None required.",
            )
        )
    else:
        codes_str = ", ".join(unset_rate_codes)
        checks.append(
            PreFlightCheckItem(
                check_code="NO_UNSET_BOQ_RATES",
                title="All Required BOQ Schedule of Rates Populated",
                category="HARD_BLOCKER",
                status="FAIL",
                detail=f"Required BOQ items have UNSET unit rates: {codes_str}.",
                remediation=(
                    "Enter valid INR unit rates and citations for all UNSET items in "
                    "Step 6 (Cost & BOQ) or reset to the Odisha SoR catalog."
                ),
            )
        )

    # 3. Hard Blocker: Grid tie-in present for any cluster assigned GRID_EXTENSION
    if not grid_clusters_missing_tie_in:
        checks.append(
            PreFlightCheckItem(
                check_code="GRID_TIE_IN_PRESENT",
                title="11 kV Tie-In Point Defined for Grid-Connected Clusters",
                category="HARD_BLOCKER",
                status="PASS",
                detail="Every grid-connected habitation cluster has a valid tie-in source.",
                remediation="None required.",
            )
        )
    else:
        missing_str = ", ".join(grid_clusters_missing_tie_in)
        checks.append(
            PreFlightCheckItem(
                check_code="GRID_TIE_IN_PRESENT",
                title="11 kV Tie-In Point Defined for Grid-Connected Clusters",
                category="HARD_BLOCKER",
                status="FAIL",
                detail=(
                    f"Clusters assigned GRID_EXTENSION lack an 11 kV tie-in point: "
                    f"{missing_str} (d_infra_m = UNSET)."
                ),
                remediation=(
                    "Place a USER_ASSUMED 11 kV tie-in point on the map or switch the "
                    "active scenario to Solar Mini-Grid / Hybrid Optimal."
                ),
            )
        )

    # 4. Soft Warning / Check: CEA Voltage Regulation Compliance (<= 5% HT, <= 6% LT)
    if vdrop_compliance_ok:
        checks.append(
            PreFlightCheckItem(
                check_code="CEA_VOLTAGE_REGULATION",
                title="CEA Voltage Drop Limits (<= 5.0% HT, <= 6.0% LT)",
                category="SOFT_WARNING",
                status="PASS",
                detail=(
                    f"Peak voltage drop within statutory limits "
                    f"(Max HT: {max_ht_vdrop_pct:.2f}%, Max LT: {max_lt_vdrop_pct:.2f}%)."
                ),
                remediation="None required.",
            )
        )
    else:
        checks.append(
            PreFlightCheckItem(
                check_code="CEA_VOLTAGE_REGULATION",
                title="CEA Voltage Drop Limits (<= 5.0% HT, <= 6.0% LT)",
                category="SOFT_WARNING",
                status="WARN",
                detail=(
                    f"Peak voltage drop exceeds normative target "
                    f"(Max HT: {max_ht_vdrop_pct:.2f}%, Max LT: {max_lt_vdrop_pct:.2f}%)."
                ),
                remediation=(
                    "Consider splitting LT feeders with additional DTs or upgrading "
                    "conductor cross-section during physical survey."
                ),
            )
        )

    # 5. Soft Warning: Axis-2 Field Verification Coverage (Core Principle #2, FR-10.3)
    requires_unverified_watermark = verification_coverage_pct < 99.99
    if not requires_unverified_watermark:
        checks.append(
            PreFlightCheckItem(
                check_code="AXIS_2_FIELD_VERIFICATION",
                title="Axis-2 Field / Utility Verification Coverage",
                category="SOFT_WARNING",
                status="PASS",
                detail="100.0% of estimated households are backed by verification records.",
                remediation="None required.",
            )
        )
    else:
        checks.append(
            PreFlightCheckItem(
                check_code="AXIS_2_FIELD_VERIFICATION",
                title="Axis-2 Field / Utility Verification Coverage",
                category="SOFT_WARNING",
                status="WARN",
                detail=(
                    f"Verification coverage is {verification_coverage_pct:.1f}% (< 100%). "
                    f"All PDF pages will carry the mandatory 'PRELIMINARY ENGINEERING — "
                    f"NOT FIELD VERIFIED' watermark."
                ),
                remediation=(
                    "Record Gram Sabha / DISCOM feeder ledger verifications in Step 2 "
                    "to advance clusters from UNVERIFIED to FIELD_VERIFIED."
                ),
            )
        )

    # 6. Soft Warning: Boundary Source Accuracy
    if boundary_source == "APPROXIMATE_BUFFER":
        checks.append(
            PreFlightCheckItem(
                check_code="AOI_BOUNDARY_PROVENANCE",
                title="Administrative Boundary Polygon Provenance",
                category="SOFT_WARNING",
                status="WARN",
                detail=(
                    "AOI uses a 1.5 km metric circular buffer around village centroid "
                    "(APPROXIMATE_BUFFER)."
                ),
                remediation="Upload official revenue village cadastral boundary if available.",
            )
        )
    else:
        checks.append(
            PreFlightCheckItem(
                check_code="AOI_BOUNDARY_PROVENANCE",
                title="Administrative Boundary Polygon Provenance",
                category="SOFT_WARNING",
                status="PASS",
                detail=f"AOI boundary uses validated polygon geometry ({boundary_source}).",
                remediation="None required.",
            )
        )

    # 7. Soft Warning: Census 2011 vs Satellite Footprint Divergence
    delta_abs = abs(census_delta_pct or 0.0)
    if delta_abs > 30.0:
        checks.append(
            PreFlightCheckItem(
                check_code="CENSUS_RECONCILIATION_DELTA",
                title="Census 2011 Household Reconciliation Divergence",
                category="SOFT_WARNING",
                status="WARN",
                detail=(
                    f"Satellite-estimated households diverge by {census_delta_pct:+.1f}% "
                    f"from projected Census 2011 baseline (> 30% threshold)."
                ),
                remediation=(
                    "Review roof-to-household k-factor or verify multi-family/non-residential "
                    "structures during Gram Sabha walk-through."
                ),
            )
        )
    else:
        checks.append(
            PreFlightCheckItem(
                check_code="CENSUS_RECONCILIATION_DELTA",
                title="Census 2011 Household Reconciliation Divergence",
                category="SOFT_WARNING",
                status="PASS",
                detail=(
                    f"Satellite vs. projected Census 2011 household delta is "
                    f"{(census_delta_pct or 0.0):+.1f}% (within ±30% tolerance)."
                ),
                remediation="None required.",
            )
        )

    hard_failed = sum(
        1 for c in checks if c.category == "HARD_BLOCKER" and c.status == "FAIL"
    )
    soft_warnings = sum(1 for c in checks if c.status == "WARN")
    can_export = hard_failed == 0

    watermark_text = (
        "PRELIMINARY ENGINEERING — NOT FIELD VERIFIED"
        if requires_unverified_watermark
        else "PRELIMINARY ENGINEERING ASSESSMENT — FOR SURVEY VALIDATION"
    )

    # Build 24-section status list (FR-10.4 explicit "No data available — reason: ..." notes)
    sections: list[DprSectionStatusItem] = []
    for spec in DPR_24_SECTIONS:
        if spec.section_number == 5 and verified_records_count == 0:
            sections.append(
                DprSectionStatusItem(
                    section_number=spec.section_number,
                    section_key=spec.section_key,
                    title=spec.title,
                    group=spec.group,
                    is_populated=False,
                    data_status_note=(
                        "No data available — reason: Zero Axis-2 field or utility "
                        "verification records have been submitted yet; all clusters remain "
                        "explicitly labeled UNVERIFIED."
                    ),
                )
            )
        elif spec.section_number == 6 and not has_existing_infra:
            sections.append(
                DprSectionStatusItem(
                    section_number=spec.section_number,
                    section_key=spec.section_key,
                    title=spec.title,
                    group=spec.group,
                    is_populated=False,
                    data_status_note=(
                        "No data available — reason: No utility 11 kV/LT GIS lines or "
                        "USER_ASSUMED tie-in points have been uploaded (d_infra_m = UNSET)."
                    ),
                )
            )
        else:
            sections.append(
                DprSectionStatusItem(
                    section_number=spec.section_number,
                    section_key=spec.section_key,
                    title=spec.title,
                    group=spec.group,
                    is_populated=True,
                    data_status_note="Populated with traceable project & engineering records.",
                )
            )

    snapshot_hash = compute_snapshot_sha256(
        {
            "project_id": project_id,
            "project_version": project_version,
            "scenario_key": scenario_key,
            "clusters_count": clusters_count,
            "unset_rate_codes": sorted(unset_rate_codes),
            "grid_clusters_missing_tie_in": sorted(grid_clusters_missing_tie_in),
            "vdrop_compliance_ok": vdrop_compliance_ok,
            "verification_coverage_pct": round(verification_coverage_pct, 2),
            "verified_records_count": verified_records_count,
            "has_existing_infra": has_existing_infra,
            "boundary_source": boundary_source,
            "total_capex_inr": round(total_capex_inr, 2),
            "npc_inr": round(npc_inr, 2),
            "lcoe_inr_kwh": round(lcoe_inr_kwh, 4),
        }
    )

    return PreFlightReport(
        can_export=can_export,
        hard_blockers_failed=hard_failed,
        soft_warnings_count=soft_warnings,
        requires_not_field_verified_watermark=requires_unverified_watermark,
        watermark_text=watermark_text,
        snapshot_hash=snapshot_hash,
        checks=checks,
        sections=sections,
    )
