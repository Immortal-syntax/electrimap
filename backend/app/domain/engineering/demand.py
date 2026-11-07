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

"""Pure 7-category parametric electricity demand estimation and horizon growth engine.

Implements Tasks M4-3 & M4-4:
- Project-level Assumptions Register default parameters with REC / CEA / ESMAP MTF citations.
- 7-category rural demand calculation per habitation cluster and AOI aggregate:
  1. DOMESTIC_BPL (Domestic BPL / Kutir Jyoti)
  2. DOMESTIC_APL (Domestic APL / Standard Residential)
  3. INSTITUTIONAL (Schools, Anganwadi, Health Sub-Centre, Panchayat)
  4. STREET_LIGHTING (Village LED Street Lights)
  5. WATER_PUMPING (Piped Drinking Water / Har Ghar Jal Submersible Pump)
  6. AGRICULTURAL_IRRIGATION (Smallholder Irrigation Pumpsets)
  7. MICRO_ENTERPRISE (Flour Mill / Rice Huller / Tribal SHG Cold-Room & Processing)
- Coincident peak demand (kW and kVA at configurable power factor cos_phi) and compound
  horizon growth over `horizon_years`.
"""

import math
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AssumptionSpec:
    """Default specification for a project-level engineering assumption."""

    key: str
    category: str  # DEMAND, GROWTH, NETWORK, SOLAR_BESS
    label: str
    default_value: float
    unit: str
    citation: str
    min_value: float
    max_value: float


DEFAULT_PROJECT_ASSUMPTIONS: tuple[AssumptionSpec, ...] = (
    AssumptionSpec(
        key="bpl_household_share",
        category="DEMAND",
        label="BPL / Kutir Jyoti Share of Households",
        default_value=0.60,
        unit="ratio",
        citation="DDUGJY / RDSS Tribal Sub-Plan Normative BPL Ratio (60%)",
        min_value=0.0,
        max_value=1.0,
    ),
    AssumptionSpec(
        key="bpl_connected_load_kw",
        category="DEMAND",
        label="Connected Load per BPL Household",
        default_value=0.25,
        unit="kW/HH",
        citation="ESMAP MTF Tier 2-3 / REC Kutir Jyoti Norm (250 W: LEDs + Fan + Charging)",
        min_value=0.05,
        max_value=2.0,
    ),
    AssumptionSpec(
        key="apl_connected_load_kw",
        category="DEMAND",
        label="Connected Load per APL Household",
        default_value=0.75,
        unit="kW/HH",
        citation="CEA / REC Standard Rural Domestic Load Norm (750 W: Tier 3-4)",
        min_value=0.20,
        max_value=5.0,
    ),
    AssumptionSpec(
        key="domestic_demand_factor",
        category="DEMAND",
        label="Domestic Maximum Demand Factor",
        default_value=0.60,
        unit="ratio",
        citation="REC Rural Distribution Manual (Individual HH Demand Factor = 0.60)",
        min_value=0.20,
        max_value=1.0,
    ),
    AssumptionSpec(
        key="domestic_hours_per_day",
        category="DEMAND",
        label="Domestic Equivalent Full-Load Hours per Day",
        default_value=5.0,
        unit="h/day",
        citation="CEA Rural Evening + Morning Load Curve (5.0 eq. hours/day)",
        min_value=1.0,
        max_value=16.0,
    ),
    AssumptionSpec(
        key="institutional_load_kw_per_50hh",
        category="DEMAND",
        label="Community Institutional Load per 50 Households",
        default_value=1.50,
        unit="kW/50HH",
        citation="DA-JGUA / Samagra Shiksha School + Anganwadi + Sub-Centre Norm",
        min_value=0.0,
        max_value=10.0,
    ),
    AssumptionSpec(
        key="streetlight_w_per_10hh",
        category="DEMAND",
        label="LED Street Lighting Load per 10 Households",
        default_value=40.0,
        unit="W/10HH",
        citation="BIS IS 16107 / EESL 40W LED Luminaire per 10 Households (11 h/night)",
        min_value=0.0,
        max_value=250.0,
    ),
    AssumptionSpec(
        key="water_pump_kw_per_cluster",
        category="DEMAND",
        label="Drinking Water Supply Pump per Habitation (>= 15 HH)",
        default_value=2.20,
        unit="kW/cluster",
        citation="Jal Jeevan Mission (JJM) 3 HP (2.2 kW) Community Submersible Pump",
        min_value=0.0,
        max_value=15.0,
    ),
    AssumptionSpec(
        key="agri_pumps_per_25hh",
        category="DEMAND",
        label="Agricultural Irrigation Pumpsets per 25 Households",
        default_value=1.0,
        unit="pumps/25HH",
        citation="PM-KUSUM / Minor Irrigation Norm (3 HP = 2.2 kW per 25 HH)",
        min_value=0.0,
        max_value=10.0,
    ),
    AssumptionSpec(
        key="micro_enterprise_kw_per_40hh",
        category="DEMAND",
        label="Rural Micro-Enterprise / Agro-Processing Load per 40 HH",
        default_value=3.70,
        unit="kW/40HH",
        citation="5 HP (3.7 kW) Grain Mill / Tribal Van Dhan Processing Unit per 40 HH",
        min_value=0.0,
        max_value=25.0,
    ),
    AssumptionSpec(
        key="cluster_coincidence_factor",
        category="DEMAND",
        label="Cluster Inter-Category Coincidence Factor",
        default_value=0.65,
        unit="ratio",
        citation="REC / IEEE Rural Feeder Coincidence Factor (Day Pump vs Evening = 0.65)",
        min_value=0.30,
        max_value=1.0,
    ),
    AssumptionSpec(
        key="power_factor_cos_phi",
        category="NETWORK",
        label="Design Lagging Power Factor (cos φ)",
        default_value=0.85,
        unit="ratio",
        citation="CEA Technical Standards for Connectivity / REC DT Sizing Standard (0.85 lag)",
        min_value=0.70,
        max_value=0.98,
    ),
    AssumptionSpec(
        key="annual_demand_growth_rate",
        category="GROWTH",
        label="Annual Compound Electricity Demand Growth Rate",
        default_value=0.045,
        unit="ratio/yr",
        citation="CEA 20th Electric Power Survey (EPS) Rural Load Growth Projection (4.5%/yr)",
        min_value=0.0,
        max_value=0.15,
    ),
    AssumptionSpec(
        key="grid_max_terrain_distance_m",
        category="NETWORK",
        label="Maximum Terrain-Weighted Distance for 11 kV Grid Extension",
        default_value=3500.0,
        unit="m",
        citation="RDSS / REC Techno-Economic Threshold for 11 kV Spur Extension (3.5 km)",
        min_value=500.0,
        max_value=15000.0,
    ),
)


@dataclass(frozen=True)
class CategoryDemandRow:
    """Computed demand metrics for a single consumer category."""

    category: str
    label: str
    consumer_count: int
    connected_kw: float
    demand_factor: float
    max_demand_kw: float
    daily_hours: float
    energy_kwh_day: float
    annual_energy_mwh: float


@dataclass(frozen=True)
class ClusterDemandResult:
    """Complete 7-category and coincident demand forecast for one habitation cluster."""

    cluster_id: str
    cluster_label: str
    cluster_name: str
    est_households: int
    categories: list[CategoryDemandRow]
    total_connected_kw: float
    non_coincident_peak_kw: float
    coincidence_factor: float
    power_factor_cos_phi: float
    peak_kw_base: float
    peak_kva_base: float
    energy_kwh_day_base: float
    annual_energy_mwh_base: float
    horizon_years: int
    annual_growth_rate: float
    growth_multiplier: float
    peak_kw_horizon: float
    peak_kva_horizon: float
    energy_kwh_day_horizon: float
    annual_energy_mwh_horizon: float


@dataclass(frozen=True)
class ProjectDemandSummary:
    """Project-wide aggregated 7-category demand and horizon forecast."""

    total_households: int
    total_connected_kw: float
    peak_kw_base: float
    peak_kva_base: float
    energy_kwh_day_base: float
    annual_energy_mwh_base: float
    horizon_years: int
    annual_growth_rate: float
    peak_kw_horizon: float
    peak_kva_horizon: float
    energy_kwh_day_horizon: float
    annual_energy_mwh_horizon: float
    category_totals: list[CategoryDemandRow]
    clusters: list[ClusterDemandResult]


def get_default_assumptions_map() -> dict[str, float]:
    """Return a dictionary of default assumption values keyed by setting key."""
    return {spec.key: spec.default_value for spec in DEFAULT_PROJECT_ASSUMPTIONS}


def compute_cluster_demand(
    *,
    cluster_id: str,
    cluster_label: str,
    cluster_name: str,
    est_households: int,
    n_non_residential: int = 0,
    horizon_years: int = 10,
    assumptions: dict[str, float] | None = None,
) -> ClusterDemandResult:
    """Compute the 7-category parametric electricity demand and horizon forecast for a cluster."""
    cfg = get_default_assumptions_map()
    if assumptions:
        for k, v in assumptions.items():
            if k in cfg:
                cfg[k] = float(v)

    hh = max(0, est_households)
    bpl_share = max(0.0, min(1.0, cfg["bpl_household_share"]))
    bpl_hh = round(hh * bpl_share)
    apl_hh = max(0, hh - bpl_hh)

    dom_df = cfg["domestic_demand_factor"]
    dom_hours = cfg["domestic_hours_per_day"]

    # 1. Domestic BPL / Kutir Jyoti
    bpl_conn_kw = round(bpl_hh * cfg["bpl_connected_load_kw"], 3)
    bpl_max_kw = round(bpl_conn_kw * dom_df, 3)
    bpl_kwh_day = round(bpl_max_kw * dom_hours, 3)

    # 2. Domestic APL / Standard Residential
    apl_conn_kw = round(apl_hh * cfg["apl_connected_load_kw"], 3)
    apl_max_kw = round(apl_conn_kw * dom_df, 3)
    apl_kwh_day = round(apl_max_kw * dom_hours, 3)

    # 3. Community & Public Institutions
    inst_units = max(1 if hh >= 12 else 0, math.ceil(hh / 50.0) + int(n_non_residential > 0))
    inst_conn_kw = round(inst_units * cfg["institutional_load_kw_per_50hh"], 3) if hh > 0 else 0.0
    inst_df = 0.70
    inst_hours = 6.0
    inst_max_kw = round(inst_conn_kw * inst_df, 3)
    inst_kwh_day = round(inst_max_kw * inst_hours, 3)

    # 4. Street Lighting (100% demand factor during night hours, 11 h/day)
    sl_luminaires = math.ceil(hh / 10.0) if hh > 0 else 0
    sl_conn_kw = round(sl_luminaires * (cfg["streetlight_w_per_10hh"] / 1000.0), 3)
    sl_df = 1.00
    sl_hours = 11.0
    sl_max_kw = round(sl_conn_kw * sl_df, 3)
    sl_kwh_day = round(sl_max_kw * sl_hours, 3)

    # 5. Drinking Water Supply Pumping (for habitations >= 15 HH)
    wp_units = 1 if hh >= 15 else 0
    wp_conn_kw = round(wp_units * cfg["water_pump_kw_per_cluster"], 3)
    wp_df = 0.85
    wp_hours = 4.0
    wp_max_kw = round(wp_conn_kw * wp_df, 3)
    wp_kwh_day = round(wp_max_kw * wp_hours, 3)

    # 6. Agricultural Irrigation Pumpsets
    agri_units = round((hh / 25.0) * cfg["agri_pumps_per_25hh"]) if hh >= 15 else 0
    agri_conn_kw = round(agri_units * 2.20, 3)  # 3 HP = 2.2 kW pump
    agri_df = 0.65
    agri_hours = 4.5
    agri_max_kw = round(agri_conn_kw * agri_df, 3)
    agri_kwh_day = round(agri_max_kw * agri_hours, 3)

    # 7. Rural Micro-Enterprise & Agro-Processing
    me_units = math.ceil(hh / 40.0) if hh >= 20 else 0
    me_conn_kw = round(me_units * cfg["micro_enterprise_kw_per_40hh"], 3)
    me_df = 0.60
    me_hours = 4.0
    me_max_kw = round(me_conn_kw * me_df, 3)
    me_kwh_day = round(me_max_kw * me_hours, 3)

    raw_rows = [
        (
            "DOMESTIC_BPL",
            "Domestic BPL / Kutir Jyoti",
            bpl_hh,
            bpl_conn_kw,
            dom_df,
            bpl_max_kw,
            dom_hours,
            bpl_kwh_day,
        ),
        (
            "DOMESTIC_APL",
            "Domestic APL / Standard",
            apl_hh,
            apl_conn_kw,
            dom_df,
            apl_max_kw,
            dom_hours,
            apl_kwh_day,
        ),
        (
            "INSTITUTIONAL",
            "Community & Public Institutions",
            inst_units,
            inst_conn_kw,
            inst_df,
            inst_max_kw,
            inst_hours,
            inst_kwh_day,
        ),
        (
            "STREET_LIGHTING",
            "Public LED Street Lighting",
            sl_luminaires,
            sl_conn_kw,
            sl_df,
            sl_max_kw,
            sl_hours,
            sl_kwh_day,
        ),
        (
            "WATER_PUMPING",
            "Drinking Water Supply Pumping",
            wp_units,
            wp_conn_kw,
            wp_df,
            wp_max_kw,
            wp_hours,
            wp_kwh_day,
        ),
        (
            "AGRICULTURAL_IRRIGATION",
            "Agricultural Irrigation Pumpsets",
            agri_units,
            agri_conn_kw,
            agri_df,
            agri_max_kw,
            agri_hours,
            agri_kwh_day,
        ),
        (
            "MICRO_ENTERPRISE",
            "Rural Micro-Enterprise / Processing",
            me_units,
            me_conn_kw,
            me_df,
            me_max_kw,
            me_hours,
            me_kwh_day,
        ),
    ]

    cat_rows: list[CategoryDemandRow] = []
    for cat_code, cat_lbl, cnt, c_kw, df_val, m_kw, hrs, e_day in raw_rows:
        cat_rows.append(
            CategoryDemandRow(
                category=cat_code,
                label=cat_lbl,
                consumer_count=cnt,
                connected_kw=c_kw,
                demand_factor=df_val,
                max_demand_kw=m_kw,
                daily_hours=hrs,
                energy_kwh_day=e_day,
                annual_energy_mwh=round((e_day * 365.0) / 1000.0, 3),
            )
        )

    total_conn_kw = round(sum(r.connected_kw for r in cat_rows), 3)
    non_coinc_kw = round(sum(r.max_demand_kw for r in cat_rows), 3)
    coinc_factor = max(0.30, min(1.0, cfg["cluster_coincidence_factor"]))
    cos_phi = max(0.70, min(0.99, cfg["power_factor_cos_phi"]))

    peak_kw_base = round(non_coinc_kw * coinc_factor, 3)
    peak_kva_base = round(peak_kw_base / cos_phi, 3)
    energy_day_base = round(sum(r.energy_kwh_day for r in cat_rows), 3)
    annual_mwh_base = round((energy_day_base * 365.0) / 1000.0, 3)

    g_rate = max(0.0, min(0.20, cfg["annual_demand_growth_rate"]))
    h_yrs = max(1, horizon_years)
    growth_mult = round((1.0 + g_rate) ** h_yrs, 4)

    peak_kw_horizon = round(peak_kw_base * growth_mult, 3)
    peak_kva_horizon = round(peak_kw_horizon / cos_phi, 3)
    energy_day_horizon = round(energy_day_base * growth_mult, 3)
    annual_mwh_horizon = round((energy_day_horizon * 365.0) / 1000.0, 3)

    return ClusterDemandResult(
        cluster_id=cluster_id,
        cluster_label=cluster_label,
        cluster_name=cluster_name,
        est_households=hh,
        categories=cat_rows,
        total_connected_kw=total_conn_kw,
        non_coincident_peak_kw=non_coinc_kw,
        coincidence_factor=coinc_factor,
        power_factor_cos_phi=cos_phi,
        peak_kw_base=peak_kw_base,
        peak_kva_base=peak_kva_base,
        energy_kwh_day_base=energy_day_base,
        annual_energy_mwh_base=annual_mwh_base,
        horizon_years=h_yrs,
        annual_growth_rate=g_rate,
        growth_multiplier=growth_mult,
        peak_kw_horizon=peak_kw_horizon,
        peak_kva_horizon=peak_kva_horizon,
        energy_kwh_day_horizon=energy_day_horizon,
        annual_energy_mwh_horizon=annual_mwh_horizon,
    )


def compute_project_demand_summary(
    clusters_inputs: list[dict[str, Any]],
    *,
    horizon_years: int = 10,
    assumptions: dict[str, float] | None = None,
) -> ProjectDemandSummary:
    """Compute cluster-level and project-wide 7-category electricity demand."""
    cluster_results: list[ClusterDemandResult] = []
    for item in clusters_inputs:
        res = compute_cluster_demand(
            cluster_id=str(item["cluster_id"]),
            cluster_label=str(item["label"]),
            cluster_name=str(item["name"]),
            est_households=int(item["est_households"]),
            n_non_residential=int(item.get("n_non_residential", 0)),
            horizon_years=horizon_years,
            assumptions=assumptions,
        )
        cluster_results.append(res)

    cfg = get_default_assumptions_map()
    if assumptions:
        for k, v in assumptions.items():
            if k in cfg:
                cfg[k] = float(v)

    # Aggregate by category across all clusters
    cat_order = [
        (
            "DOMESTIC_BPL",
            "Domestic BPL / Kutir Jyoti",
            cfg["domestic_demand_factor"],
            cfg["domestic_hours_per_day"],
        ),
        (
            "DOMESTIC_APL",
            "Domestic APL / Standard",
            cfg["domestic_demand_factor"],
            cfg["domestic_hours_per_day"],
        ),
        ("INSTITUTIONAL", "Community & Public Institutions", 0.70, 6.0),
        ("STREET_LIGHTING", "Public LED Street Lighting", 1.00, 11.0),
        ("WATER_PUMPING", "Drinking Water Supply Pumping", 0.85, 4.0),
        ("AGRICULTURAL_IRRIGATION", "Agricultural Irrigation Pumpsets", 0.65, 4.5),
        ("MICRO_ENTERPRISE", "Rural Micro-Enterprise / Processing", 0.60, 4.0),
    ]

    cat_totals: list[CategoryDemandRow] = []
    for code, lbl, df_val, hrs in cat_order:
        matching = [
            c_cat
            for cl_res in cluster_results
            for c_cat in cl_res.categories
            if c_cat.category == code
        ]
        tot_cnt = sum(m.consumer_count for m in matching)
        tot_conn = round(sum(m.connected_kw for m in matching), 3)
        tot_max = round(sum(m.max_demand_kw for m in matching), 3)
        tot_eday = round(sum(m.energy_kwh_day for m in matching), 3)
        tot_amwh = round(sum(m.annual_energy_mwh for m in matching), 3)
        cat_totals.append(
            CategoryDemandRow(
                category=code,
                label=lbl,
                consumer_count=tot_cnt,
                connected_kw=tot_conn,
                demand_factor=df_val,
                max_demand_kw=tot_max,
                daily_hours=hrs,
                energy_kwh_day=tot_eday,
                annual_energy_mwh=tot_amwh,
            )
        )

    tot_hh = sum(c.est_households for c in cluster_results)
    tot_conn_kw = round(sum(c.total_connected_kw for c in cluster_results), 3)
    peak_kw_base = round(sum(c.peak_kw_base for c in cluster_results), 3)
    peak_kva_base = round(sum(c.peak_kva_base for c in cluster_results), 3)
    energy_day_base = round(sum(c.energy_kwh_day_base for c in cluster_results), 3)
    annual_mwh_base = round(sum(c.annual_energy_mwh_base for c in cluster_results), 3)

    peak_kw_horizon = round(sum(c.peak_kw_horizon for c in cluster_results), 3)
    peak_kva_horizon = round(sum(c.peak_kva_horizon for c in cluster_results), 3)
    energy_day_horizon = round(sum(c.energy_kwh_day_horizon for c in cluster_results), 3)
    annual_mwh_horizon = round(sum(c.annual_energy_mwh_horizon for c in cluster_results), 3)

    return ProjectDemandSummary(
        total_households=tot_hh,
        total_connected_kw=tot_conn_kw,
        peak_kw_base=peak_kw_base,
        peak_kva_base=peak_kva_base,
        energy_kwh_day_base=energy_day_base,
        annual_energy_mwh_base=annual_mwh_base,
        horizon_years=max(1, horizon_years),
        annual_growth_rate=cfg["annual_demand_growth_rate"],
        peak_kw_horizon=peak_kw_horizon,
        peak_kva_horizon=peak_kva_horizon,
        energy_kwh_day_horizon=energy_day_horizon,
        annual_energy_mwh_horizon=annual_mwh_horizon,
        category_totals=cat_totals,
        clusters=cluster_results,
    )
