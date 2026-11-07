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

"""Integration tests for Milestone M7: Pre-Flight Audit, 24-Section DPR PDF, Excel BOQ & GIS ZIP."""

import io
import json
import zipfile

from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.main import app
from app.services.seed_service import DEMO_PROJECT_ID


def _login_and_get_csrf(client: TestClient) -> dict[str, str]:
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "planner@electrimap.in", "password": "ElectriMap#2026"},
    )
    assert resp.status_code == 200
    csrf_token = resp.json()["csrf_token"]
    return {"X-CSRF-Token": csrf_token}


def test_m7_preflight_24_section_dpr_excel_boq_and_gis_package() -> None:
    """Verify pre-flight audit, 24-section PDF DPR, formula Excel BOQ, GIS ZIP, and SHA-256 logs."""
    with TestClient(app) as client:
        headers = _login_and_get_csrf(client)

        # Ensure standard Odisha SoR rates are active
        reset_resp = client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/reset",
            headers=headers,
        )
        assert reset_resp.status_code == 200

        # Ensure HYBRID_OPTIMAL is pinned so no cluster requires an unset tie-in
        comp_resp = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/comparison")
        assert comp_resp.status_code == 200
        comp_data = comp_resp.json()
        hybrid_card = next(
            s for s in comp_data["scenarios"] if s["scenario_key"] == "HYBRID_OPTIMAL"
        )
        pin_resp = client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/scenarios/{hybrid_card['scenario_id']}/pin",
            headers=headers,
        )
        assert pin_resp.status_code == 200
        expected_capex_inr = pin_resp.json()["active_scenario_boq"]["total_capex_inr"]

        # 1. Verify Pre-Flight Audit endpoint (/report/preflight)
        pf_resp = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/report/preflight")
        assert pf_resp.status_code == 200
        pf_data = pf_resp.json()
        assert pf_data["can_export"] is True
        assert pf_data["hard_blockers_failed"] == 0
        assert len(pf_data["sections"]) == 24
        assert [s["section_number"] for s in pf_data["sections"]] == list(range(1, 25))
        assert len(pf_data["snapshot_hash"]) == 64

        # 2. Verify Complete 24-Section PDF DPR Export (/exports/dpr-pdf)
        pdf_resp = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/exports/dpr-pdf")
        assert pdf_resp.status_code == 200
        assert pdf_resp.headers["content-type"] == "application/pdf"
        assert len(pdf_resp.headers.get("x-export-sha256", "")) == 64
        assert pdf_resp.headers.get("x-snapshot-sha256") == pf_data["snapshot_hash"]
        assert pdf_resp.content.startswith(b"%PDF-")
        assert len(pdf_resp.content) > 25000

        # 3. Verify Formula-Driven 5-Sheet Excel BOQ Export (/exports/boq-xlsx)
        xlsx_resp = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/exports/boq-xlsx")
        assert xlsx_resp.status_code == 200
        assert (
            xlsx_resp.headers["content-type"]
            == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        wb = load_workbook(io.BytesIO(xlsx_resp.content), data_only=False)
        assert wb.sheetnames == [
            "Summary",
            "Settlements & Demand",
            "Engineering & Sizing",
            "BOQ & Rates",
            "Scenario Comparison",
        ]
        ws_boq = wb["BOQ & Rates"]
        # Verify row 2 has live multiplication formula =ROUND(D2*F2,2)
        formula_cell = str(ws_boq["G2"].value)
        assert formula_cell.startswith("=ROUND(D2*F2,2)")
        # Verify GRAND_TOTAL row has =ROUND(SUM(...),2) formula and exact verified total_capex_inr
        max_r = ws_boq.max_row
        assert ws_boq.cell(row=max_r, column=1).value == "GRAND_TOTAL"
        assert str(ws_boq.cell(row=max_r, column=7).value).startswith("=ROUND(SUM(")
        verified_capex = float(ws_boq.cell(row=max_r, column=8).value)
        assert abs(verified_capex - expected_capex_inr) < 0.05

        # 4. Verify Cleaned GIS Vector Package Export (/exports/gis-package)
        gis_resp = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/exports/gis-package")
        assert gis_resp.status_code == 200
        assert gis_resp.headers["content-type"] == "application/zip"
        with zipfile.ZipFile(io.BytesIO(gis_resp.content), mode="r") as zf:
            names = set(zf.namelist())
            assert {
                "aoi_boundary.geojson",
                "habitation_clusters.geojson",
                "infrastructure_assets.geojson",
                "preliminary_network_layout.geojson",
                "settlement_and_engineering_schedule.csv",
                "provenance_manifest.json",
            }.issubset(names)
            manifest = json.loads(zf.read("provenance_manifest.json").decode("utf-8"))
            assert manifest["storage_crs"] == "EPSG:4326"
            assert manifest["metric_computation_crs"] == "EPSG:32644"
            assert len(manifest["files"]) == 5

        # 5. Verify Cryptographic SHA-256 Export Audit Log (/exports)
        logs_resp = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/exports")
        assert logs_resp.status_code == 200
        logs_data = logs_resp.json()
        assert logs_data["total_exports"] >= 3
        kinds = {item["export_kind"] for item in logs_data["items"]}
        assert {"PDF_DPR_24", "XLSX_BOQ", "GIS_PACKAGE_ZIP"}.issubset(kinds)

