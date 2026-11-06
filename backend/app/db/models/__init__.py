"""SQLAlchemy ORM model registry for Alembic autogenerate and runtime metadata."""

from app.db.models.auth import User, UserSession
from app.db.models.infrastructure import (
    ClusterGapAnalysis,
    InfrastructureAsset,
    ProjectDemandEstimate,
    ProjectSetting,
)
from app.db.models.ops import AuditEvent, Job
from app.db.models.project import Project, ProjectAoi, ProjectLayer
from app.db.models.reference import AdminUnit, CensusVillage, Dataset, EngineeringConstant
from app.db.models.settlement import (
    ClusterRun,
    SettlementCluster,
    VerificationImport,
    VerificationRecord,
)
from app.db.models.spatial import Building, OsmFeature, SolarResource

__all__ = [
    "AdminUnit",
    "AuditEvent",
    "Building",
    "CensusVillage",
    "ClusterGapAnalysis",
    "ClusterRun",
    "Dataset",
    "EngineeringConstant",
    "InfrastructureAsset",
    "Job",
    "OsmFeature",
    "Project",
    "ProjectAoi",
    "ProjectDemandEstimate",
    "ProjectLayer",
    "ProjectSetting",
    "SettlementCluster",
    "SolarResource",
    "User",
    "UserSession",
    "VerificationImport",
    "VerificationRecord",
]
