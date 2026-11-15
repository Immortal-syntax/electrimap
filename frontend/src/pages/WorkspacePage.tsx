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

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Layers,
  LayoutList,
  Map as MapIcon,
  Settings,
} from 'lucide-react';
import { apiRequest } from '../lib/apiClient';
import { useSessionStore } from '../stores/sessionStore';
import { MapCanvas } from '../components/map/MapCanvas';
import {
  WORKSPACE_SECTIONS,
  normalizeWorkspaceSection,
  type WorkspaceSectionKey,
} from '../components/layout/navigationConfig';
import {
  DataManagementPanel,
  ProjectLayerDto,
  RasterOverlayKey,
} from '../components/workspace/DataManagementPanel';
import {
  ClusterListResponseDto,
  SettlementAssessmentPanel,
  VerificationLedgerDto,
} from '../components/workspace/SettlementAssessmentPanel';
import {
  InfrastructureAndDemandPanel,
  InfrastructureListDto,
  ProjectDemandSummaryDto,
  ProjectGapAnalysisDto,
  ProjectSettingsListDto,
} from '../components/workspace/InfrastructureAndDemandPanel';
import {
  EngineeringConstantListDto,
  NetworkEngineeringPanel,
  PlanningScenarioListDto,
} from '../components/workspace/NetworkEngineeringPanel';
import {
  CostAndScenarioComparisonPanel,
  ProjectRateListDto,
  ProjectScenarioComparisonDto,
  SorCsvImportResponseDto,
} from '../components/workspace/CostAndScenarioComparisonPanel';
import {
  DprExportCenterPanel,
  PreFlightReportDto,
  ProjectExportListDto,
} from '../components/workspace/DprExportCenterPanel';
import { ProjectOverviewDashboard } from '../components/workspace/ProjectOverviewDashboard';
import { Badge, ClassificationBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Callout } from '../components/ui/Callout';
import { Dialog } from '../components/ui/Dialog';
import { ErrorState } from '../components/ui/ErrorState';
import { Icon } from '../components/ui/Icon';
import { Input, Textarea } from '../components/ui/Input';
import type { JobStatusDto } from '../components/ui/JobProgress';
import { Select } from '../components/ui/Select';
import { LoadingState } from '../components/ui/Skeleton';
import { ProjectDto } from './ProjectsPage';

interface ReferenceGeoJsonPayload {
  villages: GeoJSON.FeatureCollection;
  buildings: GeoJSON.FeatureCollection;
  routes: GeoJSON.FeatureCollection;
}

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

export const WorkspacePage: React.FC = () => {
  const { id, section } = useParams<{ id: string; section?: string }>();
  const navigate = useNavigate();
  const { user, login } = useSessionStore();

  const activeSectionKey: WorkspaceSectionKey = normalizeWorkspaceSection(section);
  const isOverviewMode = activeSectionKey === 'overview';

  const [project, setProject] = useState<ProjectDto | null>(null);
  const [layers, setLayers] = useState<ProjectLayerDto[]>([]);
  const [buildingsGeoJson, setBuildingsGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [osmGeoJson, setOsmGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [routesGeoJson, setRoutesGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [settlements, setSettlements] = useState<ClusterListResponseDto | null>(null);
  const [verificationLedger, setVerificationLedger] = useState<VerificationLedgerDto | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  const [infrastructure, setInfrastructure] = useState<InfrastructureListDto | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<ProjectGapAnalysisDto | null>(null);
  const [settings, setSettings] = useState<ProjectSettingsListDto | null>(null);
  const [demand, setDemand] = useState<ProjectDemandSummaryDto | null>(null);
  const [scenariosState, setScenariosState] = useState<PlanningScenarioListDto | null>(null);
  const [engineeringConstants, setEngineeringConstants] =
    useState<EngineeringConstantListDto | null>(null);
  const [ratesState, setRatesState] = useState<ProjectRateListDto | null>(null);
  const [comparisonState, setComparisonState] =
    useState<ProjectScenarioComparisonDto | null>(null);
  const [preflightState, setPreflightState] = useState<PreFlightReportDto | null>(null);
  const [exportLogState, setExportLogState] = useState<ProjectExportListDto | null>(null);
  const [jobsState, setJobsState] = useState<JobStatusDto[]>([]);
  const [placeTieInModeActive, setPlaceTieInModeActive] = useState<boolean>(false);
  const [showMapInFocusedStage, setShowMapInFocusedStage] = useState<boolean>(false);
  const [showAllStagesInOverview, setShowAllStagesInOverview] = useState<boolean>(false);
  const [showMapInspectorDrawer, setShowMapInspectorDrawer] = useState<boolean>(false);

  const [visibleVectorLayers, setVisibleVectorLayers] = useState<Record<string, boolean>>({
    buildings: true,
    osm_features: true,
  });
  const [activeRasterOverlay, setActiveRasterOverlay] = useState<RasterOverlayKey>('none');
  const [rasterOpacity, setRasterOpacity] = useState<number>(0.65);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapActionError, setMapActionError] = useState<string | null>(null);

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsName, setSettingsName] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsScheme, setSettingsScheme] = useState('DA-JGUA / RDSS');
  const [settingsLoadTier, setSettingsLoadTier] = useState('TIER_3_STANDARD');
  const [settingsStateName, setSettingsStateName] = useState('');
  const [settingsDistrict, setSettingsDistrict] = useState('');
  const [settingsBlock, setSettingsBlock] = useState('');
  const [settingsVillages, setSettingsVillages] = useState('');
  const [settingsBaseYear, setSettingsBaseYear] = useState(2026);
  const [settingsHorizonYears, setSettingsHorizonYears] = useState(10);
  const [settingsDiscountRate, setSettingsDiscountRate] = useState(0.08);

  const fetchScenariosAndConstants = useCallback(async (projectId: string) => {
    const [scenRes, constRes, ratesRes, compRes, preflightRes, exportsRes, jobsRes] =
      await Promise.allSettled([
        apiRequest<PlanningScenarioListDto>(`/api/v1/projects/${projectId}/scenarios`),
        apiRequest<EngineeringConstantListDto>('/api/v1/engineering-constants'),
        apiRequest<ProjectRateListDto>(`/api/v1/projects/${projectId}/rates`),
        apiRequest<ProjectScenarioComparisonDto>(`/api/v1/projects/${projectId}/comparison`),
        apiRequest<PreFlightReportDto>(`/api/v1/projects/${projectId}/report/preflight`),
        apiRequest<ProjectExportListDto>(`/api/v1/projects/${projectId}/exports`),
        apiRequest<JobStatusDto[]>(`/api/v1/projects/${projectId}/jobs`),
      ]);
    const scenData = settledValue(scenRes);
    const constData = settledValue(constRes);
    const ratesData = settledValue(ratesRes);
    const compData = settledValue(compRes);
    const preflightData = settledValue(preflightRes);
    const exportsData = settledValue(exportsRes);
    const jobsData = settledValue(jobsRes);

    if (scenData) setScenariosState(scenData);
    if (constData) setEngineeringConstants(constData);
    if (ratesData) setRatesState(ratesData);
    if (compData) setComparisonState(compData);
    if (preflightData) setPreflightState(preflightData);
    if (exportsData) setExportLogState(exportsData);
    if (jobsData) setJobsState(jobsData);
  }, []);

  const fetchInfraAndDemand = useCallback(
    async (projectId: string) => {
      const [infraRes, gapRes, settingsRes, demandRes] = await Promise.allSettled([
        apiRequest<InfrastructureListDto>(`/api/v1/projects/${projectId}/infrastructure`),
        apiRequest<ProjectGapAnalysisDto>(`/api/v1/projects/${projectId}/gap-analysis`),
        apiRequest<ProjectSettingsListDto>(`/api/v1/projects/${projectId}/settings`),
        apiRequest<ProjectDemandSummaryDto>(`/api/v1/projects/${projectId}/demand`),
      ]);
      const infraData = settledValue(infraRes);
      const gapData = settledValue(gapRes);
      const settingsData = settledValue(settingsRes);
      const demandData = settledValue(demandRes);

      if (infraData) setInfrastructure(infraData);
      if (gapData) setGapAnalysis(gapData);
      if (settingsData) setSettings(settingsData);
      if (demandData) setDemand(demandData);
      await fetchScenariosAndConstants(projectId);
    },
    [fetchScenariosAndConstants],
  );

  const fetchSettlementsAndLedger = useCallback(
    async (projectId: string) => {
      const [clustersRes, ledgerRes] = await Promise.allSettled([
        apiRequest<ClusterListResponseDto>(`/api/v1/projects/${projectId}/clusters`),
        apiRequest<VerificationLedgerDto>(`/api/v1/projects/${projectId}/verifications`),
      ]);
      const clustersData = settledValue(clustersRes);
      const ledgerData = settledValue(ledgerRes);

      if (clustersData) {
        setSettlements(clustersData);
        setSelectedClusterId((prev) => prev ?? clustersData.items[0]?.id ?? null);
      }
      if (ledgerData) {
        setVerificationLedger(ledgerData);
      }
      await fetchInfraAndDemand(projectId);
    },
    [fetchInfraAndDemand],
  );

  const fetchLayersAndVectors = useCallback(
    async (projectId: string) => {
      const [layerRes, bldRes, osmRes] = await Promise.allSettled([
        apiRequest<ProjectLayerDto[]>(`/api/v1/projects/${projectId}/layers`),
        apiRequest<GeoJSON.FeatureCollection>(
          `/api/v1/projects/${projectId}/layers/buildings/geojson`,
        ),
        apiRequest<GeoJSON.FeatureCollection>(
          `/api/v1/projects/${projectId}/layers/osm_features/geojson`,
        ),
      ]);
      const layerItems = settledValue(layerRes);
      const bldFc = settledValue(bldRes);
      const osmFc = settledValue(osmRes);

      if (layerItems) setLayers(layerItems);
      if (bldFc) setBuildingsGeoJson(bldFc);
      if (osmFc) setOsmGeoJson(osmFc);
      await fetchSettlementsAndLedger(projectId);
    },
    [fetchSettlementsAndLedger],
  );

  const loadWorkspace = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      if (!user) {
        await login('planner@electrimap.in', 'ElectriMap#2026');
      }
      const [projData, geoRes] = await Promise.all([
        apiRequest<ProjectDto>(`/api/v1/projects/${id}`),
        apiRequest<ReferenceGeoJsonPayload>('/api/v1/spikes/reference-geojson').catch(() => null),
      ]);
      setProject(projData);
      if (geoRes) {
        setRoutesGeoJson(geoRes.routes);
      }
      await fetchLayersAndVectors(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load project workspace.');
    } finally {
      setLoading(false);
    }
  }, [id, user, login, fetchLayersAndVectors]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState
          title="Loading GIS engineering workbench..."
          description="Fetching validated AOI geometry, satellite layers, habitation clusters, and engineering scenarios."
        />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-3">
        <ErrorState
          title="Workspace Load Error"
          message={error ?? 'Project not found.'}
          onRetry={() => void loadWorkspace()}
        />
        <Link to="/projects" className="text-xs font-mono text-accent underline inline-block">
          ← Return to Projects Portfolio
        </Link>
      </div>
    );
  }

  const openSettingsDialog = () => {
    setSettingsName(project.name);
    setSettingsDescription(project.description ?? '');
    setSettingsScheme(project.scheme);
    setSettingsLoadTier(project.load_tier);
    setSettingsStateName(project.target_state ?? '');
    setSettingsDistrict(project.target_district ?? '');
    setSettingsBlock(project.target_block ?? '');
    setSettingsVillages(project.village_names ?? '');
    setSettingsBaseYear(project.base_year);
    setSettingsHorizonYears(project.horizon_years);
    setSettingsDiscountRate(project.discount_rate);
    setSettingsError(null);
    setSettingsModalOpen(true);
  };

  const handleSaveProjectSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsError(null);
    try {
      const updated = await apiRequest<ProjectDto>(`/api/v1/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          version: project.version,
          name: settingsName.trim(),
          description: settingsDescription.trim() || null,
          scheme: settingsScheme,
          load_tier: settingsLoadTier,
          target_state: settingsStateName.trim() || null,
          target_district: settingsDistrict.trim() || null,
          target_block: settingsBlock.trim() || null,
          village_names: settingsVillages.trim() || null,
          base_year: settingsBaseYear,
          horizon_years: settingsHorizonYears,
          discount_rate: settingsDiscountRate,
        }),
      });
      setProject(updated);
      setSettingsModalOpen(false);
      await fetchScenariosAndConstants(updated.id);
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : 'Unable to save project settings.',
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const rasterOverlayUrl =
    activeRasterOverlay !== 'none'
      ? `/api/v1/projects/${project.id}/layers/${activeRasterOverlay}/image`
      : null;

  const activeSectionMeta =
    WORKSPACE_SECTIONS.find((s) => s.key === activeSectionKey) ?? WORKSPACE_SECTIONS[0]!;
  const currentSectionIndex = WORKSPACE_SECTIONS.findIndex(
    (s) => s.key === activeSectionKey,
  );
  const prevSection =
    currentSectionIndex > 0 ? WORKSPACE_SECTIONS[currentSectionIndex - 1] : null;
  const nextSection =
    currentSectionIndex >= 0 && currentSectionIndex < WORKSPACE_SECTIONS.length - 1
      ? WORKSPACE_SECTIONS[currentSectionIndex + 1]
      : null;

  const navigateToSection = (key: WorkspaceSectionKey) => {
    const targetPath =
      key === 'overview'
        ? `/projects/${project.id}/workspace`
        : `/projects/${project.id}/${key}`;
    navigate(targetPath);
  };

  // Compute live data-backed readiness status per workflow section
  const getSectionReadinessBadge = (key: WorkspaceSectionKey): {
    text: string;
    tone: 'ok' | 'warn' | 'error' | 'primary' | 'neutral';
  } => {
    switch (key) {
      case 'overview':
        return { text: `v${project.version}`, tone: 'primary' };
      case 'map':
        return {
          text: project.aoi ? `${project.aoi.area_km2.toFixed(1)} km²` : 'AOI',
          tone: 'primary',
        };
      case 'data': {
        const readyCount = layers.filter((l) => l.status === 'READY').length;
        return {
          text: `${readyCount}/${Math.max(layers.length, 4)} ready`,
          tone: readyCount > 0 ? 'ok' : 'warn',
        };
      }
      case 'settlements': {
        const count = settlements?.items.length ?? 0;
        return {
          text: `${count} clusters`,
          tone: count > 0 ? 'ok' : 'warn',
        };
      }
      case 'infrastructure': {
        const hasInfra = Boolean(infrastructure?.has_existing_infra);
        return {
          text: hasInfra ? `${infrastructure?.items.length ?? 0} assets` : 'Unset',
          tone: hasInfra ? 'ok' : 'warn',
        };
      }
      case 'network': {
        const scenKey = scenariosState?.active_scenario_key;
        return {
          text: scenKey ? scenKey.replace('_OPTIMAL', '') : 'Pending',
          tone: scenKey ? 'ok' : 'neutral',
        };
      }
      case 'cost': {
        if (!ratesState) return { text: 'Pending', tone: 'neutral' };
        return ratesState.unset_count === 0
          ? { text: 'Rates ready', tone: 'ok' }
          : { text: `${ratesState.unset_count} unset`, tone: 'error' };
      }
      case 'reports': {
        if (!preflightState) return { text: 'Audit', tone: 'neutral' };
        return preflightState.can_export
          ? { text: 'Export ready', tone: 'ok' }
          : { text: 'Blocked', tone: 'error' };
      }
    }
  };

  const isMapRoute = activeSectionKey === 'map';
  const showAllStages = !isOverviewMode || showAllStagesInOverview;
  const shouldShowMapGrid =
    isMapRoute ||
    (isOverviewMode && showAllStagesInOverview) ||
    (!isOverviewMode && (showMapInFocusedStage || placeTieInModeActive));

  const sectionBadge = getSectionReadinessBadge(activeSectionKey);
  const readyLayerCount = layers.filter((l) => l.status === 'READY').length;
  const isOverviewHeroMapActive = isOverviewMode && !showAllStagesInOverview;

  const sharedMapElement = (
    <MapCanvas
      variant={isOverviewHeroMapActive ? 'overview' : 'workbench'}
      defaultLayerPanelOpen={isOverviewHeroMapActive ? false : true}
      onOpenFullMap={() => navigateToSection('map')}
      aoiGeometry={project.aoi?.geojson_geometry ?? null}
      boundarySource={project.aoi?.boundary_source ?? 'HARMONISED'}
      referenceBuildings={visibleVectorLayers.buildings ? buildingsGeoJson : null}
      osmFeatures={visibleVectorLayers.osm_features ? osmGeoJson : null}
      referenceRoutes={routesGeoJson}
      settlementClusters={settlements?.geojson ?? null}
      infrastructureAssets={infrastructure?.geojson ?? null}
      gapCorridors={gapAnalysis?.corridors_geojson ?? null}
      networkLayout={scenariosState?.active_scenario.network_geojson ?? null}
      placeTieInModeActive={placeTieInModeActive}
      onPlaceTieInPoint={(lon, lat) => {
        void (async () => {
          setPlaceTieInModeActive(false);
          setMapActionError(null);
          try {
            await apiRequest(`/api/v1/projects/${project.id}/infrastructure`, {
              method: 'POST',
              body: JSON.stringify({
                asset_type: 'TIE_IN',
                name: `11 kV Tie-In (${lon.toFixed(4)}E, ${lat.toFixed(4)}N)`,
                voltage_kv: 11.0,
                provenance: 'USER_ASSUMED',
                source_note: 'Interactive planner map click tie-in point.',
                lon,
                lat,
              }),
            });
            await fetchSettlementsAndLedger(project.id);
          } catch (err) {
            setMapActionError(
              err instanceof Error
                ? err.message
                : 'Unable to record USER_ASSUMED tie-in point.',
            );
          }
        })();
      }}
      selectedClusterId={selectedClusterId}
      onSelectCluster={(cid) => setSelectedClusterId(cid)}
      rasterOverlayUrl={rasterOverlayUrl}
      rasterOpacity={rasterOpacity}
      activeRasterOverlay={activeRasterOverlay}
      onChangeRasterOverlay={setActiveRasterOverlay}
      onChangeRasterOpacity={setRasterOpacity}
      heightClass={
        isMapRoute
          ? 'h-[calc(100vh-20.5rem)] min-h-[440px]'
          : isOverviewHeroMapActive
            ? 'h-[460px] lg:h-[520px]'
            : 'h-[480px]'
      }
    />
  );

  return (
    <div
      className={
        isMapRoute
          ? 'flex-1 flex flex-col p-3 sm:p-4 gap-3 min-h-0'
          : 'page-container section-stack'
      }
    >
      {/* Mode 1: Dedicated Full-Height GIS Workspace Header */}
      {isMapRoute && (
        <header className="bg-sheet/95 backdrop-blur-sm border border-rule-subtle rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-card">
          <div className="min-w-0 flex items-center flex-wrap gap-x-3 gap-y-1">
            <h1 className="heading-lg truncate">{project.name}</h1>
            <span className="text-xs text-ink-2">
              {project.aoi ? `${project.aoi.area_km2.toFixed(2)} km²` : 'No AOI'} ·{' '}
              <span className="font-mono">EPSG:{project.metric_epsg}</span> ·{' '}
              {readyLayerCount}/{Math.max(layers.length, 4)} layers ready
            </span>
            <span className="px-2.5 py-0.5 text-2xs font-medium border border-dashed border-warn-border bg-warn-bg text-warn rounded-full">
              Preliminary — Field Survey Required
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant={showMapInspectorDrawer ? 'primary' : 'secondary'}
              leftIcon={Layers}
              onClick={() => setShowMapInspectorDrawer((prev) => !prev)}
            >
              {showMapInspectorDrawer ? 'Hide AOI Inspector' : 'AOI & Clusters'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={Settings}
              onClick={openSettingsDialog}
            >
              Project Settings
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              leftIcon={ArrowLeft}
              onClick={() => navigateToSection('overview')}
            >
              Overview
            </Button>
          </div>
        </header>
      )}

      {/* Mode 2: Editorial Overview Project Header */}
      {isOverviewMode && (
        <header className="bg-sheet border border-rule-subtle rounded-lg shadow-card px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="primary" size="sm">
                {project.scheme} · {project.horizon_years}-Year Horizon
              </Badge>
              <span className="text-ink-2 font-medium">
                Revision v{project.version} · Updated {project.updated_at.slice(0, 10)}
              </span>
              <span className="px-2.5 py-0.5 text-2xs font-medium border border-dashed border-warn-border bg-warn-bg text-warn rounded-full">
                PRELIMINARY — NOT FIELD VERIFIED
              </span>
            </div>
            <h1 className="heading-xl text-ink truncate">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-2">
              <span>
                {project.village_names ??
                  (project.aoi?.lgd_code
                    ? `LGD ${project.aoi.lgd_code}`
                    : 'Custom AOI Polygon')}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {project.target_block ?? 'Nandapur'},{' '}
                {project.target_district ?? 'Koraput'},{' '}
                {project.target_state ?? 'Odisha'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-ink">
                WGS 84 ↔ EPSG:{project.metric_epsg}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={Settings}
              onClick={openSettingsDialog}
            >
              Project Settings
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              leftIcon={MapIcon}
              onClick={() => navigateToSection('map')}
            >
              Open GIS Workspace
            </Button>
          </div>
        </header>
      )}

      {/* Mode 3: Focused Stage Compact Header */}
      {!isOverviewMode && !isMapRoute && (
        <header className="bg-sheet border border-rule-subtle rounded-lg px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-card">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-xs text-ink-2">
              <span>{project.name}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">EPSG:{project.metric_epsg}</span>
              {project.aoi && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{project.aoi.area_km2.toFixed(2)} km²</span>
                </>
              )}
              <Badge variant={sectionBadge.tone} size="sm">
                {sectionBadge.text}
              </Badge>
            </div>
            <h1 className="heading-lg">{activeSectionMeta.title}</h1>
            <p className="text-xs text-ink-2">{activeSectionMeta.nonGisHint}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={MapIcon}
              onClick={() => setShowMapInFocusedStage((prev) => !prev)}
            >
              {showMapInFocusedStage ? 'Hide Map Preview' : 'Show Map Preview'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={Settings}
              onClick={openSettingsDialog}
            >
              Settings
            </Button>
            {prevSection && (
              <Button
                size="sm"
                variant="secondary"
                leftIcon={ArrowLeft}
                onClick={() => navigateToSection(prevSection.key)}
              >
                {prevSection.shortLabel}
              </Button>
            )}
            {nextSection && (
              <Button
                size="sm"
                variant="primary"
                rightIcon={ArrowRight}
                onClick={() => navigateToSection(nextSection.key)}
              >
                {nextSection.shortLabel}
              </Button>
            )}
          </div>
        </header>
      )}

      {project.aoi?.warnings.includes('APPROXIMATE_BOUNDARY_BUFFER_1500M') && (
        <Callout
          tone="warn"
          title="Approximate AOI Boundary Active (1.5 km Metric Circular Buffer)"
        >
          Official village polygon geometry was unavailable for LGD{' '}
          <code>{project.aoi.lgd_code}</code>. The workbench generated a 1.5 km metric buffer in
          EPSG:{project.metric_epsg}. Confirm exact revenue village boundaries during field
          survey.
        </Callout>
      )}

      {project.aoi?.warnings.includes('SELF_INTERSECTION_REPAIRED') && (
        <Callout tone="info" title="Geometry Topology Automatically Repaired">
          A self-intersection in the submitted boundary polygon was automatically repaired using
          OGC <code>make_valid</code> rules prior to metric area calculation.
        </Callout>
      )}

      <div className="sr-only" aria-live="polite">
        Active workflow step: {activeSectionKey}
      </div>

      {/* Project Overview Dashboard (Hero GIS Split, Pipeline Rail, Dimensions & Analytical Charts) */}
      {isOverviewMode && (
        <ProjectOverviewDashboard
          project={project}
          layers={layers}
          settlements={settlements}
          verificationLedger={verificationLedger}
          infrastructure={infrastructure}
          gapAnalysis={gapAnalysis}
          demand={demand}
          scenariosState={scenariosState}
          ratesState={ratesState}
          comparisonState={comparisonState}
          preflightState={preflightState}
          exportLogState={exportLogState}
          jobsState={jobsState}
          onNavigateSection={navigateToSection}
          heroMapSlot={isOverviewHeroMapActive ? sharedMapElement : undefined}
          onOpenFullMap={() => navigateToSection('map')}
        />
      )}

      {/* Interactive GIS Map & AOI/Habitation Inspector Grid */}
      {shouldShowMapGrid && (
        <div
          id="step-section-map"
          className={
            isMapRoute && !showMapInspectorDrawer
              ? 'flex-1 flex flex-col min-h-0'
              : 'grid grid-cols-1 lg:grid-cols-12 gap-4'
          }
        >
          {/* MapCanvas */}
          <div className={isMapRoute && !showMapInspectorDrawer ? 'flex-1 flex flex-col min-h-0 space-y-2' : 'lg:col-span-9 space-y-2'}>
            {mapActionError && (
              <Callout
                tone="error"
                title="Map Tie-In Placement Failed"
                action={
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() => setMapActionError(null)}
                  >
                    Dismiss
                  </Button>
                }
              >
                {mapActionError}
              </Callout>
            )}
            {sharedMapElement}
          </div>

          {/* Right AOI & Provenance Inspector Panel (Shown in Stage previews or toggled in /map) */}
          {(!isMapRoute || showMapInspectorDrawer) && (
            <aside
              aria-label="AOI and Provenance Inspector"
              className="lg:col-span-3 bg-sheet border border-rule-subtle rounded-lg p-4 space-y-3.5 text-xs shadow-card"
            >
              <div className="small-caps-heading border-b border-rule pb-2 flex items-center justify-between">
                <span>AOI &amp; Provenance Inspector</span>
                <Icon icon={Layers} size="xs" className="text-ink-3" />
              </div>

              <dl className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-rule-subtle pb-1.5">
                  <dt className="text-ink-2">Project ID</dt>
                  <dd className="font-mono text-ink">{project.id.slice(0, 8)}…</dd>
                </div>
                <div className="flex justify-between border-b border-rule-subtle pb-1.5">
                  <dt className="text-ink-2">Boundary Source</dt>
                  <dd className="font-mono text-ink">{project.aoi?.boundary_source ?? 'NONE'}</dd>
                </div>
                <div className="flex justify-between border-b border-rule-subtle pb-1.5">
                  <dt className="text-ink-2">LGD / Census 2011</dt>
                  <dd className="font-mono text-ink">
                    {project.aoi?.lgd_code ?? '—'} / {project.aoi?.census2011_code ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-rule-subtle pb-1.5">
                  <dt className="text-ink-2">Ingested GIS Layers</dt>
                  <dd className="font-medium text-ink">{layers.length} layers ready</dd>
                </div>
                <div className="flex justify-between border-b border-rule-subtle pb-1.5">
                  <dt className="text-ink-2">Revision</dt>
                  <dd className="font-mono text-ink">v{project.version}</dd>
                </div>
              </dl>

              <div className="pt-1 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="small-caps-heading">
                    Habitation Clusters ({settlements?.items.length ?? 0})
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => navigateToSection('settlements')}
                  >
                    Open Step 2 →
                  </Button>
                </div>
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {(settlements?.items ?? []).map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setSelectedClusterId(h.id)}
                      className={`w-full text-left p-2.5 border rounded-xs space-y-1.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                        selectedClusterId === h.id
                          ? 'bg-accent-tint/50 border-accent'
                          : 'bg-paper border-rule hover:bg-sheet'
                      }`}
                    >
                      <div className="flex items-center justify-between font-medium text-ink text-xs">
                        <span className="truncate">
                          {h.label} · {h.name}
                        </span>
                        <span className="font-mono text-xs shrink-0 ml-2">
                          {h.est_households} HH
                        </span>
                      </div>
                      <ClassificationBadge
                        proxyClass={h.proxy_class}
                        verificationState={h.verification_state}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Stage 1: Study Area Layers & Dataset Provenance */}
      {((isOverviewMode && showAllStages) || activeSectionKey === 'data') && (
        <section
          id="step-section-data"
          aria-label="Step 1 Study Area Layers and Provenance"
          className="space-y-2"
        >
          {isOverviewMode && showAllStages && (
            <div className="flex items-center justify-between border-b border-rule pb-2 pt-2">
              <div>
                <span className="heading-overline">Stage 1 of 6</span>
                <h2 className="heading-md">Study Area GIS Layers &amp; Dataset Provenance</h2>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => navigateToSection('data')}
              >
                Open Stage 1 →
              </Button>
            </div>
          )}
          <DataManagementPanel
            projectId={project.id}
            layers={layers}
            visibleVectorLayers={visibleVectorLayers}
            onToggleVectorLayer={(layerKey) =>
              setVisibleVectorLayers((prev) => ({
                ...prev,
                [layerKey]: !prev[layerKey],
              }))
            }
            activeRasterOverlay={activeRasterOverlay}
            onChangeRasterOverlay={setActiveRasterOverlay}
            rasterOpacity={rasterOpacity}
            onChangeRasterOpacity={setRasterOpacity}
            onLayersUpdated={() => fetchLayersAndVectors(project.id)}
          />
        </section>
      )}

      {/* Stage 2: Habitation Clustering & Field Verification */}
      {((isOverviewMode && showAllStages) || activeSectionKey === 'settlements') && (
        <section
          id="step-section-settlements"
          aria-label="Step 2 Habitation Clustering and Field Verification"
          className="space-y-2"
        >
          {isOverviewMode && showAllStages && (
            <div className="flex items-center justify-between border-b border-rule pb-2 pt-2">
              <div>
                <span className="heading-overline">Stage 2 of 6</span>
                <h2 className="heading-md">
                  Villages, Habitation Clustering &amp; Field Verification Ledger
                </h2>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => navigateToSection('settlements')}
              >
                Open Stage 2 →
              </Button>
            </div>
          )}
          <SettlementAssessmentPanel
            projectId={project.id}
            settlements={settlements}
            ledger={verificationLedger}
            selectedClusterId={selectedClusterId}
            onSelectCluster={(cid) => setSelectedClusterId(cid)}
            onSettlementsUpdated={() => fetchSettlementsAndLedger(project.id)}
          />
        </section>
      )}

      {/* Stage 3: Existing Grid Infrastructure, Gaps & Demand Forecast */}
      {((isOverviewMode && showAllStages) || activeSectionKey === 'infrastructure') && (
        <section
          id="step-section-infrastructure"
          aria-label="Step 3 Existing Grid Infrastructure and Demand Forecast"
          className="space-y-2"
        >
          {isOverviewMode && showAllStages && (
            <div className="flex items-center justify-between border-b border-rule pb-2 pt-2">
              <div>
                <span className="heading-overline">Stage 3 of 6</span>
                <h2 className="heading-md">
                  Existing Grid Infrastructure, Electrification Gaps &amp; Load Forecast
                </h2>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => navigateToSection('infrastructure')}
              >
                Open Stage 3 →
              </Button>
            </div>
          )}
          <InfrastructureAndDemandPanel
            projectId={project.id}
            infrastructure={infrastructure}
            gapAnalysis={gapAnalysis}
            settings={settings}
            demand={demand}
            placeTieInModeActive={placeTieInModeActive}
            onTogglePlaceTieInMode={() => setPlaceTieInModeActive((prev) => !prev)}
            onInfrastructureAndDemandUpdated={() => fetchSettlementsAndLedger(project.id)}
          />
        </section>
      )}

      {/* Stage 4: Network Routing, Voltage Drop & Single-Line Diagram */}
      {((isOverviewMode && showAllStages) || activeSectionKey === 'network') && (
        <section
          id="step-section-engineering"
          aria-label="Step 4 Network Routing and Single-Line Diagram"
          className="space-y-2"
        >
          {isOverviewMode && showAllStages && (
            <div className="flex items-center justify-between border-b border-rule pb-2 pt-2">
              <div>
                <span className="heading-overline">Stage 4 of 6</span>
                <h2 className="heading-md">
                  Network Routing, Voltage Drop &amp; Single-Line Diagram (SLD)
                </h2>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => navigateToSection('network')}
              >
                Open Stage 4 →
              </Button>
            </div>
          )}
          <NetworkEngineeringPanel
            projectId={project.id}
            scenariosState={scenariosState}
            constants={engineeringConstants}
            onScenariosUpdated={() => fetchScenariosAndConstants(project.id)}
          />
        </section>
      )}

      {/* Stage 5: Cost Estimation, BOQ & Scenario Comparison */}
      {((isOverviewMode && showAllStages) || activeSectionKey === 'cost') && (
        <section
          id="step-section-cost"
          aria-label="Step 5 Cost Estimation BOQ and Scenario Comparison"
          className="space-y-2"
        >
          {isOverviewMode && showAllStages && (
            <div className="flex items-center justify-between border-b border-rule pb-2 pt-2">
              <div>
                <span className="heading-overline">Stage 5 of 6</span>
                <h2 className="heading-md">
                  Schedule of Rates, Itemized BOQ &amp; 4-Scenario Comparison
                </h2>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => navigateToSection('cost')}
              >
                Open Stage 5 →
              </Button>
            </div>
          )}
          <CostAndScenarioComparisonPanel
            projectId={project.id}
            rates={ratesState}
            comparison={comparisonState}
            onUpdateRateItem={async (itemCode, rateInr, citation) => {
              await apiRequest<ProjectRateListDto>(
                `/api/v1/projects/${project.id}/rates/${itemCode}`,
                {
                  method: 'PATCH',
                  body: JSON.stringify({ rate_inr: rateInr, citation }),
                },
              );
              await fetchScenariosAndConstants(project.id);
            }}
            onResetRates={async () => {
              await apiRequest<ProjectRateListDto>(
                `/api/v1/projects/${project.id}/rates/reset`,
                { method: 'POST' },
              );
              await fetchScenariosAndConstants(project.id);
            }}
            onImportRatesCsv={async (csvContent, templateName) => {
              const res = await apiRequest<SorCsvImportResponseDto>(
                `/api/v1/projects/${project.id}/rates/import-csv`,
                {
                  method: 'POST',
                  body: JSON.stringify({
                    csv_content: csvContent,
                    template_name: templateName,
                  }),
                },
              );
              if (res.is_valid) {
                await fetchScenariosAndConstants(project.id);
              }
              return res;
            }}
            onPinScenario={async (scenarioId) => {
              await apiRequest<ProjectScenarioComparisonDto>(
                `/api/v1/projects/${project.id}/scenarios/${scenarioId}/pin`,
                { method: 'POST' },
              );
              await fetchScenariosAndConstants(project.id);
            }}
          />
        </section>
      )}

      {/* Stage 6: Complete 24-Section DPR Pre-Flight Audit & Export Center */}
      {((isOverviewMode && showAllStages) || activeSectionKey === 'reports') && (
        <section
          id="step-section-dpr"
          aria-label="Step 6 Pre-Flight Audit and 24-Section DPR Export Center"
          className="space-y-2"
        >
          {isOverviewMode && showAllStages && (
            <div className="flex items-center justify-between border-b border-rule pb-2 pt-2">
              <div>
                <span className="heading-overline">Stage 6 of 6</span>
                <h2 className="heading-md">
                  Pre-Flight Audit &amp; 24-Section DPR Export Center
                </h2>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => navigateToSection('reports')}
              >
                Open Stage 6 →
              </Button>
            </div>
          )}
          <DprExportCenterPanel
            projectId={project.id}
            preflight={preflightState}
            exportLog={exportLogState}
            onRefreshAuditAndLogs={() => fetchScenariosAndConstants(project.id)}
          />
        </section>
      )}

      {/* Progressive Disclosure Footer on Overview for Single-Scroll Technical Audit */}
      {isOverviewMode && (
        <div className="bg-sheet border border-rule-subtle rounded-lg p-5 flex flex-wrap items-center justify-between gap-3 shadow-card">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-ink">
              Complete Engineering Audit View (All 6 Workflow Modules &amp; Map)
            </h2>
            <p className="text-xs text-ink-2">
              {showAllStagesInOverview
                ? 'Showing the full workbench map and all 6 detailed workflow panels below the executive dashboard.'
                : 'Detailed workflow tables and inline modules stay collapsed by default so the overview stays readable. Expand only if reviewing all stages on one scroll.'}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            rightIcon={showAllStagesInOverview ? ChevronUp : ChevronDown}
            onClick={() => setShowAllStagesInOverview((prev) => !prev)}
          >
            {showAllStagesInOverview
              ? 'Collapse Detailed Modules'
              : 'Expand Map & All 6 Stages Inline'}
          </Button>
        </div>
      )}

      {/* Bottom Stage Navigation Bar for Focused Views */}
      {!isOverviewMode && !isMapRoute && (
        <footer
          aria-label="Stage pagination"
          className="bg-sheet border border-rule-subtle rounded-lg px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-card"
        >
          <div>
            {prevSection ? (
              <Button
                size="sm"
                variant="secondary"
                leftIcon={ArrowLeft}
                onClick={() => navigateToSection(prevSection.key)}
              >
                Previous: {prevSection.shortLabel}
              </Button>
            ) : (
              <span />
            )}
          </div>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={LayoutList}
              onClick={() => navigateToSection('overview')}
            >
              Back to Project Overview
            </Button>
          <div>
            {nextSection ? (
              <Button
                size="sm"
                variant="primary"
                rightIcon={ArrowRight}
                onClick={() => navigateToSection(nextSection.key)}
              >
                Next: {nextSection.shortLabel}
              </Button>
            ) : (
              <span />
            )}
          </div>
        </footer>
      )}

      {/* Project Metadata & Planning Configuration Dialog */}
      <Dialog
        open={settingsModalOpen}
        onClose={() => {
          if (!savingSettings) setSettingsModalOpen(false);
        }}
        overline={`PROJECT CONFIGURATION · VERSION v${project.version}`}
        title="Project Settings & Planning Horizon"
        description="Update target scheme metadata, geography labels, demand tier, or economic horizon. Optimistic version concurrency prevents silent overwrites."
        size="lg"
      >
        <form
          onSubmit={(e) => void handleSaveProjectSettings(e)}
          className="space-y-3"
        >
          {settingsError && (
            <Callout tone="error" title="Update Rejected">
              {settingsError}
            </Callout>
          )}

          <Input
            id="settings-proj-name"
            label="Project Title"
            required
            minLength={2}
            maxLength={200}
            value={settingsName}
            onChange={(e) => setSettingsName(e.target.value)}
          />

          <Textarea
            id="settings-proj-desc"
            label="Engineering Scope Notes"
            rows={2}
            maxLength={2000}
            value={settingsDescription}
            onChange={(e) => setSettingsDescription(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              id="settings-proj-scheme"
              label="Target Scheme"
              value={settingsScheme}
              onChange={(e) => setSettingsScheme(e.target.value)}
              options={[
                { value: 'DA-JGUA / RDSS', label: 'DA-JGUA / RDSS' },
                { value: 'RDSS Feeder Separation', label: 'RDSS Feeder Separation' },
                { value: 'MNRE Off-Grid / Mini-Grid', label: 'MNRE Off-Grid / Mini-Grid' },
                { value: 'State Tribal Sub-Plan (TSP)', label: 'State Tribal Sub-Plan (TSP)' },
              ]}
            />
            <Select
              id="settings-proj-tier"
              label="Consumer Load Tier"
              value={settingsLoadTier}
              onChange={(e) => setSettingsLoadTier(e.target.value)}
              mono
              options={[
                { value: 'TIER_2_SUBSISTENCE', label: 'TIER_2 (0.25 kW/HH)' },
                { value: 'TIER_3_STANDARD', label: 'TIER_3 (0.50 kW/HH)' },
                { value: 'TIER_4_PRODUCTIVE', label: 'TIER_4 (1.00 kW/HH)' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Input
              id="settings-proj-state"
              label="State"
              maxLength={100}
              value={settingsStateName}
              onChange={(e) => setSettingsStateName(e.target.value)}
            />
            <Input
              id="settings-proj-district"
              label="District"
              maxLength={100}
              value={settingsDistrict}
              onChange={(e) => setSettingsDistrict(e.target.value)}
            />
            <Input
              id="settings-proj-block"
              label="Block"
              maxLength={100}
              value={settingsBlock}
              onChange={(e) => setSettingsBlock(e.target.value)}
            />
          </div>

          <Input
            id="settings-proj-villages"
            label="Target Village(s)"
            maxLength={300}
            value={settingsVillages}
            onChange={(e) => setSettingsVillages(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Input
              id="settings-proj-base-year"
              label="Base Year"
              type="number"
              min={2020}
              max={2035}
              mono
              value={settingsBaseYear}
              onChange={(e) => setSettingsBaseYear(Number(e.target.value))}
            />
            <Input
              id="settings-proj-horizon"
              label="Horizon"
              type="number"
              min={1}
              max={30}
              unit="yrs"
              mono
              value={settingsHorizonYears}
              onChange={(e) => setSettingsHorizonYears(Number(e.target.value))}
            />
            <Input
              id="settings-proj-discount"
              label="Discount Rate"
              type="number"
              min={0.01}
              max={0.25}
              step={0.005}
              mono
              value={settingsDiscountRate}
              onChange={(e) => setSettingsDiscountRate(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-rule">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={savingSettings}
              onClick={() => setSettingsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="primary"
              isLoading={savingSettings}
            >
              Save Project Settings
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
