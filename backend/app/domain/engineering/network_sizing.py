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

"""Preliminary electrical network sizing and routing in UTM metric CRS (Tasks M5-2, M5-3, M5-4).

Domain purity rule: Pure Python, NumPy, SciPy, Shapely, and scikit-image logic.
Must NEVER import database models, file storage, or HTTP clients.
"""

import math
from collections import deque
from dataclasses import dataclass

import numpy as np
import shapely
from numpy.typing import NDArray
from scipy.sparse.csgraph import minimum_spanning_tree
from shapely.geometry import LineString, MultiLineString, MultiPoint, Point
from shapely.geometry.base import BaseGeometry

from app.domain.engineering.constants import (
    TransformerRatingSpec,
    select_standard_dt_spec,
)
from app.domain.gis.cost_surface import WORLDCOVER_WATER, build_routing_cost_surface
from app.domain.gis.crs import WGS84_EPSG, get_transformer, project_geometry
from app.domain.gis.raster_ops import compute_slope_deg
from app.domain.gis.routing import route_least_cost_feeder

DEFAULT_METRIC_EPSG = 32644


@dataclass(frozen=True)
class TerrainCostGridInput:
    """Real DEM, WorldCover, and vector road/water grid aligned to local UTM coordinates."""

    cost_surface: NDArray[np.float64]
    slope_deg: NDArray[np.float64]
    landcover_class: NDArray[np.int32]
    origin_x_m: float
    origin_y_m: float
    cell_size_m: float


@dataclass(frozen=True)
class PlacedDistributionTransformer:
    """Distribution Transformer placed at a cluster or sub-zone load centroid."""

    subzone_index: int
    label: str
    lon: float
    lat: float
    x_m: float
    y_m: float
    rating_kva: float
    allocated_peak_kva: float
    loading_pct: float
    served_buildings_count: int
    max_radial_reach_m: float
    spec: TransformerRatingSpec


@dataclass(frozen=True)
class HtFeederRoutingResult:
    """Result of routing the 11 kV HT feeder from nearest tie-in to cluster DTs."""

    requires_tie_in: bool
    ht_length_m: float
    ht_poles_count: int
    effective_span_m: float
    mean_slope_deg: float
    crossed_water_cells: int
    crossed_forest_cells: int
    ht_line_wgs84: LineString | MultiLineString | None


@dataclass(frozen=True)
class LtRadialMstResult:
    """Result of constructing the 415 V LT Minimum Spanning Tree distribution network."""

    service_nodes_count: int
    lt_3ph_length_m: float
    lt_1ph_length_m: float
    lt_total_length_m: float
    max_lt_branch_m: float
    lt_poles_count: int
    lt_lines_wgs84: MultiLineString | None


def _extract_metric_building_points(
    building_points_wgs84: list[tuple[float, float]],
    cluster_centroid_wgs84: tuple[float, float],
    est_households: int,
    metric_epsg: int = DEFAULT_METRIC_EPSG,
    allow_centroid_ring_fallback: bool = True,
) -> list[tuple[float, float]]:
    """Project building WGS 84 points to UTM (x_m, y_m)."""
    if building_points_wgs84:
        pts_m: list[tuple[float, float]] = []
        for lon, lat in building_points_wgs84:
            p_m = project_geometry(Point(lon, lat), WGS84_EPSG, metric_epsg)
            assert isinstance(p_m, Point)
            pts_m.append((float(p_m.x), float(p_m.y)))
        return pts_m

    center_m = project_geometry(
        Point(cluster_centroid_wgs84[0], cluster_centroid_wgs84[1]),
        WGS84_EPSG,
        metric_epsg,
    )
    assert isinstance(center_m, Point)
    cx, cy = float(center_m.x), float(center_m.y)
    if not allow_centroid_ring_fallback:
        return [(cx, cy)]

    # Pure unit-test synthetic ring fallback when explicit test helper requests centroid expansion
    n_nodes = max(4, min(24, max(4, est_households // 5)))
    pts_synth: list[tuple[float, float]] = []
    for idx in range(n_nodes):
        angle = (2.0 * math.pi * idx) / n_nodes
        radius_m = 45.0 + 35.0 * (idx % 3)
        pts_synth.append((cx + radius_m * math.cos(angle), cy + radius_m * math.sin(angle)))
    return pts_synth


def place_cluster_transformers(
    cluster_label: str,
    cluster_centroid_wgs84: tuple[float, float],
    building_points_wgs84: list[tuple[float, float]],
    est_households: int,
    peak_kva_horizon: float,
    dt_max_loading_ratio: float = 0.80,
    lt_max_radial_reach_m: float = 800.0,
    metric_epsg: int = DEFAULT_METRIC_EPSG,
    allow_centroid_ring_fallback: bool = True,
) -> list[PlacedDistributionTransformer]:
    """Place one or more 11/0.433 kV Distribution Transformers in UTM (Task M5-2).

    Enforces:
    - Horizon peak load per DT <= dt_max_loading_ratio * rating_kva
    - Maximum 415 V LT radial distance from DT <= lt_max_radial_reach_m (default 800 m)
    """
    pts_m = _extract_metric_building_points(
        building_points_wgs84=building_points_wgs84,
        cluster_centroid_wgs84=cluster_centroid_wgs84,
        est_households=est_households,
        metric_epsg=metric_epsg,
        allow_centroid_ring_fallback=allow_centroid_ring_fallback,
    )
    coords = np.array(pts_m, dtype=np.float64)
    mean_xy = np.mean(coords, axis=0)
    radial_dists = np.hypot(coords[:, 0] - mean_xy[0], coords[:, 1] - mean_xy[1])
    max_initial_radial_m = float(np.max(radial_dists)) if len(radial_dists) > 0 else 0.0

    # Determine number of DT sub-zones needed (capping pole-mounted units <= 100 kVA when possible)
    max_unit_kva = 100.0 * max(0.4, min(1.0, dt_max_loading_ratio))
    k_by_reach = max(1, math.ceil(max_initial_radial_m / max(100.0, lt_max_radial_reach_m)))
    k_by_load = max(1, math.ceil(peak_kva_horizon / max(10.0, max_unit_kva)))
    n_subzones = min(len(coords), max(k_by_reach, k_by_load))

    def _partition(k_count: int) -> list[np.ndarray]:
        if k_count <= 1:
            return [coords]
        spread_x = float(np.ptp(coords[:, 0]))
        spread_y = float(np.ptp(coords[:, 1]))
        sort_axis = 0 if spread_x >= spread_y else 1
        order = np.argsort(coords[:, sort_axis])
        sorted_coords = coords[order]
        chunks = np.array_split(sorted_coords, k_count)
        return [chunk for chunk in chunks if len(chunk) > 0]

    subzone_groups = _partition(n_subzones)
    total_pts = max(1, len(coords))
    while n_subzones < len(coords) and any(
        (peak_kva_horizon * (len(g) / total_pts)) > max_unit_kva for g in subzone_groups
    ):
        n_subzones += 1
        subzone_groups = _partition(n_subzones)

    total_pts = max(1, len(coords))
    placed_dts: list[PlacedDistributionTransformer] = []

    for idx, group in enumerate(subzone_groups, start=1):
        gx = float(np.mean(group[:, 0]))
        gy = float(np.mean(group[:, 1]))
        pt_wgs84 = project_geometry(Point(gx, gy), metric_epsg, WGS84_EPSG)
        assert isinstance(pt_wgs84, Point)
        share = len(group) / total_pts
        sub_kva = max(2.0, round(peak_kva_horizon * share, 2))
        dt_spec = select_standard_dt_spec(sub_kva, max_loading_ratio=dt_max_loading_ratio)
        loading_pct = round((sub_kva / dt_spec.rating_kva) * 100.0, 1)
        dists = np.hypot(group[:, 0] - gx, group[:, 1] - gy)
        max_reach_m = round(float(np.max(dists)) if len(dists) > 0 else 0.0, 1)

        dt_label = (
            f"{cluster_label}-DT{idx:02d}" if len(subzone_groups) > 1 else f"{cluster_label}-DT01"
        )
        placed_dts.append(
            PlacedDistributionTransformer(
                subzone_index=idx,
                label=dt_label,
                lon=round(float(pt_wgs84.x), 6),
                lat=round(float(pt_wgs84.y), 6),
                x_m=round(gx, 2),
                y_m=round(gy, 2),
                rating_kva=dt_spec.rating_kva,
                allocated_peak_kva=sub_kva,
                loading_pct=loading_pct,
                served_buildings_count=len(group),
                max_radial_reach_m=max_reach_m,
                spec=dt_spec,
            )
        )

    return placed_dts


def build_terrain_cost_grid_for_corridor(
    *,
    min_x: float,
    max_x: float,
    min_y: float,
    max_y: float,
    cell_size_m: float,
    n_rows: int,
    n_cols: int,
    metric_epsg: int,
    dem_elev_wgs84: NDArray[np.floating] | None = None,
    landcover_wgs84: NDArray[np.integer] | None = None,
    raster_bounds_wgs84: tuple[float, float, float, float] | None = None,
    road_geoms_wgs84: list[BaseGeometry] | None = None,
    water_geoms_wgs84: list[BaseGeometry] | None = None,
    slope_fallback_deg: float = 0.0,
) -> TerrainCostGridInput:
    """Construct a UTM-aligned cost surface from clipped GeoTIFFs and OSM road/water vectors."""
    xs = min_x + (np.arange(n_cols, dtype=np.float64) + 0.5) * cell_size_m
    ys = max_y - (np.arange(n_rows, dtype=np.float64) + 0.5) * cell_size_m
    xx, yy = np.meshgrid(xs, ys)

    slope_grid = np.full((n_rows, n_cols), max(0.0, slope_fallback_deg), dtype=np.float64)
    lc_grid = np.full((n_rows, n_cols), 30, dtype=np.int32)

    if (
        raster_bounds_wgs84 is not None
        and (dem_elev_wgs84 is not None or landcover_wgs84 is not None)
    ):
        r_minx, r_miny, r_maxx, r_maxy = raster_bounds_wgs84
        span_lon = max(1e-9, r_maxx - r_minx)
        span_lat = max(1e-9, r_maxy - r_miny)
        to_wgs84 = get_transformer(metric_epsg, WGS84_EPSG)
        lon_grid, lat_grid = to_wgs84.transform(xx, yy)

        if dem_elev_wgs84 is not None and dem_elev_wgs84.ndim == 2 and dem_elev_wgs84.size > 0:
            h_d, w_d = dem_elev_wgs84.shape
            r_idx = np.clip(
                np.floor((r_maxy - lat_grid) / (span_lat / max(1, h_d))).astype(np.int32),
                0,
                h_d - 1,
            )
            c_idx = np.clip(
                np.floor((lon_grid - r_minx) / (span_lon / max(1, w_d))).astype(np.int32),
                0,
                w_d - 1,
            )
            elev_sampled = dem_elev_wgs84[r_idx, c_idx].astype(np.float64)
            valid = np.isfinite(elev_sampled) & (elev_sampled > -500.0) & (elev_sampled < 9000.0)
            fill = float(np.median(elev_sampled[valid])) if np.any(valid) else 0.0
            elev_clean = np.where(valid, elev_sampled, fill)
            slope_grid = compute_slope_deg(
                elev_clean, cell_size_x_m=cell_size_m, cell_size_y_m=cell_size_m
            )

        if landcover_wgs84 is not None and landcover_wgs84.ndim == 2 and landcover_wgs84.size > 0:
            h_l, w_l = landcover_wgs84.shape
            r_idx_l = np.clip(
                np.floor((r_maxy - lat_grid) / (span_lat / max(1, h_l))).astype(np.int32),
                0,
                h_l - 1,
            )
            c_idx_l = np.clip(
                np.floor((lon_grid - r_minx) / (span_lon / max(1, w_l))).astype(np.int32),
                0,
                w_l - 1,
            )
            lc_grid = landcover_wgs84[r_idx_l, c_idx_l].astype(np.int32)

    road_mask: NDArray[np.bool_] | None = None
    if road_geoms_wgs84:
        proj_roads = [
            project_geometry(g, WGS84_EPSG, metric_epsg).buffer(cell_size_m * 0.75)
            for g in road_geoms_wgs84
            if g is not None and not g.is_empty
        ]
        if proj_roads:
            road_union = shapely.unary_union(proj_roads)
            road_mask = np.asarray(shapely.contains_xy(road_union, xx, yy), dtype=np.bool_)

    if water_geoms_wgs84:
        proj_waters = [
            project_geometry(g, WGS84_EPSG, metric_epsg).buffer(cell_size_m * 0.65)
            for g in water_geoms_wgs84
            if g is not None and not g.is_empty
        ]
        if proj_waters:
            water_union = shapely.unary_union(proj_waters)
            water_mask = np.asarray(shapely.contains_xy(water_union, xx, yy), dtype=np.bool_)
            if road_mask is not None:
                water_mask = water_mask & (~road_mask)
            lc_grid = np.where(water_mask, WORLDCOVER_WATER, lc_grid)

    cost_surface = build_routing_cost_surface(
        slope_deg=slope_grid,
        landcover_class=lc_grid,
        road_corridor_mask=road_mask,
    )
    return TerrainCostGridInput(
        cost_surface=cost_surface,
        slope_deg=slope_grid,
        landcover_class=lc_grid,
        origin_x_m=min_x,
        origin_y_m=max_y,
        cell_size_m=cell_size_m,
    )


def route_cluster_11kv_ht_feeder(
    tie_in_wgs84: tuple[float, float] | None,
    placed_dts: list[PlacedDistributionTransformer],
    slope_mean_deg: float,
    canopy_share: float,
    water_crossings_count: int,
    ht_standard_span_m: float = 65.0,
    ht_steep_span_m: float = 45.0,
    metric_epsg: int = DEFAULT_METRIC_EPSG,
    terrain_cost_grid: TerrainCostGridInput | None = None,
    dem_elev_wgs84: NDArray[np.floating] | None = None,
    landcover_wgs84: NDArray[np.integer] | None = None,
    raster_bounds_wgs84: tuple[float, float, float, float] | None = None,
    road_geoms_wgs84: list[BaseGeometry] | None = None,
    water_geoms_wgs84: list[BaseGeometry] | None = None,
) -> HtFeederRoutingResult:
    """Route 11 kV HT feeder from nearest tie-in point to cluster DTs via MCP_Geometric."""
    del canopy_share  # Real WorldCover grid drives canopy penalty when raster is provided.
    if tie_in_wgs84 is None or not placed_dts:
        return HtFeederRoutingResult(
            requires_tie_in=True,
            ht_length_m=0.0,
            ht_poles_count=0,
            effective_span_m=ht_standard_span_m,
            mean_slope_deg=round(slope_mean_deg, 2),
            crossed_water_cells=0,
            crossed_forest_cells=0,
            ht_line_wgs84=None,
        )

    tie_pt_m = project_geometry(Point(tie_in_wgs84[0], tie_in_wgs84[1]), WGS84_EPSG, metric_epsg)
    assert isinstance(tie_pt_m, Point)
    tx_m, ty_m = float(tie_pt_m.x), float(tie_pt_m.y)
    primary_dt = placed_dts[0]

    dx = primary_dt.x_m - tx_m
    dy = primary_dt.y_m - ty_m
    straight_dist_m = math.hypot(dx, dy)

    if terrain_cost_grid is not None:
        cost_grid = terrain_cost_grid.cost_surface
        slope_grid = terrain_cost_grid.slope_deg
        lc_grid = terrain_cost_grid.landcover_class
        origin_x_m = terrain_cost_grid.origin_x_m
        origin_y_m = terrain_cost_grid.origin_y_m
        cell_size_m = terrain_cost_grid.cell_size_m
        n_rows, n_cols = cost_grid.shape
    else:
        pad_m = max(180.0, straight_dist_m * 0.25)
        min_x = min(tx_m, primary_dt.x_m) - pad_m
        max_x = max(tx_m, primary_dt.x_m) + pad_m
        min_y = min(ty_m, primary_dt.y_m) - pad_m
        max_y = max(ty_m, primary_dt.y_m) + pad_m

        span_max = max(max_x - min_x, max_y - min_y, 300.0)
        cell_size_m = max(25.0, min(90.0, span_max / 48.0))
        n_cols = max(12, min(96, math.ceil((max_x - min_x) / cell_size_m)))
        n_rows = max(12, min(96, math.ceil((max_y - min_y) / cell_size_m)))

        grid_built = build_terrain_cost_grid_for_corridor(
            min_x=min_x,
            max_x=max_x,
            min_y=min_y,
            max_y=max_y,
            cell_size_m=cell_size_m,
            n_rows=n_rows,
            n_cols=n_cols,
            metric_epsg=metric_epsg,
            dem_elev_wgs84=dem_elev_wgs84,
            landcover_wgs84=landcover_wgs84,
            raster_bounds_wgs84=raster_bounds_wgs84,
            road_geoms_wgs84=road_geoms_wgs84,
            water_geoms_wgs84=water_geoms_wgs84,
            slope_fallback_deg=slope_mean_deg,
        )
        cost_grid = grid_built.cost_surface
        slope_grid = grid_built.slope_deg
        lc_grid = grid_built.landcover_class
        origin_x_m = grid_built.origin_x_m
        origin_y_m = grid_built.origin_y_m

    def _to_rc(x_val: float, y_val: float) -> tuple[int, int]:
        c_idx = int(np.clip(math.floor((x_val - origin_x_m) / cell_size_m), 0, n_cols - 1))
        r_idx = int(np.clip(math.floor((origin_y_m - y_val) / cell_size_m), 0, n_rows - 1))
        return (r_idx, c_idx)

    start_rc = _to_rc(tx_m, ty_m)
    end_rc = _to_rc(primary_dt.x_m, primary_dt.y_m)

    routed = route_least_cost_feeder(
        cost_surface=cost_grid,
        start_rc=start_rc,
        end_rc=end_rc,
        origin_x_m=origin_x_m,
        origin_y_m=origin_y_m,
        cell_size_m=cell_size_m,
        slope_deg=slope_grid,
        landcover_class=lc_grid,
        simplify_tolerance_m=cell_size_m * 0.45,
    )

    # Ensure exact snap from tie-in point to primary DT
    routed_coords = list(routed.line_metric.coords)
    routed_coords[0] = (tx_m, ty_m)
    routed_coords[-1] = (primary_dt.x_m, primary_dt.y_m)
    main_line_m = LineString(routed_coords)

    lines_m: list[LineString] = [main_line_m]
    for sec_dt in placed_dts[1:]:
        inter_line = LineString([(primary_dt.x_m, primary_dt.y_m), (sec_dt.x_m, sec_dt.y_m)])
        if inter_line.length > 1.0:
            lines_m.append(inter_line)

    geom_m: BaseGeometry = lines_m[0] if len(lines_m) == 1 else MultiLineString(lines_m)
    total_ht_length_m = round(float(geom_m.length), 1)
    geom_wgs84 = project_geometry(geom_m, metric_epsg, WGS84_EPSG)
    ht_line_out: LineString | MultiLineString | None = (
        geom_wgs84 if isinstance(geom_wgs84, (LineString, MultiLineString)) else None
    )

    steep_or_water = slope_mean_deg > 15.0 or water_crossings_count > 0
    effective_span_m = ht_steep_span_m if steep_or_water else ht_standard_span_m
    ht_poles_count = (
        math.ceil(total_ht_length_m / max(20.0, effective_span_m)) + len(placed_dts)
        if total_ht_length_m > 0
        else 0
    )

    return HtFeederRoutingResult(
        requires_tie_in=False,
        ht_length_m=total_ht_length_m,
        ht_poles_count=ht_poles_count,
        effective_span_m=effective_span_m,
        mean_slope_deg=round(routed.mean_slope_deg, 2),
        crossed_water_cells=max(water_crossings_count, routed.crossed_water_cells),
        crossed_forest_cells=routed.crossed_forest_cells,
        ht_line_wgs84=ht_line_out,
    )


def _cluster_service_poles(
    pts_m: list[tuple[float, float]],
    merge_radius_m: float = 28.0,
) -> list[tuple[float, float]]:
    """Group closely spaced buildings within merge_radius_m into shared LT service pole nodes."""
    nodes: list[tuple[float, float]] = []
    for px, py in pts_m:
        merged = False
        for idx, (nx, ny) in enumerate(nodes):
            if math.hypot(px - nx, py - ny) <= merge_radius_m:
                nodes[idx] = ((nx + px) * 0.5, (ny + py) * 0.5)
                merged = True
                break
        if not merged:
            nodes.append((px, py))
    return nodes


def build_cluster_415v_lt_mst(
    cluster_centroid_wgs84: tuple[float, float],
    building_points_wgs84: list[tuple[float, float]],
    est_households: int,
    placed_dts: list[PlacedDistributionTransformer],
    lt_standard_span_m: float = 45.0,
    metric_epsg: int = DEFAULT_METRIC_EPSG,
    allow_centroid_ring_fallback: bool = True,
) -> LtRadialMstResult:
    """Construct 415 V LT radial Minimum Spanning Tree (MST) from DTs to service nodes."""
    if not placed_dts:
        return LtRadialMstResult(
            service_nodes_count=0,
            lt_3ph_length_m=0.0,
            lt_1ph_length_m=0.0,
            lt_total_length_m=0.0,
            max_lt_branch_m=0.0,
            lt_poles_count=0,
            lt_lines_wgs84=None,
        )

    raw_pts_m = _extract_metric_building_points(
        building_points_wgs84=building_points_wgs84,
        cluster_centroid_wgs84=cluster_centroid_wgs84,
        est_households=est_households,
        metric_epsg=metric_epsg,
        allow_centroid_ring_fallback=allow_centroid_ring_fallback,
    )
    service_nodes_m = _cluster_service_poles(raw_pts_m, merge_radius_m=28.0)

    # Partition service nodes to their nearest placed DT
    dt_buckets: dict[int, list[tuple[float, float]]] = {idx: [] for idx in range(len(placed_dts))}
    for sx, sy in service_nodes_m:
        best_dt_idx = min(
            range(len(placed_dts)),
            key=lambda i: math.hypot(sx - placed_dts[i].x_m, sy - placed_dts[i].y_m),
        )
        dt_buckets[best_dt_idx].append((sx, sy))

    all_edges_m: list[LineString] = []
    total_3ph_m = 0.0
    total_1ph_m = 0.0
    max_branch_m = 0.0

    for dt_idx, dt in enumerate(placed_dts):
        sub_nodes = dt_buckets[dt_idx]
        if not sub_nodes:
            continue

        # Node 0 is the DT root; nodes 1..N are service poles
        vertices = [(dt.x_m, dt.y_m), *sub_nodes]
        n_v = len(vertices)
        coords_arr = np.array(vertices, dtype=np.float64)
        diff = coords_arr[:, np.newaxis, :] - coords_arr[np.newaxis, :, :]
        dist_matrix = np.hypot(diff[:, :, 0], diff[:, :, 1])

        mst_csr = minimum_spanning_tree(dist_matrix)
        mst_coo = mst_csr.tocoo()

        adj: dict[int, list[tuple[int, float]]] = {i: [] for i in range(n_v)}
        for u_idx, v_idx, weight in zip(mst_coo.row, mst_coo.col, mst_coo.data, strict=False):
            u_i = int(u_idx)
            v_i = int(v_idx)
            w_f = float(weight)
            if w_f <= 0.05:
                continue
            adj[u_i].append((v_i, w_f))
            adj[v_i].append((u_i, w_f))
            edge_line = LineString([vertices[u_i], vertices[v_i]])
            all_edges_m.append(edge_line)

        # BFS from DT root (node 0) to compute longest radial branch and 3-ph vs 1-ph split
        visited = {0}
        queue: deque[tuple[int, float]] = deque([(0, 0.0)])
        while queue:
            curr_u, dist_so_far = queue.popleft()
            if dist_so_far > max_branch_m:
                max_branch_m = dist_so_far
            neighbors = [(nbr, edge_w) for nbr, edge_w in adj[curr_u] if nbr not in visited]
            for nbr, edge_w in neighbors:
                visited.add(nbr)
                next_dist = dist_so_far + edge_w
                queue.append((nbr, next_dist))
                # Trunk edges connected to DT or internal branching nodes carry 3-phase AB cable;
                # leaf spurs carry 1-phase AB cable
                is_leaf = len(adj[nbr]) <= 1
                if is_leaf and curr_u != 0:
                    total_1ph_m += edge_w
                else:
                    total_3ph_m += edge_w

    total_lt_m = round(total_3ph_m + total_1ph_m, 1)
    lt_poles = (
        math.ceil(total_lt_m / max(20.0, lt_standard_span_m)) + len(placed_dts)
        if total_lt_m > 0
        else 0
    )

    lt_wgs84: MultiLineString | None = None
    if all_edges_m:
        multi_m = MultiLineString(all_edges_m)
        reproj = project_geometry(multi_m, metric_epsg, WGS84_EPSG)
        if isinstance(reproj, LineString):
            lt_wgs84 = MultiLineString([reproj])
        elif isinstance(reproj, MultiLineString):
            lt_wgs84 = reproj

    return LtRadialMstResult(
        service_nodes_count=len(service_nodes_m),
        lt_3ph_length_m=round(total_3ph_m, 1),
        lt_1ph_length_m=round(total_1ph_m, 1),
        lt_total_length_m=total_lt_m,
        max_lt_branch_m=round(max_branch_m, 1),
        lt_poles_count=lt_poles,
        lt_lines_wgs84=lt_wgs84,
    )


def build_dt_multipoint_wgs84(
    placed_dts: list[PlacedDistributionTransformer],
) -> MultiPoint | None:
    """Construct a WGS 84 MultiPoint geometry from placed Distribution Transformers."""
    if not placed_dts:
        return None
    return MultiPoint([Point(dt.lon, dt.lat) for dt in placed_dts])
