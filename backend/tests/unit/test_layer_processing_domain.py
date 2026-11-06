"""Unit tests for Milestone M2 pure GIS domain: footprint classification and raster rendering."""

import pytest
from shapely.geometry import Polygon

from app.domain.gis.layer_processing import (
    classify_building_footprint,
    compute_layer_summaries,
    render_raster_layer_png,
)


def test_classify_building_footprint_size_and_confidence_rules() -> None:
    """Verify ARCHITECTURE.md §4.4 footprint size classes and confidence exclusion."""
    assert classify_building_footprint(6.5, 0.90) == ("NOISE", True)
    assert classify_building_footprint(10.5, 0.85) == ("OUTBUILDING", False)
    assert classify_building_footprint(45.0, 0.88) == ("RESIDENTIAL", False)
    assert classify_building_footprint(320.0, 0.92) == ("NON_RESIDENTIAL", False)
    # Low confidence (< 0.70) marks footprint as excluded by default
    assert classify_building_footprint(45.0, 0.62) == ("RESIDENTIAL", True)


def test_compute_layer_summaries_for_koraput_aoi() -> None:
    """Verify DEM/slope, WorldCover class percentages, and VIIRS radiance summaries."""
    aoi = Polygon(
        [
            (82.695, 18.535),
            (82.768, 18.535),
            (82.768, 18.598),
            (82.695, 18.598),
            (82.695, 18.535),
        ]
    )
    summaries = compute_layer_summaries(aoi)
    dem = summaries["dem_slope"]
    assert dem["elevation_max_m"] > dem["elevation_min_m"] >= 400.0
    assert dem["slope_max_deg"] > dem["slope_mean_deg"] > 0.0

    lc = summaries["landcover"]
    total_pct = (
        lc["tree_cover_pct"]
        + lc["shrub_grass_pct"]
        + lc["cropland_pct"]
        + lc["built_up_pct"]
        + lc["water_pct"]
    )
    assert abs(total_pct - 100.0) <= 0.5

    nl = summaries["nightlights"]
    assert nl["max_radiance_nw_cm2_sr"] > nl["mean_radiance_nw_cm2_sr"] > 0.0
    assert 0.0 <= nl["mean_lightscore"] <= 1.0


def test_render_raster_layer_png_produces_valid_png_bytes() -> None:
    """Verify dem_slope, landcover, and nightlights render valid PNG images."""
    bbox = (82.695, 18.535, 82.768, 18.598)
    for key in ("dem_slope", "landcover", "nightlights"):
        png_bytes = render_raster_layer_png(key, bbox)
        assert png_bytes.startswith(b"\x89PNG\r\n\x1a\n")
        assert len(png_bytes) > 1000

    with pytest.raises(ValueError, match="Unsupported raster preview"):
        render_raster_layer_png("invalid_layer", bbox)

