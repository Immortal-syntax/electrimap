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

"""Technical risk spike (S1-S4) inspection and reference dataset endpoints."""

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(prefix="/api/v1/spikes", tags=["Spikes"])


def _read_json_if_exists(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    result: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return result


@router.get("/summary")
def get_spike_summary() -> dict[str, Any]:
    """Return aggregated status and metrics for Technical Risk Spikes S1-S4."""
    settings = get_settings()
    ref_dir = settings.data_dir / "reference"
    cache_dir = settings.data_dir / "cache"

    manifest = _read_json_if_exists(ref_dir / "MANIFEST.json")
    s2_summary = _read_json_if_exists(cache_dir / "s2_routing_summary.json")
    s4_summary = _read_json_if_exists(cache_dir / "s4_50k_summary.json")
    pdf_path = cache_dir / "s3_dpr_spike.pdf"

    return {
        "milestone": "M0",
        "reference_geography": manifest.get("reference_geography") if manifest else None,
        "spikes": {
            "S1_data_access": {
                "status": "PASSED" if manifest else "PENDING",
                "datasets_verified": len(manifest.get("datasets", [])) if manifest else 0,
                "epsg": 32644,
            },
            "S2_least_cost_routing": {
                "status": "PASSED" if s2_summary else "PENDING",
                "elapsed_seconds": s2_summary.get("elapsed_seconds") if s2_summary else None,
                "routes": s2_summary.get("routes", []) if s2_summary else [],
            },
            "S3_cartographic_pdf": {
                "status": "PASSED" if pdf_path.exists() else "PENDING",
                "pdf_size_bytes": pdf_path.stat().st_size if pdf_path.exists() else 0,
                "sections_verified": ["Title Page", "Preliminary Engineering Map Plate"],
            },
            "S4_maplibre_50k_webgl": {
                "status": "PASSED" if s4_summary else "PENDING",
                "feature_count": s4_summary.get("feature_count", 50000) if s4_summary else 50000,
                "bbox": s4_summary.get("bbox") if s4_summary else [82.68, 18.52, 82.78, 18.61],
            },
        },
    }


@router.get("/reference-geojson")
def get_reference_geojson() -> dict[str, Any]:
    """Return reference village boundary, building footprints, and S2 routed feeders."""
    settings = get_settings()
    ref_dir = settings.data_dir / "reference"

    villages = _read_json_if_exists(ref_dir / "koraput_nandapur_villages.geojson") or {
        "type": "FeatureCollection",
        "features": [],
    }
    buildings = _read_json_if_exists(ref_dir / "koraput_nandapur_buildings.geojson") or {
        "type": "FeatureCollection",
        "features": [],
    }
    routes = _read_json_if_exists(ref_dir / "koraput_nandapur_sample_routes.geojson") or {
        "type": "FeatureCollection",
        "features": [],
    }
    solar = _read_json_if_exists(ref_dir / "koraput_nandapur_solar.json") or {}

    return {
        "villages": villages,
        "buildings": buildings,
        "routes": routes,
        "solar": solar,
    }

