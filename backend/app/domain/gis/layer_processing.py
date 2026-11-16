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
from matplotlib.colors import LinearSegmentedColormap, Normalize
from numpy.typing import NDArray
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
    observation_period: str = "2024_ANNUAL",
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
        period_scale = {
            "2024_ANNUAL": 1.00,
            "2023_POST_MONSOON": 1.08,
            "2022_ANNUAL": 0.88,
            "2020_BASELINE": 0.72,
        }.get(observation_period, 1.00)
        rad = np.clip(grids["radiance"] * period_scale, 0.0, None)
        viirs_cmap = LinearSegmentedColormap.from_list(
            "viirs_black_marble",
            ["#0F172A", "#1D4ED8", "#06B6D4", "#F59E0B", "#FEF08A"],
        )
        rgba = viirs_cmap(Normalize(vmin=0.0, vmax=2.5)(rad))
        rgba[..., 3] = np.clip((rad - 0.08) / 0.35, 0.0, 0.90)
        ax.imshow(rgba)
    else:
        plt.close(fig)
        raise ValueError(f"Unsupported raster preview layer_key: '{layer_key}'")

    buf = io.BytesIO()
    fig.savefig(buf, format="png", transparent=True, pad_inches=0)
    plt.close(fig)
    return buf.getvalue()


_VIIRS_CMAP = LinearSegmentedColormap.from_list(
    "viirs_black_marble_canonical",
    ["#0F172A", "#1D4ED8", "#06B6D4", "#F59E0B", "#FEF08A"],
)

_WORLDCOVER_RGBA: dict[int, tuple[float, float, float, float]] = {
    10: (0.00, 0.39, 0.00, 0.78),  # Tree cover (#006400)
    20: (1.00, 0.73, 0.13, 0.76),  # Shrubland (#FFBB22)
    30: (1.00, 1.00, 0.30, 0.72),  # Grassland (#FFFF4C)
    40: (0.94, 0.59, 1.00, 0.74),  # Cropland (#F096FF)
    50: (0.98, 0.00, 0.00, 0.82),  # Built-up (#FA0000)
    60: (0.71, 0.71, 0.71, 0.70),  # Bare / sparse (#B4B4B4)
    80: (0.00, 0.39, 0.78, 0.85),  # Permanent water (#0064C8)
    90: (0.00, 0.59, 0.63, 0.80),  # Herbaceous wetland (#0096A0)
}


def summarize_raster_arrays(
    elev_m: NDArray[np.floating],
    landcover: NDArray[np.integer],
    cell_size_x_m: float = 30.0,
    cell_size_y_m: float = 30.0,
    radiance: NDArray[np.floating] | None = None,
) -> dict[str, dict[str, Any]]:
    """Compute real terrain, slope, land-cover, and optional radiance statistics from rasters."""
    elev_f = elev_m.astype(np.float64)
    valid_elev = np.isfinite(elev_f) & (elev_f > -500.0) & (elev_f < 9000.0)
    if np.any(valid_elev):
        fill_val = float(np.median(elev_f[valid_elev]))
        elev_clean = np.where(valid_elev, elev_f, fill_val)
        slope_deg = compute_slope_deg(
            elev_clean,
            cell_size_x_m=max(1.0, cell_size_x_m),
            cell_size_y_m=max(1.0, cell_size_y_m),
        )
        valid_elev_vals = elev_clean[valid_elev]
        valid_slope_vals = slope_deg[valid_elev]
        elev_min = round(float(np.min(valid_elev_vals)), 1)
        elev_max = round(float(np.max(valid_elev_vals)), 1)
        elev_mean = round(float(np.mean(valid_elev_vals)), 1)
        slope_mean = round(float(np.mean(valid_slope_vals)), 2)
        slope_max = round(float(np.max(valid_slope_vals)), 2)
        steep_pct = round(float(np.mean(valid_slope_vals >= 20.0) * 100.0), 1)
    else:
        elev_min = elev_max = elev_mean = slope_mean = slope_max = steep_pct = 0.0

    lc_int = landcover.astype(np.int32)
    valid_lc = lc_int[lc_int > 0]
    total_lc = max(1, int(valid_lc.size))
    tree_pct = round(float(np.sum(valid_lc == 10) / total_lc * 100.0), 1)
    shrub_grass_pct = round(float(np.sum(np.isin(valid_lc, [20, 30])) / total_lc * 100.0), 1)
    cropland_pct = round(float(np.sum(valid_lc == 40) / total_lc * 100.0), 1)
    built_pct = round(float(np.sum(valid_lc == 50) / total_lc * 100.0), 1)
    water_pct = round(float(np.sum(np.isin(valid_lc, [80, 90])) / total_lc * 100.0), 1)

    summaries: dict[str, dict[str, Any]] = {
        "dem": {
            "elevation_min_m": elev_min,
            "elevation_max_m": elev_max,
            "elevation_mean_m": elev_mean,
            "slope_mean_deg": slope_mean,
            "slope_max_deg": slope_max,
            "steep_area_pct": steep_pct,
        },
        "landcover": {
            "tree_cover_pct": tree_pct,
            "canopy_share_pct": tree_pct,
            "shrub_grass_pct": shrub_grass_pct,
            "cropland_pct": cropland_pct,
            "built_up_pct": built_pct,
            "water_barrier_pct": water_pct,
        },
    }

    if radiance is not None:
        rad_f = radiance.astype(np.float64)
        valid_rad = rad_f[np.isfinite(rad_f) & (rad_f >= 0.0)]
        if valid_rad.size > 0:
            summaries["nightlights"] = {
                "mean_radiance_nw_cm2_sr": round(float(np.mean(valid_rad)), 4),
                "max_radiance_nw_cm2_sr": round(float(np.max(valid_rad)), 4),
                "dark_area_pct": round(float(np.mean(valid_rad < 0.25) * 100.0), 1),
            }

    return summaries


def render_raster_arrays_png(
    layer_key: str,
    *,
    elev_m: NDArray[np.floating] | None = None,
    landcover: NDArray[np.integer] | None = None,
    radiance: NDArray[np.floating] | None = None,
    cell_size_m: float = 30.0,
) -> bytes:
    """Render clipped DEM, WorldCover, or VIIRS arrays into a transparent RGBA PNG."""
    fig = plt.figure(figsize=(3.2, 3.2), dpi=100)
    try:
        ax = fig.add_axes((0.0, 0.0, 1.0, 1.0))
        ax.axis("off")

        if layer_key in {"dem", "terrain", "slope"}:
            if elev_m is None:
                raise ValueError("elev_m array is required to render DEM overlay.")
            elev_f = elev_m.astype(np.float64)
            valid = np.isfinite(elev_f) & (elev_f > -500.0) & (elev_f < 9000.0)
            fill = float(np.median(elev_f[valid])) if np.any(valid) else 0.0
            clean = np.where(valid, elev_f, fill)
            vmin = float(np.percentile(clean[valid], 2)) if np.any(valid) else 0.0
            vmax = float(np.percentile(clean[valid], 98)) if np.any(valid) else 1.0
            if vmax <= vmin:
                vmax = vmin + 1.0
            hs_raw = compute_hillshade(clean, cell_size_m=max(1.0, cell_size_m))
            hs = hs_raw.astype(np.float64) / 255.0
            norm = Normalize(vmin=vmin, vmax=vmax, clip=True)(clean)
            terrain_rgba = plt.get_cmap("terrain")(norm)
            terrain_rgba[..., :3] = np.clip(
                terrain_rgba[..., :3] * (0.55 + 0.55 * hs[..., None]),
                0.0,
                1.0,
            )
            terrain_rgba[..., 3] = np.where(valid, 0.78, 0.0)
            ax.imshow(terrain_rgba)
        elif layer_key == "landcover":
            if landcover is None:
                raise ValueError("landcover array is required to render WorldCover overlay.")
            lc = landcover.astype(np.int32)
            rgba = np.zeros((*lc.shape, 4), dtype=np.float64)
            for code, color in _WORLDCOVER_RGBA.items():
                mask = lc == code
                if np.any(mask):
                    rgba[mask] = color
            ax.imshow(rgba)
        elif layer_key == "nightlights":
            if radiance is None:
                raise ValueError("radiance array is required to render VIIRS overlay.")
            rad = np.where(
                np.isfinite(radiance),
                np.clip(radiance.astype(np.float64), 0.0, None),
                0.0,
            )
            rgba = _VIIRS_CMAP(Normalize(vmin=0.0, vmax=2.5, clip=True)(rad))
            rgba[..., 3] = np.clip((rad - 0.08) / 0.35, 0.0, 0.90)
            ax.imshow(rgba)
        else:
            raise ValueError(f"Unsupported raster preview layer_key: '{layer_key}'")

        buf = io.BytesIO()
        fig.savefig(buf, format="png", transparent=True, pad_inches=0)
        return buf.getvalue()
    finally:
        plt.close(fig)
