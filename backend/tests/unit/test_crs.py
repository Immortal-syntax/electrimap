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

"""Unit tests for CRS selection, reprojection round-trip accuracy, and metric calculations."""

from shapely.geometry import Point, Polygon, box

from app.domain.gis.crs import (
    WGS84_EPSG,
    compute_metric_area_km2,
    compute_metric_area_m2,
    compute_metric_length_m,
    is_within_india_bounds,
    project_geometry,
    select_metric_epsg_for_geometry,
    select_utm_epsg_from_lon_lat,
)


def test_select_utm_epsg_for_koraput_odisha() -> None:
    """Koraput district, Odisha (~82.71E, 18.81N) lies in UTM Zone 44N (EPSG:32644)."""
    epsg = select_utm_epsg_from_lon_lat(lon_deg=82.71, lat_deg=18.81)
    assert epsg == 32644


def test_round_trip_reprojection_precision() -> None:
    """Verify EPSG:4326 -> EPSG:32644 -> EPSG:4326 round-trip error is < 0.01 m."""
    pt_wgs84 = Point(82.71234, 18.81345)
    pt_utm = project_geometry(pt_wgs84, WGS84_EPSG, 32644)
    pt_back = project_geometry(pt_utm, 32644, WGS84_EPSG)
    pt_utm_again = project_geometry(pt_back, WGS84_EPSG, 32644)
    assert pt_utm.distance(pt_utm_again) < 0.01


def test_metric_area_and_length_against_known_utm_square() -> None:
    """A 1000 m x 1000 m square in EPSG:32644 projected to WGS 84 has area 1.0 km^2."""
    utm_square = Polygon(
        [
            (680_000.0, 2_080_000.0),
            (681_000.0, 2_080_000.0),
            (681_000.0, 2_081_000.0),
            (680_000.0, 2_081_000.0),
        ]
    )
    wgs84_poly = project_geometry(utm_square, 32644, WGS84_EPSG)
    assert select_metric_epsg_for_geometry(wgs84_poly) == 32644
    area_m2 = compute_metric_area_m2(wgs84_poly, metric_epsg=32644)
    area_km2 = compute_metric_area_km2(wgs84_poly, metric_epsg=32644)
    perimeter_m = compute_metric_length_m(wgs84_poly, metric_epsg=32644)

    assert abs(area_m2 - 1_000_000.0) / 1_000_000.0 < 0.001
    assert abs(area_km2 - 1.0) < 0.001
    assert abs(perimeter_m - 4_000.0) < 1.0


def test_india_bounds_check() -> None:
    """Verify geometries inside India pass and outside India fail."""
    koraput_box = box(82.5, 18.5, 82.9, 18.9)
    london_box = box(-0.2, 51.4, 0.1, 51.6)
    assert is_within_india_bounds(koraput_box) is True
    assert is_within_india_bounds(london_box) is False

