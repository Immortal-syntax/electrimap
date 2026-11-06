"""Unit tests for pure settlement clustering, 4-tier proxy classification,
and Census 2011 household reconciliation (Milestone M3-1 & M3-2).
"""

from shapely.geometry import LineString, Point, Polygon

from app.domain.gis.classification import (
    classify_habitation_clusters,
    reconcile_census_households,
)
from app.domain.gis.clustering import (
    BuildingFootprintInput,
    run_dbscan_habitation_clustering,
)


def _make_square_building(
    bid: str,
    lon: float,
    lat: float,
    *,
    size_class: str = "RESIDENTIAL",
    area_m2: float = 48.0,
    is_excluded: bool = False,
) -> BuildingFootprintInput:
    d = 0.00004
    poly = Polygon(
        [
            (lon - d, lat - d),
            (lon + d, lat - d),
            (lon + d, lat + d),
            (lon - d, lat + d),
            (lon - d, lat - d),
        ]
    )
    return BuildingFootprintInput(
        building_id=bid,
        geom=poly,
        centroid=Point(lon, lat),
        area_m2=area_m2,
        confidence=0.88,
        size_class=size_class,
        is_excluded=is_excluded,
    )


def test_dbscan_habitation_clustering_core_and_isolated_groups() -> None:
    buildings: list[BuildingFootprintInput] = []
    # Cluster 1: 10 residential buildings tightly grouped around (82.720, 18.560)
    for i in range(10):
        buildings.append(
            _make_square_building(
                f"B-C1-{i}",
                82.720 + (i % 5) * 0.0002,
                18.560 + (i // 5) * 0.0002,
                size_class="RESIDENTIAL",
            )
        )
    # Cluster 2: 6 buildings ~1.2 km east at (82.732, 18.565)
    for i in range(6):
        buildings.append(
            _make_square_building(
                f"B-C2-{i}",
                82.732 + (i % 3) * 0.0002,
                18.565 + (i // 3) * 0.0002,
                size_class="RESIDENTIAL" if i < 5 else "NON_RESIDENTIAL",
            )
        )
    # 2 isolated homesteads ~1.5 km north-west at (82.710, 18.572)
    buildings.append(_make_square_building("B-ISO-1", 82.710, 18.572))
    buildings.append(_make_square_building("B-ISO-2", 82.7103, 18.5722))
    # 1 noise building that should be excluded
    buildings.append(
        _make_square_building(
            "B-NOISE-1", 82.720, 18.560, size_class="NOISE", area_m2=5.0, is_excluded=True
        )
    )

    res = run_dbscan_habitation_clustering(
        buildings,
        metric_epsg=32644,
        eps_m=150.0,
        min_samples=5,
        household_alpha=0.90,
    )

    assert res.excluded_count == 1
    assert len(res.clusters) == 3

    cl1 = res.clusters[0]
    assert cl1.label == "CL-01"
    assert not cl1.is_isolated_group
    assert cl1.n_detected == 10
    assert cl1.n_residential == 10
    assert cl1.est_households == 9  # round(10 * 0.90)

    cl2 = res.clusters[1]
    assert cl2.label == "CL-02"
    assert not cl2.is_isolated_group
    assert cl2.n_detected == 6
    assert cl2.n_residential == 5
    assert cl2.n_non_residential == 1
    assert cl2.est_households == 4  # round(5 * 0.90) = 4

    iso1 = res.clusters[2]
    assert iso1.label == "ISO-01"
    assert iso1.is_isolated_group
    assert iso1.n_detected == 2
    assert iso1.est_households == 2


def test_classify_habitation_clusters_enforces_epistemic_honesty() -> None:
    aoi_poly = Polygon(
        [
            (82.705, 18.550),
            (82.745, 18.550),
            (82.745, 18.580),
            (82.705, 18.580),
            (82.705, 18.550),
        ]
    )
    buildings: list[BuildingFootprintInput] = []
    # Main village core near west-south radiance peak (82.719, 18.561)
    for i in range(12):
        buildings.append(
            _make_square_building(
                f"CORE-{i}",
                82.719 + (i % 4) * 0.0002,
                18.561 + (i // 4) * 0.0002,
            )
        )
    # Remote northern ridge hamlet (82.738, 18.576)
    for i in range(6):
        buildings.append(
            _make_square_building(
                f"REMOTE-{i}",
                82.738 + (i % 3) * 0.0002,
                18.576 + (i // 3) * 0.0002,
            )
        )
    # Dispersed 2-building group
    buildings.append(_make_square_building("DISP-1", 82.708, 18.575))
    buildings.append(_make_square_building("DISP-2", 82.7082, 18.5752))

    clustering = run_dbscan_habitation_clustering(buildings, metric_epsg=32644)
    road_line = LineString([(82.710, 18.560), (82.730, 18.562)])

    classified = classify_habitation_clusters(
        clustering.clusters,
        aoi_geom=aoi_poly,
        road_geoms_wgs84=[road_line],
        metric_epsg=32644,
    )

    assert len(classified) == 3
    valid_classes = {
        "LIKELY_ELECTRIFIED",
        "POTENTIALLY_UNDERSERVED",
        "POTENTIALLY_UNSERVED",
        "UNKNOWN",
    }
    for item in classified:
        assert item.proxy_class in valid_classes
        # Rule 6: HIGH confidence is reserved strictly for verified states
        assert item.proxy_confidence in {"LOW", "MEDIUM"}
        # Axis 2 must always start UNVERIFIED
        assert item.verification_state == "UNVERIFIED"
        assert item.evidence["quality_tag"] == "PROXY"

    # Dispersed group (<5 buildings) must be classified as UNKNOWN
    iso_item = next(c for c in classified if c.cluster.is_isolated_group)
    assert iso_item.proxy_class == "UNKNOWN"


def test_reconcile_census_households_flags_30pct_divergence() -> None:
    reconciled_ok = reconcile_census_households(
        satellite_detected_buildings=145,
        satellite_residential_buildings=135,
        satellite_estimated_households=122,
        census2011_code="428914",
        village_name="Bheja",
        census_2011_households=105,
        base_year=2026,
    )
    assert not reconciled_ok.divergence_exceeds_30pct
    assert "RECONCILED" in reconciled_ok.reconciliation_note

    diverged = reconcile_census_households(
        satellite_detected_buildings=260,
        satellite_residential_buildings=240,
        satellite_estimated_households=216,
        census2011_code="428914",
        village_name="Bheja",
        census_2011_households=105,
        base_year=2026,
    )
    assert diverged.divergence_exceeds_30pct
    assert "DIVERGENCE FLAG" in diverged.reconciliation_note
