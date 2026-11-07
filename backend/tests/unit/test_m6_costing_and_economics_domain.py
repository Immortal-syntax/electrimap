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

"""Unit tests for Milestone M6 pure domain modules:
- `app.domain.costing.rates` (SoR definitions, CSV parser/validator, UNSET handling)
- `app.domain.engineering.economics` (CRF, PWF, NPC, LCOE, Year-7 BESS replacement, CO2)
- `app.domain.costing.boq` (Automated BOQ generation, terrain multiplier, exact reconciliation)
"""

import pytest

from app.domain.costing.boq import (
    ClusterBoqInput,
    compute_cluster_boq,
    compute_scenario_boq,
    compute_terrain_difficulty_multiplier,
)
from app.domain.costing.rates import (
    STANDARD_SOR_ITEMS,
    RateItemSpec,
    export_sor_to_csv,
    get_default_sor_items_map,
    parse_and_validate_sor_csv,
)
from app.domain.engineering.economics import (
    EconomicParameters,
    compute_capital_recovery_factor,
    compute_present_worth_factor,
    evaluate_lifecycle_economics,
)


def test_standard_sor_items_have_valid_provenance_and_rates() -> None:
    """Verify all 18 standard Schedule of Rates items have positive prices and citations."""
    assert len(STANDARD_SOR_ITEMS) == 18
    rates_map = get_default_sor_items_map()
    assert len(rates_map) == 18
    for item in STANDARD_SOR_ITEMS:
        assert item.rate_inr is not None and item.rate_inr > 0.0
        assert item.source_type == "REFERENCE_PUBLIC_DOCUMENT"
        assert len(item.citation) > 10


def test_sor_csv_roundtrip_and_unset_preservation() -> None:
    """Verify CSV export/import round-trip and UNSET preservation (Core Principle #4)."""
    items = list(STANDARD_SOR_ITEMS[:3])
    items.append(
        RateItemSpec(
            item_code="CUSTOM-UNSET-01",
            description="Unpriced Special River Crossing Tower",
            category="HT_11KV",
            unit="No.",
            rate_inr=None,
            source_type="UNSET",
            citation="Pending vendor quotation",
            source_year=2025,
        )
    )
    csv_text = export_sor_to_csv(items)
    parsed = parse_and_validate_sor_csv(csv_text)
    assert parsed.is_valid is True
    assert len(parsed.errors) == 0
    assert len(parsed.items) == 4
    assert parsed.unset_item_codes == ["CUSTOM-UNSET-01"]
    unset_row = next(i for i in parsed.items if i.item_code == "CUSTOM-UNSET-01")
    assert unset_row.rate_inr is None
    assert unset_row.source_type == "UNSET"


def test_sor_csv_validation_rejects_invalid_rows() -> None:
    """Verify row-level error reporting for negative rates, invalid categories, and bad numbers."""
    bad_csv = "\n".join(
        [
            "item_code,description,category,unit,rate_inr,source_type,citation,source_year",
            "HT-COND-ACSR-50,Valid Item,HT_11KV,km,-5000,USER_TEMPLATE,Bad negative rate,2025",
            "BAD-CAT-01,Invalid Category Item,UNKNOWN_CAT,No.,1200,USER_TEMPLATE,Note,2025",
            "BAD-NUM-01,Non Numeric Rate,LT_415V,km,NOT_A_NUMBER,USER_TEMPLATE,Note,2025",
        ]
    )
    res = parse_and_validate_sor_csv(bad_csv)
    assert res.is_valid is False
    assert len(res.errors) == 3
    fields = [e.field for e in res.errors]
    assert "rate_inr" in fields
    assert "category" in fields


def test_crf_pwf_and_lifecycle_economics_hand_worked() -> None:
    """Verify CRF(8%, 10) = 0.149029, PWF(8%, 10) = 6.710081, and NPC/LCOE formulas."""
    crf = compute_capital_recovery_factor(0.08, 10)
    pwf = compute_present_worth_factor(0.08, 10)
    assert crf == pytest.approx(0.149029, rel=1e-4)
    assert pwf == pytest.approx(6.710081, rel=1e-4)

    params = EconomicParameters(
        discount_rate=0.08,
        horizon_years=10,
        capital_subsidy_pct=60.0,
        minigrid_om_pct_yr=3.0,
        bess_replacement_year=7,
        bess_replacement_cost_factor=0.70,
    )
    econ = evaluate_lifecycle_economics(
        modality="SOLAR_MINIGRID",
        capex_inr=5000000.0,
        bess_or_shs_battery_capex_inr=1500000.0,
        est_households=60,
        annual_delivered_energy_mwh=50.0,
        annual_technical_loss_mwh=2.0,
        params=params,
    )
    # Annual O&M = 3% of 50,00,000 = 1,50,000 INR/yr
    assert econ.annual_om_inr == pytest.approx(150000.0)
    assert econ.pv_om_inr == pytest.approx(150000.0 * pwf, rel=1e-4)
    # Year-7 BESS replacement PV = (15,00,000 * 0.70) / (1.08^7) = 10,50,000 / 1.713824 = 612,664.95
    assert econ.pv_battery_replacement_inr == pytest.approx(
        1050000.0 / (1.08**7), rel=1e-4
    )
    assert econ.npc_inr == pytest.approx(
        econ.capex_inr + econ.pv_om_inr + econ.pv_battery_replacement_inr, rel=1e-5
    )
    assert econ.capital_subsidy_inr == pytest.approx(3000000.0)
    assert econ.net_utility_capex_inr == pytest.approx(2000000.0)
    assert econ.avoided_co2_tonnes_yr == pytest.approx(50.0 * 0.716, rel=1e-3)


def test_cluster_and_scenario_boq_reconciliation_and_unset_blocking() -> None:
    """Verify BOQ totals reconcile to the exact rupee and UNSET rates trigger export blocking."""
    rates_map = get_default_sor_items_map()
    econ_params = EconomicParameters()

    c1 = ClusterBoqInput(
        cluster_id="c-1",
        cluster_label="C-001",
        cluster_name="Bheja Main Settlement",
        modality="GRID_EXTENSION",
        est_households=60,
        slope_mean_deg=9.5,
        forest_crossings=1,
        water_crossings=0,
        ht_length_m=1800.0,
        ht_poles_count=29,
        dt_ratings_kva=[63],
        lt_3ph_length_m=620.0,
        lt_1ph_length_m=480.0,
        lt_poles_count=26,
        solar_pv_kwp=0.0,
        bess_capacity_kwh=0.0,
        inverter_kva=0.0,
        shs_kits_count=0,
        annual_energy_mwh_horizon=50.8,
        total_loss_mwh_yr=2.4,
    )
    c2 = ClusterBoqInput(
        cluster_id="c-2",
        cluster_label="C-002",
        cluster_name="Maliaguda PVTG Hamlet",
        modality="SOLAR_MINIGRID",
        est_households=38,
        slope_mean_deg=16.5,
        forest_crossings=2,
        water_crossings=1,
        ht_length_m=0.0,
        ht_poles_count=0,
        dt_ratings_kva=[],
        lt_3ph_length_m=310.0,
        lt_1ph_length_m=290.0,
        lt_poles_count=15,
        solar_pv_kwp=32.5,
        bess_capacity_kwh=140.0,
        inverter_kva=25.0,
        shs_kits_count=0,
        annual_energy_mwh_horizon=28.5,
        total_loss_mwh_yr=0.8,
    )

    mult_c1, _ = compute_terrain_difficulty_multiplier(9.5, 1, 0)
    mult_c2, _ = compute_terrain_difficulty_multiplier(16.5, 2, 1)
    assert mult_c1 == pytest.approx(1.12)
    assert mult_c2 == pytest.approx(1.25)

    cb1 = compute_cluster_boq(c1, rates_map, econ_params)
    assert cb1.has_unset_rates is False
    expected_sub = round(cb1.base_equipment_inr + cb1.terrain_premium_inr, 2)
    assert cb1.subtotal_supply_erection_inr == pytest.approx(expected_sub)
    expected_total = round(
        expected_sub
        + cb1.gst_amount_inr
        + cb1.contingency_amount_inr
        + cb1.pmc_overhead_amount_inr,
        2,
    )
    assert cb1.total_capex_inr == pytest.approx(expected_total)

    scen_summary = compute_scenario_boq(
        scenario_key="HYBRID_OPTIMAL",
        clusters=[c1, c2],
        rates_map=rates_map,
        econ_params=econ_params,
    )
    assert scen_summary.has_unset_rates is False
    assert scen_summary.export_blocked_reason is None
    assert scen_summary.total_capex_inr == pytest.approx(
        cb1.total_capex_inr
        + compute_cluster_boq(c2, rates_map, econ_params).total_capex_inr
    )

    # Now set HT-COND-ACSR-50 to UNSET and verify export blocking (AC-09.3)
    rates_with_unset = dict(rates_map)
    old_ht = rates_with_unset["HT-COND-ACSR-50"]
    rates_with_unset["HT-COND-ACSR-50"] = RateItemSpec(
        item_code=old_ht.item_code,
        description=old_ht.description,
        category=old_ht.category,
        unit=old_ht.unit,
        rate_inr=None,
        source_type="UNSET",
        citation=old_ht.citation,
        source_year=old_ht.source_year,
    )
    blocked_summary = compute_scenario_boq(
        scenario_key="HYBRID_OPTIMAL",
        clusters=[c1, c2],
        rates_map=rates_with_unset,
        econ_params=econ_params,
    )
    assert blocked_summary.has_unset_rates is True
    assert "HT-COND-ACSR-50" in blocked_summary.unset_item_codes
    assert blocked_summary.export_blocked_reason is not None
    assert "HT-COND-ACSR-50" in blocked_summary.export_blocked_reason
