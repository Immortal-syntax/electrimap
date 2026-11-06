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
    """Serve Mapbox Vector Tile (.mvt) for project buildings or osm_features."""
    proj = get_owned_project_or_404(db, project_id, user)
    if layer not in {"buildings", "osm_features"}:
        raise AppError(
            code="UNKNOWN_TILE_LAYER",
            message=f"Unsupported tile layer '{layer}'.",
            status_code=404,
        )

    dialect_name = db.bind.dialect.name if db.bind is not None else "sqlite"
    if dialect_name == "postgresql":
        table_name = "buildings" if layer == "buildings" else "osm_features"
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
