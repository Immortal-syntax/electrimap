"""SQLAlchemy ORM model registry for Alembic autogenerate and runtime metadata."""

from app.db.models.auth import User, UserSession
from app.db.models.ops import AuditEvent, Job
from app.db.models.project import Project, ProjectAoi, ProjectLayer
from app.db.models.reference import AdminUnit, CensusVillage, Dataset, EngineeringConstant
from app.db.models.spatial import Building, OsmFeature, SolarResource

__all__ = [
    "AdminUnit",
    "AuditEvent",
    "Building",
    "CensusVillage",
    "Dataset",
    "EngineeringConstant",
    "Job",
    "OsmFeature",
    "Project",
    "ProjectAoi",
    "ProjectLayer",
    "SolarResource",
    "User",
    "UserSession",
]
