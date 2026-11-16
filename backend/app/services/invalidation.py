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

"""Deterministic downstream invalidation and resynchronization helpers (CRIT-06)."""

from datetime import UTC, datetime

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.db.models.auth import User
from app.db.models.costing import ScenarioBoqLine
from app.db.models.infrastructure import ClusterGapAnalysis, ProjectDemandEstimate
from app.db.models.planning import ClusterEngineeringLayout, PlanningScenario
from app.db.models.project import Project, ProjectLayer
from app.db.models.settlement import ClusterRun, SettlementCluster
from app.db.models.spatial import Building, OsmFeature, SolarResource


def bump_project_version(db: Session, project_id: str) -> None:
    """Increment `Project.version` so vector tile ETags and pre-flight snapshot hashes update."""
    db.execute(
        update(Project)
        .where(Project.id == project_id)
        .values(version=Project.version + 1, updated_at=datetime.now(UTC))
    )


def invalidate_downstream_from_stage(
    db: Session,
    *,
    project_id: str,
    stage: str,
    drop_clusters: bool = True,
    bump_version: bool = True,
) -> None:
    """Clear downstream artifacts deterministically whenever an upstream input mutates.

    Stages (ordered broadest to narrowest):
    - `"aoi"`: AOI changed -> clears layers, buildings, OSM, solar, clusters, gap, scenarios.
    - `"data"`: Raw data acquired or replaced -> clears clusters, gap, demand, scenarios, BOQ.
    - `"clustering"`: Re-clustering -> clears gap, demand, scenarios, BOQ (+ optional clusters).
    - `"scenarios"`: Engineering/planning invalidated -> clears scenarios, cluster layouts, and BOQ.
    - `"boq_only"`: SoR rates or costing inputs changed -> clears cached BOQ rows.
    """
    if stage in {"aoi", "data", "clustering", "scenarios", "boq_only"}:
        db.execute(delete(ScenarioBoqLine).where(ScenarioBoqLine.project_id == project_id))

    if stage in {"aoi", "data", "clustering", "scenarios"}:
        db.execute(
            delete(ClusterEngineeringLayout).where(
                ClusterEngineeringLayout.project_id == project_id
            )
        )
        db.execute(
            delete(PlanningScenario).where(PlanningScenario.project_id == project_id)
        )

    if stage in {"aoi", "data", "clustering"}:
        db.execute(
            delete(ProjectDemandEstimate).where(
                ProjectDemandEstimate.project_id == project_id
            )
        )
        db.execute(
            delete(ClusterGapAnalysis).where(ClusterGapAnalysis.project_id == project_id)
        )
        if drop_clusters:
            db.execute(
                update(Building)
                .where(Building.project_id == project_id)
                .values(cluster_run_id=None, cluster_id=None)
            )
            db.execute(
                delete(SettlementCluster).where(SettlementCluster.project_id == project_id)
            )
            db.execute(delete(ClusterRun).where(ClusterRun.project_id == project_id))

    if stage == "aoi":
        db.execute(delete(Building).where(Building.project_id == project_id))
        db.execute(delete(OsmFeature).where(OsmFeature.project_id == project_id))
        db.execute(delete(SolarResource).where(SolarResource.project_id == project_id))
        db.execute(delete(ProjectLayer).where(ProjectLayer.project_id == project_id))

    if bump_version:
        bump_project_version(db, project_id)


def resync_downstream_after_upstream_change(
    db: Session,
    *,
    project_id: str,
    user: User,
    recompute_gap: bool = True,
    recompute_demand: bool = True,
    recompute_scenarios: bool = True,
) -> None:
    """Bump version, purge cached BOQ lines, and synchronously refresh gap/demand/scenarios."""
    invalidate_downstream_from_stage(
        db,
        project_id=project_id,
        stage="boq_only",
        bump_version=True,
    )
    db.commit()

    has_clusters = (
        db.execute(
            select(SettlementCluster.id).where(SettlementCluster.project_id == project_id)
        ).first()
        is not None
    )
    if not has_clusters:
        return

    from app.services.infrastructure_service import (
        compute_and_persist_gap_analysis,
        compute_and_persist_project_demand,
    )
    from app.services.planning_service import sync_project_scenarios_after_upstream_change

    if recompute_gap:
        compute_and_persist_gap_analysis(db, project_id=project_id, user=user)
    if recompute_demand:
        compute_and_persist_project_demand(db, project_id=project_id, user=user)
    if recompute_scenarios:
        sync_project_scenarios_after_upstream_change(db, project_id=project_id, user=user)
