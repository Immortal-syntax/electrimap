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

"""Unit tests for Milestone M4 pure domain modules:
- `app.domain.gis.gap_analysis` (UTM terrain-weighted distance, water crossings, no-fabricated)
- `app.domain.engineering.demand` (7-category rural demand estimation & compound horizon growth)
"""

from shapely.geometry import LineString, Point, Polygon

from app.domain.engineering.demand import (
    compute_cluster_demand,
    compute_project_demand_summary,
)
from app.domain.gis.gap_analysis import (
    ClusterGapInput,
    InfraAssetInput,
    run_project_gap_analysis,
)


def _sample_cluster(
    cluster_id: str,
    label: str,
    lon: float,
    lat: float,
    est_hh: int,
    proxy_class: str = "POTENTIALLY_UNSERVED",
    slope_deg: float = 8.0,
    canopy_share: float = 0.25,
) -> ClusterGapInput:
    poly = Polygon(
        [
            (lon - 0.001, lat - 0.001),
            (lon + 0.001, lat - 0.001),
            (lon + 0.001, lat + 0.001),
            (lon - 0.001, lat + 0.001),
            (lon - 0.001, lat - 0.001),
        ]
    )
    return ClusterGapInput(
        cluster_id=cluster_id,
        label=label,
        name=f"Habitation {label}",
        centroid_wgs84=Point(lon, lat),
        geom_wgs84=poly,
        est_households=est_hh,
        proxy_class=proxy_class,
        verification_state="UNVERIFIED",
        verified_class=None,
        slope_mean_deg=slope_deg,
        canopy_share=canopy_share,
        d_road_m=120.0,
    )


def test_gap_analysis_with_no_infrastructure_reports_unset_honestly() -> None:
    """Verify Core Principle #4: when no infra exists, d_straight_m & d_terrain_m are None."""
    clusters = [_sample_cluster("c-1", "CL-01", 82.732, 18.567, 45)]
    summary = run_project_gap_analysis(
        clusters,
        infra_assets=[],
        waterway_geoms_wgs84=[],
        metric_epsg=32644,
    )
    assert summary.has_existing_infra is False
    assert summary.infra_assets_count == 0
    assert summary.mean_d_straight_m is None
    assert summary.mean_d_terrain_m is None
    assert summary.clusters[0].d_straight_m is None
    assert summary.clusters[0].d_terrain_m is None
    assert summary.clusters[0].recommended_modality == "UNSET_INFRA_REQUIRED"


def test_gap_analysis_computes_utm_distances_water_crossings_and_modalities() -> None:
    """Verify metric distance, waterway crossing penalty, and modality recommendations."""
    c_near = _sample_cluster(
        "c-1",
        "CL-01",
        82.732,
        18.567,
        48,
        proxy_class="POTENTIALLY_UNSERVED",
        slope_deg=6.0,
        canopy_share=0.20,
    )
    c_remote_large = _sample_cluster(
        "c-2",
        "CL-02",
        82.775,
        18.595,
        32,
        proxy_class="POTENTIALLY_UNSERVED",
        slope_deg=19.5,
        canopy_share=0.68,
    )
    c_remote_small = _sample_cluster(
        "c-3",
        "ISO-01",
        82.765,
        18.588,
        6,
        proxy_class="POTENTIALLY_UNSERVED",
        slope_deg=14.0,
        canopy_share=0.50,
    )

    tie_in = InfraAssetInput(
        asset_id="a-1",
        asset_type="TIE_IN",
        name="Nandapur 11 kV Feeder Tap Point",
        geom_wgs84=Point(82.725, 18.565),
        provenance="USER_ASSUMED",
        voltage_kv=11.0,
    )
    river = LineString([(82.728, 18.550), (82.728, 18.580)])

    summary = run_project_gap_analysis(
        [c_near, c_remote_large, c_remote_small],
        infra_assets=[tie_in],
        waterway_geoms_wgs84=[river],
        metric_epsg=32644,
    )

    assert summary.has_existing_infra is True
    assert summary.assumed_assets_count == 1

    r_near = summary.clusters[0]
    assert r_near.d_straight_m is not None and 650.0 < r_near.d_straight_m < 950.0
    assert r_near.water_crossings_count == 1
    assert r_near.d_terrain_m is not None and r_near.d_terrain_m > r_near.d_straight_m
    assert r_near.recommended_modality == "GRID_EXTENSION"
    assert r_near.corridor_line_wgs84 is not None

    r_remote_large = summary.clusters[1]
    assert r_remote_large.recommended_modality == "SOLAR_MINIGRID"

    r_remote_small = summary.clusters[2]
    assert r_remote_small.recommended_modality == "STANDALONE_SHS"


def test_seven_category_demand_engine_and_horizon_compound_growth() -> None:
    """Verify all 7 consumer categories, coincident peak kVA, and compound horizon growth."""
    res = compute_cluster_demand(
        cluster_id="c-1",
        cluster_label="CL-01",
        cluster_name="Bheja Main Village Core",
        est_households=50,
        n_non_residential=2,
        horizon_years=10,
        assumptions={"bpl_household_share": 0.60, "annual_demand_growth_rate": 0.05},
    )

    assert len(res.categories) == 7
    cat_by_code = {c.category: c for c in res.categories}

    # 60% of 50 HH = 30 BPL HH, 20 APL HH
    assert cat_by_code["DOMESTIC_BPL"].consumer_count == 30
    assert cat_by_code["DOMESTIC_APL"].consumer_count == 20
    assert cat_by_code["INSTITUTIONAL"].consumer_count >= 1
    assert cat_by_code["STREET_LIGHTING"].consumer_count == 5
    assert cat_by_code["WATER_PUMPING"].consumer_count == 1
    assert cat_by_code["AGRICULTURAL_IRRIGATION"].consumer_count == 2
    assert cat_by_code["MICRO_ENTERPRISE"].consumer_count == 2

    assert res.total_connected_kw > 0
    assert res.peak_kw_base < res.non_coincident_peak_kw
    assert res.peak_kva_base > res.peak_kw_base
    assert res.peak_kva_horizon > res.peak_kva_base

    # Verify project summary aggregation
    proj_sum = compute_project_demand_summary(
        [
            {
                "cluster_id": "c-1",
                "label": "CL-01",
                "name": "Bheja Core",
                "est_households": 50,
                "n_non_residential": 2,
            },
            {
                "cluster_id": "c-2",
                "label": "CL-02",
                "name": "Podapadar Tola",
                "est_households": 30,
                "n_non_residential": 0,
            },
        ],
        horizon_years=10,
    )
    assert proj_sum.total_households == 80
    assert len(proj_sum.category_totals) == 7
    assert len(proj_sum.clusters) == 2
    assert proj_sum.annual_energy_mwh_horizon > proj_sum.annual_energy_mwh_base
