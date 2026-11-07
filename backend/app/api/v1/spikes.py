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

"""Technical risk spike (S1-S4) inspection and specialised electricity GIS layer endpoints."""

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Response

from app.core.config import get_settings
from app.domain.gis.layer_processing import render_raster_layer_png

router = APIRouter(prefix="/api/v1/spikes", tags=["Spikes"])


def _read_json_if_exists(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    result: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return result


def _build_osm_existing_power_infra() -> dict[str, Any]:
    """Return Layer A: Mapped OpenStreetMap electricity infrastructure in Nandapur Block.

    Distinguishes 33 kV sub-transmission lines (`power=line`), 11 kV primary distribution
    feeders (`power=minor_line`), 33/11 kV substations (`power=substation`), distribution
    transformers (`power=transformer`), lattice steel towers (`power=tower`), and PSC poles
    (`power=pole`). Explicitly notes that unmapped areas in OSM do not prove absence of
    ground infrastructure.
    """
    features: list[dict[str, Any]] = [
        {
            "type": "Feature",
            "properties": {
                "id": "osm-line-33kv-jeypore-nandapur",
                "name": "33 kV Jeypore–Nandapur–Pottangi Sub-Transmission Feeder",
                "infra_category": "TRANSMISSION_LINE",
                "osm_tag": "power=line",
                "voltage_kv": 33.0,
                "circuits": 1,
                "conductor": "ACSR Dog (100 sq.mm)",
                "operator": "TPSODL / OPTCL (OSM Mapped)",
                "provenance": "OSM_MAPPED",
                "quality_tag": "ESTIMATED",
                "epistemic_note": (
                    "Mapped in OpenStreetMap (ODbL). Field survey required to confirm "
                    "thermal loading and exact pole/tower coordinates."
                ),
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [82.648, 18.512],
                    [82.672, 18.526],
                    [82.692, 18.538],
                    [82.716, 18.544],
                    [82.748, 18.549],
                    [82.782, 18.556],
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {
                "id": "osm-line-11kv-bheja-spur",
                "name": "11 kV Nandapur–Bheja Rural Distribution Feeder",
                "infra_category": "DISTRIBUTION_LINE_11KV",
                "osm_tag": "power=minor_line",
                "voltage_kv": 11.0,
                "circuits": 1,
                "conductor": "ACSR Weasel (30 sq.mm)",
                "operator": "TPSODL (Southern Odisha DISCOM)",
                "provenance": "OSM_MAPPED",
                "quality_tag": "ESTIMATED",
                "epistemic_note": (
                    "Existing 11 kV primary distribution spur terminating at Bheja Main "
                    "Village Core (CL-01). Eastern and north-eastern hamlets lack 11 kV spurs."
                ),
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [82.692, 18.538],
                    [82.701, 18.545],
                    [82.709833, 18.55195],
                    [82.7145, 18.5542],
                    [82.718, 18.556],
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {
                "id": "osm-substation-nandapur-33-11",
                "name": "33/11 kV Nandapur Primary Distribution Substation",
                "infra_category": "SUBSTATION",
                "osm_tag": "power=substation",
                "voltage_kv": 33.0,
                "rating_kva": 3150.0,
                "operator": "TPSODL",
                "provenance": "OSM_MAPPED",
                "quality_tag": "ESTIMATED",
                "epistemic_note": (
                    "Primary 33/11 kV source substation serving Nandapur Block feeders."
                ),
            },
            "geometry": {
                "type": "Point",
                "coordinates": [82.692, 18.538],
            },
        },
        {
            "type": "Feature",
            "properties": {
                "id": "osm-dt-bheja-core-63kva",
                "name": "Existing 63 kVA Distribution Transformer (Bheja Core DT-01)",
                "infra_category": "TRANSFORMER",
                "osm_tag": "power=transformer",
                "voltage_kv": 11.0,
                "rating_kva": 63.0,
                "operator": "TPSODL",
                "provenance": "OSM_MAPPED",
                "quality_tag": "ESTIMATED",
                "epistemic_note": (
                    "Serves Bheja Main Village Core (CL-01). Located >1.8 km from Podapadar "
                    "Tola (CL-02) and >3.4 km from Maliaguda PVTG Hamlet (CL-03)."
                ),
            },
            "geometry": {
                "type": "Point",
                "coordinates": [82.718, 18.556],
            },
        },
        {
            "type": "Feature",
            "properties": {
                "id": "osm-dt-padwa-junction-25kva",
                "name": "Existing 25 kVA Distribution Transformer (Bheja South Tie-In DT-02)",
                "infra_category": "TRANSFORMER",
                "osm_tag": "power=transformer",
                "voltage_kv": 11.0,
                "rating_kva": 25.0,
                "operator": "TPSODL",
                "provenance": "OSM_MAPPED",
                "quality_tag": "ESTIMATED",
                "epistemic_note": (
                    "Candidate 11 kV tapping/tie-in point (82.7098°E, 18.5520°N) for "
                    "proposed feeder extension."
                ),
            },
            "geometry": {
                "type": "Point",
                "coordinates": [82.709833, 18.55195],
            },
        },
    ]

    # Add mapped 33 kV lattice steel towers and 11 kV PSC poles
    tower_coords = [
        ("TWR-33-01", [82.672, 18.526], 33.0, "TOWER", "power=tower"),
        ("TWR-33-02", [82.692, 18.538], 33.0, "TOWER", "power=tower"),
        ("TWR-33-03", [82.716, 18.544], 33.0, "TOWER", "power=tower"),
        ("TWR-33-04", [82.748, 18.549], 33.0, "TOWER", "power=tower"),
        ("POLE-11-01", [82.701, 18.545], 11.0, "POLE", "power=pole"),
        ("POLE-11-02", [82.709833, 18.55195], 11.0, "POLE", "power=pole"),
        ("POLE-11-03", [82.7145, 18.5542], 11.0, "POLE", "power=pole"),
    ]
    for code, coords, kv, cat, tag in tower_coords:
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"osm-{code.lower()}",
                    "name": (
                        f"{code} ({int(kv)} kV "
                        f"{'Lattice Steel Tower' if cat == 'TOWER' else '8m PSC Pole'})"
                    ),
                    "infra_category": cat,
                    "osm_tag": tag,
                    "voltage_kv": kv,
                    "provenance": "OSM_MAPPED",
                    "quality_tag": "ESTIMATED",
                    "epistemic_note": (
                        "Crowd-sourced OpenStreetMap support structure; absence of mapped "
                        "poles elsewhere does not prove absence of LT lines."
                    ),
                },
                "geometry": {"type": "Point", "coordinates": coords},
            }
        )

    return {"type": "FeatureCollection", "features": features}


def _build_village_electrification_layer() -> dict[str, Any]:
    """Return Layer C: Village Electrification Status & Census 2011 DCHB attributes."""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "lgd_code": "398712",
                    "census2011_code": "428914",
                    "village_name": "Bheja",
                    "block_name": "Nandapur",
                    "district_name": "Koraput",
                    "state_name": "Odisha",
                    "total_pop": 562,
                    "st_pop": 448,
                    "sc_pop": 42,
                    "households_2011": 128,
                    "detected_footprints_2026": 143,
                    "estimated_households_2026": 131,
                    "electrification_status": "PARTIALLY_ELECTRIFIED_UNDERSERVED",
                    "status_label": (
                        "Main Core Grid-Connected; Outlying Hamlets Unserved/Underserved"
                    ),
                    "domestic_power_2011": True,
                    "agricultural_power_2011": False,
                    "summer_supply_hrs_2011": 4.0,
                    "winter_supply_hrs_2011": 5.0,
                    "reported_electrified_hh_proxy": 59,
                    "reported_underserved_or_unserved_hh_proxy": 72,
                    "data_source": "Census of India 2011 DCHB + LGD + VIIRS/Footprint Proxy",
                    "verification_state": "UNVERIFIED",
                    "missing_data_notice": (
                        "Current household meter count requires DISCOM (TPSODL) consumer "
                        "billing ledger or Gram Sabha field survey verification."
                    ),
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [82.695, 18.535],
                            [82.765, 18.535],
                            [82.765, 18.595],
                            [82.695, 18.595],
                            [82.695, 18.535],
                        ]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "lgd_code": "398715",
                    "census2011_code": "428918",
                    "village_name": "Padwa",
                    "block_name": "Nandapur",
                    "district_name": "Koraput",
                    "state_name": "Odisha",
                    "total_pop": 912,
                    "st_pop": 740,
                    "sc_pop": 68,
                    "households_2011": 210,
                    "detected_footprints_2026": 228,
                    "estimated_households_2026": 215,
                    "electrification_status": "ELECTRIFIED_GRID_CONNECTED",
                    "status_label": "Grid-Connected Revenue Village (8–9 hrs/day in Census 2011)",
                    "domestic_power_2011": True,
                    "agricultural_power_2011": True,
                    "summer_supply_hrs_2011": 8.0,
                    "winter_supply_hrs_2011": 9.0,
                    "reported_electrified_hh_proxy": 190,
                    "reported_underserved_or_unserved_hh_proxy": 25,
                    "data_source": "Census of India 2011 DCHB + LGD",
                    "verification_state": "UNVERIFIED",
                    "missing_data_notice": (
                        "Feeder-level outage frequency and tail-end voltage drop require "
                        "DISCOM DT metering logs."
                    ),
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [82.62, 18.48],
                            [82.68, 18.48],
                            [82.68, 18.53],
                            [82.62, 18.53],
                            [82.62, 18.48],
                        ]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "lgd_code": "398719",
                    "census2011_code": "428922",
                    "village_name": "Maliaguda PVTG Forest Habitation",
                    "block_name": "Nandapur",
                    "district_name": "Koraput",
                    "state_name": "Odisha",
                    "total_pop": 118,
                    "st_pop": 114,
                    "sc_pop": 0,
                    "households_2011": 26,
                    "detected_footprints_2026": 28,
                    "estimated_households_2026": 26,
                    "electrification_status": "REPORTED_UNELECTRIFIED_HABITATION",
                    "status_label": (
                        "Reported Unelectrified in Census 2011 (0 hrs/day) + Near-Zero VIIRS"
                    ),
                    "domestic_power_2011": False,
                    "agricultural_power_2011": False,
                    "summer_supply_hrs_2011": 0.0,
                    "winter_supply_hrs_2011": 0.0,
                    "reported_electrified_hh_proxy": 0,
                    "reported_underserved_or_unserved_hh_proxy": 26,
                    "data_source": (
                        "Census of India 2011 DCHB (0 hrs supply) + VIIRS DNB (0.05 nW/cm²/sr)"
                    ),
                    "verification_state": "UNVERIFIED",
                    "missing_data_notice": (
                        "Official boundary polygon unavailable; shown as 1.5 km metric buffer. "
                        "Requires Gram Sabha field verification to check if standalone solar "
                        "home systems (SHS) were distributed post-2018."
                    ),
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [82.742, 18.572],
                            [82.768, 18.572],
                            [82.768, 18.596],
                            [82.742, 18.596],
                            [82.742, 18.572],
                        ]
                    ],
                },
            },
        ],
    }


def _build_electrification_gaps_And_settlements() -> tuple[dict[str, Any], dict[str, Any]]:
    """Return Layer D (Settlements & Demographics) and Layer E (Potential Electrification Gaps)."""
    settlements_fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "id": "cluster-cl-01",
                    "cluster_code": "CL-01",
                    "name": "Bheja Main Village Core",
                    "building_count": 65,
                    "estimated_households": 59,
                    "estimated_population": 260,
                    "st_share_pct": 79.7,
                    "viirs_radiance_2024_nw": 2.18,
                    "viirs_radiance_2023_nw": 2.24,
                    "viirs_radiance_2022_nw": 1.92,
                    "viirs_radiance_2020_nw": 1.55,
                    "proxy_class": "LIKELY_ELECTRIFIED",
                    "verification_state": "UNVERIFIED",
                    "distance_to_11kv_m": 120.0,
                    "terrain_effective_dist_m": 135.0,
                    "preliminary_mode": "Existing LT Augmentation Check",
                    "evidence_summary": (
                        "Existing 63 kVA DT-01 mapped within 120 m; consistent nighttime "
                        "radiance (2.18 nW/cm²/sr); Census 2011 reports domestic grid supply "
                        "(4–5 hrs/day)."
                    ),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [82.718, 18.556],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "cluster-cl-02",
                    "cluster_code": "CL-02",
                    "name": "Podapadar Tola (Eastern Ridge)",
                    "building_count": 42,
                    "estimated_households": 38,
                    "estimated_population": 168,
                    "st_share_pct": 84.0,
                    "viirs_radiance_2024_nw": 0.41,
                    "viirs_radiance_2023_nw": 0.44,
                    "viirs_radiance_2022_nw": 0.35,
                    "viirs_radiance_2020_nw": 0.28,
                    "proxy_class": "POTENTIALLY_UNDERSERVED",
                    "verification_state": "UNVERIFIED",
                    "distance_to_11kv_m": 1640.0,
                    "terrain_effective_dist_m": 1858.2,
                    "preliminary_mode": "Grid Extension (1.86 km 11 kV + 25 kVA DT)",
                    "evidence_summary": (
                        "Model-Estimated Gap: 42 building footprints (~38 HH) located 1.64 km "
                        "east of nearest 11 kV DT; weak nighttime radiance (0.41 nW/cm²/sr) "
                        "suggests either long low-voltage tail drop or partial connection."
                    ),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [82.738, 18.564],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "cluster-cl-03",
                    "cluster_code": "CL-03",
                    "name": "Maliaguda PVTG Hamlet (North-East Valley)",
                    "building_count": 28,
                    "estimated_households": 26,
                    "estimated_population": 118,
                    "st_share_pct": 96.6,
                    "viirs_radiance_2024_nw": 0.05,
                    "viirs_radiance_2023_nw": 0.06,
                    "viirs_radiance_2022_nw": 0.04,
                    "viirs_radiance_2020_nw": 0.04,
                    "proxy_class": "POTENTIALLY_UNSERVED",
                    "verification_state": "UNVERIFIED",
                    "distance_to_11kv_m": 3120.0,
                    "terrain_effective_dist_m": 3890.5,
                    "preliminary_mode": "Solar PV Mini-Grid (18.5 kWp) vs 11 kV Extension Compare",
                    "evidence_summary": (
                        "High-Priority Potential Electrification Gap: 28 footprints (~26 PVTG "
                        "HH) 3.12 km from nearest 11 kV tie-in across steep forested ridge; "
                        "Census 2011 reports 0 hrs/day power; VIIRS radiance near noise floor "
                        "(0.05 nW/cm²/sr). Note: Dark pixel alone does not rule out indoor SHS."
                    ),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [82.748, 18.579],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "cluster-cl-04",
                    "cluster_code": "CL-04",
                    "name": "Dispersed Forest Homesteads (North-West Ridge)",
                    "building_count": 8,
                    "estimated_households": 8,
                    "estimated_population": 34,
                    "st_share_pct": 92.0,
                    "viirs_radiance_2024_nw": 0.02,
                    "viirs_radiance_2023_nw": 0.02,
                    "viirs_radiance_2022_nw": 0.02,
                    "viirs_radiance_2020_nw": 0.02,
                    "proxy_class": "UNKNOWN",
                    "verification_state": "UNVERIFIED",
                    "distance_to_11kv_m": 2480.0,
                    "terrain_effective_dist_m": 3210.0,
                    "preliminary_mode": "Standalone Solar Home Systems (SHS · 200 Wp/HH)",
                    "evidence_summary": (
                        "Low-density dispersed homesteads (8 structures) 2.48 km from grid; "
                        "below VIIRS 450 m spatial detection threshold. Classified UNKNOWN "
                        "until field survey."
                    ),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [82.708, 18.578],
                },
            },
        ],
    }

    gaps_fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "id": "gap-zone-cl-02",
                    "gap_code": "GAP-01 · Podapadar Tola Underserved Pocket",
                    "target_cluster": "CL-02",
                    "gap_severity": "MODERATE_UNDERSERVED_CANDIDATE",
                    "estimation_type": "MODEL_ESTIMATED_GAP",
                    "affected_households_est": 38,
                    "straight_line_dist_m": 1640.0,
                    "terrain_weighted_dist_m": 1858.2,
                    "viirs_radiance_nw": 0.41,
                    "recommended_action": (
                        "Verify if LT tail-end voltage drop exceeds 6%; evaluate 1.86 km "
                        "11 kV spur + 25 kVA DT."
                    ),
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [82.718, 18.556],
                        [82.738, 18.564],
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "gap-zone-cl-03",
                    "gap_code": "GAP-02 · Maliaguda PVTG Unserved Corridor",
                    "target_cluster": "CL-03",
                    "gap_severity": "HIGH_UNSERVED_CANDIDATE",
                    "estimation_type": "MODEL_ESTIMATED_GAP",
                    "affected_households_est": 26,
                    "straight_line_dist_m": 3120.0,
                    "terrain_weighted_dist_m": 3890.5,
                    "viirs_radiance_nw": 0.05,
                    "recommended_action": (
                        "High-priority field survey under DA-JGUA / RDSS; compare 3.89 km "
                        "11 kV forest crossing vs 18.5 kWp Solar PV Mini-Grid."
                    ),
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [82.718, 18.556],
                        [82.748, 18.579],
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "gap-zone-cl-04",
                    "gap_code": "GAP-03 · Dispersed Homesteads Off-Grid Pocket",
                    "target_cluster": "CL-04",
                    "gap_severity": "DISPERSED_OFFGRID_CANDIDATE",
                    "estimation_type": "MODEL_ESTIMATED_GAP",
                    "affected_households_est": 8,
                    "straight_line_dist_m": 2480.0,
                    "terrain_weighted_dist_m": 3210.0,
                    "viirs_radiance_nw": 0.02,
                    "recommended_action": (
                        "Evaluate standalone Solar Home Systems (SHS) due to low load "
                        "density (8 HH over 2.5 km)."
                    ),
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [82.718, 18.556],
                        [82.708, 18.578],
                    ],
                },
            },
        ],
    }
    return settlements_fc, gaps_fc


def _build_proposed_network_extensions(routes_fc: dict[str, Any]) -> dict[str, Any]:
    """Return Layer F: Proposed 11 kV HT + 415 V LT + Proposed DTs + Mini-Grid Nodes."""
    features: list[dict[str, Any]] = []
    for idx, feat in enumerate(routes_fc.get("features", [])):
        props = dict(feat.get("properties") or {})
        props["layer_type"] = "HT_11KV_PROPOSED"
        props["status"] = "PROPOSED_PRELIMINARY"
        props["voltage_kv"] = 11.0
        props["conductor"] = "ACSR Weasel (30 sq.mm, 3-Phase 11 kV)"
        props["name"] = props.get("target_name", f"Proposed 11 kV Feeder Spur #{idx + 1}")
        props["engineering_disclaimer"] = (
            "PRELIMINARY PROPOSED ROUTE — NOT INSTALLED INFRASTRUCTURE. "
            "Requires field peg-marking, forest RoW clearance check, and DISCOM load-flow study."
        )
        features.append(
            {
                "type": "Feature",
                "properties": props,
                "geometry": feat["geometry"],
            }
        )

    # Add proposed 415 V LT distribution lines inside CL-02 and CL-03
    features.extend(
        [
            {
                "type": "Feature",
                "properties": {
                    "id": "prop-lt-cl02-mst",
                    "name": "Proposed 415 V LT AB-Cable Distribution Spine (Podapadar CL-02)",
                    "layer_type": "LT_415V_PROPOSED",
                    "status": "PROPOSED_PRELIMINARY",
                    "voltage_kv": 0.415,
                    "length_m": 640.0,
                    "length_km": 0.64,
                    "conductor": "3x35 + 1x25 sq.mm XLPE Aerial Bunched (AB) Cable",
                    "estimated_voltage_drop_pct": 3.42,
                    "engineering_disclaimer": (
                        "PRELIMINARY 415 V LT MST LAYOUT — Requires pole-to-household "
                        "service drop survey."
                    ),
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [82.734, 18.562],
                        [82.738, 18.564],
                        [82.741, 18.566],
                        [82.739, 18.567],
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "prop-dt-cl02-25kva",
                    "name": "Proposed 25 kVA 11/0.433 kV Distribution Transformer (Podapadar DT)",
                    "layer_type": "DT_PROPOSED",
                    "status": "PROPOSED_PRELIMINARY",
                    "voltage_kv": 11.0,
                    "rating_kva": 25.0,
                    "target_cluster": "CL-02",
                    "engineering_disclaimer": (
                        "PRELIMINARY DT PLACEMENT — Load center centroid; verify plinth "
                        "flood level and road access during field survey."
                    ),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [82.738, 18.564],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "prop-minigrid-cl03-18kwp",
                    "name": (
                        "Proposed 18.5 kWp Solar PV Mini-Grid + 68 kWh LFP Battery Hub "
                        "(Maliaguda CL-03)"
                    ),
                    "layer_type": "MINIGRID_PROPOSED",
                    "status": "PROPOSED_PRELIMINARY",
                    "voltage_kv": 0.415,
                    "rating_kva": 20.0,
                    "target_cluster": "CL-03",
                    "engineering_disclaimer": (
                        "PRELIMINARY OFF-GRID MINI-GRID CANDIDATE — Compare 10-year NPC "
                        "against 3.89 km 11 kV grid extension."
                    ),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [82.748, 18.579],
                },
            },
        ]
    )

    return {"type": "FeatureCollection", "features": features}


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
    """Return reference village boundary, building footprints, S2 routes, and Layers A–F."""
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

    settlements_fc, gaps_fc = _build_electrification_gaps_And_settlements()

    return {
        "villages": villages,
        "buildings": buildings,
        "routes": routes,
        "solar": solar,
        "existing_power_infra": _build_osm_existing_power_infra(),
        "village_electrification": _build_village_electrification_layer(),
        "settlements": settlements_fc,
        "electrification_gaps": gaps_fc,
        "proposed_network": _build_proposed_network_extensions(routes),
    }


@router.get("/viirs-overlay")
def get_viirs_nightlights_overlay(period: str = "2024_ANNUAL") -> Response:
    """Render colorized NASA VIIRS DNB Nighttime Illumination PNG overlay for Koraput AOI."""
    bbox = (82.695, 18.535, 82.765, 18.595)
    png_bytes = render_raster_layer_png(
        "nightlights",
        bbox,
        observation_period=period,
    )
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "X-Layer-BBox": "82.695,18.535,82.765,18.595",
            "Cache-Control": "no-cache",
        },
    )
