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

"""Pure GIS domain module for Milestone M4: Terrain-Weighted Distance & Obstacle Gap Analysis.

Computes metric straight-line distance (`d_straight_m`), terrain-penalized effective distance
(`d_terrain_m`), water crossing intersections (`water_crossings_count`), and preliminary
electrification modality affinity (`GRID_EXTENSION`, `GRID_AUGMENTATION`, `SOLAR_MINIGRID`,
`STANDALONE_SHS`, or `UNSET_INFRA_REQUIRED`) in the project's local UTM CRS (e.g., EPSG:32644).

Core Principle #4 (No Fabricated Infrastructure):
- If `infra_assets` is empty, `d_straight_m` and `d_terrain_m` are strictly `None` (UNSET)
  and `has_existing_infra` is `False`. Never invent or assume a tie-in point unless explicitly
  uploaded (`UPLOADED_GIS` / `UTILITY_RECORD`) or placed by the planner (`USER_ASSUMED`).
"""

from dataclasses import dataclass

from shapely.geometry import LineString, Point, Polygon
from shapely.geometry.base import BaseGeometry

from app.domain.gis.crs import project_geometry


@dataclass(frozen=True)
class InfraAssetInput:
    """Pure domain representation of an existing electrical asset or assumed tie-in."""

    asset_id: str
    asset_type: str  # HT_LINE, LT_LINE, DT, SUBSTATION, TIE_IN, POLE
    name: str
    geom_wgs84: BaseGeometry
    provenance: str  # UTILITY_RECORD, FIELD_SURVEY, USER_ASSUMED, OSM
    voltage_kv: float | None = None
    rating_kva: float | None = None


@dataclass(frozen=True)
class ClusterGapInput:
    """Pure domain input for a habitation cluster in gap analysis."""

    cluster_id: str
    label: str
    name: str
    centroid_wgs84: Point
    geom_wgs84: Polygon
    est_households: int
    proxy_class: str
    verification_state: str
    verified_class: str | None
    slope_mean_deg: float
    canopy_share: float
    d_road_m: float | None


@dataclass(frozen=True)
class ClusterGapResult:
    """Pure domain output of infrastructure gap and obstacle analysis for one cluster."""

    cluster_id: str
    cluster_label: str
    cluster_name: str
    est_households: int
    effective_electrification_class: str
    nearest_asset_id: str | None
    nearest_asset_name: str | None
    nearest_asset_type: str | None
    nearest_asset_provenance: str | None
    d_straight_m: float | None
    d_terrain_m: float | None
    terrain_penalty_factor: float
    slope_mean_deg: float
    canopy_share: float
    water_crossings_count: int
    road_distance_m: float | None
    recommended_modality: str
    rationale: str
    corridor_line_wgs84: LineString | None


@dataclass(frozen=True)
class ProjectGapAnalysisSummary:
    """Complete project-level gap analysis matrix and summary metrics."""

    has_existing_infra: bool
    infra_assets_count: int
    assumed_assets_count: int
    verified_assets_count: int
    mean_d_straight_m: float | None
    mean_d_terrain_m: float | None
    max_d_terrain_m: float | None
    grid_extension_candidates: int
    minigrid_candidates: int
    shs_candidates: int
    augmentation_candidates: int
    clusters: list[ClusterGapResult]


def compute_terrain_penalty_factor(
    *,
    slope_mean_deg: float,
    canopy_share: float,
    water_crossings_count: int,
    beta_slope: float = 0.045,
    alpha_canopy: float = 0.45,
    gamma_water: float = 0.12,
) -> float:
    """Compute dimensionless terrain-and-obstacle multiplier (>= 1.0) for feeder corridor length.

    Formula:
        M_terrain = 1.0 + beta_slope * max(0, slope_deg) + alpha_canopy * canopy_share
                    + gamma_water * water_crossings_count
    """
    slope_term = beta_slope * max(0.0, float(slope_mean_deg))
    canopy_term = alpha_canopy * max(0.0, min(1.0, float(canopy_share)))
    water_term = gamma_water * max(0, water_crossings_count)
    return round(1.0 + slope_term + canopy_term + water_term, 3)


def recommend_cluster_modality(
    *,
    effective_class: str,
    est_households: int,
    d_terrain_m: float | None,
    slope_mean_deg: float,
    canopy_share: float,
    grid_max_terrain_m: float = 3500.0,
    minigrid_min_households: int = 15,
) -> tuple[str, str]:
    """Recommend preliminary electrification modality based on gap metrics and household density."""
    if d_terrain_m is None:
        return (
            "UNSET_INFRA_REQUIRED",
            "Existing 11 kV / LT tie-in point is UNSET. Upload utility GIS or place an explicit "
            "USER_ASSUMED tie-in point on the map to evaluate grid extension distance.",
        )

    if effective_class in {"LIKELY_ELECTRIFIED", "ELECTRIFIED"} and d_terrain_m <= 1200.0:
        return (
            "GRID_AUGMENTATION",
            f"Habitation is classified as {effective_class} within {d_terrain_m:.0f} m "
            "terrain-weighted distance of existing network; recommend LT distribution "
            "intensification & DT check.",
        )

    if effective_class == "POTENTIALLY_UNDERSERVED" and d_terrain_m <= 1800.0:
        return (
            "GRID_AUGMENTATION",
            f"Potentially underserved habitation at {d_terrain_m:.0f} m effective distance; "
            "recommend additional 25/63 kVA DT placement and LT tail-end reconductoring.",
        )

    if est_households < minigrid_min_households and d_terrain_m > 1800.0:
        return (
            "STANDALONE_SHS",
            f"Dispersed small habitation ({est_households} HH < {minigrid_min_households} HH) "
            f"located {d_terrain_m:.0f} m (terrain-weighted) from tie-in; standalone Solar Home "
            "Systems (SHS) avoid prohibitive per-household HT feeder cost.",
        )

    if d_terrain_m <= grid_max_terrain_m and slope_mean_deg < 18.0 and canopy_share < 0.65:
        return (
            "GRID_EXTENSION",
            f"Terrain-weighted distance ({d_terrain_m:.0f} m <= {grid_max_terrain_m:.0f} m limit) "
            f"and moderate terrain ({slope_mean_deg:.1f}° slope, {canopy_share * 100:.0f}% canopy) "
            "favor 11 kV HT feeder extension + 11/0.415 kV DT.",
        )

    if est_households >= minigrid_min_households:
        return (
            "SOLAR_MINIGRID",
            f"Remote or high-obstacle habitation ({d_terrain_m:.0f} m terrain distance, "
            f"{slope_mean_deg:.1f}° slope, {canopy_share * 100:.0f}% canopy) with "
            f"{est_households} HH is well-suited for a Solar PV + BESS 415V AC Mini-Grid.",
        )

    return (
        "STANDALONE_SHS",
        f"Remote low-density habitation ({est_households} HH at {d_terrain_m:.0f} m terrain "
        "distance); recommend standalone Solar Home Systems (SHS).",
    )


def run_project_gap_analysis(
    clusters: list[ClusterGapInput],
    *,
    infra_assets: list[InfraAssetInput],
    waterway_geoms_wgs84: list[BaseGeometry],
    metric_epsg: int = 32644,
    grid_max_terrain_m: float = 3500.0,
    minigrid_min_households: int = 15,
) -> ProjectGapAnalysisSummary:
    """Compute UTM infrastructure distances, waterway crossings, and modality recommendations."""
    # Pre-project infrastructure assets and waterways into local UTM CRS
    projected_assets: list[tuple[InfraAssetInput, BaseGeometry]] = []
    for asset in infra_assets:
        if asset.geom_wgs84 is not None and not asset.geom_wgs84.is_empty:
            utm_geom = project_geometry(asset.geom_wgs84, source_epsg=4326, target_epsg=metric_epsg)
            projected_assets.append((asset, utm_geom))

    projected_waterways: list[BaseGeometry] = []
    for w_geom in waterway_geoms_wgs84:
        if w_geom is not None and not w_geom.is_empty:
            projected_waterways.append(
                project_geometry(w_geom, source_epsg=4326, target_epsg=metric_epsg)
            )

    results: list[ClusterGapResult] = []
    straight_vals: list[float] = []
    terrain_vals: list[float] = []

    grid_ext_cnt = 0
    minigrid_cnt = 0
    shs_cnt = 0
    aug_cnt = 0

    for cl in clusters:
        c_utm = project_geometry(cl.centroid_wgs84, source_epsg=4326, target_epsg=metric_epsg)
        eff_class = (
            cl.verified_class
            if cl.verification_state in {"FIELD_VERIFIED", "UTILITY_VERIFIED"} and cl.verified_class
            else cl.proxy_class
        )

        nearest_asset: InfraAssetInput | None = None
        nearest_dist_m: float | None = None
        nearest_pt_utm: Point | None = None

        for asset, asset_utm in projected_assets:
            d_m = float(c_utm.distance(asset_utm))
            if nearest_dist_m is None or d_m < nearest_dist_m:
                nearest_dist_m = d_m
                nearest_asset = asset
                # Nearest point on asset geometry
                if isinstance(asset_utm, Point):
                    nearest_pt_utm = asset_utm
                else:
                    nearest_pt_utm = asset_utm.centroid

        water_crossings = 0
        corridor_wgs84: LineString | None = None

        if nearest_dist_m is not None and nearest_pt_utm is not None:
            straight_val = round(nearest_dist_m, 1)
            c_pt = c_utm.centroid
            n_pt = nearest_pt_utm.centroid
            corridor_utm = LineString(
                [
                    (float(c_pt.x), float(c_pt.y)),
                    (float(n_pt.x), float(n_pt.y)),
                ]
            )
            for w_utm in projected_waterways:
                if corridor_utm.intersects(w_utm):
                    water_crossings += 1

            penalty = compute_terrain_penalty_factor(
                slope_mean_deg=cl.slope_mean_deg,
                canopy_share=cl.canopy_share,
                water_crossings_count=water_crossings,
            )
            terrain_val = round(straight_val * penalty, 1)
            d_straight_m: float | None = straight_val
            d_terrain_m: float | None = terrain_val
            straight_vals.append(straight_val)
            terrain_vals.append(terrain_val)

            reproj_line = project_geometry(corridor_utm, source_epsg=metric_epsg, target_epsg=4326)
            if isinstance(reproj_line, LineString):
                corridor_wgs84 = reproj_line
        else:
            d_straight_m = None
            d_terrain_m = None
            penalty = compute_terrain_penalty_factor(
                slope_mean_deg=cl.slope_mean_deg,
                canopy_share=cl.canopy_share,
                water_crossings_count=0,
            )

        modality, rationale = recommend_cluster_modality(
            effective_class=eff_class,
            est_households=cl.est_households,
            d_terrain_m=d_terrain_m,
            slope_mean_deg=cl.slope_mean_deg,
            canopy_share=cl.canopy_share,
            grid_max_terrain_m=grid_max_terrain_m,
            minigrid_min_households=minigrid_min_households,
        )

        if modality == "GRID_EXTENSION":
            grid_ext_cnt += 1
        elif modality == "SOLAR_MINIGRID":
            minigrid_cnt += 1
        elif modality == "STANDALONE_SHS":
            shs_cnt += 1
        elif modality == "GRID_AUGMENTATION":
            aug_cnt += 1

        results.append(
            ClusterGapResult(
                cluster_id=cl.cluster_id,
                cluster_label=cl.label,
                cluster_name=cl.name,
                est_households=cl.est_households,
                effective_electrification_class=eff_class,
                nearest_asset_id=nearest_asset.asset_id if nearest_asset else None,
                nearest_asset_name=nearest_asset.name if nearest_asset else None,
                nearest_asset_type=nearest_asset.asset_type if nearest_asset else None,
                nearest_asset_provenance=nearest_asset.provenance if nearest_asset else None,
                d_straight_m=d_straight_m,
                d_terrain_m=d_terrain_m,
                terrain_penalty_factor=penalty,
                slope_mean_deg=cl.slope_mean_deg,
                canopy_share=cl.canopy_share,
                water_crossings_count=water_crossings,
                road_distance_m=cl.d_road_m,
                recommended_modality=modality,
                rationale=rationale,
                corridor_line_wgs84=corridor_wgs84,
            )
        )

    assumed_cnt = sum(1 for a in infra_assets if a.provenance == "USER_ASSUMED")
    verified_cnt = sum(
        1 for a in infra_assets if a.provenance in {"UTILITY_RECORD", "FIELD_SURVEY"}
    )

    return ProjectGapAnalysisSummary(
        has_existing_infra=len(projected_assets) > 0,
        infra_assets_count=len(projected_assets),
        assumed_assets_count=assumed_cnt,
        verified_assets_count=verified_cnt,
        mean_d_straight_m=(
            round(sum(straight_vals) / len(straight_vals), 1) if straight_vals else None
        ),
        mean_d_terrain_m=(
            round(sum(terrain_vals) / len(terrain_vals), 1) if terrain_vals else None
        ),
        max_d_terrain_m=round(max(terrain_vals), 1) if terrain_vals else None,
        grid_extension_candidates=grid_ext_cnt,
        minigrid_candidates=minigrid_cnt,
        shs_candidates=shs_cnt,
        augmentation_candidates=aug_cnt,
        clusters=results,
    )
