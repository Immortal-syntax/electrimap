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

"""Formula-driven Multi-Sheet Excel (.xlsx) BOQ & Engineering Workbook Generator (Task M7-3).

Generates a 5-sheet openpyxl workbook:
1. Summary
2. Settlements & Demand
3. Engineering & Sizing
4. BOQ & Rates (with live Excel formulas =ROUND(D*F,2) and =SUM(...) matching API/PDF totals)
5. Scenario Comparison
"""

import io
from datetime import UTC, datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models.auth import User
from app.domain.reporting.preflight import compute_snapshot_sha256
from app.services.costing_service import (
    get_project_scenario_comparison,
    list_project_rates,
)
from app.services.infrastructure_service import compute_and_persist_project_demand
from app.services.planning_service import get_project_scenarios
from app.services.project_service import get_owned_project_or_404
from app.services.settlement_service import get_project_settlement_state


def generate_project_boq_xlsx(
    db: Session,
    *,
    project_id: str,
    user: User,
) -> bytes:
    """Generate a formula-driven 5-sheet Excel BOQ workbook for the active scenario."""
    proj = get_owned_project_or_404(db, project_id, user)
    settlements = get_project_settlement_state(db, project_id=proj.id, user=user)
    demand = compute_and_persist_project_demand(db, project_id=proj.id, user=user)
    scenarios_state = get_project_scenarios(db, project_id=proj.id, user=user)
    active_scenario = scenarios_state.active_scenario
    rates_state = list_project_rates(db, project_id=proj.id, user=user)
    comparison = get_project_scenario_comparison(db, project_id=proj.id, user=user)

    if comparison.has_unset_rates:
        raise AppError(
            code="UNSET_RATES_BLOCK_EXPORT",
            message=(
                comparison.export_blocked_reason
                or "Excel BOQ export is blocked because one or more required unit rates are UNSET."
            ),
            status_code=422,
            details={"unset_item_codes": comparison.unset_item_codes},
        )

    grid_missing_tie_in = [
        cl.cluster_label
        for cl in active_scenario.clusters
        if cl.modality in {"GRID_EXTENSION", "GRID_AUGMENTATION"} and cl.requires_tie_in
    ]
    if grid_missing_tie_in:
        raise AppError(
            code="GRID_TIE_IN_MISSING_BLOCK_EXPORT",
            message=(
                f"Excel BOQ export is blocked because grid-selected clusters "
                f"({', '.join(grid_missing_tie_in)}) have no 11 kV tie-in point."
            ),
            status_code=422,
            details={"grid_clusters_missing_tie_in": grid_missing_tie_in},
        )

    active_boq = comparison.active_scenario_boq
    snapshot_hash = compute_snapshot_sha256(
        {
            "project_id": proj.id,
            "project_version": proj.version,
            "scenario_key": active_boq.scenario_key,
            "total_capex_inr": round(active_boq.total_capex_inr, 2),
            "npc_inr": round(active_boq.economics.npc_inr, 2),
        }
    )

    wb = Workbook()
    header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
    sub_fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
    header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    bold_font = Font(name="Calibri", size=10, bold=True, color="0F172A")
    regular_font = Font(name="Calibri", size=10, color="1E293B")
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    # ------------------------------------------------------------------
    # Sheet 1: Summary
    # ------------------------------------------------------------------
    ws_sum = wb.active
    assert ws_sum is not None
    ws_sum.title = "Summary"

    summary_rows: list[list[object]] = [
        ["ELECTRIMAP DPR — PRELIMINARY ENGINEERING & COSTING WORKBOOK", ""],
        ["Watermark Notice", "PRELIMINARY ENGINEERING — NOT FIELD VERIFIED"],
        ["Generated Timestamp (UTC)", datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")],
        ["Project ID", proj.id],
        ["Project Name", proj.name],
        [
            "Target State / District / Block",
            f"{proj.target_state} / {proj.target_district} / {proj.target_block}",
        ],
        ["Target Scheme", proj.scheme],
        ["Metric Computation CRS", f"EPSG:{proj.metric_epsg}"],
        ["Planning Horizon (Years)", proj.horizon_years],
        ["Pinned / Active Scenario", active_boq.scenario_key],
        ["Schedule of Rates Template", rates_state.template_name],
        ["Habitation Clusters Count", len(settlements.items)],
        [
            "Satellite Estimated Households",
            settlements.census_reconciliation.satellite_estimated_households,
        ],
        ["Verification Coverage (%)", round(settlements.verification_coverage_pct, 2)],
        ["Direct Equipment Subtotal (INR)", round(active_boq.base_equipment_inr, 2)],
        ["Terrain Erection Premium (INR)", round(active_boq.terrain_premium_inr, 2)],
        ["GST Amount (INR)", round(active_boq.gst_amount_inr, 2)],
        [
            "Contingency + PMC Overheads (INR)",
            round(active_boq.contingency_amount_inr + active_boq.pmc_overhead_amount_inr, 2),
        ],
        ["Grand Total Capital Outlay (INR)", round(active_boq.total_capex_inr, 2)],
        ["Grand Total Capital Outlay (Lakhs INR)", round(active_boq.total_capex_lakhs, 2)],
        ["Scheme Capital Subsidy Grant (INR)", round(active_boq.economics.capital_subsidy_inr, 2)],
        [
            "Net Utility / Community Outlay (INR)",
            round(active_boq.economics.net_utility_capex_inr, 2),
        ],
        ["10-Year Net Present Cost — NPC (INR)", round(active_boq.economics.npc_inr, 2)],
        ["Levelized Cost of Energy — LCOE (INR/kWh)", round(active_boq.economics.lcoe_inr_kwh, 2)],
        ["Cryptographic Snapshot SHA-256", snapshot_hash],
    ]
    for r_idx, row_vals in enumerate(summary_rows, start=1):
        ws_sum.append(row_vals)
        for c_idx in (1, 2):
            cell = ws_sum.cell(row=r_idx, column=c_idx)
            cell.border = thin_border
            cell.font = bold_font if (r_idx == 1 or c_idx == 1) else regular_font

    # ------------------------------------------------------------------
    # Sheet 2: Settlements & Demand
    # ------------------------------------------------------------------
    ws_dem = wb.create_sheet(title="Settlements & Demand")
    ws_dem.append(
        [
            "Cluster Label",
            "Habitation Name",
            "Detected Footprints",
            "Estimated Households",
            "Axis-1 Proxy Class",
            "Proxy Confidence",
            "Axis-2 Verification State",
            "Mean Slope (deg)",
            "Canopy Share (%)",
        ]
    )
    for col_i in range(1, 10):
        c = ws_dem.cell(row=1, column=col_i)
        c.fill = header_fill
        c.font = header_font

    for cl in settlements.items:
        ws_dem.append(
            [
                cl.label,
                cl.name,
                cl.n_detected,
                cl.est_households,
                cl.proxy_class,
                cl.proxy_confidence,
                cl.verification_state,
                round(cl.slope_mean_deg, 2),
                round(cl.canopy_share * 100.0, 1),
            ]
        )
    cl_end_row = 1 + len(settlements.items)
    ws_dem.append(
        [
            "TOTAL",
            f"{len(settlements.items)} Habitations",
            f"=SUM(C2:C{cl_end_row})",
            f"=SUM(D2:D{cl_end_row})",
            "—",
            "—",
            f"{settlements.verification_coverage_pct:.1f}% Verified",
            "—",
            "—",
        ]
    )

    ws_dem.append([])
    cat_header_row = ws_dem.max_row + 1
    ws_dem.append(
        [
            "Category Key",
            "Consumer Category",
            "Consumer Count",
            "Connected Load (kW)",
            "Demand Factor",
            "Max Demand (kW)",
            "Daily Energy (kWh/day)",
            "Annual Energy (MWh/yr)",
            "Horizon Growth",
        ]
    )
    for col_i in range(1, 10):
        c = ws_dem.cell(row=cat_header_row, column=col_i)
        c.fill = header_fill
        c.font = header_font

    cat_start_row = ws_dem.max_row + 1
    for cat in demand.category_totals:
        ws_dem.append(
            [
                cat.category,
                cat.label,
                cat.consumer_count,
                round(cat.connected_kw, 2),
                round(cat.demand_factor, 2),
                round(cat.max_demand_kw, 2),
                round(cat.energy_kwh_day, 2),
                round(cat.annual_energy_mwh, 3),
                f"+{demand.horizon_years} Yrs",
            ]
        )
    cat_end_row = ws_dem.max_row
    ws_dem.append(
        [
            "TOTAL_DEMAND",
            "Project Sum / Coincident Peak",
            f"=SUM(C{cat_start_row}:C{cat_end_row})",
            f"=SUM(D{cat_start_row}:D{cat_end_row})",
            "—",
            f"=SUM(F{cat_start_row}:F{cat_end_row})",
            f"=SUM(G{cat_start_row}:G{cat_end_row})",
            f"=SUM(H{cat_start_row}:H{cat_end_row})",
            f"Peak Horizon: {demand.peak_kva_horizon:.2f} kVA",
        ]
    )

    # ------------------------------------------------------------------
    # Sheet 3: Engineering & Sizing
    # ------------------------------------------------------------------
    ws_eng = wb.create_sheet(title="Engineering & Sizing")
    ws_eng.append(
        [
            "Cluster Label",
            "Habitation Name",
            "Modality",
            "DT Count",
            "Total DT Rating (kVA)",
            "11 kV HT Length (m)",
            "11 kV HT Poles",
            "415 V LT Length (m)",
            "415 V LT Poles",
            "HT VDrop (%)",
            "LT VDrop (%)",
            "Solar PV (kWp)",
            "LiFePO4 BESS (kWh)",
            "Inverter (kVA)",
            "SHS Kits",
        ]
    )
    for col_i in range(1, 16):
        c = ws_eng.cell(row=1, column=col_i)
        c.fill = header_fill
        c.font = header_font

    for cl_lay in active_scenario.clusters:
        ws_eng.append(
            [
                cl_lay.cluster_label,
                cl_lay.cluster_name,
                cl_lay.modality,
                cl_lay.dt_count,
                round(cl_lay.total_dt_rating_kva, 1),
                round(cl_lay.ht_length_m, 1),
                cl_lay.ht_poles_count,
                round(cl_lay.lt_total_length_m, 1),
                cl_lay.lt_poles_count,
                round(cl_lay.ht_drop_pct, 2),
                round(cl_lay.lt_drop_pct, 2),
                round(cl_lay.solar_pv_kwp, 2),
                round(cl_lay.bess_capacity_kwh, 2),
                round(cl_lay.inverter_kva, 2),
                cl_lay.shs_kits_count,
            ]
        )
    eng_end = 1 + len(active_scenario.clusters)
    ws_eng.append(
        [
            "TOTAL",
            active_scenario.name,
            active_scenario.scenario_key,
            f"=SUM(D2:D{eng_end})",
            f"=SUM(E2:E{eng_end})",
            f"=SUM(F2:F{eng_end})",
            f"=SUM(G2:G{eng_end})",
            f"=SUM(H2:H{eng_end})",
            f"=SUM(I2:I{eng_end})",
            f"=MAX(J2:J{eng_end})",
            f"=MAX(K2:K{eng_end})",
            f"=SUM(L2:L{eng_end})",
            f"=SUM(M2:M{eng_end})",
            f"=SUM(N2:N{eng_end})",
            f"=SUM(O2:O{eng_end})",
        ]
    )

    # ------------------------------------------------------------------
    # Sheet 4: BOQ & Rates (Formula-Driven + Verified Numeric Column)
    # ------------------------------------------------------------------
    ws_boq = wb.create_sheet(title="BOQ & Rates")
    ws_boq.append(
        [
            "Item Code",
            "Description",
            "Category",
            "Quantity",
            "Unit",
            "Unit Rate (INR)",
            "Formula Amount (INR)",
            "Verified Amount (INR)",
            "Rate Source Type",
            "Schedule of Rates Citation",
        ]
    )
    for col_i in range(1, 11):
        c = ws_boq.cell(row=1, column=col_i)
        c.fill = header_fill
        c.font = header_font

    line_start_row = 2
    for idx, ln in enumerate(active_boq.aggregated_lines):
        row_num = line_start_row + idx
        ws_boq.append(
            [
                ln.item_code,
                ln.description,
                ln.category,
                round(ln.quantity, 4),
                ln.unit,
                round(ln.rate_inr or 0.0, 2),
                f"=ROUND(D{row_num}*F{row_num},2)",
                round(ln.amount_inr, 2),
                ln.rate_source_type,
                ln.citation,
            ]
        )

    line_end_row = line_start_row + len(active_boq.aggregated_lines) - 1
    sub_a_row = line_end_row + 1
    sub_b_row = sub_a_row + 1
    sub_c_row = sub_b_row + 1
    sub_d_row = sub_c_row + 1
    grand_row = sub_d_row + 1

    gst_fraction = round(active_boq.gst_pct / 100.0, 6)
    overhead_fraction = round(
        (active_boq.contingency_pct + active_boq.pmc_overhead_pct) / 100.0, 6
    )

    ws_boq.append(
        [
            "SUB-A",
            "Direct Equipment & Line Supply Subtotal",
            "SUBTOTAL",
            1.0,
            "INR",
            round(active_boq.base_equipment_inr, 2),
            f"=ROUND(SUM(G{line_start_row}:G{line_end_row}),2)",
            round(active_boq.base_equipment_inr, 2),
            "COMPUTED_FORMULA",
            "Sum of BOQ Equipment & Material Lines",
        ]
    )
    ws_boq.append(
        [
            "SUB-B",
            "Difficult Hilly/Forest Terrain Erection Premium",
            "SUBTOTAL",
            1.0,
            "INR",
            round(active_boq.terrain_premium_inr, 2),
            f"=ROUND(D{sub_b_row}*F{sub_b_row},2)",
            round(active_boq.terrain_premium_inr, 2),
            "COMPUTED_TERRAIN",
            "REC Hilly/Canopy/River Crossing Erection Multiplier",
        ]
    )
    ws_boq.append(
        [
            "SUB-C",
            f"Goods & Services Tax (GST @ {active_boq.gst_pct:.1f}%)",
            "TAX",
            gst_fraction,
            "INR",
            round(active_boq.base_equipment_inr + active_boq.terrain_premium_inr, 2),
            f"=ROUND((G{sub_a_row}+G{sub_b_row})*{gst_fraction},2)",
            round(active_boq.gst_amount_inr, 2),
            "STATUTORY_GST",
            "Composite EPC Turnkey GST Rate",
        ]
    )
    ws_boq.append(
        [
            "SUB-D",
            (
                f"Contingency ({active_boq.contingency_pct:.1f}%) + "
                f"PMC Overheads ({active_boq.pmc_overhead_pct:.1f}%)"
            ),
            "OVERHEAD",
            overhead_fraction,
            "INR",
            round(active_boq.base_equipment_inr + active_boq.terrain_premium_inr, 2),
            f"=ROUND((G{sub_a_row}+G{sub_b_row})*{overhead_fraction},2)",
            round(
                active_boq.contingency_amount_inr + active_boq.pmc_overhead_amount_inr,
                2,
            ),
            "NORMATIVE_OVERHEAD",
            "REC / DDUGJY / DA-JGUA Normative Contingency & PMC Allowance",
        ]
    )
    ws_boq.append(
        [
            "GRAND_TOTAL",
            f"GRAND TOTAL CAPITAL OUTLAY (INR {active_boq.total_capex_lakhs:.2f} Lakhs)",
            "TOTAL_CAPEX",
            1.0,
            "INR",
            round(active_boq.total_capex_inr, 2),
            f"=ROUND(SUM(G{sub_a_row}:G{sub_d_row}),2)",
            round(active_boq.total_capex_inr, 2),
            "VERIFIED_RECONCILED_TOTAL",
            f"Matches API & 24-Section PDF DPR Total (INR {active_boq.total_capex_inr:,.2f})",
        ]
    )

    for r_num in range(sub_a_row, grand_row + 1):
        for col_i in range(1, 11):
            c = ws_boq.cell(row=r_num, column=col_i)
            c.fill = sub_fill
            c.font = bold_font
            c.border = thin_border

    # ------------------------------------------------------------------
    # Sheet 5: Scenario Comparison
    # ------------------------------------------------------------------
    ws_comp = wb.create_sheet(title="Scenario Comparison")
    ws_comp.append(
        [
            "Scenario Key",
            "Scenario Name",
            "Pinned Baseline",
            "Total CAPEX (INR)",
            "Total CAPEX (Lakhs)",
            "Scheme Grant (INR)",
            "Net Utility Outlay (INR)",
            "10-Yr NPC (INR)",
            "LCOE (INR/kWh)",
            "Cost per HH (INR)",
            "Avoided CO2 (tCO2/yr)",
        ]
    )
    for col_i in range(1, 12):
        c = ws_comp.cell(row=1, column=col_i)
        c.fill = header_fill
        c.font = header_font

    for sc in comparison.scenarios:
        ws_comp.append(
            [
                sc.scenario_key,
                sc.scenario_name,
                "YES" if sc.is_active_baseline else "NO",
                round(sc.total_capex_inr, 2),
                round(sc.total_capex_lakhs, 2),
                round(sc.capital_subsidy_inr, 2),
                round(sc.net_utility_capex_inr, 2),
                round(sc.npc_inr, 2),
                round(sc.lcoe_inr_kwh, 2),
                round(sc.cost_per_household_inr, 2),
                round(sc.avoided_co2_tonnes_yr, 2),
            ]
        )

    ws_comp.append([])
    hab_hdr_row = ws_comp.max_row + 1
    ws_comp.append(
        [
            "Cluster Label",
            "Habitation Name",
            "Estimated HH",
            "Active Modality",
            "Grid CAPEX (INR)",
            "Grid 10-Yr NPC (INR)",
            "Mini-Grid CAPEX (INR)",
            "Mini-Grid 10-Yr NPC (INR)",
            "SHS CAPEX (INR)",
            "SHS 10-Yr NPC (INR)",
            "Least-Cost NPC Modality",
        ]
    )
    for col_i in range(1, 12):
        c = ws_comp.cell(row=hab_hdr_row, column=col_i)
        c.fill = header_fill
        c.font = header_font

    for h in comparison.habitation_comparisons:
        ws_comp.append(
            [
                h.cluster_label,
                h.cluster_name,
                h.est_households,
                h.active_modality,
                round(h.grid_capex_inr, 2),
                round(h.grid_npc_inr, 2),
                round(h.minigrid_capex_inr, 2),
                round(h.minigrid_npc_inr, 2),
                round(h.shs_capex_inr, 2),
                round(h.shs_npc_inr, 2),
                h.least_cost_npc_modality,
            ]
        )

    # Auto-adjust column widths across all 5 worksheets
    for sheet in wb.worksheets:
        for col_idx in range(1, sheet.max_column + 1):
            col_letter = get_column_letter(col_idx)
            max_len = 12
            for row_idx in range(1, sheet.max_row + 1):
                val = sheet.cell(row=row_idx, column=col_idx).value
                if val is not None:
                    s_val = str(val)
                    if not s_val.startswith("="):
                        max_len = max(max_len, min(46, len(s_val) + 3))
            sheet.column_dimensions[col_letter].width = max_len
            for row_idx in range(1, sheet.max_row + 1):
                cell = sheet.cell(row=row_idx, column=col_idx)
                if cell.alignment == Alignment():
                    cell.alignment = Alignment(vertical="center")

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
