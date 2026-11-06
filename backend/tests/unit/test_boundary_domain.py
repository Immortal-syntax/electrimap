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

"""Unit tests for pure GIS boundary validation, self-intersection repair, and buffer generation."""

import math

import pytest
from shapely.geometry import Polygon

from app.core.errors import AoiTooLargeError, AoiTooSmallError, InvalidGeometryError
from app.domain.gis.boundary import (
    create_approximate_village_buffer_wgs84,
    validate_and_normalize_boundary,
)


def test_validate_normalizes_polygon_to_multipolygon() -> None:
    """Verify valid Koraput polygon normalizes to MultiPolygon with EPSG:32644."""
    poly = Polygon(
        [
            (82.70, 18.54),
            (82.75, 18.54),
            (82.75, 18.58),
            (82.70, 18.58),
            (82.70, 18.54),
        ]
    )
    res = validate_and_normalize_boundary(poly)
    assert res.geojson_geometry["type"] == "MultiPolygon"
    assert res.metric_epsg == 32644
    assert 20.0 < res.area_km2 < 28.0
    assert res.warnings == []


def test_self_intersecting_bowtie_polygon_is_repaired_with_warning() -> None:
    """Verify a self-intersecting bowtie polygon is repaired via make_valid and flagged."""
    bowtie = Polygon(
        [
            (82.70, 18.54),
            (82.75, 18.58),
            (82.75, 18.54),
            (82.70, 18.58),
            (82.70, 18.54),
        ]
    )
    res = validate_and_normalize_boundary(bowtie)
    assert "SELF_INTERSECTION_REPAIRED" in res.warnings
    assert res.multipolygon_wgs84.is_valid
    assert res.area_km2 > 1.0


def test_aoi_too_large_and_too_small_raise_typed_errors() -> None:
    """Verify area cap (>500 km^2) and minimum area (<0.01 km^2) raise typed AppErrors."""
    huge_poly = Polygon(
        [
            (82.0, 18.0),
            (83.0, 18.0),
            (83.0, 19.0),
            (82.0, 19.0),
            (82.0, 18.0),
        ]
    )
    with pytest.raises(AoiTooLargeError) as exc_large:
        validate_and_normalize_boundary(huge_poly, max_aoi_km2=500.0)
    assert exc_large.value.code == "AOI_TOO_LARGE"

    tiny_poly = Polygon(
        [
            (82.73000, 18.56000),
            (82.73005, 18.56000),
            (82.73005, 18.56005),
            (82.73000, 18.56005),
            (82.73000, 18.56000),
        ]
    )
    with pytest.raises(AoiTooSmallError) as exc_small:
        validate_and_normalize_boundary(tiny_poly)
    assert exc_small.value.code == "AOI_TOO_SMALL"


def test_outside_india_bounds_rejected() -> None:
    """Verify coordinates outside India (e.g. swapped lat/lon) raise InvalidGeometryError."""
    swapped = Polygon(
        [
            (18.54, 82.70),
            (18.58, 82.70),
            (18.58, 82.75),
            (18.54, 82.75),
            (18.54, 82.70),
        ]
    )
    with pytest.raises(InvalidGeometryError, match="outside India"):
        validate_and_normalize_boundary(swapped)


def test_approximate_village_buffer_area_accuracy() -> None:
    """Verify a 1,500 m circular UTM buffer has area within 1% of pi * 1.5^2 = 7.0686 km^2."""
    multipoly, area_km2, utm_epsg = create_approximate_village_buffer_wgs84(
        82.755, 18.585, radius_m=1500.0
    )
    expected_km2 = math.pi * (1.5**2)
    assert utm_epsg == 32644
    assert multipoly.is_valid
    assert abs(area_km2 - expected_km2) / expected_km2 < 0.01

