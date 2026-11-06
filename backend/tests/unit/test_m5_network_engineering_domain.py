"""Unit tests for Milestone M5 pure engineering domain:
- REC/IS/CEA Engineering Constants (`constants.py`)
- Distribution Transformer placement & sub-zone splitting (`network_sizing.py`)
- 11 kV HT feeder MCP_Geometric routing & 415 V LT radial MST (`network_sizing.py`)
- Voltage drop, technical losses, Solar PV + BESS Mini-Grid, and SHS sizing (`calculations.py`)
"""

from app.domain.engineering.calculations import (
    compute_annual_technical_losses,
    compute_solar_minigrid_sizing,
    compute_standalone_shs_sizing,
    compute_voltage_drop_analysis,
    evaluate_cluster_engineering_layout,
)
from app.domain.engineering.constants import (
    STANDARD_ENGINEERING_CONSTANTS,
    get_default_constants_map,
    select_standard_dt_spec,
)
from app.domain.engineering.network_sizing import (
    build_cluster_415v_lt_mst,
    place_cluster_transformers,
    route_cluster_11kv_ht_feeder,
)


def test_standard_constants_and_dt_selection() -> None:
    consts = get_default_constants_map()
    assert len(STANDARD_ENGINEERING_CONSTANTS) >= 19
    assert consts["ht_11kv_r_ohm_per_km"] == 0.5426
    assert consts["lt_415v_3ph_r_ohm_per_km"] == 0.641
    assert consts["ht_max_vdrop_pct"] == 5.0
    assert consts["lt_max_vdrop_pct"] == 6.0

    # 12 kVA horizon peak -> 16 kVA DT (80% of 16 = 12.8 kVA)
    dt_16 = select_standard_dt_spec(12.0, max_loading_ratio=0.80)
    assert dt_16.rating_kva == 16.0

    # 45 kVA horizon peak -> 63 kVA DT (80% of 63 = 50.4 kVA)
    dt_63 = select_standard_dt_spec(45.0, max_loading_ratio=0.80)
    assert dt_63.rating_kva == 63.0


def test_dt_placement_ht_routing_and_lt_mst() -> None:
    # Single sub-zone cluster
    dts = place_cluster_transformers(
        cluster_label="CL-01",
        cluster_centroid_wgs84=(82.732, 18.567),
        building_points_wgs84=[],
        est_households=60,
        peak_kva_horizon=42.0,
    )
    assert len(dts) == 1
    assert dts[0].rating_kva == 63.0
    assert dts[0].loading_pct <= 80.0

    # Without tie-in point, Core Principle #4 requires ht_length_m == 0 and requires_tie_in == True
    ht_unset = route_cluster_11kv_ht_feeder(
        tie_in_wgs84=None,
        placed_dts=dts,
        slope_mean_deg=8.0,
        canopy_share=0.2,
        water_crossings_count=0,
    )
    assert ht_unset.requires_tie_in is True
    assert ht_unset.ht_length_m == 0.0
    assert ht_unset.ht_poles_count == 0

    # With explicit tie-in point, routes via MCP_Geometric in UTM EPSG:32644
    ht_routed = route_cluster_11kv_ht_feeder(
        tie_in_wgs84=(82.725, 18.562),
        placed_dts=dts,
        slope_mean_deg=16.5,  # Steep slope -> 45 m span
        canopy_share=0.30,
        water_crossings_count=1,
    )
    assert ht_routed.requires_tie_in is False
    assert ht_routed.ht_length_m > 800.0
    assert ht_routed.effective_span_m == 45.0
    assert ht_routed.ht_poles_count >= 18
    assert ht_routed.ht_line_wgs84 is not None

    # 415 V LT radial MST
    lt_mst = build_cluster_415v_lt_mst(
        cluster_centroid_wgs84=(82.732, 18.567),
        building_points_wgs84=[],
        est_households=60,
        placed_dts=dts,
    )
    assert lt_mst.lt_total_length_m > 100.0
    assert lt_mst.max_lt_branch_m > 40.0
    assert lt_mst.lt_poles_count >= 4
    assert lt_mst.lt_lines_wgs84 is not None


def test_voltage_drop_losses_and_offgrid_sizing() -> None:
    dts = place_cluster_transformers(
        cluster_label="CL-01",
        cluster_centroid_wgs84=(82.732, 18.567),
        building_points_wgs84=[],
        est_households=55,
        peak_kva_horizon=38.0,
    )
    vdrop = compute_voltage_drop_analysis(
        peak_kva_horizon=38.0,
        ht_length_m=1450.0,
        max_lt_branch_m=240.0,
        dt_count=1,
    )
    assert vdrop.ht_drop_pct > 0.0
    assert vdrop.lt_drop_pct > 0.0
    assert vdrop.overall_vdrop_compliant is True

    losses = compute_annual_technical_losses(
        peak_kw_horizon=32.3,
        peak_kva_horizon=38.0,
        energy_kwh_day_horizon=220.0,
        annual_energy_mwh_horizon=80.3,
        ht_length_m=1450.0,
        max_lt_branch_m=240.0,
        placed_dts=dts,
    )
    assert losses.total_loss_mwh_yr > 0.5
    assert 0.5 <= losses.technical_loss_pct <= 15.0

    mg = compute_solar_minigrid_sizing(
        peak_kva_horizon=28.0,
        energy_kwh_day_horizon=165.0,
        worst_ghi_kwh_m2_day=3.82,
    )
    assert mg.solar_pv_kwp >= 60.0
    assert mg.bess_capacity_kwh >= 200.0
    assert mg.inverter_kva >= 35.0

    shs = compute_standalone_shs_sizing(est_households=18, n_non_residential=1)
    assert shs.shs_kits_count == 18
    assert shs.institutional_packs_count == 1
    assert shs.total_pv_kwp == 4.6

    eval_grid = evaluate_cluster_engineering_layout(
        cluster_id="cl-test",
        cluster_label="CL-01",
        cluster_name="Bheja Main Core",
        est_households=55,
        n_non_residential=2,
        cluster_centroid_wgs84=(82.732, 18.567),
        building_points_wgs84=[],
        modality="GRID_EXTENSION",
        is_manual_override=False,
        tie_in_wgs84=(82.725, 18.562),
        slope_mean_deg=7.5,
        canopy_share=0.18,
        water_crossings_count=0,
        peak_kw_horizon=32.3,
        peak_kva_horizon=38.0,
        energy_kwh_day_horizon=220.0,
        annual_energy_mwh_horizon=80.3,
    )
    assert eval_grid.dt_count == 1
    assert eval_grid.ht_length_m > 500.0
    assert eval_grid.lt_total_length_m > 100.0
