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

"""Automated Bill of Quantities (BOQ) Generator & Multi-Option Cost Engine (Task M6-2).

Generates traceable BOQ line items from M5 engineering layout quantities and Schedule of Rates
(SoR) items. Enforces Core Principle #4:
- Never invents missing unit rates; any required item with `rate_inr is None` is flagged as
  `UNSET` and sets `has_unset_rates = True` to block DPR export.
"""

import math
from dataclasses import dataclass

from app.domain.costing.rates import RateItemSpec
from app.domain.engineering.economics import (
    EconomicParameters,
    LifecycleEconomicResult,
    evaluate_lifecycle_economics,
)

CONDUCTOR_SAG_WASTAGE_FACTOR = 1.03  # 3% sag & jumper allowance per REC construction standard


@dataclass(frozen=True)
class ClusterBoqInput:
    """Engineering layout and terrain quantities for a single habitation cluster."""

    cluster_id: str
    cluster_label: str
    cluster_name: str
    modality: str  # GRID_EXTENSION, SOLAR_MINIGRID, STANDALONE_SHS, GRID_AUGMENTATION
    est_households: int
    slope_mean_deg: float
    forest_crossings: int
    water_crossings: int
    ht_length_m: float
    ht_poles_count: int
    dt_ratings_kva: list[int]  # e.g. [63] or [63, 25]
    lt_3ph_length_m: float
    lt_1ph_length_m: float
    lt_poles_count: int
    solar_pv_kwp: float
    bess_capacity_kwh: float
    inverter_kva: float
    shs_kits_count: int
    annual_energy_mwh_horizon: float
    total_loss_mwh_yr: float


@dataclass(frozen=True)
class BoqLineResult:
    """Single computed Bill of Quantities (BOQ) line item with rate provenance."""

    cluster_id: str | None
    cluster_label: str | None
    item_code: str
    description: str
    category: str
    unit: str
    quantity: float
    quantity_basis: str
    rate_inr: float | None
    rate_source_type: str
    citation: str
    is_unset: bool
    amount_inr: float


@dataclass(frozen=True)
class ClusterCostBreakdown:
    """Complete cost and life-cycle economic summary for a single habitation cluster."""

    cluster_id: str
    cluster_label: str
    cluster_name: str
    modality: str
    est_households: int
    terrain_multiplier: float
    terrain_classification: str
    lines: list[BoqLineResult]
    base_equipment_inr: float
    terrain_premium_inr: float
    subtotal_supply_erection_inr: float
    gst_amount_inr: float
    contingency_amount_inr: float
    pmc_overhead_amount_inr: float
    total_capex_inr: float
    total_capex_lakhs: float
    bess_or_shs_battery_capex_inr: float
    has_unset_rates: bool
    unset_item_codes: list[str]
    economics: LifecycleEconomicResult


@dataclass(frozen=True)
class ScenarioBoqSummary:
    """Aggregated scenario-level BOQ lines, cost abstract, and life-cycle economics."""

    aggregated_lines: list[BoqLineResult]
    cluster_breakdowns: list[ClusterCostBreakdown]
    base_equipment_inr: float
    terrain_premium_inr: float
    subtotal_supply_erection_inr: float
    gst_pct: float
    gst_amount_inr: float
    contingency_pct: float
    contingency_amount_inr: float
    pmc_overhead_pct: float
    pmc_overhead_amount_inr: float
    total_capex_inr: float
    total_capex_lakhs: float
    has_unset_rates: bool
    unset_item_codes: list[str]
    export_blocked_reason: str | None
    economics: LifecycleEconomicResult


def compute_terrain_difficulty_multiplier(
    slope_mean_deg: float,
    forest_crossings: int,
    water_crossings: int,
) -> tuple[float, str]:
    """Compute REC/RDSS terrain erection difficulty multiplier from slope and obstacles."""
    if slope_mean_deg > 15.0 or (forest_crossings >= 1 and slope_mean_deg > 10.0):
        return (1.25, "Steep Hilly / Dense Forest Terrain (1.25x Erection Factor)")
    if slope_mean_deg > 8.0 or forest_crossings >= 1 or water_crossings >= 1:
        return (1.12, "Rolling Hilly / Riverine Terrain (1.12x Erection Factor)")
    return (1.00, "Plain / Accessible Terrain (1.00x Base Factor)")


def _dt_rating_to_item_code(rating_kva: int) -> str:
    if rating_kva <= 16:
        return "DT-11-04-16KVA"
    if rating_kva <= 25:
        return "DT-11-04-25KVA"
    if rating_kva <= 63:
        return "DT-11-04-63KVA"
    if rating_kva <= 100:
        return "DT-11-04-100KVA"
    return "DT-11-04-200KVA"


def _make_boq_line(
    *,
    cluster_id: str | None,
    cluster_label: str | None,
    item_code: str,
    quantity: float,
    quantity_basis: str,
    rates_map: dict[str, RateItemSpec],
) -> BoqLineResult:
    spec = rates_map.get(item_code)
    if spec is None:
        return BoqLineResult(
            cluster_id=cluster_id,
            cluster_label=cluster_label,
            item_code=item_code,
            description=f"Missing Schedule of Rates Entry ({item_code})",
            category="CIVIL_EARTHING",
            unit="Unit",
            quantity=round(quantity, 3),
            quantity_basis=quantity_basis,
            rate_inr=None,
            rate_source_type="UNSET",
            citation="Missing from active Schedule of Rates",
            is_unset=True,
            amount_inr=0.0,
        )

    is_unset = spec.rate_inr is None or spec.source_type == "UNSET"
    qty_rounded = round(quantity, 3)
    amount_inr = 0.0 if spec.rate_inr is None else round(qty_rounded * spec.rate_inr, 2)

    return BoqLineResult(
        cluster_id=cluster_id,
        cluster_label=cluster_label,
        item_code=spec.item_code,
        description=spec.description,
        category=spec.category,
        unit=spec.unit,
        quantity=qty_rounded,
        quantity_basis=quantity_basis,
        rate_inr=spec.rate_inr,
        rate_source_type="UNSET" if is_unset else spec.source_type,
        citation=spec.citation,
        is_unset=is_unset,
        amount_inr=amount_inr,
    )


def compute_cluster_boq(
    cluster: ClusterBoqInput,
    rates_map: dict[str, RateItemSpec],
    econ_params: EconomicParameters,
) -> ClusterCostBreakdown:
    """Generate itemized BOQ lines and life-cycle costs for a single habitation cluster."""
    lines: list[BoqLineResult] = []
    bess_or_shs_battery_capex_inr = 0.0

    # 1. 11 kV HT Feeder lines and poles (if HT route length > 0)
    if cluster.ht_length_m > 0.0:
        ht_km = (cluster.ht_length_m / 1000.0) * CONDUCTOR_SAG_WASTAGE_FACTOR
        lines.append(
            _make_boq_line(
                cluster_id=cluster.cluster_id,
                cluster_label=cluster.cluster_label,
                item_code="HT-COND-ACSR-50",
                quantity=ht_km,
                quantity_basis=(
                    f"{cluster.ht_length_m:.1f} m route length x 1.03 sag allowance"
                ),
                rates_map=rates_map,
            )
        )
    if cluster.ht_poles_count > 0:
        lines.append(
            _make_boq_line(
                cluster_id=cluster.cluster_id,
                cluster_label=cluster.cluster_label,
                item_code="HT-POLE-PSC-9M",
                quantity=float(cluster.ht_poles_count),
                quantity_basis=f"{cluster.ht_poles_count} nos. 9 m PSC supports along 11 kV route",
                rates_map=rates_map,
            )
        )

    # 2. Distribution Transformer Substation(s)
    if cluster.dt_ratings_kva and cluster.modality in {"GRID_EXTENSION", "GRID_AUGMENTATION"}:
        counts_by_code: dict[str, tuple[int, int]] = {}
        for r_kva in cluster.dt_ratings_kva:
            code = _dt_rating_to_item_code(r_kva)
            prev_cnt, _ = counts_by_code.get(code, (0, r_kva))
            counts_by_code[code] = (prev_cnt + 1, r_kva)

        for code, (cnt, r_kva) in sorted(counts_by_code.items()):
            lines.append(
                _make_boq_line(
                    cluster_id=cluster.cluster_id,
                    cluster_label=cluster.cluster_label,
                    item_code=code,
                    quantity=float(cnt),
                    quantity_basis=f"{cnt} x {r_kva} kVA IS-1180 Level-2 DT substation",
                    rates_map=rates_map,
                )
            )
        lines.append(
            _make_boq_line(
                cluster_id=cluster.cluster_id,
                cluster_label=cluster.cluster_label,
                item_code="DT-PROT-HG-AB",
                quantity=float(len(cluster.dt_ratings_kva)),
                quantity_basis=(
                    f"11 kV AB switch, HG fuse & LA protection set for "
                    f"{len(cluster.dt_ratings_kva)} DT(s)"
                ),
                rates_map=rates_map,
            )
        )

    # 3. 415 V / 240 V LT Aerial Bunched Cable Network & 8 m PSC Poles
    if cluster.lt_3ph_length_m > 0.0:
        lt_3ph_km = (cluster.lt_3ph_length_m / 1000.0) * CONDUCTOR_SAG_WASTAGE_FACTOR
        lines.append(
            _make_boq_line(
                cluster_id=cluster.cluster_id,
                cluster_label=cluster.cluster_label,
                item_code="LT-COND-AB-3PH",
                quantity=lt_3ph_km,
                quantity_basis=(
                    f"{cluster.lt_3ph_length_m:.1f} m 3-phase trunk x 1.03 sag allowance"
                ),
                rates_map=rates_map,
            )
        )
    if cluster.lt_1ph_length_m > 0.0:
        lt_1ph_km = (cluster.lt_1ph_length_m / 1000.0) * CONDUCTOR_SAG_WASTAGE_FACTOR
        lines.append(
            _make_boq_line(
                cluster_id=cluster.cluster_id,
                cluster_label=cluster.cluster_label,
                item_code="LT-COND-AB-1PH",
                quantity=lt_1ph_km,
                quantity_basis=(
                    f"{cluster.lt_1ph_length_m:.1f} m 1-phase lateral x 1.03 sag allowance"
                ),
                rates_map=rates_map,
            )
        )
    if cluster.lt_poles_count > 0:
        lines.append(
            _make_boq_line(
                cluster_id=cluster.cluster_id,
                cluster_label=cluster.cluster_label,
                item_code="LT-POLE-PSC-8M",
                quantity=float(cluster.lt_poles_count),
                quantity_basis=f"{cluster.lt_poles_count} nos. 8 m PSC poles @ 45 m span",
                rates_map=rates_map,
            )
        )

    # 4. Household Service Connections (for Grid Extension, Solar Mini-Grid, or Augmentation)
    if cluster.modality in {"GRID_EXTENSION", "SOLAR_MINIGRID", "GRID_AUGMENTATION"}:
        conn_hh = (
            max(1, round(cluster.est_households * 0.35))
            if cluster.modality == "GRID_AUGMENTATION"
            else max(1, cluster.est_households)
        )
        basis_note = (
            f"35% unserved/underserved infill of {cluster.est_households} households"
            if cluster.modality == "GRID_AUGMENTATION"
            else f"100% last-mile service connections for {conn_hh} households"
        )
        lines.append(
            _make_boq_line(
                cluster_id=cluster.cluster_id,
                cluster_label=cluster.cluster_label,
                item_code="SVC-CONN-BPL-1PH",
                quantity=float(conn_hh),
                quantity_basis=basis_note,
                rates_map=rates_map,
            )
        )

    # 5. Solar Mini-Grid Generation Assets
    if cluster.modality == "SOLAR_MINIGRID":
        if cluster.solar_pv_kwp > 0.0:
            lines.append(
                _make_boq_line(
                    cluster_id=cluster.cluster_id,
                    cluster_label=cluster.cluster_label,
                    item_code="MG-SOLAR-PV-KW",
                    quantity=cluster.solar_pv_kwp,
                    quantity_basis=f"{cluster.solar_pv_kwp:.2f} kWp Mono-PERC array",
                    rates_map=rates_map,
                )
            )
        if cluster.bess_capacity_kwh > 0.0:
            bess_line = _make_boq_line(
                cluster_id=cluster.cluster_id,
                cluster_label=cluster.cluster_label,
                item_code="MG-BESS-LFP-KWH",
                quantity=cluster.bess_capacity_kwh,
                quantity_basis=f"{cluster.bess_capacity_kwh:.2f} kWh LiFePO4 BESS bank",
                rates_map=rates_map,
            )
            lines.append(bess_line)
            bess_or_shs_battery_capex_inr += bess_line.amount_inr
        if cluster.inverter_kva > 0.0:
            lines.append(
                _make_boq_line(
                    cluster_id=cluster.cluster_id,
                    cluster_label=cluster.cluster_label,
                    item_code="MG-PCU-INV-KVA",
                    quantity=cluster.inverter_kva,
                    quantity_basis=f"{cluster.inverter_kva:.2f} kVA hybrid grid-forming PCU",
                    rates_map=rates_map,
                )
            )
        lines.append(
            _make_boq_line(
                cluster_id=cluster.cluster_id,
                cluster_label=cluster.cluster_label,
                item_code="MG-CIV-CTRL-ROOM",
                quantity=1.0,
                quantity_basis="1 mini-grid control room, fencing & array water system",
                rates_map=rates_map,
            )
        )

    # 6. Standalone Solar Home Systems (SHS)
    if cluster.modality == "STANDALONE_SHS" and cluster.shs_kits_count > 0:
        shs_line = _make_boq_line(
            cluster_id=cluster.cluster_id,
            cluster_label=cluster.cluster_label,
            item_code="SHS-KIT-200WP",
            quantity=float(cluster.shs_kits_count),
            quantity_basis=f"{cluster.shs_kits_count} households x 1 SHS kit (200 Wp + LiFePO4)",
            rates_map=rates_map,
        )
        lines.append(shs_line)
        # ~32% of SHS kit cost is the LiFePO4 battery pack for replacement modelling
        bess_or_shs_battery_capex_inr += round(shs_line.amount_inr * 0.32, 2)

    # 7. GI Pipe Earthing Sets (2 per DT + 1 per 3 poles)
    total_poles = cluster.ht_poles_count + cluster.lt_poles_count
    dt_earthing = 2 * len(cluster.dt_ratings_kva)
    pole_earthing = math.ceil(total_poles / 3.0) if total_poles > 0 else 0
    earthing_sets = dt_earthing + pole_earthing + (2 if cluster.modality == "SOLAR_MINIGRID" else 0)
    if earthing_sets > 0:
        lines.append(
            _make_boq_line(
                cluster_id=cluster.cluster_id,
                cluster_label=cluster.cluster_label,
                item_code="CIV-EARTH-PIPE",
                quantity=float(earthing_sets),
                quantity_basis=(
                    f"{dt_earthing} DT earthing + {pole_earthing} line pole earthing sets (IS 3043)"
                ),
                rates_map=rates_map,
            )
        )

    unset_codes = sorted({ln.item_code for ln in lines if ln.is_unset})
    has_unset = len(unset_codes) > 0

    base_equipment_inr = round(sum(ln.amount_inr for ln in lines), 2)
    terrain_mult, terrain_label = compute_terrain_difficulty_multiplier(
        cluster.slope_mean_deg, cluster.forest_crossings, cluster.water_crossings
    )
    terrain_premium_inr = round(base_equipment_inr * (terrain_mult - 1.0), 2)
    subtotal_inr = round(base_equipment_inr + terrain_premium_inr, 2)

    gst_inr = round(subtotal_inr * (econ_params.gst_pct / 100.0), 2)
    contingency_inr = round(subtotal_inr * (econ_params.contingency_pct / 100.0), 2)
    pmc_inr = round(subtotal_inr * (econ_params.pmc_overhead_pct / 100.0), 2)
    total_capex_inr = round(subtotal_inr + gst_inr + contingency_inr + pmc_inr, 2)

    econ_result = evaluate_lifecycle_economics(
        modality=cluster.modality,
        capex_inr=total_capex_inr,
        bess_or_shs_battery_capex_inr=bess_or_shs_battery_capex_inr,
        est_households=cluster.est_households,
        annual_delivered_energy_mwh=cluster.annual_energy_mwh_horizon,
        annual_technical_loss_mwh=cluster.total_loss_mwh_yr,
        params=econ_params,
    )

    return ClusterCostBreakdown(
        cluster_id=cluster.cluster_id,
        cluster_label=cluster.cluster_label,
        cluster_name=cluster.cluster_name,
        modality=cluster.modality,
        est_households=cluster.est_households,
        terrain_multiplier=terrain_mult,
        terrain_classification=terrain_label,
        lines=lines,
        base_equipment_inr=base_equipment_inr,
        terrain_premium_inr=terrain_premium_inr,
        subtotal_supply_erection_inr=subtotal_inr,
        gst_amount_inr=gst_inr,
        contingency_amount_inr=contingency_inr,
        pmc_overhead_amount_inr=pmc_inr,
        total_capex_inr=total_capex_inr,
        total_capex_lakhs=round(total_capex_inr / 100000.0, 2),
        bess_or_shs_battery_capex_inr=bess_or_shs_battery_capex_inr,
        has_unset_rates=has_unset,
        unset_item_codes=unset_codes,
        economics=econ_result,
    )


def compute_scenario_boq(
    *,
    scenario_key: str,
    clusters: list[ClusterBoqInput],
    rates_map: dict[str, RateItemSpec],
    econ_params: EconomicParameters,
) -> ScenarioBoqSummary:
    """Aggregate cluster-level BOQ breakdowns into a project-wide scenario BOQ and cost abstract."""
    cluster_breakdowns = [
        compute_cluster_boq(cl, rates_map, econ_params) for cl in clusters
    ]

    # Aggregate line items by item_code across all clusters
    grouped_qty: dict[str, float] = {}
    grouped_clusters: dict[str, list[str]] = {}
    for cb in cluster_breakdowns:
        for ln in cb.lines:
            grouped_qty[ln.item_code] = grouped_qty.get(ln.item_code, 0.0) + ln.quantity
            if cb.cluster_label:
                grouped_clusters.setdefault(ln.item_code, []).append(cb.cluster_label)

    # Preserve standard item ordering first, then any custom items
    ordered_codes = [
        code for code in rates_map if code in grouped_qty
    ] + [code for code in sorted(grouped_qty) if code not in rates_map]

    aggregated_lines: list[BoqLineResult] = []
    for code in ordered_codes:
        qty = grouped_qty[code]
        cl_labels = sorted(set(grouped_clusters.get(code, [])))
        basis = f"Aggregated across {', '.join(cl_labels)}" if cl_labels else "Scenario total"
        aggregated_lines.append(
            _make_boq_line(
                cluster_id=None,
                cluster_label="ALL",
                item_code=code,
                quantity=qty,
                quantity_basis=basis,
                rates_map=rates_map,
            )
        )

    base_equipment_inr = round(
        sum(cb.base_equipment_inr for cb in cluster_breakdowns), 2
    )
    terrain_premium_inr = round(
        sum(cb.terrain_premium_inr for cb in cluster_breakdowns), 2
    )
    subtotal_inr = round(base_equipment_inr + terrain_premium_inr, 2)
    gst_inr = round(sum(cb.gst_amount_inr for cb in cluster_breakdowns), 2)
    contingency_inr = round(
        sum(cb.contingency_amount_inr for cb in cluster_breakdowns), 2
    )
    pmc_inr = round(sum(cb.pmc_overhead_amount_inr for cb in cluster_breakdowns), 2)
    total_capex_inr = round(sum(cb.total_capex_inr for cb in cluster_breakdowns), 2)

    unset_codes = sorted(
        {code for cb in cluster_breakdowns for code in cb.unset_item_codes}
    )
    has_unset = len(unset_codes) > 0
    export_blocked_reason = (
        f"DPR export is blocked because {len(unset_codes)} required Schedule of Rates item(s) "
        f"are UNSET: {', '.join(unset_codes)}. Enter verified unit rates or import a complete "
        "rate schedule before exporting."
        if has_unset
        else None
    )

    total_hh = sum(cb.est_households for cb in cluster_breakdowns)
    total_energy_mwh = sum(c.annual_energy_mwh_horizon for c in clusters)
    total_loss_mwh = sum(c.total_loss_mwh_yr for c in clusters)
    total_bess_capex = sum(cb.bess_or_shs_battery_capex_inr for cb in cluster_breakdowns)

    # Sum cluster-level lifecycle costs so hybrid scenarios preserve modality-specific O&M/tariffs
    pv_om_total = round(sum(cb.economics.pv_om_inr for cb in cluster_breakdowns), 2)
    pv_energy_total = round(
        sum(cb.economics.pv_energy_purchase_inr for cb in cluster_breakdowns), 2
    )
    pv_rep_total = round(
        sum(cb.economics.pv_battery_replacement_inr for cb in cluster_breakdowns), 2
    )
    annual_om_total = round(
        sum(cb.economics.annual_om_inr for cb in cluster_breakdowns), 2
    )
    annual_energy_cost_total = round(
        sum(cb.economics.annual_energy_purchase_inr for cb in cluster_breakdowns), 2
    )
    npc_total = round(
        total_capex_inr + pv_om_total + pv_energy_total + pv_rep_total, 2
    )
    avoided_co2_total = round(
        sum(cb.economics.avoided_co2_tonnes_yr for cb in cluster_breakdowns), 2
    )

    base_econ = evaluate_lifecycle_economics(
        modality=scenario_key,
        capex_inr=total_capex_inr,
        bess_or_shs_battery_capex_inr=total_bess_capex,
        est_households=max(1, total_hh),
        annual_delivered_energy_mwh=total_energy_mwh,
        annual_technical_loss_mwh=total_loss_mwh,
        params=econ_params,
    )

    scenario_econ = LifecycleEconomicResult(
        modality=scenario_key,
        capex_inr=total_capex_inr,
        capex_lakhs=round(total_capex_inr / 100000.0, 2),
        capital_subsidy_inr=base_econ.capital_subsidy_inr,
        net_utility_capex_inr=base_econ.net_utility_capex_inr,
        annual_om_inr=annual_om_total,
        annual_energy_purchase_inr=annual_energy_cost_total,
        pv_om_inr=pv_om_total,
        pv_energy_purchase_inr=pv_energy_total,
        pv_battery_replacement_inr=pv_rep_total,
        npc_inr=npc_total,
        npc_lakhs=round(npc_total / 100000.0, 2),
        annual_delivered_energy_kwh=base_econ.annual_delivered_energy_kwh,
        pv_delivered_energy_kwh=base_econ.pv_delivered_energy_kwh,
        lcoe_inr_kwh=round(npc_total / max(1.0, base_econ.pv_delivered_energy_kwh), 2),
        annualized_cost_inr_yr=round(
            npc_total
            * (base_econ.annualized_cost_inr_yr / max(1.0, base_econ.npc_inr)),
            2,
        ),
        cost_per_household_inr=round(total_capex_inr / max(1, total_hh), 2),
        npc_per_household_inr=round(npc_total / max(1, total_hh), 2),
        avoided_co2_tonnes_yr=avoided_co2_total,
    )

    return ScenarioBoqSummary(
        aggregated_lines=aggregated_lines,
        cluster_breakdowns=cluster_breakdowns,
        base_equipment_inr=base_equipment_inr,
        terrain_premium_inr=terrain_premium_inr,
        subtotal_supply_erection_inr=subtotal_inr,
        gst_pct=econ_params.gst_pct,
        gst_amount_inr=gst_inr,
        contingency_pct=econ_params.contingency_pct,
        contingency_amount_inr=contingency_inr,
        pmc_overhead_pct=econ_params.pmc_overhead_pct,
        pmc_overhead_amount_inr=pmc_inr,
        total_capex_inr=total_capex_inr,
        total_capex_lakhs=round(total_capex_inr / 100000.0, 2),
        has_unset_rates=has_unset,
        unset_item_codes=unset_codes,
        export_blocked_reason=export_blocked_reason,
        economics=scenario_econ,
    )
