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

"""Unit tests for terrain slope, hillshade, cost surface, and MCP_Geometric routing."""

import numpy as np

from app.domain.gis.cost_surface import (
    WORLDCOVER_CROPLAND,
    WORLDCOVER_WATER,
    build_routing_cost_surface,
)
from app.domain.gis.raster_ops import compute_hillshade, compute_slope_deg
from app.domain.gis.routing import route_least_cost_feeder


def test_compute_slope_and_hillshade_on_planar_ramp() -> None:
    """Verify slope calculation on a planar 1:1 ramp (30 m rise per 30 m run = 45 degrees)."""
    cols = np.arange(20, dtype=np.float64) * 30.0
    elevation_m = np.tile(cols, (20, 1))
    slope_deg = compute_slope_deg(elevation_m, cell_size_x_m=30.0, cell_size_y_m=30.0)
    assert np.allclose(slope_deg[:, 2:-2], 45.0, atol=0.1)

    hillshade = compute_hillshade(elevation_m, cell_size_m=30.0)
    assert hillshade.shape == (20, 20)
    assert hillshade.dtype == np.uint8


def test_least_cost_feeder_avoids_impassable_water_obstacle() -> None:
    """Verify MCP_Geometric routes around a water barrier unless bridged by a road."""
    slope_deg = np.zeros((30, 30), dtype=np.float64)
    landcover = np.full((30, 30), WORLDCOVER_CROPLAND, dtype=np.int32)
    # Place a vertical water barrier across column 15 from row 0 to row 24, leaving a gap at row 26
    landcover[0:25, 15] = WORLDCOVER_WATER

    cost_surface = build_routing_cost_surface(slope_deg=slope_deg, landcover_class=landcover)
    route = route_least_cost_feeder(
        cost_surface=cost_surface,
        start_rc=(10, 5),
        end_rc=(10, 25),
        origin_x_m=680_000.0,
        origin_y_m=2_080_000.0,
        cell_size_m=30.0,
        slope_deg=slope_deg,
        landcover_class=landcover,
    )

    assert route.crossed_water_cells == 0
    assert route.length_m > 20 * 30.0
    assert any(r >= 25 for r, _c in route.grid_indices)

