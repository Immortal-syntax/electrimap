"""Pure GIS zonal statistics extraction, 4-tier proxy electrification classification,
and Census 2011 household reconciliation (ARCHITECTURE.md §4.4 & AGENTS.md §1).
"""

from dataclasses import dataclass
from typing import Any

import numpy as np
from shapely.geometry import Point, Polygon
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from app.domain.gis.clustering import DetectedCluster
from app.domain.gis.crs import project_geometry
from app.domain.gis.layer_processing import generate_aoi_grids


@dataclass(frozen=True)
class ClassificationThresholds:
    """Editable provisional thresholds for Axis-1 proxy classification (§4.4)."""

    nl_electrified_min: float = 0.75
    nl_unserved_max: float = 0.20
    max_infra_dist_electrified_m: float = 1000.0
    max_dt_service_dist_m: float = 500.0
    min_buildings_for_proxy: int = 5


@dataclass(frozen=True)
class ClassifiedClusterResult:
    """Zonal statistics and two-axis epistemic classification for a habitation cluster."""

    cluster: DetectedCluster
    proxy_class: str
    proxy_confidence: str
    verification_state: str
    slope_mean_deg: float
    slope_max_deg: float
    canopy_share: float
    mean_radiance_nw_cm2_sr: float
    nl_lightscore: float
    d_road_m: float | None
    d_infra_m: float | None
    d_dt_m: float | None
    d_electrified_cluster_m: float | None
    evidence: dict[str, Any]


@dataclass(frozen=True)
class CensusReconciliationSummary:
    """Comparison of satellite-estimated households against Census 2011 baseline."""

    census2011_code: str | None
    village_name: str | None
    census_2011_households: int | None
    projected_base_year_households: int | None
    satellite_detected_buildings: int
    satellite_residential_buildings: int
    satellite_estimated_households: int
    delta_households: int | None
    delta_pct: float | None
    divergence_exceeds_30pct: bool
    reconciliation_note: str


def _sample_raster_stats_for_cluster(
    cluster_geom: Polygon,
    aoi_bbox: tuple[float, float, float, float],
    grids: dict[str, np.ndarray],
) -> tuple[float, float, float, float, float]:
    """Extract mean/max slope (deg), canopy share [0..1], mean radiance, and lightscore."""
    min_lon, min_lat, max_lon, max_lat = aoi_bbox
    slope_grid = grids["slope_deg"]
    wc_grid = grids["worldcover"]
    rad_grid = grids["radiance"]
    rows, cols = slope_grid.shape

    c_min_x, c_min_y, c_max_x, c_max_y = cluster_geom.bounds
    span_x = max(max_lon - min_lon, 1e-6)
    span_y = max(max_lat - min_lat, 1e-6)

    col_start = int(np.clip(np.floor((c_min_x - min_lon) / span_x * cols), 0, cols - 1))
    col_end = int(np.clip(np.ceil((c_max_x - min_lon) / span_x * cols), col_start + 1, cols))
    row_start = int(np.clip(np.floor((max_lat - c_max_y) / span_y * rows), 0, rows - 1))
    row_end = int(np.clip(np.ceil((max_lat - c_min_y) / span_y * rows), row_start + 1, rows))

    sub_slope = slope_grid[row_start:row_end, col_start:col_end]
    sub_wc = wc_grid[row_start:row_end, col_start:col_end]
    sub_rad = rad_grid[row_start:row_end, col_start:col_end]

    slope_mean = round(float(np.mean(sub_slope)), 2)
    slope_max = round(float(np.max(sub_slope)), 2)
    canopy_share = round(float(np.mean(sub_wc == 10)), 3)
    mean_rad = round(float(np.mean(sub_rad)), 3)
    lightscore = round(float(np.clip(mean_rad / 1.35, 0.0, 1.0)), 3)
    return slope_mean, slope_max, canopy_share, mean_rad, lightscore


def classify_habitation_clusters(
    clusters: list[DetectedCluster],
    *,
    aoi_geom: BaseGeometry,
    road_geoms_wgs84: list[BaseGeometry] | None = None,
    infra_geoms_wgs84: list[BaseGeometry] | None = None,
    dt_geoms_wgs84: list[BaseGeometry] | None = None,
    metric_epsg: int = 32644,
    thresholds: ClassificationThresholds | None = None,
) -> list[ClassifiedClusterResult]:
    """Compute zonal metrics and assign 4-tier Axis-1 proxy class + Axis-2 UNVERIFIED state.

    Epistemic Honesty Invariants:
    - Proxy classes are strictly in:
      `{"LIKELY_ELECTRIFIED", "POTENTIALLY_UNDERSERVED", "POTENTIALLY_UNSERVED", "UNKNOWN"}`
    - Proxy confidence is strictly in `{"LOW", "MEDIUM"}` (`"HIGH"` is reserved for verified).
    - `verification_state` is always initialized to `"UNVERIFIED"`.
    """
    cfg = thresholds or ClassificationThresholds()
    if not clusters:
        return []

    min_lon, min_lat, max_lon, max_lat = [float(x) for x in aoi_geom.bounds]
    aoi_bbox = (min_lon, min_lat, max_lon, max_lat)
    grids = generate_aoi_grids(aoi_bbox)

    road_union_utm: BaseGeometry | None = None
    if road_geoms_wgs84:
        utm_roads = [
            project_geometry(g, source_epsg=4326, target_epsg=metric_epsg)
            for g in road_geoms_wgs84
        ]
        road_union_utm = unary_union(utm_roads)

    infra_union_utm: BaseGeometry | None = None
    if infra_geoms_wgs84:
        utm_infra = [
            project_geometry(g, source_epsg=4326, target_epsg=metric_epsg)
            for g in infra_geoms_wgs84
        ]
        infra_union_utm = unary_union(utm_infra)

    dt_union_utm: BaseGeometry | None = None
    if dt_geoms_wgs84:
        utm_dts = [
            project_geometry(g, source_epsg=4326, target_epsg=metric_epsg)
            for g in dt_geoms_wgs84
        ]
        dt_union_utm = unary_union(utm_dts)

    cluster_utm_centroids: list[Point] = []
    raw_stats: list[dict[str, Any]] = []
    electrified_utm_points: list[Point] = []

    for c in clusters:
        c_utm = project_geometry(c.centroid, source_epsg=4326, target_epsg=metric_epsg)
        c_utm_pt = Point(float(c_utm.centroid.x), float(c_utm.centroid.y))
        cluster_utm_centroids.append(c_utm_pt)

        slope_mean, slope_max, canopy_share, mean_rad, nl_score = (
            _sample_raster_stats_for_cluster(c.geom, aoi_bbox, grids)
        )
        d_road_m = (
            round(float(c_utm_pt.distance(road_union_utm)), 1)
            if road_union_utm is not None
            else None
        )
        d_infra_m = (
            round(float(c_utm_pt.distance(infra_union_utm)), 1)
            if infra_union_utm is not None
            else None
        )
        d_dt_m = (
            round(float(c_utm_pt.distance(dt_union_utm)), 1)
            if dt_union_utm is not None
            else None
        )

        is_likely_elec = (
            not c.is_isolated_group
            and c.n_detected >= cfg.min_buildings_for_proxy
            and nl_score >= cfg.nl_electrified_min
            and (d_infra_m is None or d_infra_m <= cfg.max_infra_dist_electrified_m)
        )
        if is_likely_elec:
            electrified_utm_points.append(c_utm_pt)

        raw_stats.append(
            {
                "slope_mean_deg": slope_mean,
                "slope_max_deg": slope_max,
                "canopy_share": canopy_share,
                "mean_radiance_nw_cm2_sr": mean_rad,
                "nl_lightscore": nl_score,
                "d_road_m": d_road_m,
                "d_infra_m": d_infra_m,
                "d_dt_m": d_dt_m,
                "is_likely_elec": is_likely_elec,
            }
        )

    results: list[ClassifiedClusterResult] = []
    for idx, c in enumerate(clusters):
        st = raw_stats[idx]
        c_utm_pt = cluster_utm_centroids[idx]
        nl_score = float(st["nl_lightscore"])
        d_infra_m = st["d_infra_m"]
        d_dt_m = st["d_dt_m"]
        d_road_m = st["d_road_m"]
        canopy_share = float(st["canopy_share"])

        d_elec_m: float | None = None
        if electrified_utm_points:
            dists = [
                float(c_utm_pt.distance(ep))
                for ep in electrified_utm_points
                if ep.distance(c_utm_pt) > 1.0
            ]
            if st["is_likely_elec"]:
                d_elec_m = 0.0
            elif dists:
                d_elec_m = round(min(dists), 1)

        reasons: list[str] = []
        if c.is_isolated_group or c.n_detected < cfg.min_buildings_for_proxy:
            proxy_class = "UNKNOWN"
            proxy_confidence = "LOW"
            reasons.append(
                f"Small/dispersed habitation group ({c.n_detected} footprints < "
                f"{cfg.min_buildings_for_proxy} threshold); 500m nightlights cannot "
                "resolve isolated roofs reliably."
            )
        elif st["is_likely_elec"]:
            proxy_class = "LIKELY_ELECTRIFIED"
            proxy_confidence = (
                "MEDIUM" if (d_road_m is not None and d_road_m <= 500.0) else "LOW"
            )
            reasons.append(
                f"Nightlight LightScore={nl_score:.2f} (>= {cfg.nl_electrified_min:.2f}) "
                "indicates sustained nocturnal radiance."
            )
        elif nl_score < cfg.nl_unserved_max and (
            (d_infra_m is not None and d_infra_m > cfg.max_infra_dist_electrified_m)
            or (d_infra_m is None and (d_elec_m is None or d_elec_m > 800.0))
        ):
            proxy_class = "POTENTIALLY_UNSERVED"
            proxy_confidence = "MEDIUM" if canopy_share < 0.65 else "LOW"
            reasons.append(
                f"Low nightlight LightScore={nl_score:.2f} (< {cfg.nl_unserved_max:.2f}) "
                "and remote from electrified core/grid lines."
            )
        else:
            proxy_class = "POTENTIALLY_UNDERSERVED"
            proxy_confidence = "MEDIUM"
            if d_dt_m is not None and d_dt_m > cfg.max_dt_service_dist_m:
                reasons.append(
                    f"Distance to nearest DT ({d_dt_m:.0f} m) exceeds "
                    f"{cfg.max_dt_service_dist_m:.0f} m LT regulation limit."
                )
            else:
                reasons.append(
                    f"Intermediate nightlight LightScore={nl_score:.2f} in "
                    f"[{cfg.nl_unserved_max:.2f}, {cfg.nl_electrified_min:.2f}) "
                    "suggests partial coverage or peripheral tail-end supply."
                )

        evidence_dict: dict[str, Any] = {
            "quality_tag": "PROXY",
            "nl_lightscore": nl_score,
            "mean_radiance_nw_cm2_sr": st["mean_radiance_nw_cm2_sr"],
            "slope_mean_deg": st["slope_mean_deg"],
            "slope_max_deg": st["slope_max_deg"],
            "canopy_share": canopy_share,
            "d_road_m": d_road_m,
            "d_infra_m": d_infra_m,
            "d_dt_m": d_dt_m,
            "d_electrified_cluster_m": d_elec_m,
            "rationale": " ".join(reasons),
            "epistemic_notice": (
                "Satellite proxy estimation only — does not verify household meter "
                "connections or hours of supply."
            ),
        }

        results.append(
            ClassifiedClusterResult(
                cluster=c,
                proxy_class=proxy_class,
                proxy_confidence=proxy_confidence,
                verification_state="UNVERIFIED",
                slope_mean_deg=st["slope_mean_deg"],
                slope_max_deg=st["slope_max_deg"],
                canopy_share=canopy_share,
                mean_radiance_nw_cm2_sr=st["mean_radiance_nw_cm2_sr"],
                nl_lightscore=nl_score,
                d_road_m=d_road_m,
                d_infra_m=d_infra_m,
                d_dt_m=d_dt_m,
                d_electrified_cluster_m=d_elec_m,
                evidence=evidence_dict,
            )
        )

    return results


def reconcile_census_households(
    *,
    satellite_detected_buildings: int,
    satellite_residential_buildings: int,
    satellite_estimated_households: int,
    census2011_code: str | None,
    village_name: str | None,
    census_2011_households: int | None,
    base_year: int = 2026,
    annual_growth_rate: float = 0.014,
) -> CensusReconciliationSummary:
    """Cross-check satellite household estimates against Census 2011 baseline (§4.4 Rule 3)."""
    if census_2011_households is None or census_2011_households <= 0:
        return CensusReconciliationSummary(
            census2011_code=census2011_code,
            village_name=village_name,
            census_2011_households=census_2011_households,
            projected_base_year_households=None,
            satellite_detected_buildings=satellite_detected_buildings,
            satellite_residential_buildings=satellite_residential_buildings,
            satellite_estimated_households=satellite_estimated_households,
            delta_households=None,
            delta_pct=None,
            divergence_exceeds_30pct=False,
            reconciliation_note=(
                "No Census 2011 household baseline linked to this AOI; "
                "household count is derived solely from residential footprints (alpha=0.90)."
            ),
        )

    years_elapsed = max(0, base_year - 2011)
    projected_hh = int(
        round(census_2011_households * ((1.0 + annual_growth_rate) ** years_elapsed))
    )
    delta_hh = satellite_estimated_households - projected_hh
    delta_pct = round((delta_hh / max(projected_hh, 1)) * 100.0, 1)
    exceeds_30 = abs(delta_pct) > 30.0

    if exceeds_30:
        note = (
            f"DIVERGENCE FLAG (|Δ| = {abs(delta_pct):.1f}% > 30%): Satellite estimate "
            f"({satellite_estimated_households} HH) differs significantly from projected "
            f"{base_year} Census baseline ({projected_hh} HH from {census_2011_households} HH "
            "in 2011). Field verification of habitation boundaries and multi-family dwellings "
            "is mandatory."
        )
    else:
        note = (
            f"RECONCILED (|Δ| = {abs(delta_pct):.1f}% <= 30%): Satellite estimate "
            f"({satellite_estimated_households} HH) is consistent with {base_year} projected "
            f"Census households ({projected_hh} HH from {census_2011_households} HH in 2011)."
        )

    return CensusReconciliationSummary(
        census2011_code=census2011_code,
        village_name=village_name,
        census_2011_households=census_2011_households,
        projected_base_year_households=projected_hh,
        satellite_detected_buildings=satellite_detected_buildings,
        satellite_residential_buildings=satellite_residential_buildings,
        satellite_estimated_households=satellite_estimated_households,
        delta_households=delta_hh,
        delta_pct=delta_pct,
        divergence_exceeds_30pct=exceeds_30,
        reconciliation_note=note,
    )
