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

"""Integration tests for Milestone M6:
- Schedule of Rates (SoR) catalog, inline edit, UNSET export blocking, CSV import/export, and reset
- Automated BOQ generation and 4-scenario side-by-side comparison (`HYBRID_OPTIMAL`,
  `GRID_EXTENSION_ONLY`, `MINIGRID_PRIORITY`, `SHS_DISPERSED`)
- Scenario pinning (`POST /api/v1/projects/{id}/scenarios/{sid}/pin`)
- Preliminary DPR PDF export with Sections 15–17 (HTTP 422 blocking when any rate is UNSET)
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
        json={
            "email": DEFAULT_PLANNER_EMAIL,
            "password": DEFAULT_PLANNER_PASSWORD,
        },
    )
    assert resp.status_code == 200
    csrf_token = resp.json()["csrf_token"]
    return {"X-CSRF-Token": csrf_token}


def test_m6_rates_boq_scenario_comparison_and_pdf_export() -> None:
    """Verify full M6 workflow including UNSET rate export-block and scenario pinning."""
    with TestClient(app) as client:
        headers = _login_and_get_csrf(client)

        # Ensure clean baseline rates and scenarios for DEMO_PROJECT_ID
        reset_resp = client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/reset",
            headers=headers,
        )
        assert reset_resp.status_code == 200
        rates_data = reset_resp.json()
        assert rates_data["total_items"] == 18
        assert rates_data["unset_count"] == 0

        # 1. Fetch 4-scenario comparison
        comp_resp = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/comparison")
        assert comp_resp.status_code == 200
        comp_data = comp_resp.json()
        assert comp_data["has_unset_rates"] is False
        assert len(comp_data["scenarios"]) == 4
        assert len(comp_data["habitation_comparisons"]) >= 1

        # Verify all 4 scenarios use the exact same household & energy demand inputs (AC-10.1)
        hh_counts = {s["total_households_served"] for s in comp_data["scenarios"]}
        energy_vals = {s["annual_delivered_energy_mwh"] for s in comp_data["scenarios"]}
        assert len(hh_counts) == 1
        assert len(energy_vals) == 1

        baseline_capex = comp_data["active_scenario_boq"]["total_capex_inr"]
        assert baseline_capex > 0.0

        # 2. Fetch scenario BOQ directly and verify reconciliation
        active_sid = comp_data["active_scenario_id"]
        boq_resp = client.get(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/scenarios/{active_sid}/boq"
        )
        assert boq_resp.status_code == 200
        boq_data = boq_resp.json()
        assert boq_data["total_capex_inr"] == baseline_capex
        assert len(boq_data["aggregated_lines"]) >= 3

        # 3. Edit a rate item (SVC-CONN-BPL-1PH) and verify BOQ total updates
        patch_resp = client.patch(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/SVC-CONN-BPL-1PH",
            headers=headers,
            json={"rate_inr": 4500.0, "citation": "Updated Odisha DISCOM 2026 Rate"},
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["user_edited_count"] >= 1

        comp_after_edit = client.get(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/comparison"
        ).json()
        assert (
            comp_after_edit["active_scenario_boq"]["total_capex_inr"] != baseline_capex
        )

        # 4. Mark SVC-CONN-BPL-1PH as UNSET and verify DPR PDF export is blocked (AC-09.3)
        unset_resp = client.patch(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/SVC-CONN-BPL-1PH",
            headers=headers,
            json={"rate_inr": None},
        )
        assert unset_resp.status_code == 200
        assert unset_resp.json()["unset_count"] == 1
        assert "SVC-CONN-BPL-1PH" in unset_resp.json()["unset_item_codes"]

        blocked_pdf_resp = client.get(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/exports/preliminary-settlement-pdf"
        )
        assert blocked_pdf_resp.status_code == 422
        assert blocked_pdf_resp.json()["error"]["code"] == "UNSET_RATES_BLOCK_EXPORT"

        # 5. Test CSV Import validation (invalid CSV rejected, valid CSV accepted) and CSV Export
        bad_csv_resp = client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/import-csv",
            headers=headers,
            json={
                "csv_content": (
                    "item_code,description,category,unit,rate_inr,source_type,citation,source_year\n"
                    "SVC-CONN-BPL-1PH,Bad negative rate,SERVICE_CONNECTIONS,Household,"
                    "-100,USER_TEMPLATE,Bad,2025"
                ),
                "template_name": "Invalid CSV Test",
            },
        )
        assert bad_csv_resp.status_code == 200
        assert bad_csv_resp.json()["is_valid"] is False
        assert len(bad_csv_resp.json()["errors"]) == 1

        good_csv_resp = client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/import-csv",
            headers=headers,
            json={
                "csv_content": (
                    "item_code,description,category,unit,rate_inr,source_type,citation,source_year\n"
                    "SVC-CONN-BPL-1PH,Restored Service Connection Kit,SERVICE_CONNECTIONS,"
                    "Household,3850.00,USER_TEMPLATE,Restored CSV,2025"
                ),
                "template_name": "Valid Odisha CSV",
            },
        )
        assert good_csv_resp.status_code == 200
        assert good_csv_resp.json()["is_valid"] is True
        assert good_csv_resp.json()["unset_count"] == 0

        csv_export_resp = client.get(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/export-csv"
        )
        assert csv_export_resp.status_code == 200
        assert "SVC-CONN-BPL-1PH" in csv_export_resp.text

        # 6. Pin MINIGRID_PRIORITY scenario and verify DPR PDF export succeeds with Sections 15-17
        mg_scen = next(
            s
            for s in comp_data["scenarios"]
            if s["scenario_key"] == "MINIGRID_PRIORITY"
        )
        pin_resp = client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/scenarios/{mg_scen['scenario_id']}/pin",
            headers=headers,
        )
        assert pin_resp.status_code == 200
        assert pin_resp.json()["active_scenario_key"] == "MINIGRID_PRIORITY"

        pdf_resp = client.get(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/exports/preliminary-settlement-pdf"
        )
        assert pdf_resp.status_code == 200
        assert pdf_resp.headers["content-type"] == "application/pdf"
        assert pdf_resp.content.startswith(b"%PDF-1.4")
        assert len(pdf_resp.content) > 25000

        # Restore HYBRID_OPTIMAL and reference rates after test
        hybrid_scen = next(
            s for s in comp_data["scenarios"] if s["scenario_key"] == "HYBRID_OPTIMAL"
        )
        client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/scenarios/{hybrid_scen['scenario_id']}/pin",
            headers=headers,
        )
        client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/reset",
            headers=headers,
        )
