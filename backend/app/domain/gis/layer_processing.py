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

"""Pure GIS domain functions for building footprint size classification and raster overlays.

Domain purity rule: No DB, HTTP, or file storage imports allowed.
"""

import io
from typing import Any

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap
from shapely.geometry.base import BaseGeometry

from app.domain.gis.raster_ops import compute_hillshade, compute_slope_deg

matplotlib.use("Agg")


def classify_building_footprint(area_m2: float, confidence: float = 0.85) -> tuple[str, bool]:
    """Classify a building footprint by area (m^2) and confidence per ARCHITECTURE.md §4.4.

    Returns (size_class, is_excluded_by_default):
    - area_m2 < 9.0 -> ('NOISE', True)
    - 9.0 <= area_m2 < 12.0 -> ('OUTBUILDING', False)
    - 12.0 <= area_m2 <= 250.0 -> ('RESIDENTIAL', False)
    - area_m2 > 250.0 -> ('NON_RESIDENTIAL', False)
    If confidence < 0.70, marks as excluded by default.
    """
    low_conf = confidence < 0.70
    if area_m2 < 9.0:
        return "NOISE", True
    if area_m2 < 12.0:
        return "OUTBUILDING", low_conf
    if area_m2 <= 250.0:
        return "RESIDENTIAL", low_conf
    return "NON_RESIDENTIAL", low_conf


def generate_aoi_grids(
    bbox: tuple[float, float, float, float],
    rows: int = 120,
    cols: int = 120,
) -> dict[str, np.ndarray]:
    """Generate deterministic terrain DEM (m), slope (deg), WorldCover, and VIIRS grids."""
    min_lon, min_lat, max_lon, max_lat = bbox
    lons = np.linspace(min_lon, max_lon, cols)
    lats = np.linspace(max_lat, min_lat, rows)
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    norm_x = (lon_grid - min_lon) / max(1e-5, (max_lon - min_lon))
    norm_y = (lat_grid - min_lat) / max(1e-5, (max_lat - min_lat))

    # Eastern Ghats terrain profile (620 m valley to 980 m ridge)
    dem_m = (
        640.0
        + 195.0 * np.sin(norm_x * np.pi * 1.6) * np.cos(norm_y * np.pi * 1.3)
        + 95.0 * np.exp(-((norm_x - 0.68) ** 2 + (norm_y - 0.58) ** 2) / 0.045)
        + 55.0 * np.cos((norm_x + norm_y) * np.pi * 2.2)
    ).astype(np.float32)

    slope_deg = compute_slope_deg(dem_m, cell_size_x_m=30.0, cell_size_y_m=30.0)
    hillshade = compute_hillshade(dem_m, cell_size_m=30.0)

    # ESA WorldCover: 10=Tree, 20=Shrub, 30=Grass, 40=Crop, 50=Built-up, 80=Water
    worldcover = np.full((rows, cols), 40, dtype=np.uint8)
    worldcover[slope_deg >= 12.0] = 10
    worldcover[(slope_deg >= 7.0) & (slope_deg < 12.0)] = 20
    # Built-up settlement pockets
    dist_main = np.hypot(norm_x - 0.35, norm_y - 0.42)
    dist_east = np.hypot(norm_x - 0.62, norm_y - 0.54)
    worldcover[(dist_main < 0.08) | (dist_east < 0.06)] = 50
    # Meandering stream channel
    river_y = 0.48 + 0.14 * np.sin(norm_x * np.pi * 2.0)
    worldcover[np.abs(norm_y - river_y) < 0.022] = 80

    # Night-time radiance (nW/cm^2/sr) — higher near main village, near-zero in remote forest
    radiance = (
        2.35 * np.exp(-(dist_main**2) / 0.015)
        + 0.48 * np.exp(-(dist_east**2) / 0.012)
        + 0.04
    ).astype(np.float32)

    return {
        "dem_m": dem_m,
        "slope_deg": slope_deg,
        "hillshade": hillshade,
        "worldcover": worldcover,
        "radiance": radiance,
    }


def compute_layer_summaries(
    aoi_geom: BaseGeometry,
) -> dict[str, dict[str, Any]]:
    """Compute terrain, landcover, and nightlight summary statistics for an AOI geometry."""
    min_lon, min_lat, max_lon, max_lat = aoi_geom.bounds
    grids = generate_aoi_grids((min_lon, min_lat, max_lon, max_lat))
    dem_m = grids["dem_m"]
    slope_deg = grids["slope_deg"]
    wc = grids["worldcover"]
    rad = grids["radiance"]

    total_cells = float(wc.size)
    return {
        "dem_slope": {
            "elevation_min_m": round(float(np.min(dem_m)), 1),
            "elevation_max_m": round(float(np.max(dem_m)), 1),
            "elevation_mean_m": round(float(np.mean(dem_m)), 1),
            "slope_mean_deg": round(float(np.mean(slope_deg)), 2),
            "slope_max_deg": round(float(np.max(slope_deg)), 2),
            "steep_area_gt15_pct": round(float(np.mean(slope_deg > 15.0) * 100.0), 1),
        },
        "landcover": {
            "tree_cover_pct": round(float(np.sum(wc == 10) / total_cells * 100.0), 1),
            "shrub_grass_pct": round(
                float(np.sum((wc == 20) | (wc == 30)) / total_cells * 100.0), 1
            ),
            "cropland_pct": round(float(np.sum(wc == 40) / total_cells * 100.0), 1),
            "built_up_pct": round(float(np.sum(wc == 50) / total_cells * 100.0), 1),
            "water_pct": round(float(np.sum(wc == 80) / total_cells * 100.0), 1),
        },
        "nightlights": {
            "mean_radiance_nw_cm2_sr": round(float(np.mean(rad)), 3),
            "max_radiance_nw_cm2_sr": round(float(np.max(rad)), 3),
            "p90_radiance_nw_cm2_sr": round(float(np.percentile(rad, 90)), 3),
            "mean_lightscore": round(float(np.clip(np.mean(rad) / 1.5, 0.0, 1.0)), 3),
        },
    }


def render_raster_layer_png(
    layer_key: str,
    bbox: tuple[float, float, float, float],
) -> bytes:
    """Render a colorized raster overlay PNG for MapLibre `image` source."""
    grids = generate_aoi_grids(bbox, rows=160, cols=160)

    fig, ax = plt.subplots(figsize=(4, 4), dpi=100)
    fig.patch.set_alpha(0.0)
    ax.set_axis_off()
    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)

    if layer_key == "dem_slope":
        # Design System §3.3: sequential slope ramp (#F7F4E9 -> #C9A66B -> #7F4F24)
        slope_cmap = LinearSegmentedColormap.from_list(
            "survey_slope", ["#F7F4E9", "#C9A66B", "#7F4F24"]
        )
        ax.imshow(grids["hillshade"], cmap="gray", alpha=0.45)
        ax.imshow(grids["slope_deg"], cmap=slope_cmap, vmin=0.0, vmax=28.0, alpha=0.72)
    elif layer_key == "landcover":
        wc = grids["worldcover"]
        rgba = np.zeros((wc.shape[0], wc.shape[1], 4), dtype=np.float32)
        color_map: dict[int, tuple[float, float, float, float]] = {
            10: (0.00, 0.39, 0.00, 0.65),  # Tree cover (#006400)
            20: (1.00, 0.73, 0.13, 0.60),  # Shrubland (#FFBB22)
            30: (1.00, 1.00, 0.30, 0.55),  # Grassland (#FFFF4C)
            40: (0.94, 0.59, 1.00, 0.45),  # Cropland (#F096FF)
            50: (0.98, 0.00, 0.00, 0.85),  # Built-up (#FA0000)
            80: (0.00, 0.39, 0.78, 0.85),  # Water (#0064C8)
        }
        for code, col in color_map.items():
            rgba[wc == code] = col
        ax.imshow(rgba)
    elif layer_key == "nightlights":
        ax.imshow(grids["radiance"], cmap="viridis", vmin=0.0, vmax=2.4, alpha=0.78)
    else:
        plt.close(fig)
        raise ValueError(f"Unsupported raster preview layer_key: '{layer_key}'")

    buf = io.BytesIO()
    fig.savefig(buf, format="png", transparent=True, pad_inches=0)
    plt.close(fig)
    return buf.getvalue()
