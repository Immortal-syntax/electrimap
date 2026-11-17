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

"""Unit regression tests covering AUD engineering math, SHS BOQ alignment, and CSV safety."""

import pytest

from app.domain.costing.boq import ClusterBoqInput, compute_scenario_boq
from app.domain.costing.rates import RateItemSpec, export_sor_to_csv, get_default_sor_items_map
from app.domain.engineering.calculations import (
    compute_annual_technical_losses,
    compute_voltage_drop_analysis,
)
from app.domain.engineering.economics import EconomicParameters, compute_capital_recovery_factor
from app.domain.engineering.network_sizing import place_cluster_transformers


def test_minigrid_losses_nonzero_and_1ph_drop_penalty() -> None:
    """Verify SOLAR_MINIGRID (lt_feeder_count=1, ht_length_m=0) reports LT losses > 0
    and 1-phase 240V laterals produce higher percentage drop than 3-phase 415V branches.
    """
    dts = place_cluster_transformers(
        cluster_label="CL-MG",
        cluster_centroid_wgs84=(82.732, 18.567),
        building_points_wgs84=[],
        est_households=45,
        peak_kva_horizon=24.0,
    )

    mg_losses = compute_annual_technical_losses(
        peak_kw_horizon=20.4,
        peak_kva_horizon=24.0,
        energy_kwh_day_horizon=140.0,
        annual_energy_mwh_horizon=51.1,
        ht_length_m=0.0,
        max_lt_branch_m=280.0,
        placed_dts=dts,
        lt_3ph_length_m=320.0,
        lt_1ph_length_m=240.0,
        lt_feeder_count=1,
    )
    assert mg_losses.ht_line_loss_kwh_yr == 0.0
    assert mg_losses.lt_line_loss_kwh_yr > 0.0
    assert mg_losses.total_loss_mwh_yr > 0.0

    vdrop_3ph_only = compute_voltage_drop_analysis(
        peak_kva_horizon=24.0,
        ht_length_m=0.0,
        max_lt_branch_m=280.0,
        dt_count=1,
        lt_3ph_length_m=560.0,
        lt_1ph_length_m=0.0,
    )
    vdrop_with_1ph = compute_voltage_drop_analysis(
        peak_kva_horizon=24.0,
        ht_length_m=0.0,
        max_lt_branch_m=280.0,
        dt_count=1,
        lt_3ph_length_m=320.0,
        lt_1ph_length_m=240.0,
    )
    assert vdrop_with_1ph.lt_drop_pct > vdrop_3ph_only.lt_drop_pct


def test_shs_institutional_packs_and_annualized_cost_math() -> None:
    """Verify institutional PV kits bill into SHS CAPEX, worst_ghi caps PV energy,
    and annualized_cost_inr_yr equals round(npc_inr * crf, 2).
    """
    rates_map = get_default_sor_items_map()
    econ_params = EconomicParameters(discount_rate=0.08, horizon_years=10)

    shs_cluster_low_ghi = ClusterBoqInput(
        cluster_id="c-shs",
        cluster_label="CL-01",
        cluster_name="Remote Hamlet",
        modality="STANDALONE_SHS",
        est_households=20,
        slope_mean_deg=12.0,
        forest_crossings=0,
        water_crossings=0,
        ht_length_m=0.0,
        ht_poles_count=0,
        dt_ratings_kva=[],
        lt_3ph_length_m=0.0,
        lt_1ph_length_m=0.0,
        lt_poles_count=0,
        solar_pv_kwp=0.0,
        bess_capacity_kwh=0.0,
        inverter_kva=0.0,
        shs_kits_count=20,
        institutional_packs_count=2,
        worst_ghi_kwh_m2_day=2.5,
        annual_energy_mwh_horizon=24.0,
        total_loss_mwh_yr=0.0,
    )

    shs_cluster_high_ghi = ClusterBoqInput(
        cluster_id=shs_cluster_low_ghi.cluster_id,
        cluster_label=shs_cluster_low_ghi.cluster_label,
        cluster_name=shs_cluster_low_ghi.cluster_name,
        modality="STANDALONE_SHS",
        est_households=20,
        slope_mean_deg=12.0,
        forest_crossings=0,
        water_crossings=0,
        ht_length_m=0.0,
        ht_poles_count=0,
        dt_ratings_kva=[],
        lt_3ph_length_m=0.0,
        lt_1ph_length_m=0.0,
        lt_poles_count=0,
        solar_pv_kwp=0.0,
        bess_capacity_kwh=0.0,
        inverter_kva=0.0,
        shs_kits_count=20,
        institutional_packs_count=0,
        worst_ghi_kwh_m2_day=5.0,
        annual_energy_mwh_horizon=24.0,
        total_loss_mwh_yr=0.0,
    )

    summary_inst = compute_scenario_boq(
        scenario_key="STANDALONE_SOLAR_HOME",
        clusters=[shs_cluster_low_ghi],
        rates_map=rates_map,
        econ_params=econ_params,
    )
    summary_base = compute_scenario_boq(
        scenario_key="STANDALONE_SOLAR_HOME",
        clusters=[shs_cluster_high_ghi],
        rates_map=rates_map,
        econ_params=econ_params,
    )

    shs_line_inst = next(
        line for line in summary_inst.aggregated_lines if line.item_code == "SHS-KIT-200WP"
    )
    # 20 HH kits + (2 institutional packs * 5 kits) = 30 kits
    assert shs_line_inst.quantity == pytest.approx(30.0)
    assert summary_inst.total_capex_inr > summary_base.total_capex_inr
    assert (
        summary_inst.economics.pv_delivered_energy_kwh
        < summary_base.economics.pv_delivered_energy_kwh
    )

    crf = compute_capital_recovery_factor(0.08, 10)
    assert summary_inst.economics.annualized_cost_inr_yr == pytest.approx(
        round(summary_inst.economics.npc_inr * crf, 2),
        abs=0.05,
    )


def test_export_sor_to_csv_neutralizes_formula_injection() -> None:
    """Verify leading =, +, -, @ characters are apostrophe-prefixed on CSV export."""
    malicious_item = RateItemSpec(
        item_code="CUSTOM-INJECT",
        description="=cmd|' /C calc'!A0",
        category="HT_11KV",
        unit="No.",
        rate_inr=1500.0,
        source_type="USER_TEMPLATE",
        citation="+SUM(1,2) Reference",
        source_year=2025,
    )
    csv_out = export_sor_to_csv([malicious_item])
    assert "'=cmd|" in csv_out
    assert "'+SUM(1,2)" in csv_out


def test_serverless_database_url_normalization_and_reference_dir(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verify postgres:// -> postgresql+psycopg:// normalization, POSTGRES_URL fallback,
    bundled backend/reference_data lookup, and Vercel /tmp SQLite + Secure cookie guards.
    """
    from app.core.config import Settings, normalize_database_url

    assert normalize_database_url("postgres://u:p@host/db?sslmode=require") == (
        "postgresql+psycopg://u:p@host/db?sslmode=require"
    )
    assert normalize_database_url("postgresql://u:p@host/db") == (
        "postgresql+psycopg://u:p@host/db"
    )
    assert normalize_database_url("postgresql+psycopg://u:p@host/db") == (
        "postgresql+psycopg://u:p@host/db"
    )

    monkeypatch.setenv("POSTGRES_URL", "postgres://neon_user:pass@ep-cool.neon.tech/neondb")
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_PROJECT_PRODUCTION_URL", "electrimap-india.vercel.app")
    vercel_pg = Settings(app_env="demo")
    assert vercel_pg.database_url == "postgresql+psycopg://neon_user:pass@ep-cool.neon.tech/neondb"
    assert vercel_pg.effective_cookie_secure is True
    assert "https://electrimap-india.vercel.app" in vercel_pg.cors_origin_list
    assert (vercel_pg.reference_dir / "MANIFEST.json").exists()

    monkeypatch.delenv("POSTGRES_URL")
    vercel_sqlite = Settings(app_env="demo")
    assert vercel_sqlite.database_url.startswith("sqlite:///")
    assert "electrimap_dev.db" in vercel_sqlite.database_url
    assert "./data/" not in vercel_sqlite.database_url
