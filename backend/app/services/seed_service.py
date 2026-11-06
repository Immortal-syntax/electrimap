"""Idempotent seeding for default accounts, Koraput admin units, and demo project."""

from shapely.geometry import MultiPolygon, Polygon
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.models.auth import User
from app.db.models.project import Project, ProjectAoi
from app.db.models.reference import AdminUnit, CensusVillage, EngineeringConstant
from app.domain.engineering.constants import STANDARD_ENGINEERING_CONSTANTS
from app.domain.gis.crs import compute_metric_area_km2

DEMO_PROJECT_ID = "00000000-0000-4000-8000-000000000001"
DEFAULT_PLANNER_EMAIL = "planner@electrimap.in"
DEFAULT_PLANNER_PASSWORD = "ElectriMap#2026"
DEFAULT_ADMIN_EMAIL = "admin@electrimap.in"
DEFAULT_ADMIN_PASSWORD = "AdminElectriMap#2026"


def _make_rect_multipolygon(
    min_lon: float, min_lat: float, max_lon: float, max_lat: float
) -> MultiPolygon:
    poly = Polygon(
        [
            (min_lon, min_lat),
            (max_lon, min_lat),
            (max_lon, max_lat),
            (min_lon, max_lat),
            (min_lon, min_lat),
        ]
    )
    return MultiPolygon([poly])


def ensure_seed_data(db: Session) -> None:
    """Seed users, Odisha/Koraput administrative units, Census 2011 records, and demo project."""
    existing_planner = db.execute(
        select(User).where(User.email == DEFAULT_PLANNER_EMAIL)
    ).scalar_one_or_none()

    if existing_planner is None:
        planner = User(
            id="00000000-0000-4000-8000-000000000010",
            email=DEFAULT_PLANNER_EMAIL,
            password_hash=hash_password(DEFAULT_PLANNER_PASSWORD),
            display_name="Swayam (Lead Planner)",
            role="PLANNER",
            is_active=True,
        )
        admin = User(
            id="00000000-0000-4000-8000-000000000011",
            email=DEFAULT_ADMIN_EMAIL,
            password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
            display_name="System Administrator",
            role="ADMIN",
            is_active=True,
        )
        db.add_all([planner, admin])
        db.flush()
    else:
        planner = existing_planner

    # Seed Admin Units if empty
    has_state = db.execute(
        select(AdminUnit).where(AdminUnit.lgd_code == "21")
    ).scalar_one_or_none()

    bheja_poly = MultiPolygon(
        [
            Polygon(
                [
                    (82.695, 18.535),
                    (82.768, 18.532),
                    (82.774, 18.598),
                    (82.702, 18.602),
                    (82.690, 18.568),
                    (82.695, 18.535),
                ]
            )
        ]
    )

    if has_state is None:
        units = [
            AdminUnit(
                lgd_code="21",
                level="STATE",
                name="Odisha",
                parent_lgd_code=None,
                census2011_code="21",
                geom=_make_rect_multipolygon(81.37, 17.78, 87.48, 22.57),
                boundary_source="HARMONISED",
                centroid_lon=84.42,
                centroid_lat=20.15,
            ),
            AdminUnit(
                lgd_code="360",
                level="DISTRICT",
                name="Koraput",
                parent_lgd_code="21",
                census2011_code="398",
                geom=_make_rect_multipolygon(82.08, 18.20, 83.38, 19.35),
                boundary_source="HARMONISED",
                centroid_lon=82.71,
                centroid_lat=18.81,
            ),
            AdminUnit(
                lgd_code="3291",
                level="BLOCK",
                name="Nandapur",
                parent_lgd_code="360",
                census2011_code="03018",
                geom=_make_rect_multipolygon(82.55, 18.42, 82.88, 18.72),
                boundary_source="HARMONISED",
                centroid_lon=82.73,
                centroid_lat=18.57,
            ),
            AdminUnit(
                lgd_code="3294",
                level="BLOCK",
                name="Pottangi",
                parent_lgd_code="360",
                census2011_code="03020",
                geom=_make_rect_multipolygon(82.85, 18.45, 83.12, 18.74),
                boundary_source="HARMONISED",
                centroid_lon=82.97,
                centroid_lat=18.58,
            ),
            AdminUnit(
                lgd_code="124901",
                level="GP",
                name="Bheja Gram Panchayat",
                parent_lgd_code="3291",
                census2011_code=None,
                geom=bheja_poly,
                boundary_source="HARMONISED",
                centroid_lon=82.732,
                centroid_lat=18.567,
            ),
            AdminUnit(
                lgd_code="124902",
                level="GP",
                name="Padwa Gram Panchayat",
                parent_lgd_code="3291",
                census2011_code=None,
                geom=_make_rect_multipolygon(82.61, 18.47, 82.69, 18.54),
                boundary_source="HARMONISED",
                centroid_lon=82.65,
                centroid_lat=18.505,
            ),
            AdminUnit(
                lgd_code="124903",
                level="GP",
                name="Pukali Gram Panchayat",
                parent_lgd_code="3294",
                census2011_code=None,
                geom=_make_rect_multipolygon(82.91, 18.52, 82.99, 18.59),
                boundary_source="HARMONISED",
                centroid_lon=82.95,
                centroid_lat=18.555,
            ),
            AdminUnit(
                lgd_code="398712",
                level="VILLAGE",
                name="Bheja",
                parent_lgd_code="124901",
                census2011_code="428914",
                geom=bheja_poly,
                boundary_source="HARMONISED",
                centroid_lon=82.732,
                centroid_lat=18.567,
            ),
            AdminUnit(
                lgd_code="398715",
                level="VILLAGE",
                name="Padwa",
                parent_lgd_code="124902",
                census2011_code="428918",
                geom=_make_rect_multipolygon(82.62, 18.48, 82.68, 18.53),
                boundary_source="HARMONISED",
                centroid_lon=82.65,
                centroid_lat=18.505,
            ),
            AdminUnit(
                lgd_code="398719",
                level="VILLAGE",
                name="Maliaguda PVTG Forest Habitation",
                parent_lgd_code="124901",
                census2011_code="428922",
                geom=None,  # Intentionally null to exercise APPROXIMATE_BUFFER fallback
                boundary_source="APPROXIMATE_BUFFER",
                centroid_lon=82.755,
                centroid_lat=18.585,
            ),
            AdminUnit(
                lgd_code="398801",
                level="VILLAGE",
                name="Pukali",
                parent_lgd_code="124903",
                census2011_code="429005",
                geom=_make_rect_multipolygon(82.92, 18.53, 82.98, 18.58),
                boundary_source="HARMONISED",
                centroid_lon=82.95,
                centroid_lat=18.555,
            ),
        ]
        db.add_all(units)

        census_rows = [
            CensusVillage(
                census2011_code="428914",
                state_code="21",
                district_code="398",
                subdistrict_code="03018",
                name="Bheja",
                total_pop=562,
                households=128,
                st_pop=448,
                sc_pop=42,
                amenities={
                    "primary_school": 1,
                    "middle_school": 1,
                    "phc_sub_centre": 1,
                    "drinking_water_handpump": True,
                    "all_weather_road": False,
                },
                power_supply_2011={
                    "domestic_available": True,
                    "agricultural_available": False,
                    "summer_hours_per_day": 4.0,
                    "winter_hours_per_day": 5.0,
                },
            ),
            CensusVillage(
                census2011_code="428918",
                state_code="21",
                district_code="398",
                subdistrict_code="03018",
                name="Padwa",
                total_pop=912,
                households=210,
                st_pop=740,
                sc_pop=68,
                amenities={
                    "primary_school": 2,
                    "middle_school": 1,
                    "phc_sub_centre": 1,
                    "drinking_water_handpump": True,
                    "all_weather_road": True,
                },
                power_supply_2011={
                    "domestic_available": True,
                    "agricultural_available": True,
                    "summer_hours_per_day": 8.0,
                    "winter_hours_per_day": 9.0,
                },
            ),
            CensusVillage(
                census2011_code="428922",
                state_code="21",
                district_code="398",
                subdistrict_code="03018",
                name="Maliaguda PVTG Forest Habitation",
                total_pop=118,
                households=26,
                st_pop=114,
                sc_pop=0,
                amenities={
                    "primary_school": 0,
                    "middle_school": 0,
                    "phc_sub_centre": 0,
                    "drinking_water_handpump": True,
                    "all_weather_road": False,
                },
                power_supply_2011={
                    "domestic_available": False,
                    "agricultural_available": False,
                    "summer_hours_per_day": 0.0,
                    "winter_hours_per_day": 0.0,
                },
            ),
            CensusVillage(
                census2011_code="429005",
                state_code="21",
                district_code="398",
                subdistrict_code="03020",
                name="Pukali",
                total_pop=710,
                households=164,
                st_pop=595,
                sc_pop=38,
                amenities={
                    "primary_school": 1,
                    "middle_school": 1,
                    "phc_sub_centre": 1,
                    "drinking_water_handpump": True,
                    "all_weather_road": True,
                },
                power_supply_2011={
                    "domestic_available": True,
                    "agricultural_available": False,
                    "summer_hours_per_day": 5.0,
                    "winter_hours_per_day": 6.0,
                },
            ),
        ]
        db.add_all(census_rows)
        db.flush()

    # Seed default demo project if not present
    demo_proj = db.execute(
        select(Project).where(Project.id == DEMO_PROJECT_ID)
    ).scalar_one_or_none()
    if demo_proj is None:
        area_km2 = round(compute_metric_area_km2(bheja_poly), 4)
        proj = Project(
            id=DEMO_PROJECT_ID,
            owner_id=planner.id,
            name="Koraput — Nandapur Block (Village Bheja Pre-Feasibility Demo)",
            description=(
                "Reference pre-feasibility DPR project for Village Bheja (LGD 398712, "
                "Census 428914) in Nandapur Block, Koraput District, Odisha."
            ),
            scheme="DA-JGUA / RDSS",
            target_state="Odisha",
            target_district="Koraput",
            target_block="Nandapur",
            village_names="Bheja, Podapadar Tola, Maliaguda PVTG Hamlet",
            base_year=2026,
            horizon_years=10,
            discount_rate=0.08,
            load_tier="TIER_3_STANDARD",
            metric_epsg=32644,
            status="AOI_SET",
            version=1,
        )
        aoi = ProjectAoi(
            project_id=DEMO_PROJECT_ID,
            geom=bheja_poly,
            boundary_source="HARMONISED",
            area_km2=area_km2,
            lgd_code="398712",
            census2011_code="428914",
            upload_filename=None,
            original_crs="EPSG:4326",
            warnings=[],
        )
        db.add_all([proj, aoi])

    # Seed verified REC/IS/CEA engineering constants
    existing_const_keys = {
        row.key for row in db.execute(select(EngineeringConstant)).scalars().all()
    }
    for spec in STANDARD_ENGINEERING_CONSTANTS:
        if spec.key not in existing_const_keys:
            db.add(
                EngineeringConstant(
                    key=spec.key,
                    value=spec.value,
                    unit=spec.unit,
                    description=spec.description,
                    citation=spec.citation,
                    status=spec.status,
                    updated_by="system_seed",
                )
            )

    db.commit()
