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

"""Deterministic Life-Cycle Financial & Tariff Modelling Engine (Task M6-2 / M6-3).

Implements life-cycle economics for rural/tribal electrification:
- Capital Recovery Factor (CRF) & Present Worth Factor (PWF)
- Net Present Cost (NPC_INR) over planning horizon N at discount rate r
- Levelized Cost of Energy (LCOE_INR_KWH)
- Annual O&M, Wholesale Grid Energy Cost (including technical losses), and BESS Replacement PV
- Scheme Capital Subsidy (RDSS / PM-JANMAN / DA-JGUA) & Avoided Carbon Emissions (CEA baseline)

Adheres strictly to AGENTS.md:
- Domain Purity: No DB or network imports.
- Explicit Units in Identifiers (`capex_inr`, `npc_inr`, `lcoe_inr_kwh`, `energy_mwh_yr`).
"""

from dataclasses import dataclass

CEA_GRID_EMISSION_FACTOR_TCO2_MWH = 0.716  # CEA CO2 Baseline Database v19.0


@dataclass(frozen=True)
class EconomicParameters:
    """Configurable financial and economic parameters for NPC and LCOE evaluation."""

    discount_rate: float = 0.08  # 8.0% real social discount rate
    horizon_years: int = 10  # 10-year DPR planning horizon
    gst_pct: float = 18.0  # 18.0% Goods & Services Tax
    contingency_pct: float = 3.0  # 3.0% physical & price contingency
    pmc_overhead_pct: float = 5.0  # 5.0% Project Management Consultancy / departmental charges
    capital_subsidy_pct: float = 60.0  # 60.0% RDSS / PM-JANMAN / DA-JGUA central grant share
    grid_om_pct_yr: float = 2.5  # 2.5% of CAPEX annual O&M for grid HT/LT/DT assets
    minigrid_om_pct_yr: float = 3.0  # 3.0% of CAPEX annual O&M for solar mini-grid
    shs_om_pct_yr: float = 3.5  # 3.5% of CAPEX annual O&M for standalone SHS
    bulk_grid_tariff_inr_kwh: float = 4.20  # ₹4.20/kWh DISCOM bulk supply cost at 11 kV bus
    bess_replacement_year: int = 7  # Year 7 LiFePO4 battery pack replacement
    bess_replacement_cost_factor: float = 0.70  # 70% of initial battery capital cost


@dataclass(frozen=True)
class LifecycleEconomicResult:
    """Complete life-cycle financial evaluation for a cluster or scenario."""

    modality: str
    capex_inr: float
    capex_lakhs: float
    capital_subsidy_inr: float
    net_utility_capex_inr: float
    annual_om_inr: float
    annual_energy_purchase_inr: float
    pv_om_inr: float
    pv_energy_purchase_inr: float
    pv_battery_replacement_inr: float
    npc_inr: float
    npc_lakhs: float
    annual_delivered_energy_kwh: float
    pv_delivered_energy_kwh: float
    lcoe_inr_kwh: float
    annualized_cost_inr_yr: float
    cost_per_household_inr: float
    npc_per_household_inr: float
    avoided_co2_tonnes_yr: float


def compute_capital_recovery_factor(discount_rate: float, horizon_years: int) -> float:
    """Compute Capital Recovery Factor CRF(r, N) = [r(1+r)^N] / [(1+r)^N - 1]."""
    n = max(1, horizon_years)
    r = max(0.0, discount_rate)
    if r < 1e-6:
        return round(1.0 / n, 6)
    factor = (1.0 + r) ** n
    return round((r * factor) / (factor - 1.0), 6)


def compute_present_worth_factor(discount_rate: float, horizon_years: int) -> float:
    """Compute uniform-series Present Worth Factor PWF(r, N) = [(1+r)^N - 1] / [r(1+r)^N]."""
    n = max(1, horizon_years)
    r = max(0.0, discount_rate)
    if r < 1e-6:
        return float(n)
    factor = (1.0 + r) ** n
    return round((factor - 1.0) / (r * factor), 6)


def evaluate_lifecycle_economics(
    *,
    modality: str,
    capex_inr: float,
    bess_or_shs_battery_capex_inr: float,
    est_households: int,
    annual_delivered_energy_mwh: float,
    annual_technical_loss_mwh: float,
    params: EconomicParameters,
) -> LifecycleEconomicResult:
    """Compute deterministic CAPEX, NPC, LCOE, O&M, and subsidy metrics over horizon N."""
    r = max(0.0, params.discount_rate)
    n = max(1, params.horizon_years)
    pwf = compute_present_worth_factor(r, n)
    crf = compute_capital_recovery_factor(r, n)

    if modality in {"GRID_EXTENSION", "GRID_AUGMENTATION"}:
        om_pct = params.grid_om_pct_yr
    elif modality == "SOLAR_MINIGRID":
        om_pct = params.minigrid_om_pct_yr
    else:
        om_pct = params.shs_om_pct_yr

    annual_om_inr = round(capex_inr * (om_pct / 100.0), 2)
    pv_om_inr = round(annual_om_inr * pwf, 2)

    # Grid options purchase wholesale bulk power for delivered energy + technical losses
    if modality in {"GRID_EXTENSION", "GRID_AUGMENTATION"}:
        gross_grid_kwh_yr = max(
            0.0, (annual_delivered_energy_mwh + annual_technical_loss_mwh) * 1000.0
        )
        annual_energy_purchase_inr = round(
            gross_grid_kwh_yr * params.bulk_grid_tariff_inr_kwh, 2
        )
    else:
        annual_energy_purchase_inr = 0.0
    pv_energy_purchase_inr = round(annual_energy_purchase_inr * pwf, 2)

    # Off-grid options incur battery replacement within a 10-year horizon (Year 7)
    if (
        modality in {"SOLAR_MINIGRID", "STANDALONE_SHS", "HYBRID_OPTIMAL"}
        and bess_or_shs_battery_capex_inr > 0.0
        and params.bess_replacement_year <= n
    ):
        nominal_rep_inr = bess_or_shs_battery_capex_inr * params.bess_replacement_cost_factor
        pv_battery_replacement_inr = round(
            nominal_rep_inr / ((1.0 + r) ** params.bess_replacement_year), 2
        )
    else:
        pv_battery_replacement_inr = 0.0

    npc_inr = round(
        capex_inr + pv_om_inr + pv_energy_purchase_inr + pv_battery_replacement_inr, 2
    )
    annualized_cost_inr_yr = round(npc_inr * crf, 2)

    annual_delivered_energy_kwh = round(max(1.0, annual_delivered_energy_mwh * 1000.0), 2)
    pv_delivered_energy_kwh = round(annual_delivered_energy_kwh * pwf, 2)
    lcoe_inr_kwh = round(npc_inr / max(1.0, pv_delivered_energy_kwh), 2)

    capital_subsidy_inr = round(capex_inr * (params.capital_subsidy_pct / 100.0), 2)
    net_utility_capex_inr = round(max(0.0, capex_inr - capital_subsidy_inr), 2)

    hh_div = max(1, est_households)
    cost_per_hh_inr = round(capex_inr / hh_div, 2)
    npc_per_hh_inr = round(npc_inr / hh_div, 2)

    if modality in {"SOLAR_MINIGRID", "STANDALONE_SHS"}:
        avoided_co2_tonnes_yr = round(
            annual_delivered_energy_mwh * CEA_GRID_EMISSION_FACTOR_TCO2_MWH, 2
        )
    else:
        avoided_co2_tonnes_yr = 0.0

    return LifecycleEconomicResult(
        modality=modality,
        capex_inr=round(capex_inr, 2),
        capex_lakhs=round(capex_inr / 100000.0, 2),
        capital_subsidy_inr=capital_subsidy_inr,
        net_utility_capex_inr=net_utility_capex_inr,
        annual_om_inr=annual_om_inr,
        annual_energy_purchase_inr=annual_energy_purchase_inr,
        pv_om_inr=pv_om_inr,
        pv_energy_purchase_inr=pv_energy_purchase_inr,
        pv_battery_replacement_inr=pv_battery_replacement_inr,
        npc_inr=npc_inr,
        npc_lakhs=round(npc_inr / 100000.0, 2),
        annual_delivered_energy_kwh=annual_delivered_energy_kwh,
        pv_delivered_energy_kwh=pv_delivered_energy_kwh,
        lcoe_inr_kwh=lcoe_inr_kwh,
        annualized_cost_inr_yr=annualized_cost_inr_yr,
        cost_per_household_inr=cost_per_hh_inr,
        npc_per_household_inr=npc_per_hh_inr,
        avoided_co2_tonnes_yr=avoided_co2_tonnes_yr,
    )
