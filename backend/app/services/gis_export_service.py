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

"""Cleaned GIS Vector Package Export Generator (GeoJSON + CSV + Manifest ZIP) (Task M7-4).

Generates a self-contained ZIP archive containing:
- aoi_boundary.geojson
- habitation_clusters.geojson
- infrastructure_assets.geojson
- preliminary_network_layout.geojson
- settlement_and_engineering_schedule.csv
- provenance_manifest.json (with SHA-256 digests, CRS metadata, and dataset attributions)
"""

import csv
import io
import json
import zipfile
from datetime import UTC, datetime
from typing import Any

from shapely.geometry import mapping
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.auth import User
from app.db.models.project import ProjectAoi
from app.domain.reporting.preflight import compute_file_sha256, compute_snapshot_sha256
from app.services.costing_service import get_project_scenario_comparison
from app.services.data_service import list_project_layers_with_provenance
from app.services.infrastructure_service import list_project_infrastructure
from app.services.planning_service import get_project_scenarios
from app.services.project_service import get_owned_project_or_404
from app.services.settlement_service import get_project_settlement_state


def generate_project_gis_package_zip(
    db: Session,
    *,
    project_id: str,
    user: User,
) -> bytes:
    """Generate a cleaned GIS vector package (.zip) with GeoJSON layers, CSV, and manifest."""
    proj = get_owned_project_or_404(db, project_id, user)
    settlements = get_project_settlement_state(db, project_id=proj.id, user=user)
    infra = list_project_infrastructure(db, project_id=proj.id, user=user)
    scenarios_state = get_project_scenarios(db, project_id=proj.id, user=user)
    active_scenario = scenarios_state.active_scenario
    comparison = get_project_scenario_comparison(db, project_id=proj.id, user=user)
    layers = list_project_layers_with_provenance(db, project_id=proj.id, user=user)

    aoi_row = db.execute(
        select(ProjectAoi).where(ProjectAoi.project_id == proj.id)
    ).scalar_one_or_none()

    # 1. aoi_boundary.geojson
    aoi_features: list[dict[str, Any]] = []
    if aoi_row is not None and aoi_row.geom is not None:
        aoi_features.append(
            {
                "type": "Feature",
                "geometry": mapping(aoi_row.geom),
                "properties": {
                    "project_id": proj.id,
                    "project_name": proj.name,
                    "boundary_source": aoi_row.boundary_source,
                    "lgd_code": aoi_row.lgd_code,
                    "census2011_code": aoi_row.census2011_code,
                    "area_km2": round(aoi_row.area_km2, 4),
                    "storage_crs": "EPSG:4326",
                    "metric_computation_crs": f"EPSG:{proj.metric_epsg}",
                    "epistemic_notice": (
                        "Preliminary engineering boundary — verify cadastral limits "
                        "during field survey."
                    ),
                },
            }
        )
    aoi_geojson_bytes = json.dumps(
        {
            "type": "FeatureCollection",
            "name": "aoi_boundary",
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
            "features": aoi_features,
        },
        indent=2,
    ).encode("utf-8")

    # 2. habitation_clusters.geojson (enriched with provenance & epistemic tags)
    cluster_features: list[dict[str, Any]] = []
    for feat in settlements.geojson.get("features", []):
        props = dict(feat.get("properties", {}))
        props["storage_crs"] = "EPSG:4326"
        props["metric_computation_crs"] = f"EPSG:{proj.metric_epsg}"
        props["axis_1_provenance"] = "PROXY_SATELLITE_ESTIMATE"
        props["epistemic_notice"] = (
            "Axis-1 proxy classification is derived from open satellite footprints and VIIRS "
            "nightlights; never treat as verified without Axis-2 field/utility evidence."
        )
        cluster_features.append(
            {
                "type": "Feature",
                "geometry": feat.get("geometry"),
                "properties": props,
            }
        )
    clusters_geojson_bytes = json.dumps(
        {
            "type": "FeatureCollection",
            "name": "habitation_clusters",
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
            "features": cluster_features,
        },
        indent=2,
    ).encode("utf-8")

    # 3. infrastructure_assets.geojson
    infra_geojson_bytes = json.dumps(
        {
            "type": "FeatureCollection",
            "name": "infrastructure_assets",
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
            "features": infra.geojson.get("features", []),
        },
        indent=2,
    ).encode("utf-8")

    # 4. preliminary_network_layout.geojson
    net_features: list[dict[str, Any]] = []
    for feat in active_scenario.network_geojson.get("features", []):
        props = dict(feat.get("properties", {}))
        props["scenario_key"] = active_scenario.scenario_key
        props["engineering_status"] = "PRELIMINARY_ENGINEERING_NOT_FIELD_VERIFIED"
        props["storage_crs"] = "EPSG:4326"
        props["metric_computation_crs"] = f"EPSG:{proj.metric_epsg}"
        net_features.append(
            {
                "type": "Feature",
                "geometry": feat.get("geometry"),
                "properties": props,
            }
        )
    network_geojson_bytes = json.dumps(
        {
            "type": "FeatureCollection",
            "name": "preliminary_network_layout",
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
            "features": net_features,
        },
        indent=2,
    ).encode("utf-8")

    # 5. settlement_and_engineering_schedule.csv
    hab_comp_map = {h.cluster_id: h for h in comparison.habitation_comparisons}
    cl_meta_map = {c.id: c for c in settlements.items}
    csv_buf = io.StringIO()
    writer = csv.writer(csv_buf, lineterminator="\n")
    writer.writerow(
        [
            "cluster_id",
            "cluster_label",
            "habitation_name",
            "n_detected_buildings",
            "est_households",
            "axis1_proxy_class",
            "axis1_proxy_confidence",
            "axis2_verification_state",
            "active_scenario_key",
            "assigned_modality",
            "dt_count",
            "total_dt_rating_kva",
            "ht_length_m",
            "ht_poles_count",
            "lt_total_length_m",
            "lt_poles_count",
            "ht_vdrop_pct",
            "lt_vdrop_pct",
            "solar_pv_kwp",
            "bess_capacity_kwh",
            "shs_kits_count",
            "grid_npc_inr",
            "minigrid_npc_inr",
            "shs_npc_inr",
            "least_cost_npc_modality",
        ]
    )
    for cl_lay in active_scenario.clusters:
        c_meta = cl_meta_map.get(cl_lay.cluster_id)
        h_comp = hab_comp_map.get(cl_lay.cluster_id)
        writer.writerow(
            [
                cl_lay.cluster_id,
                cl_lay.cluster_label,
                cl_lay.cluster_name,
                c_meta.n_detected if c_meta else 0,
                cl_lay.est_households,
                c_meta.proxy_class if c_meta else "UNKNOWN",
                c_meta.proxy_confidence if c_meta else "LOW",
                c_meta.verification_state if c_meta else "UNVERIFIED",
                active_scenario.scenario_key,
                cl_lay.modality,
                cl_lay.dt_count,
                round(cl_lay.total_dt_rating_kva, 1),
                round(cl_lay.ht_length_m, 1),
                cl_lay.ht_poles_count,
                round(cl_lay.lt_total_length_m, 1),
                cl_lay.lt_poles_count,
                round(cl_lay.ht_drop_pct, 2),
                round(cl_lay.lt_drop_pct, 2),
                round(cl_lay.solar_pv_kwp, 2),
                round(cl_lay.bess_capacity_kwh, 2),
                cl_lay.shs_kits_count,
                round(h_comp.grid_npc_inr, 2) if h_comp else 0.0,
                round(h_comp.minigrid_npc_inr, 2) if h_comp else 0.0,
                round(h_comp.shs_npc_inr, 2) if h_comp else 0.0,
                h_comp.least_cost_npc_modality if h_comp else cl_lay.modality,
            ]
        )
    schedule_csv_bytes = csv_buf.getvalue().encode("utf-8")

    # 6. provenance_manifest.json
    snapshot_hash = compute_snapshot_sha256(
        {
            "project_id": proj.id,
            "project_version": proj.version,
            "scenario_key": active_scenario.scenario_key,
            "clusters_count": len(settlements.items),
            "total_capex_inr": round(comparison.active_scenario_boq.total_capex_inr, 2),
        }
    )
    manifest_payload = {
        "package_format": "ElectriMap DPR Cleaned GIS Vector & Schedule Package v1.0",
        "generated_at_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "project_id": proj.id,
        "project_name": proj.name,
        "project_version": proj.version,
        "active_scenario_key": active_scenario.scenario_key,
        "storage_crs": "EPSG:4326",
        "metric_computation_crs": f"EPSG:{proj.metric_epsg}",
        "verification_coverage_pct": round(settlements.verification_coverage_pct, 2),
        "watermark_notice": "PRELIMINARY ENGINEERING — NOT FIELD VERIFIED",
        "snapshot_sha256": snapshot_hash,
        "files": [
            {
                "filename": "aoi_boundary.geojson",
                "sha256": compute_file_sha256(aoi_geojson_bytes),
                "size_bytes": len(aoi_geojson_bytes),
            },
            {
                "filename": "habitation_clusters.geojson",
                "sha256": compute_file_sha256(clusters_geojson_bytes),
                "size_bytes": len(clusters_geojson_bytes),
            },
            {
                "filename": "infrastructure_assets.geojson",
                "sha256": compute_file_sha256(infra_geojson_bytes),
                "size_bytes": len(infra_geojson_bytes),
            },
            {
                "filename": "preliminary_network_layout.geojson",
                "sha256": compute_file_sha256(network_geojson_bytes),
                "size_bytes": len(network_geojson_bytes),
            },
            {
                "filename": "settlement_and_engineering_schedule.csv",
                "sha256": compute_file_sha256(schedule_csv_bytes),
                "size_bytes": len(schedule_csv_bytes),
            },
        ],
        "dataset_provenance": [
            {
                "layer_key": lyr.layer_key,
                "dataset_name": lyr.dataset.name if lyr.dataset else lyr.layer_key,
                "temporal_coverage": lyr.dataset.temporal_coverage if lyr.dataset else "2024",
                "licence": lyr.dataset.licence if lyr.dataset else "Open",
            }
            for lyr in layers
        ],
    }
    manifest_bytes = json.dumps(manifest_payload, indent=2).encode("utf-8")

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("aoi_boundary.geojson", aoi_geojson_bytes)
        zf.writestr("habitation_clusters.geojson", clusters_geojson_bytes)
        zf.writestr("infrastructure_assets.geojson", infra_geojson_bytes)
        zf.writestr("preliminary_network_layout.geojson", network_geojson_bytes)
        zf.writestr("settlement_and_engineering_schedule.csv", schedule_csv_bytes)
        zf.writestr("provenance_manifest.json", manifest_bytes)

    return zip_buf.getvalue()
