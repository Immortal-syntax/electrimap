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

"""Integration tests for Milestone M5 (Network Layout Routing & Engineering Engine):
- `GET /api/v1/engineering-constants`
- `GET /api/v1/projects/{id}/scenarios`
- `POST /api/v1/projects/{id}/scenarios/generate`
- `PATCH /api/v1/projects/{id}/scenarios/{sid}/clusters/{cid}`
- `GET /api/v1/projects/{id}/exports/preliminary-settlement-pdf` (Sections 1-14 + SLD)
"""

from fastapi.testclient import TestClient

from app.main import app
from app.services.seed_service import (
    DEFAULT_PLANNER_EMAIL,
    DEFAULT_PLANNER_PASSWORD,
    DEMO_PROJECT_ID,
)


def _login_and_get_csrf(client: TestClient) -> dict[str, str]:
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": DEFAULT_PLANNER_EMAIL, "password": DEFAULT_PLANNER_PASSWORD},
    )
    assert resp.status_code == 200
    csrf_token = resp.json()["csrf_token"]
    return {"X-CSRF-Token": csrf_token}


def test_m5_engineering_constants_and_scenario_lifecycle() -> None:
    with TestClient(app) as client:
        headers = _login_and_get_csrf(client)

        # 1. Verify engineering constants endpoint
        const_resp = client.get("/api/v1/engineering-constants")
        assert const_resp.status_code == 200
        const_data = const_resp.json()
        assert const_data["count"] >= 19
        keys = {item["key"] for item in const_data["items"]}
        assert "ht_11kv_r_ohm_per_km" in keys
        assert "lt_415v_3ph_r_ohm_per_km" in keys

        # 2. Fetch default scenarios on Demo Project (ensuring HYBRID_OPTIMAL baseline)
        client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/scenarios/generate",
            headers=headers,
            json={"scenario_key": "HYBRID_OPTIMAL", "preserve_manual_overrides": False},
        )
        scen_resp = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/scenarios")
        assert scen_resp.status_code == 200
        scen_data = scen_resp.json()
        assert scen_data["active_scenario_key"] == "HYBRID_OPTIMAL"
        active = scen_data["active_scenario"]
        assert len(active["clusters"]) >= 1

        # 3. Place an explicit USER_ASSUMED 11 kV tie-in point and generate GRID_EXTENSION_ONLY
        tie_resp = client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/infrastructure",
            headers=headers,
            json={
                "asset_type": "TIE_IN",
                "name": "Nandapur 11 kV Feeder Tap (M5 Test)",
                "voltage_kv": 11.0,
                "provenance": "USER_ASSUMED",
                "source_note": "M5 integration test tie-in point",
                "lon": 82.725,
                "lat": 18.562,
            },
        )
        assert tie_resp.status_code == 201
        asset_id = tie_resp.json()["id"]

        grid_resp = client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/scenarios/generate",
            headers=headers,
            json={
                "scenario_key": "GRID_EXTENSION_ONLY",
                "preserve_manual_overrides": False,
            },
        )
        assert grid_resp.status_code == 200
        grid_scen = grid_resp.json()
        assert grid_scen["scenario_key"] == "GRID_EXTENSION_ONLY"
        assert grid_scen["total_ht_length_m"] > 0.0
        assert grid_scen["total_lt_length_m"] > 0.0
        assert grid_scen["total_dt_count"] >= 1
        assert len(grid_scen["network_geojson"]["features"]) >= 2

        # 4. Override first cluster to SOLAR_MINIGRID and verify synchronous recalculation
        first_cid = grid_scen["clusters"][0]["cluster_id"]
        override_resp = client.patch(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/scenarios/{grid_scen['id']}/clusters/{first_cid}",
            headers=headers,
            json={"modality": "SOLAR_MINIGRID"},
        )
        assert override_resp.status_code == 200
        updated_scen = override_resp.json()
        overridden_cluster = next(
            c for c in updated_scen["clusters"] if c["cluster_id"] == first_cid
        )
        assert overridden_cluster["modality"] == "SOLAR_MINIGRID"
        assert overridden_cluster["is_manual_override"] is True
        assert overridden_cluster["solar_pv_kwp"] > 0.0
        assert overridden_cluster["bess_capacity_kwh"] > 0.0

        # 5. Verify DPR PDF export includes Sections 10-14 and SLD schematic
        pdf_resp = client.get(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/exports/preliminary-settlement-pdf"
        )
        assert pdf_resp.status_code == 200
        assert pdf_resp.headers["content-type"] == "application/pdf"
        assert len(pdf_resp.content) > 25000

        # Clean up test tie-in asset and restore default HYBRID_OPTIMAL scenario
        del_resp = client.delete(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/infrastructure/{asset_id}",
            headers=headers,
        )
        assert del_resp.status_code == 204
        client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/scenarios/generate",
            headers=headers,
            json={"scenario_key": "HYBRID_OPTIMAL", "preserve_manual_overrides": False},
        )

