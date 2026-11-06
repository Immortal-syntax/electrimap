"""Pure GIS habitation clustering domain using metric UTM DBSCAN (scikit-learn)."""

import math
from dataclasses import dataclass, field

import numpy as np
from shapely.geometry import MultiPoint, Point, Polygon
from shapely.ops import unary_union
from sklearn.cluster import DBSCAN

from app.domain.gis.crs import project_geometry


@dataclass(frozen=True)
class BuildingFootprintInput:
    """Input footprint record for habitation clustering (geometries in EPSG:4326)."""

    building_id: str
    geom: Polygon
    centroid: Point
    area_m2: float
    confidence: float
    size_class: str
    is_excluded: bool = False


@dataclass(frozen=True)
class DetectedCluster:
    """A single habitation cluster or grouped isolated-homestead unit."""

    cluster_index: int
    label: str
    is_isolated_group: bool
    geom: Polygon
    centroid: Point
    building_ids: list[str]
    n_detected: int
    n_residential: int
    n_non_residential: int
    n_outbuilding: int
    est_households: int


@dataclass(frozen=True)
class ClusteringResult:
    """Complete output of a habitation clustering run."""

    clusters: list[DetectedCluster] = field(default_factory=list)
    building_to_cluster_index: dict[str, int] = field(default_factory=dict)
    excluded_count: int = 0


def _build_cluster_hull_wgs84(
    utm_polygons: list[Polygon],
    *,
    metric_epsg: int,
    hull_buffer_m: float,
) -> tuple[Polygon, Point]:
    """Compute a buffered convex hull in UTM (m) and reproject back to WGS 84 (EPSG:4326)."""
    merged_utm = unary_union(utm_polygons)
    hull_utm = merged_utm.convex_hull.buffer(hull_buffer_m, quad_segs=8).simplify(
        2.5, preserve_topology=True
    )
    if not isinstance(hull_utm, Polygon):
        pts = [p.centroid for p in utm_polygons]
        hull_utm = MultiPoint(pts).convex_hull.buffer(hull_buffer_m, quad_segs=8)

    hull_wgs84_geom = project_geometry(hull_utm, source_epsg=metric_epsg, target_epsg=4326)
    hull_wgs84 = (
        hull_wgs84_geom
        if isinstance(hull_wgs84_geom, Polygon)
        else Polygon(hull_wgs84_geom.convex_hull)
    )
    centroid_wgs84 = Point(float(hull_wgs84.centroid.x), float(hull_wgs84.centroid.y))
    return hull_wgs84, centroid_wgs84


def run_dbscan_habitation_clustering(
    buildings: list[BuildingFootprintInput],
    *,
    metric_epsg: int = 32644,
    eps_m: float = 150.0,
    min_samples: int = 5,
    household_alpha: float = 0.90,
    isolated_grid_m: float = 500.0,
    hull_buffer_m: float = 25.0,
) -> ClusteringResult:
    """Cluster valid building footprints in metric UTM space (`metric_epsg`).

    Rules (ARCHITECTURE.md §4.4):
    1. Exclude footprints marked `is_excluded=True` or `size_class == "NOISE"`.
    2. Project valid footprints and centroids to `metric_epsg` (meters).
    3. Run scikit-learn `DBSCAN(eps=eps_m, min_samples=min_samples, metric='euclidean')`
       over valid building centroids.
    4. Order core clusters deterministically by descending building count (then west-to-east)
       and label them `CL-01`, `CL-02`, ...
    5. Group DBSCAN noise (`label == -1`, isolated homesteads) by `isolated_grid_m` UTM grid
       cells and label them `ISO-01`, `ISO-02`, ... with `is_isolated_group=True`.
    6. Estimate households as `max(1, round(n_residential * household_alpha))` when
       `n_residential > 0`, else `0`.
    """
    if eps_m <= 0:
        raise ValueError("eps_m must be positive.")
    if min_samples < 2:
        raise ValueError("min_samples must be at least 2.")

    valid_buildings: list[BuildingFootprintInput] = []
    excluded_count = 0
    for b in buildings:
        if b.is_excluded or b.size_class == "NOISE":
            excluded_count += 1
        else:
            valid_buildings.append(b)

    if not valid_buildings:
        return ClusteringResult(
            clusters=[],
            building_to_cluster_index={},
            excluded_count=excluded_count,
        )

    utm_polys: list[Polygon] = []
    utm_coords = np.zeros((len(valid_buildings), 2), dtype=np.float64)
    for idx, b in enumerate(valid_buildings):
        p_utm = project_geometry(b.geom, source_epsg=4326, target_epsg=metric_epsg)
        c_utm = project_geometry(b.centroid, source_epsg=4326, target_epsg=metric_epsg)
        utm_polys.append(
            p_utm if isinstance(p_utm, Polygon) else Polygon(p_utm.convex_hull)
        )
        utm_coords[idx, 0] = float(c_utm.centroid.x)
        utm_coords[idx, 1] = float(c_utm.centroid.y)

    dbscan = DBSCAN(eps=eps_m, min_samples=min_samples, metric="euclidean", algorithm="ball_tree")
    raw_labels: np.ndarray = dbscan.fit_predict(utm_coords)

    core_groups: dict[int, list[int]] = {}
    noise_indices: list[int] = []
    for idx, lbl in enumerate(raw_labels):
        lbl_int = int(lbl)
        if lbl_int == -1:
            noise_indices.append(idx)
        else:
            core_groups.setdefault(lbl_int, []).append(idx)

    sorted_core = sorted(
        core_groups.values(),
        key=lambda indices: (-len(indices), float(np.mean(utm_coords[indices, 0]))),
    )

    clusters: list[DetectedCluster] = []
    building_to_cluster_index: dict[str, int] = {}

    for c_idx, member_indices in enumerate(sorted_core, start=1):
        label_str = f"CL-{c_idx:02d}"
        cluster_obj = _create_detected_cluster(
            cluster_index=len(clusters),
            label=label_str,
            is_isolated_group=False,
            member_indices=member_indices,
            valid_buildings=valid_buildings,
            utm_polys=utm_polys,
            metric_epsg=metric_epsg,
            hull_buffer_m=hull_buffer_m,
            household_alpha=household_alpha,
        )
        for bid in cluster_obj.building_ids:
            building_to_cluster_index[bid] = cluster_obj.cluster_index
        clusters.append(cluster_obj)

    if noise_indices:
        iso_cells: dict[tuple[int, int], list[int]] = {}
        for idx in noise_indices:
            gx = int(math.floor(utm_coords[idx, 0] / isolated_grid_m))
            gy = int(math.floor(utm_coords[idx, 1] / isolated_grid_m))
            iso_cells.setdefault((gx, gy), []).append(idx)

        sorted_iso = sorted(
            iso_cells.values(),
            key=lambda indices: (-len(indices), float(np.mean(utm_coords[indices, 0]))),
        )
        for iso_idx, member_indices in enumerate(sorted_iso, start=1):
            label_str = f"ISO-{iso_idx:02d}"
            cluster_obj = _create_detected_cluster(
                cluster_index=len(clusters),
                label=label_str,
                is_isolated_group=True,
                member_indices=member_indices,
                valid_buildings=valid_buildings,
                utm_polys=utm_polys,
                metric_epsg=metric_epsg,
                hull_buffer_m=hull_buffer_m,
                household_alpha=household_alpha,
            )
            for bid in cluster_obj.building_ids:
                building_to_cluster_index[bid] = cluster_obj.cluster_index
            clusters.append(cluster_obj)

    return ClusteringResult(
        clusters=clusters,
        building_to_cluster_index=building_to_cluster_index,
        excluded_count=excluded_count,
    )


def _create_detected_cluster(
    *,
    cluster_index: int,
    label: str,
    is_isolated_group: bool,
    member_indices: list[int],
    valid_buildings: list[BuildingFootprintInput],
    utm_polys: list[Polygon],
    metric_epsg: int,
    hull_buffer_m: float,
    household_alpha: float,
) -> DetectedCluster:
    member_blds = [valid_buildings[i] for i in member_indices]
    member_utm_polys = [utm_polys[i] for i in member_indices]
    hull_wgs84, centroid_wgs84 = _build_cluster_hull_wgs84(
        member_utm_polys,
        metric_epsg=metric_epsg,
        hull_buffer_m=hull_buffer_m,
    )

    n_detected = len(member_blds)
    n_res = sum(1 for b in member_blds if b.size_class == "RESIDENTIAL")
    n_non_res = sum(1 for b in member_blds if b.size_class == "NON_RESIDENTIAL")
    n_out = sum(1 for b in member_blds if b.size_class == "OUTBUILDING")

    est_hh = max(1, int(round(n_res * household_alpha))) if n_res > 0 else 0

    return DetectedCluster(
        cluster_index=cluster_index,
        label=label,
        is_isolated_group=is_isolated_group,
        geom=hull_wgs84,
        centroid=centroid_wgs84,
        building_ids=[b.building_id for b in member_blds],
        n_detected=n_detected,
        n_residential=n_res,
        n_non_residential=n_non_res,
        n_outbuilding=n_out,
        est_households=est_hh,
    )
