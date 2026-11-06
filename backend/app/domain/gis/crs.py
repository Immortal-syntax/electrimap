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

"""Coordinate Reference System (CRS) helpers for WGS 84 (EPSG:4326) and dynamic UTM zones.

Domain purity rule: No DB, HTTP, or filesystem imports allowed.
"""

from functools import lru_cache

import numpy as np
import shapely
from pyproj import CRS, Transformer
from shapely.geometry.base import BaseGeometry

WGS84_EPSG = 4326

# India bounding box in WGS 84 decimal degrees (lon_min, lat_min, lon_max, lat_max)
INDIA_BBOX_WGS84: tuple[float, float, float, float] = (68.0, 6.0, 98.0, 38.0)


def select_utm_epsg_from_lon_lat(lon_deg: float, lat_deg: float) -> int:
    """Compute the WGS 84 UTM EPSG code for a given longitude and latitude in degrees.

    For India (longitudes 68E to 98E, northern hemisphere), this returns
    EPSG:32642 through EPSG:32647. Koraput, Odisha (~82.7E, 18.8N) -> EPSG:32644.
    """
    if not (-180.0 <= lon_deg <= 180.0) or not (-80.0 <= lat_deg <= 84.0):
        raise ValueError(f"Coordinates out of valid UTM range: lon={lon_deg}, lat={lat_deg}")
    utm_zone = int((lon_deg + 180.0) // 6.0) + 1
    utm_zone = max(1, min(60, utm_zone))
    base_epsg = 32600 if lat_deg >= 0.0 else 32700
    return base_epsg + utm_zone


def select_metric_epsg_for_geometry(geom_wgs84: BaseGeometry) -> int:
    """Select the metric UTM EPSG code from the centroid of a WGS 84 geometry."""
    if geom_wgs84.is_empty:
        raise ValueError("Cannot select metric CRS for an empty geometry.")
    centroid = geom_wgs84.centroid
    return select_utm_epsg_from_lon_lat(lon_deg=centroid.x, lat_deg=centroid.y)


@lru_cache(maxsize=64)
def get_transformer(source_epsg: int, target_epsg: int) -> Transformer:
    """Return a cached PyProj Transformer with always_xy=True (lon/easting first)."""
    return Transformer.from_crs(
        CRS.from_epsg(source_epsg),
        CRS.from_epsg(target_epsg),
        always_xy=True,
    )


def project_geometry(
    geom: BaseGeometry,
    source_epsg: int,
    target_epsg: int,
) -> BaseGeometry:
    """Reproject a Shapely geometry from source_epsg to target_epsg."""
    if source_epsg == target_epsg:
        return geom
    transformer = get_transformer(source_epsg, target_epsg)
    return shapely.transform(
        geom,
        lambda coords: np.column_stack(transformer.transform(coords[:, 0], coords[:, 1])),
    )


def compute_metric_area_m2(geom_wgs84: BaseGeometry, metric_epsg: int | None = None) -> float:
    """Compute the metric area in square meters (m^2) by projecting to UTM."""
    target_epsg = metric_epsg or select_metric_epsg_for_geometry(geom_wgs84)
    projected_geom = project_geometry(geom_wgs84, WGS84_EPSG, target_epsg)
    return float(projected_geom.area)


def compute_metric_area_km2(geom_wgs84: BaseGeometry, metric_epsg: int | None = None) -> float:
    """Compute the metric area in square kilometers (km^2) by projecting to UTM."""
    return compute_metric_area_m2(geom_wgs84, metric_epsg=metric_epsg) / 1_000_000.0


def compute_metric_length_m(geom_wgs84: BaseGeometry, metric_epsg: int | None = None) -> float:
    """Compute the metric length in meters (m) by projecting to UTM."""
    target_epsg = metric_epsg or select_metric_epsg_for_geometry(geom_wgs84)
    projected_geom = project_geometry(geom_wgs84, WGS84_EPSG, target_epsg)
    return float(projected_geom.length)


def is_within_india_bounds(geom_wgs84: BaseGeometry) -> bool:
    """Check whether a WGS 84 geometry's bounding box lies within India's geographic extent."""
    if geom_wgs84.is_empty:
        return False
    min_lon, min_lat, max_lon, max_lat = geom_wgs84.bounds
    india_min_lon, india_min_lat, india_max_lon, india_max_lat = INDIA_BBOX_WGS84
    return bool(
        min_lon >= india_min_lon
        and max_lon <= india_max_lon
        and min_lat >= india_min_lat
        and max_lat <= india_max_lat
    )
