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

"""Integration tests verifying AUD-01..AUD-17 backend invariants and epistemic guardrails."""

import json

from fastapi.testclient import TestClient

from app.services.seed_service import (
    DEFAULT_PLANNER_EMAIL,
    DEFAULT_PLANNER_PASSWORD,
    DEMO_PROJECT_ID,
)


def _login_headers(client: TestClient) -> dict[str, str]:
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": DEFAULT_PLANNER_EMAIL, "password": DEFAULT_PLANNER_PASSWORD},
    )
    assert resp.status_code == 200
    return {"X-CSRF-Token": str(resp.json()["csrf_token"])}


def test_aud_outside_koraput_synthetic_blocks_export_and_viirs_unavailable(
    seeded_client: TestClient,
) -> None:
    """Verify outside-reference AOI marks synthetic fallback and blocks DPR export."""
    client = seeded_client
    headers = _login_headers(client)

    proj_resp = client.post(
        "/api/v1/projects",
        headers=headers,
        json={
            "name": "Mandla Madhya Pradesh Synthetic Guard Test",
            "target_state": "Madhya Pradesh",
            "target_district": "Mandla",
            "target_block": "Bichhiya",
            "scheme": "PM-JANMAN",
            "horizon_years": 5,
            "load_tier": "TIER_4_PRODUCTIVE",
        },
    )
    assert proj_resp.status_code == 201
    project_id = str(proj_resp.json()["id"])

    # Load tier TIER_4_PRODUCTIVE should have seeded productive BPL load default (0.50 kW/HH)
    settings_resp = client.get(f"/api/v1/projects/{project_id}/settings")
    assert settings_resp.status_code == 200
    bpl_kw = next(
        s["value"]
        for s in settings_resp.json()["items"]
        if s["key"] == "bpl_connected_load_kw"
    )
    assert abs(float(bpl_kw) - 0.50) < 1e-3

    # Define an AOI outside the Koraput reference bundle (UTM 44N -> Mandla ~80.6E, 22.4N)
    aoi_resp = client.put(
        f"/api/v1/projects/{project_id}/aoi",
        headers=headers,
        json={
            "mode": "USER_DRAWN",
            "geojson_geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [80.60, 22.40],
                        [80.62, 22.40],
                        [80.62, 22.42],
                        [80.60, 22.42],
                        [80.60, 22.40],
                    ]
                ],
            },
        },
    )
    assert aoi_resp.status_code == 200

    acq_resp = client.post(
        f"/api/v1/projects/{project_id}/data/acquire",
        headers=headers,
        json={"force_refresh": True},
    )
    assert acq_resp.status_code in {200, 202}

    layers_resp = client.get(f"/api/v1/projects/{project_id}/layers")
    assert layers_resp.status_code == 200
    layers_by_key = {item["layer_key"]: item for item in layers_resp.json()}
    assert layers_by_key["nightlights"]["summary_metrics"]["is_unavailable"] is True
    assert layers_by_key["buildings"]["summary_metrics"]["is_synthetic_fallback"] is True

    # Run clustering & verify Stage 2 Skeleton PDF still succeeds unblocked by Stage 5 rates
    clust_resp = client.post(
        f"/api/v1/projects/{project_id}/clusters/detect",
        headers=headers,
        json={"eps_m": 150.0, "min_samples": 3, "household_alpha": 0.9},
    )
    assert clust_resp.status_code == 200

    skel_pdf = client.get(
        f"/api/v1/projects/{project_id}/exports/preliminary-settlement-pdf",
        params={"skeleton_only": "true"},
    )
    assert skel_pdf.status_code == 200
    assert skel_pdf.content.startswith(b"%PDF-")

    # Full preflight & 24-section export must block synthetic fallback with SYNTHETIC_FALLBACK_DATA
    pf_resp = client.get(f"/api/v1/projects/{project_id}/report/preflight")
    assert pf_resp.status_code == 200
    pf_json = pf_resp.json()
    assert pf_json["can_export"] is False
    synth_check = next(
        c for c in pf_json["checks"] if c["check_code"] == "SYNTHETIC_FALLBACK_DATA"
    )
    assert synth_check["status"] == "FAIL"

    dpr_resp = client.get(f"/api/v1/projects/{project_id}/exports/dpr-pdf")
    assert dpr_resp.status_code == 422


def test_aud_horizon_sync_unset_suppression_recluster_preservation_and_validation(
    seeded_client: TestClient,
) -> None:
    """Verify UNSET suppression, strict upload validation, preservation, and buffers."""
    client = seeded_client
    headers = _login_headers(client)

    # 1. Verify Demo Project uses dynamic horizon propagation and withholds UNSET comparison totals
    proj_detail = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}").json()
    assert proj_detail["horizon_years"] == 10

    client.post(f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/reset", headers=headers)
    unset_resp = client.patch(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/SVC-CONN-BPL-1PH",
        headers=headers,
        json={"rate_inr": None},
    )
    assert unset_resp.status_code == 200
    unset_shs = client.patch(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/SHS-KIT-200WP",
        headers=headers,
        json={"rate_inr": None},
    )
    assert unset_shs.status_code == 200

    comp_unset = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/comparison").json()
    assert comp_unset["has_unset_rates"] is True
    assert comp_unset["active_scenario_boq"]["totals_withheld"] is True
    assert comp_unset["active_scenario_boq"]["total_capex_inr"] == 0.0
    assert all(
        row["least_cost_npc_modality"] == "UNSET_RATES_REQUIRED"
        for row in comp_unset["habitation_comparisons"]
    )
    client.post(f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/reset", headers=headers)

    # 2. Invalid GeoJSON asset_type must return 422 (never coerce to TIE_IN)
    bad_infra = json.dumps(
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"asset_type": "UNKNOWN_BOGUS_TYPE", "name": "Bad"},
                    "geometry": {"type": "Point", "coordinates": [82.73, 18.56]},
                }
            ],
        }
    ).encode("utf-8")
    bad_inf_resp = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/infrastructure/upload",
        headers=headers,
        files={"file": ("bad_infra.geojson", bad_infra, "application/geo+json")},
    )
    assert bad_inf_resp.status_code == 422

    # 3. Invalid CSV verification import must reject bad state/class instead of coercing
    clust_list = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/clusters").json()["items"]
    first_label = str(clust_list[0]["label"])
    bad_csv = (
        "cluster_label,verification_state,verified_class,"
        "evidence_type,verifier_name,observed_on,note\n"
        f"{first_label},BOGUS_STATE,LIKELY_ELECTRIFIED,FIELD_SURVEY,Tester,2026-03-01,Bad state\n"
    ).encode()
    bad_csv_resp = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/verifications/import",
        headers=headers,
        files={"file": ("bad_verifications.csv", bad_csv, "text/csv")},
    )
    assert bad_csv_resp.status_code == 201
    bad_csv_json = bad_csv_resp.json()
    assert bad_csv_json["matched"] == 0
    assert bad_csv_json["unmatched"] == 1
    assert any(
        "invalid verification_state" in msg
        for msg in bad_csv_json["report"]["unmatched_labels"]
    )

    # 4. Verified clusters stay preserved via 150m spatial matching when re-clustering runs
    target_cid = clust_list[0]["id"]
    ver_resp = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/verifications",
        headers=headers,
        json={
            "target_type": "CLUSTER",
            "target_id": target_cid,
            "verification_state": "FIELD_VERIFIED",
            "verified_class": "POTENTIALLY_UNSERVED",
            "evidence_type": "GRAM_SABHA_RESOLUTION",
            "verifier_name": "Er. Preservation Check",
            "observed_on": "2026-04-01",
            "note": "Should survive re-clustering",
        },
    )
    assert ver_resp.status_code == 201

    reclust = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/clusters/detect",
        headers=headers,
        json={"eps_m": 150.0, "min_samples": 4, "household_alpha": 0.9},
    )
    assert reclust.status_code == 200
    preserved_items = [
        item
        for item in reclust.json()["settlements"]["items"]
        if item["verification_state"] == "FIELD_VERIFIED"
        and item["verified_class"] == "POTENTIALLY_UNSERVED"
    ]
    assert len(preserved_items) >= 1

    # 5. Village layer uses smooth metric geodesic circles rather than 5-point rectangles
    vill_resp = client.get("/api/v1/spikes/reference-geojson")
    assert vill_resp.status_code == 200
    village_fc = vill_resp.json()["village_electrification"]
    assert len(village_fc["features"]) >= 1
    for feat in village_fc["features"]:
        ring = feat["geometry"]["coordinates"][0]
        outer = ring[0] if isinstance(ring[0][0], list) else ring
        assert len(outer) > 12


def test_full_audit_remediation_crit_and_high_invariants(
    seeded_client: TestClient,
) -> None:
    """Verify CRIT-01..06 and HIGH-02..04 invariants after remediation."""
    from io import BytesIO

    from openpyxl import load_workbook

    client = seeded_client
    headers = _login_headers(client)

    # 1. CRIT-01: Unavailable VIIRS never synthesizes fake lightscores or underserved labels
    clust_resp = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/clusters")
    assert clust_resp.status_code == 200
    clusters = clust_resp.json()["items"]
    assert len(clusters) >= 3
    for cl in clusters:
        assert cl["proxy_class"] == "UNKNOWN"
        assert cl["proxy_confidence"] == "LOW"
        assert cl["evidence"].get("nl_lightscore") is None
        assert cl["evidence"]["nightlights_available"] is False

    # 2. HIGH-04: Malformed CSV headers / NUL bytes never crash with HTTP 500
    for bad_csv in (
        "wrong,headers\n1,2\n",
        "\ufeffwrong,cols\nfoo,bar\n",
        "item_code,description,category,unit,rate_inr\n\x00BAD,Test,HT_11KV,Km,1000\n",
        "item_code,description,category,unit,rate_inr\n",
    ):
        csv_resp = client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/import-csv",
            headers=headers,
            json={"csv_content": bad_csv, "template_name": "Bad CSV Check"},
        )
        assert csv_resp.status_code == 200
        assert csv_resp.json()["is_valid"] is False
        assert len(csv_resp.json()["errors"]) >= 1

    # 3. CRIT-06: Verification HH change immediately updates demand & scenarios
    target_cl = clusters[0]
    orig_hh = int(target_cl["est_households"])
    base_demand = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/demand").json()
    ver_resp = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/verifications",
        headers=headers,
        json={
            "target_type": "CLUSTER",
            "target_id": target_cl["id"],
            "verification_state": "FIELD_VERIFIED",
            "verified_class": "POTENTIALLY_UNDERSERVED",
            "verified_households": orig_hh + 25,
            "evidence_type": "FIELD_SURVEY",
            "verifier_name": "Er. Invariant Check",
            "observed_on": "2026-04-02",
            "note": "Check immediate demand resync",
        },
    )
    assert ver_resp.status_code == 201
    ver_id = ver_resp.json()["id"]
    updated_demand = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/demand").json()
    assert updated_demand["total_households"] == base_demand["total_households"] + 25

    # Reverse verification cleanly and ensure demand reverts immediately
    rev_resp = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/verifications/{ver_id}/reverse",
        headers=headers,
        json={"verifier_name": "Er. Invariant Check", "note": "Revert HH check"},
    )
    assert rev_resp.status_code == 201
    reverted_demand = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/demand").json()
    assert reverted_demand["total_households"] == base_demand["total_households"]

    # 4. CRIT-06 (Infra -> Scenario resync), CRIT-02 (Comparison), HIGH-02 (Mini-Grid no DT)
    tie_resp = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/infrastructure",
        headers=headers,
        json={
            "asset_type": "TIE_IN",
            "name": "Temp Remediation Tie-In",
            "lon": 82.725,
            "lat": 18.565,
            "voltage_kv": 11.0,
            "provenance": "USER_ASSUMED",
            "source_note": "Invariant test",
        },
    )
    assert tie_resp.status_code == 201
    tie_id = tie_resp.json()["id"]

    # Scenario generation & comparison
    comp_resp = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/comparison")
    assert comp_resp.status_code == 200
    comp = comp_resp.json()
    assert len(comp["habitation_comparisons"]) == len(clusters)
    iso_rows = [r for r in comp["habitation_comparisons"] if r["cluster_label"].startswith("ISO-")]
    if iso_rows:
        r0 = iso_rows[0]
        assert r0["minigrid_npc_inr"] != r0["shs_npc_inr"]
        assert r0["least_cost_npc_modality"] == "STANDALONE_SHS"

    # Excel Sheet 2 & Sheet 4 sanity check
    xlsx_resp = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/exports/boq-xlsx")
    assert xlsx_resp.status_code == 200
    wb = load_workbook(BytesIO(xlsx_resp.content), data_only=False)
    ws_dem = wb["Settlements & Demand"]
    last_labels = [ws_dem.cell(row=r, column=1).value for r in range(1, ws_dem.max_row + 1)]
    assert "SUBTOTAL_BASE_NON_COINC" in last_labels
    assert "COINCIDENT_BASE" in last_labels
    assert "HORIZON_DESIGN" in last_labels

    # Delete temp tie-in and verify CRIT-04 preflight blocks grid when 0 infra exists
    assert (
        client.delete(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/infrastructure/{tie_id}",
            headers=headers,
        ).status_code
        == 204
    )

    # Fresh empty-infra project with GRID_EXTENSION_ONLY must fail GRID_TIE_IN_PRESENT
    empty_proj = client.post(
        "/api/v1/projects",
        headers=headers,
        json={
            "name": "Empty Infra Tie-In Gate Check",
            "target_state": "Odisha",
            "target_district": "Mayurbhanj",
            "target_block": "Karanjia",
        },
    ).json()
    epid = empty_proj["id"]
    aoi_r = client.put(
        f"/api/v1/projects/{epid}/aoi",
        headers=headers,
        json={
            "mode": "USER_DRAWN",
            "geojson_geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [80.60, 22.40],
                        [80.62, 22.40],
                        [80.62, 22.42],
                        [80.60, 22.42],
                        [80.60, 22.40],
                    ]
                ],
            },
        },
    )
    assert aoi_r.status_code == 200
    assert (
        client.post(
            f"/api/v1/projects/{epid}/data/acquire",
            headers=headers,
            json={"force_refresh": True},
        ).status_code
        == 200
    )
    for b_idx, (lon, lat) in enumerate(
        [(80.608, 22.408), (80.6083, 22.4081), (80.6085, 22.4082), (80.6082, 22.4084)]
    ):
        assert (
            client.post(
                f"/api/v1/projects/{epid}/buildings",
                headers=headers,
                json={"lon": lon, "lat": lat, "area_m2": 48.0 + b_idx * 4.0},
            ).status_code
            == 201
        )
    assert (
        client.post(
            f"/api/v1/projects/{epid}/clusters/detect",
            headers=headers,
            json={"eps_m": 150.0, "min_samples": 3, "household_alpha": 0.9},
        ).status_code
        == 200
    )
    grid_sc = client.post(
        f"/api/v1/projects/{epid}/scenarios/generate",
        headers=headers,
        json={"scenario_key": "GRID_EXTENSION_ONLY", "preserve_manual_overrides": False},
    )
    assert grid_sc.status_code == 200
    grid_sc_id = grid_sc.json()["id"]
    client.post(f"/api/v1/projects/{epid}/scenarios/{grid_sc_id}/pin", headers=headers)
    pf_empty = client.get(f"/api/v1/projects/{epid}/report/preflight").json()
    tie_chk = next(c for c in pf_empty["checks"] if c["check_code"] == "GRID_TIE_IN_PRESENT")
    assert tie_chk["status"] == "FAIL"
    assert client.delete(f"/api/v1/projects/{epid}", headers=headers).status_code == 204
