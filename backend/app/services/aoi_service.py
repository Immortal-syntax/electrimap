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

"""AOI management service: AdminUnit lookup, boundary validation, and safe file upload."""

import io
import json
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import geopandas as gpd
import shapely
from shapely.geometry import MultiPolygon, Polygon, mapping
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, InvalidGeometryError, UploadValidationError
from app.db.models.auth import User
from app.db.models.ops import AuditEvent
from app.db.models.project import ProjectAoi
from app.db.models.reference import AdminUnit, CensusVillage
from app.domain.gis.boundary import (
    create_approximate_village_buffer_wgs84,
    validate_and_normalize_boundary,
)
from app.domain.gis.crs import compute_metric_area_km2, select_metric_epsg_for_geometry
from app.schemas.admin_unit import (
    AdminBoundaryResponse,
    AdminUnitResponse,
    CensusInfoResponse,
)
from app.schemas.aoi import ProjectAoiResponse, SetAoiRequest
from app.services.project_service import get_owned_project_or_404
from app.services.seed_service import ensure_seed_data

MAX_ZIP_ENTRIES = 32
MAX_COMPRESSION_RATIO = 50.0


def _build_census_info(db: Session, census_code: str | None) -> CensusInfoResponse | None:
    if not census_code:
        return None
    row = db.execute(
        select(CensusVillage).where(CensusVillage.census2011_code == census_code)
    ).scalar_one_or_none()
    if row is None:
        return None
    return CensusInfoResponse(
        census2011_code=row.census2011_code,
        name=row.name,
        total_pop=row.total_pop,
        households=row.households,
        st_pop=row.st_pop,
        sc_pop=row.sc_pop,
        amenities=dict(row.amenities or {}),
        power_supply_2011=dict(row.power_supply_2011 or {}),
    )


def _serialize_admin_unit(db: Session, unit: AdminUnit) -> AdminUnitResponse:
    return AdminUnitResponse(
        lgd_code=unit.lgd_code,
        level=unit.level,
        name=unit.name,
        parent_lgd_code=unit.parent_lgd_code,
        census2011_code=unit.census2011_code,
        boundary_source=unit.boundary_source,
        has_polygon_geometry=unit.geom is not None,
        centroid_lon=unit.centroid_lon,
        centroid_lat=unit.centroid_lat,
        census_info=_build_census_info(db, unit.census2011_code),
    )


def list_admin_units(
    db: Session,
    *,
    parent_lgd_code: str | None = None,
    level: str | None = None,
) -> list[AdminUnitResponse]:
    """List administrative units filtered by parent_lgd_code and/or level."""
    ensure_seed_data(db)
    stmt = select(AdminUnit)
    if parent_lgd_code is not None:
        stmt = stmt.where(AdminUnit.parent_lgd_code == parent_lgd_code)
    if level is not None:
        stmt = stmt.where(AdminUnit.level == level.upper())
    stmt = stmt.order_by(AdminUnit.name.asc())
    rows = db.execute(stmt).scalars().all()
    return [_serialize_admin_unit(db, row) for row in rows]


def search_admin_units(db: Session, query_text: str) -> list[AdminUnitResponse]:
    """Search administrative units by name, LGD code, or Census 2011 code."""
    ensure_seed_data(db)
    q = f"%{query_text.strip()}%"
    stmt = (
        select(AdminUnit)
        .where(
            or_(
                AdminUnit.name.ilike(q),
                AdminUnit.lgd_code.ilike(q),
                AdminUnit.census2011_code.ilike(q),
            )
        )
        .order_by(AdminUnit.level.asc(), AdminUnit.name.asc())
        .limit(25)
    )
    rows = db.execute(stmt).scalars().all()
    return [_serialize_admin_unit(db, row) for row in rows]


def resolve_admin_unit_boundary(db: Session, lgd_code: str) -> AdminBoundaryResponse:
    """Resolve an AdminUnit's boundary geometry or generate an approximate 1.5 km buffer."""
    ensure_seed_data(db)
    unit = db.execute(
        select(AdminUnit).where(AdminUnit.lgd_code == lgd_code)
    ).scalar_one_or_none()
    if unit is None:
        raise AppError(
            code="ADMIN_UNIT_NOT_FOUND",
            message=f"Administrative unit '{lgd_code}' not found.",
            status_code=404,
            details={"lgd_code": lgd_code},
        )

    warnings: list[str] = []
    if unit.geom is not None:
        multipoly: MultiPolygon = unit.geom
        metric_epsg = select_metric_epsg_for_geometry(multipoly)
        area_km2 = round(compute_metric_area_km2(multipoly, metric_epsg=metric_epsg), 4)
        boundary_source = "HARMONISED"
    else:
        lon = unit.centroid_lon if unit.centroid_lon is not None else 82.732
        lat = unit.centroid_lat if unit.centroid_lat is not None else 18.567
        multipoly, area_km2, metric_epsg = create_approximate_village_buffer_wgs84(
            lon, lat, radius_m=1500.0
        )
        boundary_source = "APPROXIMATE_BUFFER"
        warnings.append("APPROXIMATE_BOUNDARY_BUFFER_1500M")

    return AdminBoundaryResponse(
        lgd_code=unit.lgd_code,
        name=unit.name,
        level=unit.level,
        census2011_code=unit.census2011_code,
        boundary_source=boundary_source,
        area_km2=area_km2,
        metric_epsg=metric_epsg,
        warnings=warnings,
        geojson_geometry=dict(mapping(multipoly)),
        census_info=_build_census_info(db, unit.census2011_code),
    )


def _upsert_project_aoi(
    db: Session,
    *,
    project_id: str,
    user: User,
    multipoly: MultiPolygon,
    boundary_source: str,
    area_km2: float,
    metric_epsg: int,
    lgd_code: str | None,
    census2011_code: str | None,
    upload_filename: str | None,
    original_crs: str | None,
    warnings: list[str],
) -> ProjectAoiResponse:
    proj = get_owned_project_or_404(db, project_id, user)
    aoi_row = db.execute(
        select(ProjectAoi).where(ProjectAoi.project_id == proj.id)
    ).scalar_one_or_none()

    if aoi_row is None:
        aoi_row = ProjectAoi(
            project_id=proj.id,
            geom=multipoly,
            boundary_source=boundary_source,
            area_km2=area_km2,
            lgd_code=lgd_code,
            census2011_code=census2011_code,
            upload_filename=upload_filename,
            original_crs=original_crs,
            warnings=warnings,
        )
        db.add(aoi_row)
    else:
        aoi_row.geom = multipoly
        aoi_row.boundary_source = boundary_source
        aoi_row.area_km2 = area_km2
        aoi_row.lgd_code = lgd_code
        aoi_row.census2011_code = census2011_code
        aoi_row.upload_filename = upload_filename
        aoi_row.original_crs = original_crs
        aoi_row.warnings = warnings
        aoi_row.updated_at = datetime.now(UTC)

    proj.metric_epsg = metric_epsg
    if proj.status == "DRAFT":
        proj.status = "AOI_SET"
    proj.version += 1
    proj.updated_at = datetime.now(UTC)

    db.add(
        AuditEvent(
            project_id=proj.id,
            actor_id=user.id,
            event_type="PROJECT_AOI_SET",
            entity="project_aoi",
            entity_id=proj.id,
            diff={
                "boundary_source": boundary_source,
                "area_km2": area_km2,
                "metric_epsg": metric_epsg,
                "lgd_code": lgd_code,
                "warnings": warnings,
            },
        )
    )
    db.commit()

    return ProjectAoiResponse(
        project_id=proj.id,
        boundary_source=boundary_source,
        area_km2=area_km2,
        metric_epsg=metric_epsg,
        lgd_code=lgd_code,
        census2011_code=census2011_code,
        upload_filename=upload_filename,
        original_crs=original_crs,
        warnings=warnings,
        geojson_geometry=dict(mapping(multipoly)),
    )


def set_project_aoi(
    db: Session,
    *,
    project_id: str,
    user: User,
    payload: SetAoiRequest,
) -> ProjectAoiResponse:
    """Set project AOI from an administrative unit LGD code or a user-drawn polygon."""
    settings = get_settings()
    mode = payload.mode.upper()

    if mode == "ADMIN_UNIT":
        if not payload.lgd_code:
            raise InvalidGeometryError("lgd_code is required when mode is ADMIN_UNIT.")
        resolved = resolve_admin_unit_boundary(db, payload.lgd_code)
        validated = validate_and_normalize_boundary(
            resolved.geojson_geometry,
            source_crs="EPSG:4326",
            max_aoi_km2=settings.max_aoi_km2,
        )
        combined_warnings = list(dict.fromkeys(resolved.warnings + validated.warnings))
        return _upsert_project_aoi(
            db,
            project_id=project_id,
            user=user,
            multipoly=validated.multipolygon_wgs84,
            boundary_source=resolved.boundary_source,
            area_km2=validated.area_km2,
            metric_epsg=validated.metric_epsg,
            lgd_code=resolved.lgd_code,
            census2011_code=resolved.census2011_code,
            upload_filename=None,
            original_crs="EPSG:4326",
            warnings=combined_warnings,
        )

    if mode == "USER_DRAWN":
        if not payload.geojson_geometry:
            raise InvalidGeometryError("geojson_geometry is required when mode is USER_DRAWN.")
        validated = validate_and_normalize_boundary(
            payload.geojson_geometry,
            source_crs=payload.source_crs,
            max_aoi_km2=settings.max_aoi_km2,
        )
        return _upsert_project_aoi(
            db,
            project_id=project_id,
            user=user,
            multipoly=validated.multipolygon_wgs84,
            boundary_source="USER_DRAWN",
            area_km2=validated.area_km2,
            metric_epsg=validated.metric_epsg,
            lgd_code=None,
            census2011_code=None,
            upload_filename=None,
            original_crs=payload.source_crs,
            warnings=validated.warnings,
        )

    raise InvalidGeometryError(
        f"Unsupported AOI mode '{payload.mode}'. Expected 'ADMIN_UNIT' or 'USER_DRAWN'."
    )


def get_project_aoi(db: Session, *, project_id: str, user: User) -> ProjectAoiResponse:
    """Retrieve a project's configured AOI or raise 404."""
    proj = get_owned_project_or_404(db, project_id, user)
    aoi_row = db.execute(
        select(ProjectAoi).where(ProjectAoi.project_id == proj.id)
    ).scalar_one_or_none()
    if aoi_row is None or aoi_row.geom is None:
        raise AppError(
            code="AOI_NOT_CONFIGURED",
            message="Project does not have an Area of Interest configured yet.",
            status_code=404,
            details={"project_id": proj.id},
        )
    return ProjectAoiResponse(
        project_id=proj.id,
        boundary_source=aoi_row.boundary_source,
        area_km2=aoi_row.area_km2,
        metric_epsg=proj.metric_epsg,
        lgd_code=aoi_row.lgd_code,
        census2011_code=aoi_row.census2011_code,
        upload_filename=aoi_row.upload_filename,
        original_crs=aoi_row.original_crs,
        warnings=list(aoi_row.warnings or []),
        geojson_geometry=dict(mapping(aoi_row.geom)),
    )


def _parse_kml_bytes(raw_bytes: bytes) -> Polygon:
    """Safely parse KML LinearRing/Polygon coordinates into a Shapely Polygon."""
    text_content = raw_bytes.decode("utf-8", errors="replace")
    if "<!DOCTYPE" in text_content.upper() or "<!ENTITY" in text_content.upper():
        raise UploadValidationError(
            "XML DOCTYPE and ENTITY declarations are forbidden in KML uploads.",
            code="UNSAFE_XML_ENTITY",
        )
    try:
        root = ET.fromstring(text_content)
    except ET.ParseError as exc:
        raise UploadValidationError(f"Malformed KML XML: {exc}") from exc

    coord_nodes = [
        elem for elem in root.iter() if elem.tag.endswith("coordinates") and elem.text
    ]
    if not coord_nodes:
        raise UploadValidationError("KML file contains no <coordinates> elements.")

    points: list[tuple[float, float]] = []
    for token in (coord_nodes[0].text or "").strip().split():
        parts = token.split(",")
        if len(parts) >= 2:
            lon = float(parts[0])
            lat = float(parts[1])
            points.append((lon, lat))

    if len(points) < 3:
        raise UploadValidationError("KML polygon requires at least 3 coordinate pairs.")
    return Polygon(points)


def _parse_shapefile_zip_bytes(raw_bytes: bytes, max_bytes: int) -> tuple[Any, str]:
    """Safely extract and parse a Shapefile .zip archive with zip-bomb and .prj verification."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw_bytes))
    except zipfile.BadZipFile as exc:
        raise UploadValidationError("Uploaded file is not a valid ZIP archive.") from exc

    with zf:
        infos = zf.infolist()
        if not infos or len(infos) > MAX_ZIP_ENTRIES:
            raise UploadValidationError(
                f"ZIP archive must contain between 1 and {MAX_ZIP_ENTRIES} files."
            )

        total_uncompressed = 0
        filenames_lower: set[str] = set()

        for info in infos:
            member_path = Path(info.filename)
            if member_path.is_absolute() or ".." in member_path.parts:
                raise UploadValidationError(
                    "Unsafe path detected inside ZIP archive.",
                    code="UNSAFE_ZIP_PATH",
                )
            total_uncompressed += info.file_size
            if total_uncompressed > max_bytes * 2:
                raise UploadValidationError(
                    "Uncompressed ZIP size exceeds allowed upload limit.",
                    code="ZIP_BOMB_DETECTED",
                )
            if info.compress_size > 0:
                ratio = info.file_size / info.compress_size
                if ratio > MAX_COMPRESSION_RATIO:
                    raise UploadValidationError(
                        f"ZIP compression ratio ({ratio:.1f}x) exceeds safety limit.",
                        code="ZIP_BOMB_DETECTED",
                    )
            filenames_lower.add(member_path.suffix.lower())

        for required_ext, err_code in [
            (".shp", "MISSING_SHP_COMPONENT"),
            (".shx", "MISSING_SHX_COMPONENT"),
            (".dbf", "MISSING_DBF_COMPONENT"),
            (".prj", "MISSING_CRS_PRJ"),
        ]:
            if required_ext not in filenames_lower:
                raise UploadValidationError(
                    f"Shapefile archive is missing required '{required_ext}' file.",
                    code=err_code,
                )

        with tempfile.TemporaryDirectory(prefix="electrimap_shp_") as tmp_dir:
            tmp_root = Path(tmp_dir)
            for info in infos:
                if info.is_dir():
                    continue
                target_file = tmp_root / Path(info.filename).name
                target_file.write_bytes(zf.read(info.filename))

            shp_files = list(tmp_root.glob("*.shp"))
            if not shp_files:
                raise UploadValidationError(
                    "No .shp file found after extracting archive.",
                    code="MISSING_SHP_COMPONENT",
                )
            gdf = gpd.read_file(shp_files[0])
            if gdf.empty:
                raise UploadValidationError("Shapefile contains no features.")
            if gdf.crs is None:
                raise UploadValidationError(
                    "Shapefile has no recognizable coordinate reference system (.prj).",
                    code="MISSING_CRS_PRJ",
                )
            original_crs = gdf.crs.to_string()
            gdf_wgs84 = gdf.to_crs(epsg=4326)
            merged_geom = shapely.unary_union(list(gdf_wgs84.geometry))
            return merged_geom, original_crs


def upload_project_aoi_file(
    db: Session,
    *,
    project_id: str,
    user: User,
    filename: str,
    raw_bytes: bytes,
) -> ProjectAoiResponse:
    """Validate and ingest an uploaded GeoJSON, KML, or zipped Shapefile as the project AOI."""
    settings = get_settings()
    max_bytes = settings.max_upload_mb * 1024 * 1024

    if len(raw_bytes) == 0:
        raise UploadValidationError("Uploaded boundary file is empty.")
    if len(raw_bytes) > max_bytes:
        raise UploadValidationError(
            f"File size exceeds maximum limit of {settings.max_upload_mb} MB.",
            code="FILE_TOO_LARGE",
        )

    safe_name = Path(filename or "boundary.geojson").name
    ext = Path(safe_name).suffix.lower()

    if ext in {".geojson", ".json"}:
        try:
            parsed_json = json.loads(raw_bytes.decode("utf-8"))
        except Exception as exc:
            raise UploadValidationError(f"Invalid JSON in uploaded file: {exc}") from exc
        validated = validate_and_normalize_boundary(
            parsed_json,
            source_crs="EPSG:4326",
            max_aoi_km2=settings.max_aoi_km2,
        )
        original_crs = "EPSG:4326"
    elif ext == ".kml":
        kml_poly = _parse_kml_bytes(raw_bytes)
        validated = validate_and_normalize_boundary(
            kml_poly,
            source_crs="EPSG:4326",
            max_aoi_km2=settings.max_aoi_km2,
        )
        original_crs = "EPSG:4326"
    elif ext == ".zip":
        shp_geom_wgs84, original_crs = _parse_shapefile_zip_bytes(raw_bytes, max_bytes)
        validated = validate_and_normalize_boundary(
            shp_geom_wgs84,
            source_crs="EPSG:4326",
            max_aoi_km2=settings.max_aoi_km2,
        )
    else:
        raise UploadValidationError(
            f"Unsupported boundary file extension '{ext}'. Allowed: .geojson, .json, .kml, .zip."
        )

    return _upsert_project_aoi(
        db,
        project_id=project_id,
        user=user,
        multipoly=validated.multipolygon_wgs84,
        boundary_source="USER_UPLOADED",
        area_km2=validated.area_km2,
        metric_epsg=validated.metric_epsg,
        lgd_code=None,
        census2011_code=None,
        upload_filename=safe_name,
        original_crs=original_crs,
        warnings=validated.warnings,
    )
