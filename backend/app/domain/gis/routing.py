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

"""Least-cost path routing on raster cost surfaces using scikit-image MCP_Geometric.

Domain purity rule: Pure NumPy / Shapely / scikit-image logic.
"""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray
from shapely.geometry import LineString
from skimage.graph import MCP_Geometric


@dataclass(frozen=True)
class RoutedFeederPath:
    """Result of routing a preliminary 11 kV feeder over a terrain cost surface."""

    grid_indices: list[tuple[int, int]]
    line_metric: LineString
    length_m: float
    total_weighted_cost: float
    mean_slope_deg: float
    max_slope_deg: float
    crossed_water_cells: int
    crossed_forest_cells: int


def route_least_cost_feeder(
    cost_surface: NDArray[np.floating],
    start_rc: tuple[int, int],
    end_rc: tuple[int, int],
    origin_x_m: float,
    origin_y_m: float,
    cell_size_m: float = 30.0,
    slope_deg: NDArray[np.floating] | None = None,
    landcover_class: NDArray[np.integer] | None = None,
    simplify_tolerance_m: float = 15.0,
) -> RoutedFeederPath:
    """Compute a least-cost path from start_rc (row, col) to end_rc (row, col) in metric CRS."""
    n_rows, n_cols = cost_surface.shape
    for label, (r, c) in (("start_rc", start_rc), ("end_rc", end_rc)):
        if not (0 <= r < n_rows and 0 <= c < n_cols):
            raise ValueError(f"{label}={(r, c)} is outside grid shape {(n_rows, n_cols)}.")

    if start_rc == end_rc:
        x_m = origin_x_m + (start_rc[1] + 0.5) * cell_size_m
        y_m = origin_y_m - (start_rc[0] + 0.5) * cell_size_m
        line = LineString([(x_m, y_m), (x_m + 0.01, y_m + 0.01)])
        return RoutedFeederPath(
            grid_indices=[start_rc],
            line_metric=line,
            length_m=0.0,
            total_weighted_cost=0.0,
            mean_slope_deg=0.0,
            max_slope_deg=0.0,
            crossed_water_cells=0,
            crossed_forest_cells=0,
        )

    mcp = MCP_Geometric(cost_surface.astype(np.float64), sampling=(cell_size_m, cell_size_m))
    cumulative_costs, _traceback = mcp.find_costs(starts=[start_rc], ends=[end_rc])
    path_rc: list[tuple[int, int]] = [
        (int(r), int(c)) for r, c in mcp.traceback(end_rc)
    ]
    total_cost = float(cumulative_costs[end_rc])

    coords_xy: list[tuple[float, float]] = [
        (
            origin_x_m + (col + 0.5) * cell_size_m,
            origin_y_m - (row + 0.5) * cell_size_m,
        )
        for row, col in path_rc
    ]
    raw_line = LineString(coords_xy)
    simplified_geom = (
        raw_line.simplify(simplify_tolerance_m, preserve_topology=False)
        if simplify_tolerance_m > 0.0 and len(coords_xy) > 2
        else raw_line
    )
    if (
        isinstance(simplified_geom, LineString)
        and not simplified_geom.is_empty
        and len(simplified_geom.coords) >= 2
    ):
        simplified_line = simplified_geom
    else:
        simplified_line = raw_line

    rows_idx = [r for r, _ in path_rc]
    cols_idx = [c for _, c in path_rc]

    mean_slope = 0.0
    max_slope = 0.0
    if slope_deg is not None:
        sampled_slopes = slope_deg[rows_idx, cols_idx]
        mean_slope = float(np.mean(sampled_slopes))
        max_slope = float(np.max(sampled_slopes))

    water_cells = 0
    forest_cells = 0
    if landcover_class is not None:
        sampled_lc = landcover_class[rows_idx, cols_idx]
        water_cells = int(np.sum(sampled_lc == 80))
        forest_cells = int(np.sum(sampled_lc == 10))

    return RoutedFeederPath(
        grid_indices=path_rc,
        line_metric=simplified_line,
        length_m=float(raw_line.length),
        total_weighted_cost=total_cost,
        mean_slope_deg=mean_slope,
        max_slope_deg=max_slope,
        crossed_water_cells=water_cells,
        crossed_forest_cells=forest_cells,
    )

