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

"""Pure GIS domain logic for AOI boundary validation, repair, CRS normalization, and area checks."""

from dataclasses import dataclass, field
from typing import Any, cast

import pyproj
import shapely
from shapely.geometry import MultiPolygon, Point, Polygon, mapping, shape
from shapely.geometry.base import BaseGeometry

from app.core.errors import AoiTooLargeError, AoiTooSmallError, InvalidGeometryError
from app.domain.gis.crs import (
    WGS84_EPSG,
    compute_metric_area_km2,
    is_within_india_bounds,
    project_geometry,
    select_metric_epsg_for_geometry,
)

MAX_AOI_VERTICES = 50_000
MIN_AOI_KM2 = 0.01


@dataclass(frozen=True)
class ValidatedBoundaryResult:
    """Result of validating and normalizing an AOI boundary geometry."""

    multipolygon_wgs84: MultiPolygon
    geojson_geometry: dict[str, Any]
    area_km2: float
    metric_epsg: int
    centroid_lon: float
    centroid_lat: float
    vertex_count: int
    original_crs: str
    warnings: list[str] = field(default_factory=list)


def _count_vertices(geom: BaseGeometry) -> int:
    """Return total coordinate vertex count across all rings of a geometry."""
    return int(shapely.get_num_coordinates(geom))


def _extract_multipolygon(geom: BaseGeometry) -> MultiPolygon:
    """Extract polygonal components from a geometry and normalize to MultiPolygon."""
    if isinstance(geom, MultiPolygon):
        return geom
    if isinstance(geom, Polygon):
        return MultiPolygon([geom])
    if hasattr(geom, "geoms"):
        polys: list[Polygon] = []
        for part in geom.geoms:
            if isinstance(part, Polygon) and not part.is_empty:
                polys.append(part)
            elif isinstance(part, MultiPolygon) and not part.is_empty:
                polys.extend(list(part.geoms))
        if polys:
            return MultiPolygon(polys)
    raise InvalidGeometryError(
        "Boundary geometry must be a Polygon or MultiPolygon.",
        details={"geometry_type": geom.geom_type},
    )


def reproject_arbitrary_crs_to_wgs84(geom: BaseGeometry, source_crs: str) -> BaseGeometry:
    """Reproject a Shapely geometry from an arbitrary CRS string/WKT into WGS 84 (EPSG:4326)."""
    try:
        crs_obj = pyproj.CRS.from_user_input(source_crs)
    except pyproj.exceptions.CRSError as exc:
        raise InvalidGeometryError(
            f"Unrecognized coordinate reference system: '{source_crs}'.",
            details={"source_crs": source_crs},
        ) from exc

    epsg_code = crs_obj.to_epsg()
    if epsg_code == WGS84_EPSG:
        return geom

    transformer = pyproj.Transformer.from_crs(
        crs_obj, f"EPSG:{WGS84_EPSG}", always_xy=True
    )
    transformed = shapely.transform(
        geom,
        lambda coords: transformer.transform(coords[:, 0], coords[:, 1]),
        interleaved= False,
    )
    return cast(BaseGeometry, transformed)


def validate_and_normalize_boundary(
    raw_geom_or_geojson: BaseGeometry | dict[str, Any],
    *,
    source_crs: str = "EPSG:4326",
    max_aoi_km2: float = 500.0,
    min_aoi_km2: float = MIN_AOI_KM2,
) -> ValidatedBoundaryResult:
    """Validate, repair if needed, reproject to EPSG:4326, and compute metric area in km^2."""
    warnings: list[str] = []

    if isinstance(raw_geom_or_geojson, dict):
        geom_dict = raw_geom_or_geojson
        if geom_dict.get("type") == "FeatureCollection":
            features = geom_dict.get("features") or []
            if not features:
                raise InvalidGeometryError("FeatureCollection contains no features.")
            geoms = [shape(f["geometry"]) for f in features if f.get("geometry")]
            if not geoms:
                raise InvalidGeometryError("FeatureCollection contains no valid geometries.")
            raw_geom: BaseGeometry = shapely.unary_union(geoms)
        else:
            if geom_dict.get("type") == "Feature":
                geom_dict = geom_dict.get("geometry") or {}
            try:
                raw_geom = shape(geom_dict)
            except Exception as exc:
                raise InvalidGeometryError(f"Malformed GeoJSON geometry: {exc}") from exc
    else:
        raw_geom = raw_geom_or_geojson

    if raw_geom is None or raw_geom.is_empty:
        raise InvalidGeometryError("Boundary geometry is empty.")

    # Force 2D if 3D coordinates (Z) are present
    if shapely.has_z(raw_geom):
        raw_geom = shapely.force_2d(raw_geom)
        warnings.append("Z_COORDINATES_STRIPPED_TO_2D")

    vertex_count = _count_vertices(raw_geom)
    if vertex_count < 4:
        raise InvalidGeometryError(
            "Polygon boundary requires at least 3 distinct vertices.",
            details={"vertex_count": vertex_count},
        )
    if vertex_count > MAX_AOI_VERTICES:
        raise InvalidGeometryError(
            f"Boundary vertex count ({vertex_count}) exceeds limit of {MAX_AOI_VERTICES}.",
            details={"vertex_count": vertex_count, "max_vertices": MAX_AOI_VERTICES},
        )

    # Reproject to WGS 84 if source_crs is not EPSG:4326
    geom_wgs84 = reproject_arbitrary_crs_to_wgs84(raw_geom, source_crs)

    # Check validity and repair simple self-intersections (e.g. bowtie polygons)
    if not geom_wgs84.is_valid:
        repaired = shapely.make_valid(geom_wgs84)
        if not repaired.is_valid or repaired.is_empty:
            raise InvalidGeometryError("Geometry is self-intersecting and could not be repaired.")
        geom_wgs84 = repaired
        warnings.append("SELF_INTERSECTION_REPAIRED")

    multipoly = _extract_multipolygon(geom_wgs84)
    if multipoly.is_empty or not multipoly.is_valid:
        raise InvalidGeometryError("Normalized MultiPolygon is empty or invalid.")

    if not is_within_india_bounds(multipoly):
        minx, miny, maxx, maxy = multipoly.bounds
        raise InvalidGeometryError(
            "Boundary lies outside India coordinate bounds (68.0E-98.0E, 6.0N-38.0N). "
            "Check whether latitude/longitude are swapped or the source CRS is incorrect.",
            details={"bounds": [minx, miny, maxx, maxy]},
        )

    metric_epsg = select_metric_epsg_for_geometry(multipoly)
    area_km2 = compute_metric_area_km2(multipoly, metric_epsg=metric_epsg)

    if area_km2 < min_aoi_km2:
        raise AoiTooSmallError(area_km2=area_km2, min_aoi_km2=min_aoi_km2)
    if area_km2 > max_aoi_km2:
        raise AoiTooLargeError(area_km2=area_km2, max_aoi_km2=max_aoi_km2)

    centroid = multipoly.centroid
    return ValidatedBoundaryResult(
        multipolygon_wgs84=multipoly,
        geojson_geometry=dict(mapping(multipoly)),
        area_km2=round(area_km2, 4),
        metric_epsg=metric_epsg,
        centroid_lon=round(float(centroid.x), 5),
        centroid_lat=round(float(centroid.y), 5),
        vertex_count=_count_vertices(multipoly),
        original_crs=source_crs,
        warnings=warnings,
    )


def create_approximate_village_buffer_wgs84(
    lon: float,
    lat: float,
    radius_m: float = 1500.0,
) -> tuple[MultiPolygon, float, int]:
    """Create a metric circular buffer in local UTM around a village centroid."""
    pt_wgs84 = Point(lon, lat)
    utm_epsg = select_metric_epsg_for_geometry(pt_wgs84)
    pt_utm = project_geometry(pt_wgs84, WGS84_EPSG, utm_epsg)
    poly_utm = pt_utm.buffer(radius_m, quad_segs=16)
    area_km2 = float(poly_utm.area) / 1_000_000.0
    poly_wgs84 = project_geometry(poly_utm, utm_epsg, WGS84_EPSG)
    multipoly = _extract_multipolygon(poly_wgs84)
    return multipoly, round(area_km2, 4), utm_epsg