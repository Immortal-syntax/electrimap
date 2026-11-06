"""Cost-surface construction for 11 kV HT feeder routing over terrain and land cover.

Domain purity rule: Pure NumPy computation without DB/HTTP/FS dependencies.
"""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

# ESA WorldCover 10m standard class codes
WORLDCOVER_TREE_COVER = 10
WORLDCOVER_SHRUBLAND = 20
WORLDCOVER_GRASSLAND = 30
WORLDCOVER_CROPLAND = 40
WORLDCOVER_BUILT_UP = 50
WORLDCOVER_BARE = 60
WORLDCOVER_WATER = 80
WORLDCOVER_WETLAND = 90


@dataclass(frozen=True)
class CostSurfaceParams:
    """Configurable weights for building the 11 kV routing traversal cost grid."""

    slope_weight: float = 3.5
    steep_slope_threshold_deg: float = 20.0
    steep_slope_penalty: float = 6.0
    forest_penalty: float = 2.5
    wetland_penalty: float = 5.0
    water_impassable_cost: float = 1e6
    road_corridor_discount: float = 0.35


def build_routing_cost_surface(
    slope_deg: NDArray[np.floating],
    landcover_class: NDArray[np.integer] | None = None,
    road_corridor_mask: NDArray[np.bool_] | None = None,
    params: CostSurfaceParams | None = None,
) -> NDArray[np.float64]:
    """Build a strictly positive unitless cost-multiplier grid (>= 0.2) for MCP_Geometric.

    Every cell value represents the relative traversal cost per meter across that cell.
    Water bodies receive a high barrier cost (1e6) unless bridged by a road corridor.
    """
    cfg = params or CostSurfaceParams()
    slope_rad = np.radians(np.clip(slope_deg.astype(np.float64), 0.0, 85.0))
    tan_slope = np.tan(slope_rad)

    cost = 1.0 + cfg.slope_weight * tan_slope
    steep_mask = slope_deg >= cfg.steep_slope_threshold_deg
    cost = np.where(steep_mask, cost + cfg.steep_slope_penalty, cost)

    if landcover_class is not None:
        if landcover_class.shape != slope_deg.shape:
            raise ValueError("landcover_class and slope_deg must have identical grid shapes.")
        cost = np.where(landcover_class == WORLDCOVER_TREE_COVER, cost + cfg.forest_penalty, cost)
        cost = np.where(landcover_class == WORLDCOVER_WETLAND, cost + cfg.wetland_penalty, cost)
        water_mask = landcover_class == WORLDCOVER_WATER
        if road_corridor_mask is not None:
            water_mask = water_mask & (~road_corridor_mask)
        cost = np.where(water_mask, cfg.water_impassable_cost, cost)

    if road_corridor_mask is not None:
        if road_corridor_mask.shape != slope_deg.shape:
            raise ValueError("road_corridor_mask and slope_deg must have identical grid shapes.")
        cost = np.where(road_corridor_mask, cost * (1.0 - cfg.road_corridor_discount), cost)

    return np.clip(cost, 0.2, cfg.water_impassable_cost)

