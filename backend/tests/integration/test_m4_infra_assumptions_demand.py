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

"""Integration tests for Milestone M4:
- Existing Electrical Infrastructure & Interactive Tie-In Placement (`/infrastructure`)
- Terrain-Weighted Distance & Obstacle Gap Analysis Matrix (`/gap-analysis`)
- Project-Level Assumptions Register (`/settings`)
- 7-Category Parametric Electricity Demand Estimation (`/demand`)
- DPR PDF Sections 1–9 Export
"""

import json

from fastapi.testclient import TestClient

from app.services.seed_service import (
    DEFAULT_PLANNER_EMAIL,
    DEFAULT_PLANNER_PASSWORD,
    DEMO_PROJECT_ID,
)


def _login_planner(client: TestClient) -> str:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": DEFAULT_PLANNER_EMAIL, "password": DEFAULT_PLANNER_PASSWORD},
    )
    assert res.status_code == 200
    csrf_token: str = res.json()["csrf_token"]
    return csrf_token


def test_m4_no_fabricated_infrastructure_and_gap_analysis_lifecycle(
    client: TestClient,
) -> None:
    """Verify Core Principle #4 (UNSET when no infra exists), tie-in, upload, and gap matrix."""
    csrf = _login_planner(client)
    headers = {"X-CSRF-Token": csrf}

    # 1. Initially, no existing infrastructure is fabricated
    infra_res = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/infrastructure")
    assert infra_res.status_code == 200
    assert infra_res.json()["has_existing_infra"] is False
    assert len(infra_res.json()["items"]) == 0

    gap_initial = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/gap-analysis")
    assert gap_initial.status_code == 200
    gap_init_body = gap_initial.json()
    assert gap_init_body["has_existing_infra"] is False
    assert gap_init_body["mean_d_straight_m"] is None
    assert gap_init_body["mean_d_terrain_m"] is None
    assert all(
        c["d_straight_m"] is None and c["recommended_modality"] == "UNSET_INFRA_REQUIRED"
        for c in gap_init_body["clusters"]
    )

    # 2. Place an explicit USER_ASSUMED 11 kV Tie-In Point
    post_tie = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/infrastructure",
        headers=headers,
        json={
            "asset_type": "TIE_IN",
            "name": "Nandapur 11 kV Feeder Tap Point (Assumed)",
            "voltage_kv": 11.0,
            "provenance": "USER_ASSUMED",
            "source_note": "Assumed tap point on Nandapur-Padwa 11 kV feeder road crossing.",
            "lon": 82.7265,
            "lat": 18.5645,
        },
    )
    assert post_tie.status_code == 201
    tie_asset = post_tie.json()
    assert tie_asset["provenance"] == "USER_ASSUMED"
    assert tie_asset["quality_tag"] == "ASSUMED"
    asset_id = tie_asset["id"]

    # 3. Verify Gap Analysis now computes UTM distances and corridors
    gap_after = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/gap-analysis")
    assert gap_after.status_code == 200
    gap_body = gap_after.json()
    assert gap_body["has_existing_infra"] is True
    assert gap_body["assumed_assets_count"] == 1
    assert gap_body["mean_d_straight_m"] is not None and gap_body["mean_d_straight_m"] > 0
    assert (
        gap_body["mean_d_terrain_m"] is not None
        and gap_body["mean_d_terrain_m"] > gap_body["mean_d_straight_m"]
    )
    assert len(gap_body["corridors_geojson"]["features"]) == len(gap_body["clusters"])

    # Confirm cluster d_infra_m was synchronized
    clusters_res = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/clusters")
    assert all(c["d_infra_m"] is not None for c in clusters_res.json()["items"])

    # 4. Relocate the tie-in point via PATCH
    patch_tie = client.patch(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/infrastructure/{asset_id}",
        headers=headers,
        json={"lon": 82.7310, "lat": 18.5665, "name": "Relocated 11 kV Tie-In"},
    )
    assert patch_tie.status_code == 200
    assert patch_tie.json()["name"] == "Relocated 11 kV Tie-In"

    # 5. Upload a utility GeoJSON infrastructure file (UTILITY_RECORD)
    geojson_payload = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "asset_type": "HT_LINE",
                    "name": "Existing 11 kV Nandapur Spur",
                    "voltage_kv": 11.0,
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[82.720, 18.560], [82.728, 18.566]],
                },
            }
        ],
    }
    up_res = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/infrastructure/upload",
        headers=headers,
        data={
            "provenance": "UTILITY_RECORD",
            "source_note": "TPSODL Koraput Division 11 kV GIS extract",
        },
        files={
            "file": (
                "tpsodl_11kv.geojson",
                json.dumps(geojson_payload).encode(),
                "application/geo+json",
            )
        },
    )
    assert up_res.status_code == 201
    assert len(up_res.json()["items"]) == 2

    # 6. Delete both assets and confirm honest UNSET state returns
    for item in up_res.json()["items"]:
        del_res = client.delete(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/infrastructure/{item['id']}",
            headers=headers,
        )
        assert del_res.status_code == 204

    gap_cleared = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/gap-analysis").json()
    assert gap_cleared["has_existing_infra"] is False
    assert gap_cleared["mean_d_straight_m"] is None


def test_m4_assumptions_register_and_seven_category_demand_engine(
    client: TestClient,
) -> None:
    """Verify project settings CRUD, bounds check, reset, and 7-category demand recalculation."""
    csrf = _login_planner(client)
    headers = {"X-CSRF-Token": csrf}

    # 1. GET /settings returns 14 seeded REC/CEA assumptions
    settings_res = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/settings")
    assert settings_res.status_code == 200
    s_body = settings_res.json()
    assert len(s_body["items"]) == 14
    assert s_body["user_edited_count"] == 0

    # 2. Baseline 7-category demand calculation
    dem_base = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/demand")
    assert dem_base.status_code == 200
    d_base = dem_base.json()
    assert len(d_base["category_totals"]) == 7
    assert d_base["total_households"] > 0
    base_horizon_kva = d_base["peak_kva_horizon"]

    # 3. Override annual_demand_growth_rate from 0.045 to 0.08 and bpl_household_share to 0.40
    patch_res = client.patch(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/settings",
        headers=headers,
        json={
            "updates": [
                {
                    "key": "annual_demand_growth_rate",
                    "value": 0.08,
                    "override_note": "Higher agro-processing growth under DA-JGUA",
                },
                {
                    "key": "bpl_household_share",
                    "value": 0.40,
                    "override_note": "Updated from Gram Panchayat socio-economic register",
                },
            ]
        },
    )
    assert patch_res.status_code == 200
    p_body = patch_res.json()
    assert p_body["user_edited_count"] == 2
    edited_growth = next(
        i for i in p_body["items"] if i["key"] == "annual_demand_growth_rate"
    )
    assert edited_growth["is_user_edited"] is True
    assert edited_growth["quality_tag"] == "USER_ENTERED"

    # 4. Out-of-bounds setting value rejected with 422 SETTING_OUT_OF_BOUNDS
    bad_patch = client.patch(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/settings",
        headers=headers,
        json={"updates": [{"key": "power_factor_cos_phi", "value": 1.25}]},
    )
    assert bad_patch.status_code == 422
    assert bad_patch.json()["error"]["code"] == "SETTING_OUT_OF_BOUNDS"

    # 5. Recompute demand and verify higher horizon peak kVA
    dem_updated = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/demand/calculate",
        headers=headers,
    )
    assert dem_updated.status_code == 200
    assert dem_updated.json()["peak_kva_horizon"] > base_horizon_kva

    # 6. Reset settings to normative defaults
    reset_res = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/settings/reset",
        headers=headers,
    )
    assert reset_res.status_code == 200
    assert reset_res.json()["user_edited_count"] == 0

    # 7. Verify DPR PDF export with Sections 1-9 succeeds
    pdf_res = client.get(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/exports/preliminary-settlement-pdf"
    )
    assert pdf_res.status_code == 200
    assert pdf_res.content.startswith(b"%PDF-")
    assert len(pdf_res.content) > 15_000
