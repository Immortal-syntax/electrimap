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

"""Vector tile (`ST_AsMVT` / binary tile) endpoint with project ownership verification."""

import json

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.errors import AppError
from app.db.models.auth import User
from app.db.session import get_db
from app.services.data_service import get_project_vector_layer_geojson
from app.services.project_service import get_owned_project_or_404
from app.services.settlement_service import get_project_settlement_state

router = APIRouter(prefix="/api/v1/tiles", tags=["Vector Tiles"])


@router.get("/{project_id}/{layer}/{z}/{x}/{y}.mvt")
def get_vector_tile(
    project_id: str,
    layer: str,
    z: int,
    x: int,
    y: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Serve Mapbox Vector Tile (.mvt) for project buildings, osm_features, or clusters."""
    proj = get_owned_project_or_404(db, project_id, user)
    if layer not in {"buildings", "osm_features", "clusters"}:
        raise AppError(
            code="UNKNOWN_TILE_LAYER",
            message=f"Unsupported tile layer '{layer}'.",
            status_code=404,
        )

    dialect_name = db.bind.dialect.name if db.bind is not None else "sqlite"
    if dialect_name == "postgresql":
        table_map = {
            "buildings": "buildings",
            "osm_features": "osm_features",
            "clusters": "clusters",
        }
        table_name = table_map[layer]
        sql = text(
            f"""
            WITH mvtgeom AS (
                SELECT id,
                       ST_AsMVTGeom(
                           ST_Transform(geom, 3857),
                           ST_TileEnvelope(:z, :x, :y),
                           4096, 64, true
                       ) AS geom
                FROM {table_name}
                WHERE project_id = :pid
                  AND ST_Intersects(
                      geom,
                      ST_Transform(ST_TileEnvelope(:z, :x, :y), 4326)
                  )
            )
            SELECT ST_AsMVT(mvtgeom.*, :layer_name, 4096, 'geom')
            FROM mvtgeom
            """
        )
        mvt_bytes = (
            db.execute(
                sql,
                {"z": z, "x": x, "y": y, "pid": proj.id, "layer_name": layer},
            ).scalar_one_or_none()
            or b""
        )
        return Response(
            content=bytes(mvt_bytes),
            media_type="application/vnd.mapbox-vector-tile",
        )

    # On local SQLite fallback, serialize compact tile payload with ownership verified
    if layer == "clusters":
        settlements = get_project_settlement_state(db, project_id=proj.id, user=user)
        fc = settlements.geojson
    else:
        fc = get_project_vector_layer_geojson(
            db, project_id=proj.id, layer_name=layer, user=user
        )
    payload_bytes = json.dumps(
        {"tile": [z, x, y], "layer": layer, "feature_count": len(fc["features"])}
    ).encode("utf-8")
    return Response(
        content=payload_bytes,
        media_type="application/vnd.mapbox-vector-tile",
    )
