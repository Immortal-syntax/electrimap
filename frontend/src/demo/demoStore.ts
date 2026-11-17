/*
 * Copyright 2026 Swayam Kumar
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Per-user localStorage project workspace & deterministic recalculation pipeline.
 * Replaces external database persistence for zero-infrastructure demo hosting.
 */

import { DEMO_PROJECT_ID } from '../components/layout/navigationConfig';
import type { JobStatusDto } from '../components/ui/JobProgress';
import type {
  ProjectRateListDto,
  ProjectScenarioComparisonDto,
  SorCsvImportResponseDto,
} from '../components/workspace/CostAndScenarioComparisonPanel';
import type { ProjectLayerDto } from '../components/workspace/DataManagementPanel';
import type {
  PreFlightReportDto,
  ProjectExportListDto,
  ProjectExportRecordDto,
} from '../components/workspace/DprExportCenterPanel';
import type {
  InfrastructureAssetDto,
  InfrastructureListDto,
  ProjectDemandSummaryDto,
  ProjectGapAnalysisDto,
  ProjectSettingDto,
  ProjectSettingsListDto,
} from '../components/workspace/InfrastructureAndDemandPanel';
import type { PlanningScenarioListDto } from '../components/workspace/NetworkEngineeringPanel';
import type {
  ClusterDto,
  ClusterListResponseDto,
  VerificationImportDto,
  VerificationLedgerDto,
  VerificationRecordDto,
} from '../components/workspace/SettlementAssessmentPanel';
import type { ProjectDto } from '../pages/ProjectsPage';
import { getStoredDemoUser } from './demoAuth';
import {
  buildProjectScenarioComparison,
  buildAllScenariosForProject,
  computeProjectDemandSummary,
  createDefaultRatesList,
  createDefaultSettingsForProject,
  evaluateDprPreflight,
  parseAndValidateSorCsv,
} from './domainEngMath';
import {
  buildDemoBuildingsInsidePolygon,
  computeCensusReconciliation,
  computeGeometryAreaKm2,
  computeGeometryCentroidAndBbox,
  parseBuildingsFromFeatureCollection,
  parseUploadedGeoJsonOrKmlGeometry,
  runClusteringAndClassification,
  runProjectGapAnalysis,
  selectMetricEpsgForGeometry,
  type ClusteringRunParams,
} from './domainGeoMath';
import {
  KORAPUT_BHEJA_POLYGON,
  KORAPUT_OSM_FEATURES_FC,
  OPEN_DATASET_CATALOG,
  REFERENCE_ADMIN_UNITS,
  getKoraputReferenceBundle,
  type ReferenceCensusInfo,
} from './referenceData/referenceCatalog';
import type { VerificationState } from '../components/ui/Badge';

const STORE_KEY_PREFIX = 'electrimap_demo_workspace_v1:';
const ANONYMOUS_BUCKET = 'public_guest';

export interface StoredProjectRecord {
  project: ProjectDto;
  censusInfo: ReferenceCensusInfo | null;
  layers: ProjectLayerDto[];
  isKoraputReference: boolean;
  hasSampleDemoGeometry: boolean;
  customBuildingsFc: GeoJSON.FeatureCollection | null;
  customOsmFc: GeoJSON.FeatureCollection | null;
  clusterParams: ClusteringRunParams;
  infraAssets: InfrastructureAssetDto[];
  settings: ProjectSettingDto[];
  verifications: VerificationRecordDto[];
  verificationImports: VerificationImportDto[];
  activeScenarioKey: string;
  manualOverridesByClusterLabel: Record<string, string>;
  rates: ProjectRateListDto;
  exportRecords: ProjectExportRecordDto[];
  jobs: JobStatusDto[];
}

export interface DerivedProjectState {
  project: ProjectDto;
  layers: ProjectLayerDto[];
  buildingsFc: GeoJSON.FeatureCollection;
  osmFc: GeoJSON.FeatureCollection;
  settlements: ClusterListResponseDto;
  ledger: VerificationLedgerDto;
  infrastructure: InfrastructureListDto;
  gapAnalysis: ProjectGapAnalysisDto;
  settingsList: ProjectSettingsListDto;
  demand: ProjectDemandSummaryDto;
  scenariosList: PlanningScenarioListDto;
  comparison: ProjectScenarioComparisonDto;
  preflight: PreFlightReportDto;
  exportsList: ProjectExportListDto;
  jobs: JobStatusDto[];
}

function activeBucketId(): string {
  return getStoredDemoUser()?.id ?? ANONYMOUS_BUCKET;
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `demo-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

function findDatasetByKey(key: string) {
  return OPEN_DATASET_CATALOG.find((d) => d.key === key) ?? OPEN_DATASET_CATALOG[0]!;
}

function buildAcquiredLayersForProject(
  projectId: string,
  bbox: [number, number, number, number],
  buildingCount: number,
  osmCount: number,
  isKoraputRef: boolean,
  hasSampleDemo: boolean,
): ProjectLayerDto[] {
  const nowIso = new Date().toISOString();
  const modeVec = isKoraputRef ? 'LOCAL_GEOJSON_EXTRACT' : 'DEMO_SAMPLE_PROXY';
  const modeRas = isKoraputRef ? 'LOCAL_GEOTIFF_EXTRACT' : 'DEMO_SAMPLE_PROXY';
  return [
    {
      id: `lyr-${projectId.slice(0, 8)}-buildings`,
      project_id: projectId,
      layer_key: 'buildings',
      status: 'READY',
      retrieved_at: nowIso,
      feature_count: buildingCount,
      bbox,
      summary_metrics: {
        data_source_mode: modeVec,
        is_demo_sample: hasSampleDemo,
        note: hasSampleDemo
          ? 'Illustrative demo building footprints generated inside custom boundary.'
          : 'Extracted from Koraput/Nandapur reference footprints.',
      },
      error_message: null,
      cache_key: isKoraputRef ? 'ref_koraput_buildings' : 'demo_sample_footprints',
      dataset: findDatasetByKey('google_open_buildings_v3'),
    },
    {
      id: `lyr-${projectId.slice(0, 8)}-dem`,
      project_id: projectId,
      layer_key: 'dem_slope',
      status: 'READY',
      retrieved_at: nowIso,
      feature_count: null,
      bbox,
      summary_metrics: {
        data_source_mode: modeRas,
        slope_mean_deg: isKoraputRef ? 8.2 : 5.1,
        elevation_min_m: isKoraputRef ? 860 : 280,
        elevation_max_m: isKoraputRef ? 1290 : 410,
      },
      error_message: null,
      cache_key: 'dem_glo30',
      dataset: findDatasetByKey('copernicus_dem_glo30'),
    },
    {
      id: `lyr-${projectId.slice(0, 8)}-worldcover`,
      project_id: projectId,
      layer_key: 'landcover',
      status: 'READY',
      retrieved_at: nowIso,
      feature_count: null,
      bbox,
      summary_metrics: {
        data_source_mode: modeRas,
        tree_cover_share: isKoraputRef ? 0.36 : 0.22,
        water_share: 0.02,
      },
      error_message: null,
      cache_key: 'esa_worldcover_10m',
      dataset: findDatasetByKey('esa_worldcover_10m'),
    },
    {
      id: `lyr-${projectId.slice(0, 8)}-nightlights`,
      project_id: projectId,
      layer_key: 'nightlights',
      status: 'READY',
      retrieved_at: nowIso,
      feature_count: null,
      bbox,
      summary_metrics: {
        data_source_mode: isKoraputRef ? 'LOCAL_GEOTIFF_EXTRACT' : 'DEMO_REFERENCE_PROXY',
        is_unavailable: false,
      },
      error_message: null,
      cache_key: 'viirs_dnb_2024',
      dataset: findDatasetByKey('nasa_viirs_dnb_monthly'),
    },
    {
      id: `lyr-${projectId.slice(0, 8)}-solar`,
      project_id: projectId,
      layer_key: 'solar_climatology',
      status: 'READY',
      retrieved_at: nowIso,
      feature_count: 12,
      bbox,
      summary_metrics: {
        data_source_mode: isKoraputRef ? 'NASA_POWER_LOCAL_EXTRACT' : 'DEMO_SOLAR_ESTIMATE',
        worst_month: 'AUG',
        worst_ghi_kwh_m2_day: isKoraputRef ? 3.43 : 3.85,
        annual_mean_ghi_kwh_m2_day: isKoraputRef ? 4.9 : 5.15,
      },
      error_message: null,
      cache_key: 'nasa_power_climatology',
      dataset: findDatasetByKey('nasa_power_solar_t2m'),
    },
    {
      id: `lyr-${projectId.slice(0, 8)}-osm`,
      project_id: projectId,
      layer_key: 'osm_features',
      status: 'READY',
      retrieved_at: nowIso,
      feature_count: osmCount,
      bbox,
      summary_metrics: {
        data_source_mode: isKoraputRef ? 'LOCAL_OSM_EXTRACT' : 'DEMO_OSM_PROXY',
      },
      error_message: null,
      cache_key: 'osm_features',
      dataset: findDatasetByKey('osm_and_census_2011'),
    },
  ];
}

function createInitialKoraputInfraAssets(projectId: string): InfrastructureAssetDto[] {
  const nowIso = '2026-11-06T00:00:00Z';
  return [
    {
      id: 'asset-osm-substation-nandapur',
      project_id: projectId,
      asset_type: 'SUBSTATION',
      name: '33/11 kV Nandapur Primary Distribution Substation',
      voltage_kv: 33.0,
      rating_kva: 3150,
      provenance: 'OSM_MAPPED',
      quality_tag: 'ESTIMATED',
      dataset_id: 'ds-osm-census',
      source_note: 'Mapped OpenStreetMap 33/11 kV primary source substation (field survey required).',
      attributes: { operator: 'TPSODL' },
      geojson_geometry: { type: 'Point', coordinates: [82.692, 18.538] },
      updated_at: nowIso,
    },
    {
      id: 'asset-osm-11kv-bheja-spur',
      project_id: projectId,
      asset_type: 'LINE_11KV',
      name: '11 kV Nandapur–Bheja Rural Distribution Feeder',
      voltage_kv: 11.0,
      rating_kva: null,
      provenance: 'OSM_MAPPED',
      quality_tag: 'ESTIMATED',
      dataset_id: 'ds-osm-census',
      source_note: 'Existing 11 kV feeder reaching Bheja Core (CL-01).',
      attributes: { conductor: 'ACSR Weasel' },
      geojson_geometry: {
        type: 'LineString',
        coordinates: [
          [82.692, 18.538],
          [82.701, 18.545],
          [82.709833, 18.55195],
          [82.7145, 18.5542],
          [82.718, 18.556],
        ],
      },
      updated_at: nowIso,
    },
    {
      id: 'asset-osm-dt-bheja-core',
      project_id: projectId,
      asset_type: 'DT',
      name: 'Existing 63 kVA Distribution Transformer (Bheja Core DT-01)',
      voltage_kv: 11.0,
      rating_kva: 63,
      provenance: 'OSM_MAPPED',
      quality_tag: 'ESTIMATED',
      dataset_id: 'ds-osm-census',
      source_note: 'Serves Bheja Main Village Core (CL-01).',
      attributes: { operator: 'TPSODL' },
      geojson_geometry: { type: 'Point', coordinates: [82.718, 18.556] },
      updated_at: nowIso,
    },
    {
      id: 'asset-tiein-bheja-south',
      project_id: projectId,
      asset_type: 'TIE_IN',
      name: '25 kVA DT-02 / 11 kV Tapping Node (Bheja South Road)',
      voltage_kv: 11.0,
      rating_kva: 25,
      provenance: 'USER_ASSUMED',
      quality_tag: 'ASSUMED',
      dataset_id: null,
      source_note: 'Reference demo 11 kV tapping point at Bheja South Junction for feeder extension routing.',
      attributes: {},
      geojson_geometry: { type: 'Point', coordinates: [82.709833, 18.55195] },
      updated_at: nowIso,
    },
  ];
}

function createDemoProjectRecord(ownerId: string): StoredProjectRecord {
  const ref = getKoraputReferenceBundle();
  const areaKm2 = computeGeometryAreaKm2(KORAPUT_BHEJA_POLYGON, 32644);
  const { bbox } = computeGeometryCentroidAndBbox(KORAPUT_BHEJA_POLYGON);
  const censusBheja = REFERENCE_ADMIN_UNITS.find((u) => u.lgd_code === '398712')?.census_info ?? null;
  const nowIso = '2026-11-16T08:00:00Z';

  return {
    project: {
      id: DEMO_PROJECT_ID,
      owner_id: ownerId,
      name: 'Koraput — Nandapur Block (Village Bheja Pre-Feasibility Demo)',
      description:
        'Reference pre-feasibility DPR project for Village Bheja (LGD 398712, Census 428914) in Nandapur Block, Koraput District, Odisha.',
      scheme: 'DA-JGUA / RDSS',
      target_state: 'Odisha',
      target_district: 'Koraput',
      target_block: 'Nandapur',
      village_names: 'Bheja, Podapadar Tola, Maliaguda PVTG Hamlet',
      base_year: 2026,
      horizon_years: 10,
      discount_rate: 0.08,
      load_tier: 'TIER_3_STANDARD',
      metric_epsg: 32644,
      status: 'DATA_READY',
      version: 1,
      created_at: nowIso,
      updated_at: nowIso,
      aoi: {
        boundary_source: 'HARMONISED',
        area_km2: areaKm2,
        lgd_code: '398712',
        census2011_code: '428914',
        upload_filename: null,
        original_crs: 'EPSG:4326',
        warnings: [],
        geojson_geometry: KORAPUT_BHEJA_POLYGON,
      },
    },
    censusInfo: censusBheja,
    layers: buildAcquiredLayersForProject(
      DEMO_PROJECT_ID,
      bbox,
      ref.buildings.features.length,
      KORAPUT_OSM_FEATURES_FC.features.length,
      true,
      false,
    ),
    isKoraputReference: true,
    hasSampleDemoGeometry: false,
    customBuildingsFc: null,
    customOsmFc: null,
    clusterParams: {
      eps_m: 150,
      min_samples: 5,
      household_alpha: 0.9,
      nl_electrified_min: 0.75,
      nl_unserved_max: 0.2,
    },
    infraAssets: createInitialKoraputInfraAssets(DEMO_PROJECT_ID),
    settings: createDefaultSettingsForProject(DEMO_PROJECT_ID, 'TIER_3_STANDARD'),
    verifications: [],
    verificationImports: [],
    activeScenarioKey: 'HYBRID_OPTIMAL',
    manualOverridesByClusterLabel: {},
    rates: createDefaultRatesList(DEMO_PROJECT_ID),
    exportRecords: [],
    jobs: [],
  };
}

function loadStoreMap(bucketId: string): Record<string, StoredProjectRecord> {
  const storageKey = `${STORE_KEY_PREFIX}${bucketId}`;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, StoredProjectRecord>;
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to fresh seed if corrupted
    }
  }
  const seeded: Record<string, StoredProjectRecord> = {
    [DEMO_PROJECT_ID]: createDemoProjectRecord(bucketId),
  };
  saveStoreMap(bucketId, seeded);
  return seeded;
}

function saveStoreMap(bucketId: string, map: Record<string, StoredProjectRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORE_KEY_PREFIX}${bucketId}`, JSON.stringify(map));
  } catch {
    // Ignore storage quota exceptions cleanly
  }
}

function getRecordOrThrow(projectId: string): {
  bucketId: string;
  map: Record<string, StoredProjectRecord>;
  record: StoredProjectRecord;
} {
  const bucketId = activeBucketId();
  const map = loadStoreMap(bucketId);
  const record = map[projectId];
  if (!record) {
    throw new Error(`Project '${projectId}' not found in your demo workspace.`);
  }
  return { bucketId, map, record };
}

function saveRecord(
  bucketId: string,
  map: Record<string, StoredProjectRecord>,
  record: StoredProjectRecord,
): void {
  map[record.project.id] = record;
  saveStoreMap(bucketId, map);
}

// Recompute full derived engineering state deterministically from stored inputs
export function deriveProjectState(record: StoredProjectRecord): DerivedProjectState {
  const { project, layers, infraAssets, settings, rates } = record;
  const ref = getKoraputReferenceBundle();

  const buildingsFc: GeoJSON.FeatureCollection =
    record.customBuildingsFc ??
    (record.isKoraputReference && layers.length > 0
      ? ref.buildings
      : { type: 'FeatureCollection', features: [] });

  const osmFc: GeoJSON.FeatureCollection =
    record.customOsmFc ??
    (record.isKoraputReference && layers.length > 0
      ? KORAPUT_OSM_FEATURES_FC
      : { type: 'FeatureCollection', features: [] });

  const buildingsParsed = parseBuildingsFromFeatureCollection(buildingsFc, project.metric_epsg);
  const roads = osmFc.features
    .filter((f) => String((f.properties as Record<string, unknown> | null)?.feature_type ?? '') === 'road')
    .map((f) => f.geometry)
    .filter((g): g is GeoJSON.Geometry => Boolean(g));
  const waterways = osmFc.features
    .filter((f) => String((f.properties as Record<string, unknown> | null)?.feature_type ?? '') === 'waterway')
    .map((f) => f.geometry)
    .filter((g): g is GeoJSON.Geometry => Boolean(g));

  const nlLayer = layers.find((l) => l.layer_key === 'nightlights');
  const hasNightlights = Boolean(nlLayer && nlLayer.summary_metrics?.is_unavailable !== true);

  const clustered = runClusteringAndClassification({
    projectId: project.id,
    buildings: buildingsParsed,
    infraAssets,
    roads,
    clusterParams: record.clusterParams,
    metricEpsg: project.metric_epsg,
    hasNightlights,
    isKoraputReference: record.isKoraputReference,
  });

  // Replay append-only verification ledger over matching clusters (target_id or cluster_label)
  const reversedIds = new Set(
    record.verifications.map((r) => r.reverses_id).filter((id): id is string => Boolean(id)),
  );
  const activeVerifications = record.verifications.filter(
    (r) => !r.reverses_id && !reversedIds.has(r.id),
  );
  const clustersWithVerif: ClusterDto[] = clustered.clusters.map((cl) => {
    const matches = activeVerifications.filter(
      (v) => v.target_id === cl.id || v.cluster_label === cl.label,
    );
    const latest = matches[matches.length - 1];
    if (!latest) return cl;
    const nv = latest.new_value ?? {};
    const vState = (String(nv.verification_state ?? 'FIELD_VERIFIED') as VerificationState);
    const vClass = nv.verified_class ? String(nv.verified_class) : null;
    const vHh =
      typeof nv.est_households === 'number' && Number.isFinite(nv.est_households)
        ? nv.est_households
        : cl.est_households;
    return {
      ...cl,
      verification_state: vState,
      verified_class: vClass,
      est_households: vHh,
    };
  });

  const totalClusters = clustersWithVerif.length;
  const verifiedClusters = clustersWithVerif.filter((c) => c.verification_state !== 'UNVERIFIED');
  const totalHh = clustersWithVerif.reduce((s, c) => s + c.est_households, 0);
  const verifiedHh = verifiedClusters.reduce((s, c) => s + c.est_households, 0);
  const verifPct = totalHh > 0 ? Number(((verifiedHh / totalHh) * 100).toFixed(1)) : 0;

  const censusReconciliation = computeCensusReconciliation({
    censusInfo: record.censusInfo,
    census2011Code: project.aoi?.census2011_code ?? null,
    villageName: project.village_names ?? null,
    baseYear: project.base_year,
    clusters: clustersWithVerif,
  });

  const clusterGeoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: clustersWithVerif.map((c) => ({
      type: 'Feature',
      properties: {
        id: c.id,
        label: c.label,
        name: c.name,
        n_detected: c.n_detected,
        est_households: c.est_households,
        proxy_class: c.proxy_class,
        verification_state: c.verification_state,
        verified_class: c.verified_class,
        d_infra_m: c.d_infra_m,
        nl_lightscore: c.evidence.nl_lightscore,
      },
      geometry: c.geojson_geometry,
    })),
  };

  const settlements: ClusterListResponseDto = {
    project_id: project.id,
    cluster_run_id: clustered.clusterRunId,
    params: {
      eps_m: record.clusterParams.eps_m,
      min_samples: record.clusterParams.min_samples,
      household_alpha: record.clusterParams.household_alpha,
    },
    items: clustersWithVerif,
    geojson: clusterGeoJson,
    census_reconciliation: censusReconciliation,
    verification_coverage_pct: verifPct,
  };

  const ledger: VerificationLedgerDto = {
    project_id: project.id,
    total_clusters: totalClusters,
    verified_clusters: verifiedClusters.length,
    total_households: totalHh,
    verified_households: verifiedHh,
    verification_coverage_pct: verifPct,
    records: [...record.verifications].reverse(),
    imports: [...record.verificationImports].reverse(),
  };

  const gridMaxM =
    settings.find((s) => s.key === 'grid_max_terrain_distance_m')?.value ?? 3500;
  const gapAnalysis = runProjectGapAnalysis({
    projectId: project.id,
    clusters: clustersWithVerif,
    infraAssets,
    waterways,
    metricEpsg: project.metric_epsg,
    gridMaxTerrainM: gridMaxM,
  });

  const demand = computeProjectDemandSummary({
    projectId: project.id,
    clusters: clustersWithVerif,
    horizonYears: project.horizon_years,
    settings,
  });

  const solarLayer = layers.find((l) => l.layer_key === 'solar_climatology');
  const worstGhi =
    typeof solarLayer?.summary_metrics?.worst_ghi_kwh_m2_day === 'number'
      ? solarLayer.summary_metrics.worst_ghi_kwh_m2_day
      : ref.solar.worst_ghi_kwh_m2_day;

  const builtScenarios = buildAllScenariosForProject({
    projectId: project.id,
    clusters: clustersWithVerif,
    buildingCoordsByClusterId: clustered.buildingCoordsByClusterId,
    demand,
    gapAnalysis,
    infraAssets,
    worstGhiKwhM2Day: worstGhi,
    metricEpsg: project.metric_epsg,
    activeScenarioKey: record.activeScenarioKey,
    manualOverridesByClusterLabel: record.manualOverridesByClusterLabel,
  });

  const scenariosList: PlanningScenarioListDto = {
    project_id: project.id,
    active_scenario_key: builtScenarios.active_scenario_key,
    active_scenario: builtScenarios.active_scenario,
    scenarios: builtScenarios.scenarios,
  };

  const comparison = buildProjectScenarioComparison({
    projectId: project.id,
    scheme: project.scheme,
    discountRate: project.discount_rate,
    horizonYears: project.horizon_years,
    clusters: clustersWithVerif,
    scenarios: builtScenarios.scenarios,
    activeScenario: builtScenarios.active_scenario,
    rates,
  });

  const preflight = evaluateDprPreflight({
    projectId: project.id,
    projectVersion: project.version,
    activeScenario: builtScenarios.active_scenario,
    comparison,
    clustersCount: clustersWithVerif.length,
    verificationCoveragePct: verifPct,
    verifiedRecordsCount: activeVerifications.length,
    hasExistingInfra: infraAssets.length > 0,
    boundarySource: project.aoi?.boundary_source ?? 'UNSET',
    censusDeltaPct: censusReconciliation.delta_pct,
    hasSampleDemoGeometry: record.hasSampleDemoGeometry,
  });

  const infraList: InfrastructureListDto = {
    project_id: project.id,
    has_existing_infra: infraAssets.length > 0,
    items: infraAssets,
    geojson: {
      type: 'FeatureCollection',
      features: infraAssets.map((a) => ({
        type: 'Feature',
        properties: {
          id: a.id,
          asset_type: a.asset_type,
          name: a.name,
          voltage_kv: a.voltage_kv,
          rating_kva: a.rating_kva,
          provenance: a.provenance,
          quality_tag: a.quality_tag,
        },
        geometry: a.geojson_geometry,
      })),
    },
  };

  const settingsList: ProjectSettingsListDto = {
    project_id: project.id,
    user_edited_count: settings.filter((s) => s.is_user_edited).length,
    items: settings,
  };

  return {
    project,
    layers,
    buildingsFc,
    osmFc,
    settlements,
    ledger,
    infrastructure: infraList,
    gapAnalysis,
    settingsList,
    demand,
    scenariosList,
    comparison,
    preflight,
    exportsList: {
      project_id: project.id,
      total_exports: record.exportRecords.length,
      items: [...record.exportRecords].reverse(),
    },
    jobs: record.jobs,
  };
}

// ---------------------------------------------------------------------------
// Store Operations Invoked by demoApiRouter.ts
// ---------------------------------------------------------------------------

export function listProjectsForCurrentUser(): ProjectDto[] {
  const bucketId = activeBucketId();
  const map = loadStoreMap(bucketId);
  return Object.values(map)
    .map((r) => r.project)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getDerivedProject(projectId: string): DerivedProjectState {
  const { record } = getRecordOrThrow(projectId);
  return deriveProjectState(record);
}

export function getProjectRates(projectId: string): ProjectRateListDto {
  return getRecordOrThrow(projectId).record.rates;
}

export function createNewDemoProject(payload: Record<string, unknown>): ProjectDto {
  const bucketId = activeBucketId();
  const map = loadStoreMap(bucketId);
  const newId = makeUuid();
  const nowIso = new Date().toISOString();
  const loadTier = String(payload.load_tier ?? 'TIER_3_STANDARD');

  const project: ProjectDto = {
    id: newId,
    owner_id: bucketId,
    name: String(payload.name ?? 'New Village Study').trim(),
    description: payload.description ? String(payload.description) : null,
    scheme: String(payload.scheme ?? 'DA-JGUA / RDSS'),
    target_state: payload.target_state ? String(payload.target_state) : null,
    target_district: payload.target_district ? String(payload.target_district) : null,
    target_block: payload.target_block ? String(payload.target_block) : null,
    village_names: payload.village_names ? String(payload.village_names) : null,
    base_year: Number(payload.base_year ?? 2026),
    horizon_years: Number(payload.horizon_years ?? 10),
    discount_rate: Number(payload.discount_rate ?? 0.08),
    load_tier: loadTier,
    metric_epsg: 32644,
    status: 'DRAFT',
    version: 1,
    created_at: nowIso,
    updated_at: nowIso,
    aoi: null,
  };

  const record: StoredProjectRecord = {
    project,
    censusInfo: null,
    layers: [],
    isKoraputReference: false,
    hasSampleDemoGeometry: false,
    customBuildingsFc: null,
    customOsmFc: null,
    clusterParams: {
      eps_m: 150,
      min_samples: 5,
      household_alpha: 0.9,
      nl_electrified_min: 0.75,
      nl_unserved_max: 0.2,
    },
    infraAssets: [],
    settings: createDefaultSettingsForProject(newId, loadTier),
    verifications: [],
    verificationImports: [],
    activeScenarioKey: 'HYBRID_OPTIMAL',
    manualOverridesByClusterLabel: {},
    rates: createDefaultRatesList(newId),
    exportRecords: [],
    jobs: [],
  };
  saveRecord(bucketId, map, record);
  return project;
}

export function setProjectAoiJson(
  projectId: string,
  payload: { mode: string; lgd_code?: string; geojson_geometry?: GeoJSON.Geometry },
) {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const nowIso = new Date().toISOString();

  if (payload.mode === 'ADMIN_UNIT' && payload.lgd_code) {
    const unit = REFERENCE_ADMIN_UNITS.find((u) => u.lgd_code === payload.lgd_code);
    if (!unit) {
      throw new Error(`Administrative unit LGD '${payload.lgd_code}' not found.`);
    }
    record.censusInfo = unit.census_info;
    record.isKoraputReference = unit.lgd_code === '398712';
    record.project = {
      ...record.project,
      metric_epsg: unit.metric_epsg,
      status: 'AOI_VALIDATED',
      version: record.project.version + 1,
      updated_at: nowIso,
      village_names: record.project.village_names ?? unit.name,
      aoi: {
        boundary_source: unit.boundary_source,
        area_km2: unit.area_km2,
        lgd_code: unit.lgd_code,
        census2011_code: unit.census2011_code,
        upload_filename: null,
        original_crs: 'EPSG:4326',
        warnings: unit.warnings,
        geojson_geometry: unit.geometry,
      },
    };
  } else if (payload.geojson_geometry) {
    const metricEpsg = selectMetricEpsgForGeometry(payload.geojson_geometry);
    const areaKm2 = Math.max(0.05, computeGeometryAreaKm2(payload.geojson_geometry, metricEpsg));
    record.censusInfo = null;
    record.isKoraputReference = false;
    record.project = {
      ...record.project,
      metric_epsg: metricEpsg,
      status: 'AOI_VALIDATED',
      version: record.project.version + 1,
      updated_at: nowIso,
      aoi: {
        boundary_source: 'USER_DRAWN',
        area_km2: areaKm2,
        lgd_code: null,
        census2011_code: null,
        upload_filename: null,
        original_crs: 'EPSG:4326',
        warnings: [],
        geojson_geometry: payload.geojson_geometry,
      },
    };
  } else {
    throw new Error('Specify either a valid village LGD code or polygon geometry.');
  }

  saveRecord(bucketId, map, record);
  return {
    project_id: projectId,
    ...record.project.aoi!,
    metric_epsg: record.project.metric_epsg,
  };
}

export function setProjectAoiUploadedFile(
  projectId: string,
  filename: string,
  textContent: string,
) {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const { geometry } = parseUploadedGeoJsonOrKmlGeometry(filename, textContent);
  const metricEpsg = selectMetricEpsgForGeometry(geometry);
  const areaKm2 = Math.max(0.05, computeGeometryAreaKm2(geometry, metricEpsg));
  const nowIso = new Date().toISOString();

  record.censusInfo = null;
  record.isKoraputReference = false;
  record.project = {
    ...record.project,
    metric_epsg: metricEpsg,
    status: 'AOI_VALIDATED',
    version: record.project.version + 1,
    updated_at: nowIso,
    aoi: {
      boundary_source: 'USER_UPLOAD',
      area_km2: areaKm2,
      lgd_code: null,
      census2011_code: null,
      upload_filename: filename,
      original_crs: 'EPSG:4326',
      warnings: [],
      geojson_geometry: geometry,
    },
  };
  saveRecord(bucketId, map, record);
  return {
    project_id: projectId,
    ...record.project.aoi,
    metric_epsg: metricEpsg,
  };
}

export function patchDemoProject(projectId: string, payload: Record<string, unknown>): ProjectDto {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const prevTier = record.project.load_tier;
  const nextTier = String(payload.load_tier ?? prevTier);
  const nextProj: ProjectDto = {
    ...record.project,
    name: payload.name !== undefined ? String(payload.name).trim() : record.project.name,
    description:
      payload.description !== undefined
        ? payload.description
          ? String(payload.description)
          : null
        : record.project.description,
    scheme: payload.scheme !== undefined ? String(payload.scheme) : record.project.scheme,
    load_tier: nextTier,
    target_state:
      payload.target_state !== undefined
        ? payload.target_state
          ? String(payload.target_state)
          : null
        : record.project.target_state,
    target_district:
      payload.target_district !== undefined
        ? payload.target_district
          ? String(payload.target_district)
          : null
        : record.project.target_district,
    target_block:
      payload.target_block !== undefined
        ? payload.target_block
          ? String(payload.target_block)
          : null
        : record.project.target_block,
    village_names:
      payload.village_names !== undefined
        ? payload.village_names
          ? String(payload.village_names)
          : null
        : record.project.village_names,
    base_year: payload.base_year !== undefined ? Number(payload.base_year) : record.project.base_year,
    horizon_years:
      payload.horizon_years !== undefined ? Number(payload.horizon_years) : record.project.horizon_years,
    discount_rate:
      payload.discount_rate !== undefined ? Number(payload.discount_rate) : record.project.discount_rate,
    version: record.project.version + 1,
    updated_at: new Date().toISOString(),
  };

  if (nextTier !== prevTier) {
    record.settings = createDefaultSettingsForProject(projectId, nextTier);
  }
  record.project = nextProj;
  saveRecord(bucketId, map, record);
  return nextProj;
}

export function duplicateDemoProject(projectId: string): ProjectDto {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const newId = makeUuid();
  const nowIso = new Date().toISOString();
  const clone: StoredProjectRecord = JSON.parse(JSON.stringify(record)) as StoredProjectRecord;
  clone.project = {
    ...clone.project,
    id: newId,
    owner_id: bucketId,
    name: `${clone.project.name} (Copy)`,
    version: 1,
    created_at: nowIso,
    updated_at: nowIso,
  };
  clone.settings = clone.settings.map((s) => ({ ...s, project_id: newId }));
  clone.rates = {
    ...clone.rates,
    project_id: newId,
    items: clone.rates.items.map((r) => ({ ...r, project_id: newId })),
  };
  clone.infraAssets = clone.infraAssets.map((a) => ({ ...a, project_id: newId }));
  clone.exportRecords = [];
  saveRecord(bucketId, map, clone);
  return clone.project;
}

export function deleteDemoProject(projectId: string): void {
  const { bucketId, map } = getRecordOrThrow(projectId);
  delete map[projectId];
  saveStoreMap(bucketId, map);
}

export function acquireDataForProject(projectId: string): JobStatusDto {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const ref = getKoraputReferenceBundle();
  const aoiGeom = record.project.aoi?.geojson_geometry ?? KORAPUT_BHEJA_POLYGON;
  const { bbox } = computeGeometryCentroidAndBbox(aoiGeom);
  const nowIso = new Date().toISOString();

  if (record.isKoraputReference) {
    record.hasSampleDemoGeometry = false;
    record.customBuildingsFc = null;
    record.customOsmFc = null;
    record.layers = buildAcquiredLayersForProject(
      projectId,
      bbox,
      ref.buildings.features.length,
      KORAPUT_OSM_FEATURES_FC.features.length,
      true,
      false,
    );
    if (record.infraAssets.length === 0) {
      record.infraAssets = createInitialKoraputInfraAssets(projectId);
    }
  } else {
    record.hasSampleDemoGeometry = true;
    const demoBuildings = buildDemoBuildingsInsidePolygon(
      aoiGeom,
      record.project.metric_epsg,
      record.project.village_names ?? record.project.name,
    );
    record.customBuildingsFc = demoBuildings;
    record.layers = buildAcquiredLayersForProject(
      projectId,
      bbox,
      demoBuildings.features.length,
      0,
      false,
      true,
    );
  }

  const job: JobStatusDto = {
    id: `job-${makeUuid().slice(0, 8)}`,
    project_id: projectId,
    job_type: 'DATA_ACQUISITION',
    status: 'SUCCEEDED',
    progress: 100,
    stage: 'Completed',
    params: null,
    result: { layers_ready: record.layers.length },
    error: null,
    attempts: 1,
    created_by: getStoredDemoUser()?.display_name ?? null,
    created_at: nowIso,
    updated_at: nowIso,
    finished_at: nowIso,
  };
  record.jobs = [job, ...record.jobs.slice(0, 9)];
  record.project = {
    ...record.project,
    status: 'DATA_READY',
    version: record.project.version + 1,
    updated_at: nowIso,
  };
  saveRecord(bucketId, map, record);
  return job;
}

export function uploadCustomLayerForProject(
  projectId: string,
  layerKey: string,
  filename: string,
  textContent: string,
): ProjectLayerDto {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const { featureCollection } = parseUploadedGeoJsonOrKmlGeometry(filename, textContent);
  const nowIso = new Date().toISOString();
  const aoiGeom = record.project.aoi?.geojson_geometry ?? KORAPUT_BHEJA_POLYGON;
  const { bbox } = computeGeometryCentroidAndBbox(aoiGeom);

  if (layerKey === 'buildings') {
    record.customBuildingsFc = featureCollection;
    record.hasSampleDemoGeometry = false;
  } else if (layerKey === 'osm_features') {
    record.customOsmFc = featureCollection;
  }

  const newLayer: ProjectLayerDto = {
    id: `lyr-${projectId.slice(0, 8)}-${layerKey}`,
    project_id: projectId,
    layer_key: layerKey,
    status: 'READY',
    retrieved_at: nowIso,
    feature_count: featureCollection.features.length,
    bbox,
    summary_metrics: { data_source_mode: 'USER_UPLOAD', filename },
    error_message: null,
    cache_key: `user_upload_${filename}`,
    dataset: {
      id: `ds-upload-${layerKey}`,
      key: 'user_upload',
      name: `User Uploaded File (${filename})`,
      provider: 'Local Planner Upload',
      url: '',
      licence: 'Project Internal',
      licence_url: null,
      attribution_text: 'User Uploaded GIS Layer',
      spatial_resolution: 'Uploaded Vector',
      temporal_coverage: String(new Date().getFullYear()),
      version: '1.0',
      is_non_commercial: false,
      notes: `Uploaded GIS file '${filename}'.`,
    },
  };

  record.layers = [...record.layers.filter((l) => l.layer_key !== layerKey), newLayer];
  record.project = {
    ...record.project,
    version: record.project.version + 1,
    updated_at: nowIso,
  };
  saveRecord(bucketId, map, record);
  return newLayer;
}

export function runProjectClustering(projectId: string, params: Partial<ClusteringRunParams>) {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  record.clusterParams = {
    eps_m: Number(params.eps_m ?? record.clusterParams.eps_m),
    min_samples: Number(params.min_samples ?? record.clusterParams.min_samples),
    household_alpha: Number(params.household_alpha ?? record.clusterParams.household_alpha),
    nl_electrified_min: Number(params.nl_electrified_min ?? record.clusterParams.nl_electrified_min),
    nl_unserved_max: Number(params.nl_unserved_max ?? record.clusterParams.nl_unserved_max),
  };
  record.project = {
    ...record.project,
    version: record.project.version + 1,
    updated_at: new Date().toISOString(),
  };
  saveRecord(bucketId, map, record);
  return deriveProjectState(record).settlements;
}

export function addVerificationEntry(projectId: string, payload: Record<string, unknown>) {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const derived = deriveProjectState(record);
  const targetId = String(payload.target_id ?? '');
  const cluster = derived.settlements.items.find((c) => c.id === targetId || c.label === targetId);
  const nowIso = new Date().toISOString();

  const rec: VerificationRecordDto = {
    id: makeUuid(),
    project_id: projectId,
    target_type: 'CLUSTER',
    target_id: cluster?.id ?? targetId,
    cluster_label: cluster?.label ?? null,
    attribute: 'verification_state',
    previous_value: {
      verification_state: cluster?.verification_state ?? 'UNVERIFIED',
      verified_class: cluster?.verified_class ?? null,
    },
    new_value: {
      verification_state: String(payload.verification_state ?? 'FIELD_VERIFIED'),
      verified_class: payload.verified_class ? String(payload.verified_class) : null,
      ...(typeof payload.verified_households === 'number'
        ? { est_households: payload.verified_households }
        : {}),
    },
    evidence_type: String(payload.evidence_type ?? 'GRAM_SABHA_SURVEY'),
    verifier_name: String(payload.verifier_name ?? 'Demo Field Team'),
    observed_on: String(payload.observed_on ?? nowIso.slice(0, 10)),
    note: String(payload.note ?? ''),
    import_batch_id: null,
    reverses_id: null,
    created_by: getStoredDemoUser()?.display_name ?? null,
    created_at: nowIso,
  };
  record.verifications.push(rec);
  record.project = { ...record.project, version: record.project.version + 1, updated_at: nowIso };
  saveRecord(bucketId, map, record);
  return rec;
}

export function reverseVerificationEntry(
  projectId: string,
  verificationId: string,
  payload: Record<string, unknown>,
) {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const orig = record.verifications.find((v) => v.id === verificationId);
  if (!orig) throw new Error('Verification record not found.');
  const nowIso = new Date().toISOString();
  const rev: VerificationRecordDto = {
    id: makeUuid(),
    project_id: projectId,
    target_type: orig.target_type,
    target_id: orig.target_id,
    cluster_label: orig.cluster_label,
    attribute: orig.attribute,
    previous_value: orig.new_value,
    new_value: orig.previous_value,
    evidence_type: orig.evidence_type,
    verifier_name: String(payload.verifier_name ?? 'Reversal'),
    observed_on: nowIso.slice(0, 10),
    note: String(payload.note ?? 'Reversal of verification record.'),
    import_batch_id: null,
    reverses_id: verificationId,
    created_by: getStoredDemoUser()?.display_name ?? null,
    created_at: nowIso,
  };
  record.verifications.push(rev);
  record.project = { ...record.project, version: record.project.version + 1, updated_at: nowIso };
  saveRecord(bucketId, map, record);
  return rev;
}

export function importVerificationsCsv(
  projectId: string,
  filename: string,
  csvText: string,
): VerificationImportDto {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const derived = deriveProjectState(record);
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const importId = makeUuid();
  const nowIso = new Date().toISOString();
  let matched = 0;
  let unmatched = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i]!.split(',').map((s) => s.trim());
    const label = cols[0] ?? '';
    const vState = cols[1] || 'FIELD_VERIFIED';
    const vClass = cols[2] || 'UNELECTRIFIED';
    const vHh = cols[3] ? Number(cols[3]) : null;
    const evType = cols[4] || 'FIELD_SURVEY';
    const verifier = cols[5] || 'CSV Field Import';
    const obsOn = cols[6] || nowIso.slice(0, 10);
    const note = cols[7] || `Imported from ${filename}`;

    const cluster = derived.settlements.items.find(
      (c) => c.label.toUpperCase() === label.toUpperCase(),
    );
    if (!cluster) {
      unmatched += 1;
      continue;
    }
    matched += 1;
    record.verifications.push({
      id: makeUuid(),
      project_id: projectId,
      target_type: 'CLUSTER',
      target_id: cluster.id,
      cluster_label: cluster.label,
      attribute: 'verification_state',
      previous_value: { verification_state: cluster.verification_state, verified_class: cluster.verified_class },
      new_value: {
        verification_state: vState,
        verified_class: vClass,
        ...(vHh !== null && Number.isFinite(vHh) ? { est_households: vHh } : {}),
      },
      evidence_type: evType,
      verifier_name: verifier,
      observed_on: obsOn,
      note,
      import_batch_id: importId,
      reverses_id: null,
      created_by: getStoredDemoUser()?.display_name ?? null,
      created_at: nowIso,
    });
  }

  const imp: VerificationImportDto = {
    id: importId,
    project_id: projectId,
    filename,
    row_count: Math.max(0, lines.length - 1),
    matched,
    unmatched,
    report: { filename, matched, unmatched },
    created_at: nowIso,
  };
  record.verificationImports.push(imp);
  record.project = { ...record.project, version: record.project.version + 1, updated_at: nowIso };
  saveRecord(bucketId, map, record);
  return imp;
}

export function addInfrastructureAsset(projectId: string, payload: Record<string, unknown>) {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const nowIso = new Date().toISOString();
  const lon = Number(payload.lon ?? 82.7265);
  const lat = Number(payload.lat ?? 18.5645);
  const prov = String(payload.provenance ?? 'USER_ASSUMED');
  const asset: InfrastructureAssetDto = {
    id: `ast-${makeUuid().slice(0, 8)}`,
    project_id: projectId,
    asset_type: String(payload.asset_type ?? 'TIE_IN'),
    name: String(payload.name ?? '11 kV Tie-In Point'),
    voltage_kv: payload.voltage_kv !== undefined ? Number(payload.voltage_kv) : 11.0,
    rating_kva: payload.rating_kva !== undefined && payload.rating_kva !== null ? Number(payload.rating_kva) : null,
    provenance: prov,
    quality_tag: prov === 'UTILITY_RECORD' || prov === 'FIELD_SURVEY' ? 'VERIFIED' : 'ASSUMED',
    dataset_id: null,
    source_note: String(payload.source_note ?? 'Map click placement'),
    attributes: {},
    geojson_geometry: { type: 'Point', coordinates: [lon, lat] },
    updated_at: nowIso,
  };
  record.infraAssets.push(asset);
  record.project = { ...record.project, version: record.project.version + 1, updated_at: nowIso };
  saveRecord(bucketId, map, record);
  return asset;
}

export function deleteInfrastructureAsset(projectId: string, assetId: string) {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  record.infraAssets = record.infraAssets.filter((a) => a.id !== assetId);
  record.project = {
    ...record.project,
    version: record.project.version + 1,
    updated_at: new Date().toISOString(),
  };
  saveRecord(bucketId, map, record);
}

export function uploadInfrastructureGeoJson(
  projectId: string,
  filename: string,
  textContent: string,
  provenance: string,
  sourceNote: string,
) {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const { featureCollection } = parseUploadedGeoJsonOrKmlGeometry(filename, textContent);
  const nowIso = new Date().toISOString();
  for (const feat of featureCollection.features) {
    if (!feat.geometry) continue;
    const props = (feat.properties ?? {}) as Record<string, unknown>;
    record.infraAssets.push({
      id: `ast-${makeUuid().slice(0, 8)}`,
      project_id: projectId,
      asset_type: String(props.asset_type ?? (feat.geometry.type === 'Point' ? 'TIE_IN' : 'LINE_11KV')),
      name: String(props.name ?? filename),
      voltage_kv: typeof props.voltage_kv === 'number' ? props.voltage_kv : 11.0,
      rating_kva: typeof props.rating_kva === 'number' ? props.rating_kva : null,
      provenance,
      quality_tag: provenance === 'UTILITY_RECORD' ? 'VERIFIED' : 'ASSUMED',
      dataset_id: null,
      source_note: sourceNote,
      attributes: {},
      geojson_geometry: feat.geometry,
      updated_at: nowIso,
    });
  }
  record.project = { ...record.project, version: record.project.version + 1, updated_at: nowIso };
  saveRecord(bucketId, map, record);
  return deriveProjectState(record).infrastructure;
}

export function patchProjectSettings(
  projectId: string,
  updates: Array<{ key: string; value: number }>,
) {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const nowIso = new Date().toISOString();
  const updMap = new Map(updates.map((u) => [u.key, u.value]));
  record.settings = record.settings.map((s) => {
    const val = updMap.get(s.key);
    if (val === undefined) return s;
    const isEdited = Math.abs(val - s.default_value) > 1e-6;
    return {
      ...s,
      value: val,
      quality_tag: isEdited ? 'USER_ENTERED' : 'ESTIMATED',
      is_user_edited: isEdited,
      updated_at: nowIso,
    };
  });
  record.project = { ...record.project, version: record.project.version + 1, updated_at: nowIso };
  saveRecord(bucketId, map, record);
  return deriveProjectState(record).settingsList;
}

export function resetProjectSettings(projectId: string) {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  record.settings = createDefaultSettingsForProject(projectId, record.project.load_tier);
  record.project = {
    ...record.project,
    version: record.project.version + 1,
    updated_at: new Date().toISOString(),
  };
  saveRecord(bucketId, map, record);
  return deriveProjectState(record).settingsList;
}

export function generateProjectScenario(
  projectId: string,
  scenarioKey: string,
  preserveOverrides: boolean,
) {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  record.activeScenarioKey = scenarioKey;
  if (!preserveOverrides) {
    record.manualOverridesByClusterLabel = {};
  }
  record.project = {
    ...record.project,
    version: record.project.version + 1,
    updated_at: new Date().toISOString(),
  };
  saveRecord(bucketId, map, record);
  return deriveProjectState(record).scenariosList;
}

export function overrideClusterModalityInScenario(
  projectId: string,
  _scenarioId: string,
  clusterId: string,
  modality: string,
) {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const derived = deriveProjectState(record);
  const cluster = derived.settlements.items.find((c) => c.id === clusterId || c.label === clusterId);
  if (cluster) {
    record.manualOverridesByClusterLabel[cluster.label] = modality;
  }
  record.project = {
    ...record.project,
    version: record.project.version + 1,
    updated_at: new Date().toISOString(),
  };
  saveRecord(bucketId, map, record);
  return deriveProjectState(record).scenariosList.active_scenario;
}

export function updateProjectRateItem(
  projectId: string,
  itemCode: string,
  rateInr: number | null,
  citation?: string,
): ProjectRateListDto {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const nowIso = new Date().toISOString();
  const nextItems = record.rates.items.map((item) => {
    if (item.item_code !== itemCode) return item;
    return {
      ...item,
      rate_inr: rateInr,
      source_type: rateInr === null ? 'UNSET' : 'USER_EDITED',
      citation: citation?.trim() || item.citation,
      is_user_edited: true,
      updated_at: nowIso,
    };
  });
  const unsetCodes = nextItems.filter((i) => i.rate_inr === null).map((i) => i.item_code);
  record.rates = {
    ...record.rates,
    items: nextItems,
    unset_count: unsetCodes.length,
    unset_item_codes: unsetCodes,
    user_edited_count: nextItems.filter((i) => i.is_user_edited).length,
  };
  record.project = { ...record.project, version: record.project.version + 1, updated_at: nowIso };
  saveRecord(bucketId, map, record);
  return record.rates;
}

export function resetProjectRates(projectId: string): ProjectRateListDto {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  record.rates = createDefaultRatesList(projectId);
  record.project = {
    ...record.project,
    version: record.project.version + 1,
    updated_at: new Date().toISOString(),
  };
  saveRecord(bucketId, map, record);
  return record.rates;
}

export function importProjectRatesCsv(
  projectId: string,
  csvContent: string,
  templateName: string,
): SorCsvImportResponseDto {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const res = parseAndValidateSorCsv(projectId, csvContent, templateName);
  if (res.is_valid && res.rates) {
    record.rates = res.rates;
    record.project = {
      ...record.project,
      version: record.project.version + 1,
      updated_at: new Date().toISOString(),
    };
    saveRecord(bucketId, map, record);
  }
  return res;
}

export function pinComparisonScenario(
  projectId: string,
  scenarioId: string,
): ProjectScenarioComparisonDto {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const derived = deriveProjectState(record);
  const matched = derived.scenariosList.scenarios.find(
    (s) => s.id === scenarioId || s.scenario_key === scenarioId,
  );
  if (matched) {
    record.activeScenarioKey = matched.scenario_key;
    record.manualOverridesByClusterLabel = {};
    record.project = {
      ...record.project,
      version: record.project.version + 1,
      updated_at: new Date().toISOString(),
    };
    saveRecord(bucketId, map, record);
  }
  return deriveProjectState(record).comparison;
}

export function recordDemoExportArtifact(
  projectId: string,
  entry: Omit<ProjectExportRecordDto, 'id' | 'project_id' | 'created_at' | 'created_by'>,
): ProjectExportRecordDto {
  const { bucketId, map, record } = getRecordOrThrow(projectId);
  const full: ProjectExportRecordDto = {
    ...entry,
    id: `exp-${makeUuid().slice(0, 8)}`,
    project_id: projectId,
    created_by: getStoredDemoUser()?.display_name ?? 'Demo User',
    created_at: new Date().toISOString(),
  };
  record.exportRecords.push(full);
  saveRecord(bucketId, map, record);
  return full;
}
