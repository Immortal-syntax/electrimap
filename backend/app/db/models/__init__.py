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

"""SQLAlchemy ORM model registry for Alembic autogenerate and runtime metadata."""

from app.db.models.auth import User, UserSession
from app.db.models.costing import ProjectRateItem, ScenarioBoqLine
from app.db.models.infrastructure import (
    ClusterGapAnalysis,
    InfrastructureAsset,
    ProjectDemandEstimate,
    ProjectSetting,
)
from app.db.models.ops import AuditEvent, Job
from app.db.models.planning import ClusterEngineeringLayout, PlanningScenario
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
    "ClusterEngineeringLayout",
    "ClusterGapAnalysis",
    "ClusterRun",
    "Dataset",
    "EngineeringConstant",
    "InfrastructureAsset",
    "Job",
    "OsmFeature",
    "PlanningScenario",
    "Project",
    "ProjectAoi",
    "ProjectDemandEstimate",
    "ProjectLayer",
    "ProjectRateItem",
    "ProjectSetting",
    "ScenarioBoqLine",
    "SettlementCluster",
    "SolarResource",
    "User",
    "UserSession",
    "VerificationImport",
    "VerificationRecord",
]
