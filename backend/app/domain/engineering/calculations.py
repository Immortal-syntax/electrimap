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

"""Deterministic electrical engineering calculations: voltage drop, losses, and off-grid sizing.

Domain purity rule: Pure Python & NumPy mathematical calculations.
Must NEVER import database models, file storage, or HTTP clients.
"""

import math
from dataclasses import dataclass

from shapely.geometry import LineString, MultiLineString, MultiPoint

from app.domain.engineering.constants import get_default_constants_map
from app.domain.engineering.network_sizing import (
    DEFAULT_METRIC_EPSG,
    PlacedDistributionTransformer,
    build_cluster_415v_lt_mst,
    build_dt_multipoint_wgs84,
    place_cluster_transformers,
    route_cluster_11kv_ht_feeder,
)


@dataclass(frozen=True)
class VoltageDropAnalysisResult:
    """Voltage drop analysis for 11 kV HT feeder and 415 V LT radial distributor."""

    ht_current_a: float
    ht_drop_v: float
    ht_drop_pct: float
    ht_vdrop_compliant: bool
    lt_current_a: float
    lt_drop_v: float
    lt_drop_pct: float
    lt_vdrop_compliant: bool
    overall_vdrop_compliant: bool


@dataclass(frozen=True)
class TechnicalLossesResult:
    """Annual technical energy losses (I²R line losses + IS 1180 DT iron/copper losses)."""

    load_factor: float
    load_loss_factor: float
    ht_line_loss_kwh_yr: float
    lt_line_loss_kwh_yr: float
    dt_no_load_loss_kwh_yr: float
    dt_copper_loss_kwh_yr: float
    total_loss_mwh_yr: float
    technical_loss_pct: float


@dataclass(frozen=True)
class SolarMinigridSizingResult:
    """Off-grid Solar PV + LiFePO4 BESS Mini-Grid sizing under worst-month monsoon GHI."""

    worst_ghi_kwh_m2_day: float
    solar_pv_kwp: float
    bess_capacity_kwh: float
    usable_bess_kwh: float
    inverter_kva: float
    autonomy_days: float
    daily_generation_kwh: float


@dataclass(frozen=True)
class StandaloneShsSizingResult:
    """Standalone Solar Home System (SHS) kit sizing for remote/dispersed households."""

    shs_kits_count: int
    institutional_packs_count: int
    total_pv_kwp: float
    total_bess_kwh: float


@dataclass(frozen=True)
class ClusterEngineeringEvaluation:
    """Complete deterministic engineering layout & sizing result for a habitation cluster."""

    cluster_id: str
    cluster_label: str
    cluster_name: str
    est_households: int
    modality: str
    is_manual_override: bool
    requires_tie_in: bool
    peak_kw_horizon: float
    peak_kva_horizon: float
    energy_kwh_day_horizon: float
    annual_energy_mwh_horizon: float
    placed_dts: list[PlacedDistributionTransformer]
    dt_count: int
    total_dt_rating_kva: float
    max_dt_loading_pct: float
    ht_length_m: float
    ht_poles_count: int
    lt_3ph_length_m: float
    lt_1ph_length_m: float
    lt_total_length_m: float
    max_lt_branch_m: float
    lt_poles_count: int
    vdrop: VoltageDropAnalysisResult
    losses: TechnicalLossesResult
    solar_minigrid: SolarMinigridSizingResult | None
    standalone_shs: StandaloneShsSizingResult | None
    ht_line_wgs84: LineString | MultiLineString | None
    lt_lines_wgs84: MultiLineString | None
    dt_points_wgs84: MultiPoint | None
    engineering_notes: list[str]


def compute_voltage_drop_analysis(
    peak_kva_horizon: float,
    ht_length_m: float,
    max_lt_branch_m: float,
    dt_count: int,
    power_factor_cos_phi: float = 0.85,
    constants: dict[str, float] | None = None,
) -> VoltageDropAnalysisResult:
    """Compute 3-phase 11 kV HT and 415 V LT voltage drop (V and %) against CEA limits."""
    consts = {**get_default_constants_map(), **(constants or {})}
    cos_phi = max(0.5, min(0.99, power_factor_cos_phi))
    sin_phi = math.sqrt(max(0.0, 1.0 - cos_phi * cos_phi))

    r_ht = consts["ht_11kv_r_ohm_per_km"]
    x_ht = consts["ht_11kv_x_ohm_per_km"]
    r_lt = consts["lt_415v_3ph_r_ohm_per_km"]
    x_lt = consts["lt_415v_3ph_x_ohm_per_km"]
    ht_limit_pct = consts["ht_max_vdrop_pct"]
    lt_limit_pct = consts["lt_max_vdrop_pct"]

    # 11 kV 3-phase feeder voltage drop
    if ht_length_m > 0.0 and peak_kva_horizon > 0.0:
        i_ht_a = peak_kva_horizon / (math.sqrt(3.0) * 11.0)
        l_ht_km = ht_length_m / 1000.0
        z_eff_ht = r_ht * cos_phi + x_ht * sin_phi
        ht_drop_v = math.sqrt(3.0) * i_ht_a * l_ht_km * z_eff_ht
        ht_drop_pct = (ht_drop_v / 11000.0) * 100.0
    else:
        i_ht_a = 0.0
        ht_drop_v = 0.0
        ht_drop_pct = 0.0

    # 415 V 3-phase LT radial branch voltage drop (distributed load factor k_dist = 0.65)
    if max_lt_branch_m > 0.0 and peak_kva_horizon > 0.0 and dt_count > 0:
        kva_per_dt = peak_kva_horizon / max(1, dt_count)
        i_lt_a = kva_per_dt / (math.sqrt(3.0) * 0.415)
        l_branch_km = max_lt_branch_m / 1000.0
        k_dist = 0.65
        z_eff_lt = r_lt * cos_phi + x_lt * sin_phi
        lt_drop_v = math.sqrt(3.0) * i_lt_a * l_branch_km * k_dist * z_eff_lt
        lt_drop_pct = (lt_drop_v / 415.0) * 100.0
    else:
        i_lt_a = 0.0
        lt_drop_v = 0.0
        lt_drop_pct = 0.0

    ht_ok = ht_drop_pct <= ht_limit_pct
    lt_ok = lt_drop_pct <= lt_limit_pct

    return VoltageDropAnalysisResult(
        ht_current_a=round(i_ht_a, 2),
        ht_drop_v=round(ht_drop_v, 2),
        ht_drop_pct=round(ht_drop_pct, 2),
        ht_vdrop_compliant=ht_ok,
        lt_current_a=round(i_lt_a, 2),
        lt_drop_v=round(lt_drop_v, 2),
        lt_drop_pct=round(lt_drop_pct, 2),
        lt_vdrop_compliant=lt_ok,
        overall_vdrop_compliant=ht_ok and lt_ok,
    )


def compute_annual_technical_losses(
    peak_kw_horizon: float,
    peak_kva_horizon: float,
    energy_kwh_day_horizon: float,
    annual_energy_mwh_horizon: float,
    ht_length_m: float,
    max_lt_branch_m: float,
    placed_dts: list[PlacedDistributionTransformer],
    constants: dict[str, float] | None = None,
) -> TechnicalLossesResult:
    """Compute annual HT/LT I²R conductor losses and IS 1180 DT iron/copper losses."""
    consts = {**get_default_constants_map(), **(constants or {})}
    r_ht = consts["ht_11kv_r_ohm_per_km"]
    r_lt = consts["lt_415v_3ph_r_ohm_per_km"]

    if peak_kw_horizon <= 0.0 or energy_kwh_day_horizon <= 0.0:
        return TechnicalLossesResult(
            load_factor=0.0,
            load_loss_factor=0.0,
            ht_line_loss_kwh_yr=0.0,
            lt_line_loss_kwh_yr=0.0,
            dt_no_load_loss_kwh_yr=0.0,
            dt_copper_loss_kwh_yr=0.0,
            total_loss_mwh_yr=0.0,
            technical_loss_pct=0.0,
        )

    lf = max(0.08, min(0.85, energy_kwh_day_horizon / (24.0 * peak_kw_horizon)))
    llf = 0.30 * lf + 0.70 * (lf * lf)

    # 3-phase HT I²R loss: P_loss_peak = 3 * I_ht^2 * R_ht * L_km
    if ht_length_m > 0.0:
        i_ht_a = peak_kva_horizon / (math.sqrt(3.0) * 11.0)
        p_ht_loss_kw = (3.0 * (i_ht_a**2) * r_ht * (ht_length_m / 1000.0)) / 1000.0
        ht_loss_kwh_yr = p_ht_loss_kw * llf * 8760.0
    else:
        ht_loss_kwh_yr = 0.0

    # 3-phase LT I²R loss across DT sub-zones (distributed factor 0.50 for I²R along branch)
    if max_lt_branch_m > 0.0 and placed_dts:
        n_dts = len(placed_dts)
        kva_per_dt = peak_kva_horizon / n_dts
        i_lt_a = kva_per_dt / (math.sqrt(3.0) * 0.415)
        p_lt_loss_per_dt_kw = (
            3.0 * (i_lt_a**2) * r_lt * (max_lt_branch_m / 1000.0) * 0.50
        ) / 1000.0
        lt_loss_kwh_yr = n_dts * p_lt_loss_per_dt_kw * llf * 8760.0
    else:
        lt_loss_kwh_yr = 0.0

    # IS 1180 Level-2 DT iron (no-load) and copper (load) losses
    dt_iron_kwh_yr = 0.0
    dt_copper_kwh_yr = 0.0
    for dt in placed_dts:
        loading_ratio = dt.allocated_peak_kva / max(1.0, dt.rating_kva)
        dt_iron_kwh_yr += (dt.spec.no_load_loss_w / 1000.0) * 8760.0
        dt_copper_kwh_yr += (dt.spec.full_load_loss_w / 1000.0) * (loading_ratio**2) * llf * 8760.0

    total_loss_kwh_yr = ht_loss_kwh_yr + lt_loss_kwh_yr + dt_iron_kwh_yr + dt_copper_kwh_yr
    total_loss_mwh_yr = total_loss_kwh_yr / 1000.0
    delivered_mwh_yr = max(0.001, annual_energy_mwh_horizon)
    loss_pct = (total_loss_mwh_yr / (delivered_mwh_yr + total_loss_mwh_yr)) * 100.0

    return TechnicalLossesResult(
        load_factor=round(lf, 3),
        load_loss_factor=round(llf, 3),
        ht_line_loss_kwh_yr=round(ht_loss_kwh_yr, 1),
        lt_line_loss_kwh_yr=round(lt_loss_kwh_yr, 1),
        dt_no_load_loss_kwh_yr=round(dt_iron_kwh_yr, 1),
        dt_copper_loss_kwh_yr=round(dt_copper_kwh_yr, 1),
        total_loss_mwh_yr=round(total_loss_mwh_yr, 3),
        technical_loss_pct=round(loss_pct, 2),
    )


def compute_solar_minigrid_sizing(
    peak_kva_horizon: float,
    energy_kwh_day_horizon: float,
    worst_ghi_kwh_m2_day: float = 3.82,
    constants: dict[str, float] | None = None,
) -> SolarMinigridSizingResult:
    """Size a Solar PV + LiFePO4 BESS Mini-Grid using NASA POWER worst-month monsoon GHI."""
    consts = {**get_default_constants_map(), **(constants or {})}
    pr = max(0.55, min(0.90, consts["solar_pr_ratio"]))
    autonomy_days = max(0.5, min(5.0, consts["bess_autonomy_days"]))
    dod = max(0.50, min(0.95, consts["bess_dod_ratio"]))
    rt_eff = max(0.70, min(0.98, consts["bess_roundtrip_eff"]))
    safe_ghi = max(2.2, worst_ghi_kwh_m2_day)

    # Required PV array with 8% distribution + battery charging overhead, rounded to 2.5 kWp steps
    raw_pv_kwp = (energy_kwh_day_horizon * 1.08) / (safe_ghi * pr)
    solar_pv_kwp = max(5.0, math.ceil(raw_pv_kwp / 2.5) * 2.5)

    # Evening/night + monsoon autonomy storage (65% of daily energy cycled through battery)
    night_share = 0.65
    usable_bess_kwh = energy_kwh_day_horizon * night_share * autonomy_days
    raw_nominal_bess_kwh = usable_bess_kwh / (dod * rt_eff)
    bess_capacity_kwh = max(10.0, math.ceil(raw_nominal_bess_kwh / 5.0) * 5.0)

    inverter_kva = max(5.0, float(math.ceil(peak_kva_horizon * 1.25 / 5.0) * 5.0))
    daily_gen_kwh = solar_pv_kwp * safe_ghi * pr

    return SolarMinigridSizingResult(
        worst_ghi_kwh_m2_day=round(safe_ghi, 2),
        solar_pv_kwp=round(solar_pv_kwp, 2),
        bess_capacity_kwh=round(bess_capacity_kwh, 2),
        usable_bess_kwh=round(usable_bess_kwh, 2),
        inverter_kva=round(inverter_kva, 2),
        autonomy_days=round(autonomy_days, 2),
        daily_generation_kwh=round(daily_gen_kwh, 2),
    )


def compute_standalone_shs_sizing(
    est_households: int,
    n_non_residential: int = 0,
    constants: dict[str, float] | None = None,
) -> StandaloneShsSizingResult:
    """Size Standalone Solar Home Systems (SHS) for dispersed/remote habitations."""
    consts = {**get_default_constants_map(), **(constants or {})}
    kit_pv_wp = consts["shs_kit_pv_wp"]
    kit_bess_wh = consts["shs_kit_bess_wh"]

    hh_count = max(1, est_households)
    inst_packs = max(0, min(5, n_non_residential))
    total_pv_kwp = (hh_count * kit_pv_wp) / 1000.0 + inst_packs * 1.0
    total_bess_kwh = (hh_count * kit_bess_wh) / 1000.0 + inst_packs * 3.2

    return StandaloneShsSizingResult(
        shs_kits_count=hh_count,
        institutional_packs_count=inst_packs,
        total_pv_kwp=round(total_pv_kwp, 2),
        total_bess_kwh=round(total_bess_kwh, 2),
    )


def evaluate_cluster_engineering_layout(
    cluster_id: str,
    cluster_label: str,
    cluster_name: str,
    est_households: int,
    n_non_residential: int,
    cluster_centroid_wgs84: tuple[float, float],
    building_points_wgs84: list[tuple[float, float]],
    modality: str,
    is_manual_override: bool,
    tie_in_wgs84: tuple[float, float] | None,
    slope_mean_deg: float,
    canopy_share: float,
    water_crossings_count: int,
    peak_kw_horizon: float,
    peak_kva_horizon: float,
    energy_kwh_day_horizon: float,
    annual_energy_mwh_horizon: float,
    worst_ghi_kwh_m2_day: float = 3.82,
    power_factor_cos_phi: float = 0.85,
    constants: dict[str, float] | None = None,
    metric_epsg: int = DEFAULT_METRIC_EPSG,
) -> ClusterEngineeringEvaluation:
    """Evaluate complete network routing, DT sizing, voltage drop, losses, and solar/BESS."""
    consts = {**get_default_constants_map(), **(constants or {})}
    notes: list[str] = []

    if modality == "STANDALONE_SHS":
        shs = compute_standalone_shs_sizing(
            est_households=est_households,
            n_non_residential=n_non_residential,
            constants=consts,
        )
        zero_vdrop = VoltageDropAnalysisResult(
            ht_current_a=0.0,
            ht_drop_v=0.0,
            ht_drop_pct=0.0,
            ht_vdrop_compliant=True,
            lt_current_a=0.0,
            lt_drop_v=0.0,
            lt_drop_pct=0.0,
            lt_vdrop_compliant=True,
            overall_vdrop_compliant=True,
        )
        zero_losses = TechnicalLossesResult(
            load_factor=0.0,
            load_loss_factor=0.0,
            ht_line_loss_kwh_yr=0.0,
            lt_line_loss_kwh_yr=0.0,
            dt_no_load_loss_kwh_yr=0.0,
            dt_copper_loss_kwh_yr=0.0,
            total_loss_mwh_yr=0.0,
            technical_loss_pct=0.0,
        )
        notes.append(
            f"Standalone SHS selected: {shs.shs_kits_count} household kits "
            f"({shs.total_pv_kwp:.2f} kWp PV, {shs.total_bess_kwh:.2f} kWh LiFePO4). "
            "No 11 kV HT or 415 V LT lines required."
        )
        return ClusterEngineeringEvaluation(
            cluster_id=cluster_id,
            cluster_label=cluster_label,
            cluster_name=cluster_name,
            est_households=est_households,
            modality=modality,
            is_manual_override=is_manual_override,
            requires_tie_in=False,
            peak_kw_horizon=peak_kw_horizon,
            peak_kva_horizon=peak_kva_horizon,
            energy_kwh_day_horizon=energy_kwh_day_horizon,
            annual_energy_mwh_horizon=annual_energy_mwh_horizon,
            placed_dts=[],
            dt_count=0,
            total_dt_rating_kva=0.0,
            max_dt_loading_pct=0.0,
            ht_length_m=0.0,
            ht_poles_count=0,
            lt_3ph_length_m=0.0,
            lt_1ph_length_m=0.0,
            lt_total_length_m=0.0,
            max_lt_branch_m=0.0,
            lt_poles_count=0,
            vdrop=zero_vdrop,
            losses=zero_losses,
            solar_minigrid=None,
            standalone_shs=shs,
            ht_line_wgs84=None,
            lt_lines_wgs84=None,
            dt_points_wgs84=None,
            engineering_notes=notes,
        )

    # Place DT(s) (or Mini-Grid Generation Hub at load centroid)
    placed_dts = place_cluster_transformers(
        cluster_label=cluster_label,
        cluster_centroid_wgs84=cluster_centroid_wgs84,
        building_points_wgs84=building_points_wgs84,
        est_households=est_households,
        peak_kva_horizon=peak_kva_horizon,
        dt_max_loading_ratio=consts["dt_max_loading_ratio"],
        lt_max_radial_reach_m=consts["lt_max_radial_reach_m"],
        metric_epsg=metric_epsg,
    )
    lt_mst = build_cluster_415v_lt_mst(
        cluster_centroid_wgs84=cluster_centroid_wgs84,
        building_points_wgs84=building_points_wgs84,
        est_households=est_households,
        placed_dts=placed_dts,
        lt_standard_span_m=consts["lt_standard_span_m"],
        metric_epsg=metric_epsg,
    )
    dt_points_wgs84 = build_dt_multipoint_wgs84(placed_dts)

    if modality == "SOLAR_MINIGRID":
        mg = compute_solar_minigrid_sizing(
            peak_kva_horizon=peak_kva_horizon,
            energy_kwh_day_horizon=energy_kwh_day_horizon,
            worst_ghi_kwh_m2_day=worst_ghi_kwh_m2_day,
            constants=consts,
        )
        vdrop = compute_voltage_drop_analysis(
            peak_kva_horizon=peak_kva_horizon,
            ht_length_m=0.0,
            max_lt_branch_m=lt_mst.max_lt_branch_m,
            dt_count=max(1, len(placed_dts)),
            power_factor_cos_phi=power_factor_cos_phi,
            constants=consts,
        )
        losses = compute_annual_technical_losses(
            peak_kw_horizon=peak_kw_horizon,
            peak_kva_horizon=peak_kva_horizon,
            energy_kwh_day_horizon=energy_kwh_day_horizon,
            annual_energy_mwh_horizon=annual_energy_mwh_horizon,
            ht_length_m=0.0,
            max_lt_branch_m=lt_mst.max_lt_branch_m,
            placed_dts=[],
            constants=consts,
        )
        notes.append(
            f"Solar PV + LiFePO4 Mini-Grid sized for worst-month GHI "
            f"{mg.worst_ghi_kwh_m2_day} kWh/m²/d: {mg.solar_pv_kwp} kWp PV, "
            f"{mg.bess_capacity_kwh} kWh BESS ({mg.autonomy_days}d autonomy), "
            f"and {lt_mst.lt_total_length_m} m local 415 V LT AB cable network."
        )
        return ClusterEngineeringEvaluation(
            cluster_id=cluster_id,
            cluster_label=cluster_label,
            cluster_name=cluster_name,
            est_households=est_households,
            modality=modality,
            is_manual_override=is_manual_override,
            requires_tie_in=False,
            peak_kw_horizon=peak_kw_horizon,
            peak_kva_horizon=peak_kva_horizon,
            energy_kwh_day_horizon=energy_kwh_day_horizon,
            annual_energy_mwh_horizon=annual_energy_mwh_horizon,
            placed_dts=placed_dts,
            dt_count=0,
            total_dt_rating_kva=0.0,
            max_dt_loading_pct=0.0,
            ht_length_m=0.0,
            ht_poles_count=0,
            lt_3ph_length_m=lt_mst.lt_3ph_length_m,
            lt_1ph_length_m=lt_mst.lt_1ph_length_m,
            lt_total_length_m=lt_mst.lt_total_length_m,
            max_lt_branch_m=lt_mst.max_lt_branch_m,
            lt_poles_count=lt_mst.lt_poles_count,
            vdrop=vdrop,
            losses=losses,
            solar_minigrid=mg,
            standalone_shs=None,
            ht_line_wgs84=None,
            lt_lines_wgs84=lt_mst.lt_lines_wgs84,
            dt_points_wgs84=dt_points_wgs84,
            engineering_notes=notes,
        )

    # GRID_EXTENSION or GRID_AUGMENTATION
    if modality == "GRID_AUGMENTATION" and tie_in_wgs84 is None:
        # Augmentation of an already electrified cluster with local LT reconductoring & DT upgrade
        ht_res = route_cluster_11kv_ht_feeder(
            tie_in_wgs84=None,
            placed_dts=placed_dts,
            slope_mean_deg=slope_mean_deg,
            canopy_share=canopy_share,
            water_crossings_count=water_crossings_count,
            ht_standard_span_m=consts["ht_standard_span_m"],
            ht_steep_span_m=consts["ht_steep_span_m"],
            metric_epsg=metric_epsg,
        )
    else:
        ht_res = route_cluster_11kv_ht_feeder(
            tie_in_wgs84=tie_in_wgs84,
            placed_dts=placed_dts,
            slope_mean_deg=slope_mean_deg,
            canopy_share=canopy_share,
            water_crossings_count=water_crossings_count,
            ht_standard_span_m=consts["ht_standard_span_m"],
            ht_steep_span_m=consts["ht_steep_span_m"],
            metric_epsg=metric_epsg,
        )

    vdrop = compute_voltage_drop_analysis(
        peak_kva_horizon=peak_kva_horizon,
        ht_length_m=ht_res.ht_length_m,
        max_lt_branch_m=lt_mst.max_lt_branch_m,
        dt_count=len(placed_dts),
        power_factor_cos_phi=power_factor_cos_phi,
        constants=consts,
    )
    losses = compute_annual_technical_losses(
        peak_kw_horizon=peak_kw_horizon,
        peak_kva_horizon=peak_kva_horizon,
        energy_kwh_day_horizon=energy_kwh_day_horizon,
        annual_energy_mwh_horizon=annual_energy_mwh_horizon,
        ht_length_m=ht_res.ht_length_m,
        max_lt_branch_m=lt_mst.max_lt_branch_m,
        placed_dts=placed_dts,
        constants=consts,
    )

    total_dt_kva = sum(dt.rating_kva for dt in placed_dts)
    max_dt_load_pct = max((dt.loading_pct for dt in placed_dts), default=0.0)

    if ht_res.requires_tie_in and modality == "GRID_EXTENSION":
        notes.append(
            "Existing 11 kV tie-in point is UNSET (Core Principle #4). "
            "Place an assumed 11 kV tie-in point or upload utility GIS to route the 11 kV feeder."
        )
    else:
        notes.append(
            f"11 kV HT feeder routed via MCP_Geometric ({ht_res.ht_length_m} m, "
            f"{ht_res.ht_poles_count} poles); {len(placed_dts)}x DT ({total_dt_kva:.0f} kVA total, "
            f"max loading {max_dt_load_pct:.1f}%); 415 V LT MST {lt_mst.lt_total_length_m} m."
        )

    if not vdrop.overall_vdrop_compliant:
        notes.append(
            f"WARNING: Voltage drop exceeds CEA limits (HT {vdrop.ht_drop_pct}% vs 5%, "
            f"LT {vdrop.lt_drop_pct}% vs 6%). Consider sub-zone DT addition or Solar Mini-Grid."
        )

    return ClusterEngineeringEvaluation(
        cluster_id=cluster_id,
        cluster_label=cluster_label,
        cluster_name=cluster_name,
        est_households=est_households,
        modality=modality,
        is_manual_override=is_manual_override,
        requires_tie_in=ht_res.requires_tie_in and modality == "GRID_EXTENSION",
        peak_kw_horizon=peak_kw_horizon,
        peak_kva_horizon=peak_kva_horizon,
        energy_kwh_day_horizon=energy_kwh_day_horizon,
        annual_energy_mwh_horizon=annual_energy_mwh_horizon,
        placed_dts=placed_dts,
        dt_count=len(placed_dts),
        total_dt_rating_kva=round(total_dt_kva, 1),
        max_dt_loading_pct=round(max_dt_load_pct, 1),
        ht_length_m=ht_res.ht_length_m,
        ht_poles_count=ht_res.ht_poles_count,
        lt_3ph_length_m=lt_mst.lt_3ph_length_m,
        lt_1ph_length_m=lt_mst.lt_1ph_length_m,
        lt_total_length_m=lt_mst.lt_total_length_m,
        max_lt_branch_m=lt_mst.max_lt_branch_m,
        lt_poles_count=lt_mst.lt_poles_count,
        vdrop=vdrop,
        losses=losses,
        solar_minigrid=None,
        standalone_shs=None,
        ht_line_wgs84=ht_res.ht_line_wgs84,
        lt_lines_wgs84=lt_mst.lt_lines_wgs84,
        dt_points_wgs84=dt_points_wgs84,
        engineering_notes=notes,
    )
