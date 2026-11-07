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
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../lib/apiClient';
import { useSessionStore } from '../stores/sessionStore';
import { MapCanvas } from '../components/map/MapCanvas';
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
import { ClassificationBadge } from '../components/ui/Badge';
import { Callout } from '../components/ui/Callout';
import { StatTile } from '../components/ui/StatTile';
import { TitleBlock } from '../components/ui/TitleBlock';
import { ProjectDto } from './ProjectsPage';

interface ReferenceGeoJsonPayload {
  villages: GeoJSON.FeatureCollection;
  buildings: GeoJSON.FeatureCollection;
  routes: GeoJSON.FeatureCollection;
}

const WORKFLOW_STEPS = [
  { key: 'data', label: '1. Data & AOI', state: 'READY' },
  { key: 'settlements', label: '2. Settlements', state: 'READY' },
  { key: 'infrastructure', label: '3. Infrastructure', state: 'READY' },
  { key: 'planning', label: '4. Planning', state: 'READY' },
  { key: 'engineering', label: '5. Engineering', state: 'READY' },
  { key: 'cost', label: '6. Cost & BOQ', state: 'ACTIVE' },
  { key: 'compare', label: '7. Compare & DPR', state: 'ACTIVE' },
];

export const WorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, login } = useSessionStore();

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
  const [placeTieInModeActive, setPlaceTieInModeActive] = useState<boolean>(false);

  const [visibleVectorLayers, setVisibleVectorLayers] = useState<Record<string, boolean>>({
    buildings: true,
    osm_features: true,
  });
  const [activeRasterOverlay, setActiveRasterOverlay] = useState<RasterOverlayKey>('none');
  const [rasterOpacity, setRasterOpacity] = useState<number>(0.65);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScenariosAndConstants = useCallback(async (projectId: string) => {
    const [scenData, constData, ratesData, compData] = await Promise.all([
      apiRequest<PlanningScenarioListDto>(`/api/v1/projects/${projectId}/scenarios`),
      apiRequest<EngineeringConstantListDto>('/api/v1/engineering-constants'),
      apiRequest<ProjectRateListDto>(`/api/v1/projects/${projectId}/rates`),
      apiRequest<ProjectScenarioComparisonDto>(`/api/v1/projects/${projectId}/comparison`),
    ]);
    setScenariosState(scenData);
    setEngineeringConstants(constData);
    setRatesState(ratesData);
    setComparisonState(compData);
  }, []);

  const fetchInfraAndDemand = useCallback(
    async (projectId: string) => {
      const [infraData, gapData, settingsData, demandData] = await Promise.all([
        apiRequest<InfrastructureListDto>(`/api/v1/projects/${projectId}/infrastructure`),
        apiRequest<ProjectGapAnalysisDto>(`/api/v1/projects/${projectId}/gap-analysis`),
        apiRequest<ProjectSettingsListDto>(`/api/v1/projects/${projectId}/settings`),
        apiRequest<ProjectDemandSummaryDto>(`/api/v1/projects/${projectId}/demand`),
      ]);
      setInfrastructure(infraData);
      setGapAnalysis(gapData);
      setSettings(settingsData);
      setDemand(demandData);
      await fetchScenariosAndConstants(projectId);
    },
    [fetchScenariosAndConstants],
  );

  const fetchSettlementsAndLedger = useCallback(
    async (projectId: string) => {
      const [clustersData, ledgerData] = await Promise.all([
        apiRequest<ClusterListResponseDto>(`/api/v1/projects/${projectId}/clusters`),
        apiRequest<VerificationLedgerDto>(`/api/v1/projects/${projectId}/verifications`),
      ]);
      setSettlements(clustersData);
      setVerificationLedger(ledgerData);
      setSelectedClusterId((prev) => prev ?? clustersData.items[0]?.id ?? null);
      await fetchInfraAndDemand(projectId);
    },
    [fetchInfraAndDemand],
  );

  const fetchLayersAndVectors = useCallback(
    async (projectId: string) => {
      const [layerItems, bldFc, osmFc] = await Promise.all([
        apiRequest<ProjectLayerDto[]>(`/api/v1/projects/${projectId}/layers`),
        apiRequest<GeoJSON.FeatureCollection>(
          `/api/v1/projects/${projectId}/layers/buildings/geojson`,
        ),
        apiRequest<GeoJSON.FeatureCollection>(
          `/api/v1/projects/${projectId}/layers/osm_features/geojson`,
        ),
      ]);
      setLayers(layerItems);
      setBuildingsGeoJson(bldFc);
      setOsmGeoJson(osmFc);
      await fetchSettlementsAndLedger(projectId);
    },
    [fetchSettlementsAndLedger],
  );

  useEffect(() => {
    let active = true;
    async function loadWorkspace() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        if (!user) {
          await login('planner@electrimap.in', 'ElectriMap#2026');
        }
        const [projData, geoData] = await Promise.all([
          apiRequest<ProjectDto>(`/api/v1/projects/${id}`),
          apiRequest<ReferenceGeoJsonPayload>('/api/v1/spikes/reference-geojson'),
        ]);
        if (!active) return;
        setProject(projData);
        setRoutesGeoJson(geoData.routes);
        await fetchLayersAndVectors(id);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load project workspace.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadWorkspace();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, fetchLayersAndVectors]);

  if (loading) {
    return (
      <div className="p-8 text-center font-mono text-xs text-ink-2">
        Loading GIS engineering workbench...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-3">
        <Callout tone="error" title="Workspace Load Error">
          {error ?? 'Project not found.'}
        </Callout>
        <Link to="/projects" className="text-xs font-mono text-accent underline">
          ← Return to Projects Portfolio
        </Link>
      </div>
    );
  }

  const rasterOverlayUrl =
    activeRasterOverlay !== 'none'
      ? `/api/v1/projects/${project.id}/layers/${activeRasterOverlay}/image`
      : null;

  const solarLayer = layers.find((l) => l.layer_key === 'solar_resource');
  const worstMonthGhi =
    solarLayer && typeof solarLayer.summary_metrics.worst_ghi_kwh_m2_day === 'number'
      ? Number(solarLayer.summary_metrics.worst_ghi_kwh_m2_day).toFixed(2)
      : '3.82';

  const verCoveragePct = settlements?.verification_coverage_pct ?? 0.0;

  return (
    <div className="max-w-[1440px] w-full mx-auto p-4 space-y-4">
      <TitleBlock
        sheetNumber={`SHEET PRJ-v${project.version}`}
        projectTitle={project.name}
        villageLabel={
          project.village_names ??
          (project.aoi?.lgd_code ? `LGD ${project.aoi.lgd_code}` : 'Custom AOI Polygon')
        }
        blockAndDistrict={`${project.target_block ?? 'Nandapur'}, ${
          project.target_district ?? 'Koraput'
        }, ${project.target_state ?? 'Odisha'}`}
        crsLabel={`WGS 84 ↔ EPSG:${project.metric_epsg}`}
        scenarioName={`${project.scheme} · ${project.horizon_years}-Year Horizon`}
        dateIso={project.updated_at.slice(0, 10)}
        isPreliminary={true}
      />

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Validated AOI Area"
          value={project.aoi ? project.aoi.area_km2.toFixed(2) : '0.00'}
          unit="km²"
          quality={
            project.aoi?.boundary_source === 'APPROXIMATE_BUFFER' ? 'ASSUMED' : 'ESTIMATED'
          }
          subtitle={`Boundary Source: ${project.aoi?.boundary_source ?? 'UNSET'}`}
        />
        <StatTile
          label="Metric Computation CRS"
          value={`EPSG:${project.metric_epsg}`}
          unit="UTM"
          quality="VERIFIED"
          subtitle="All distances (m) and areas (m²) computed in UTM"
        />
        <StatTile
          label="Design Worst-Month GHI"
          value={worstMonthGhi}
          unit="kWh/m²/day"
          quality="ESTIMATED"
          subtitle="NASA POWER Climatology (Monsoon Design)"
        />
        <StatTile
          label="Verification Coverage"
          value={verCoveragePct.toFixed(1)}
          unit="% HH verified"
          quality={verCoveragePct > 0 ? 'VERIFIED' : 'PROXY'}
          subtitle={
            verCoveragePct > 0
              ? `${verificationLedger?.verified_clusters ?? 0}/${
                  verificationLedger?.total_clusters ?? 0
                } clusters verified on Axis 2`
              : 'All settlement clusters currently UNVERIFIED on Axis 2'
          }
        />
      </div>

      {/* Main Workbench Grid: Step Rail + MapCanvas + Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Step Rail */}
        <aside
          aria-label="Engineering workflow steps"
          className="lg:col-span-2 bg-sheet border border-rule-strong rounded-xs p-2.5 space-y-1"
        >
          <div className="small-caps-heading px-2 py-1 border-b border-rule mb-1">
            Workflow Steps
          </div>
          {WORKFLOW_STEPS.map((step) => (
            <div
              key={step.key}
              className={`px-2.5 py-2 rounded-xs text-xs font-medium flex items-center justify-between ${
                step.state === 'ACTIVE'
                  ? 'bg-accent-tint text-accent border border-accent/40'
                  : 'text-ink-2'
              }`}
            >
              <span>{step.label}</span>
              <span className="font-mono text-[10px]">{step.state}</span>
            </div>
          ))}
        </aside>

        {/* Center MapCanvas */}
        <div className="lg:col-span-7">
          <MapCanvas
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
              })();
            }}
            selectedClusterId={selectedClusterId}
            onSelectCluster={(cid) => setSelectedClusterId(cid)}
            rasterOverlayUrl={rasterOverlayUrl}
            rasterOpacity={rasterOpacity}
            heightClass="h-[460px]"
          />
        </div>

        {/* Right Inspector Panel */}
        <aside
          aria-label="AOI and Provenance Inspector"
          className="lg:col-span-3 bg-sheet border border-rule-strong rounded-xs p-3.5 space-y-3 text-xs"
        >
          <div className="small-caps-heading border-b border-rule pb-1.5">
            AOI &amp; Provenance Inspector
          </div>

          <dl className="space-y-2 font-mono text-[11px]">
            <div className="flex justify-between border-b border-rule/60 pb-1">
              <dt className="text-ink-2">Project ID</dt>
              <dd className="text-ink">{project.id.slice(0, 8)}…</dd>
            </div>
            <div className="flex justify-between border-b border-rule/60 pb-1">
              <dt className="text-ink-2">Boundary Source</dt>
              <dd className="text-ink">{project.aoi?.boundary_source ?? 'NONE'}</dd>
            </div>
            <div className="flex justify-between border-b border-rule/60 pb-1">
              <dt className="text-ink-2">LGD / Census 2011</dt>
              <dd className="text-ink">
                {project.aoi?.lgd_code ?? '—'} / {project.aoi?.census2011_code ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between border-b border-rule/60 pb-1">
              <dt className="text-ink-2">Ingested GIS Layers</dt>
              <dd className="text-ink">{layers.length} layers READY</dd>
            </div>
            <div className="flex justify-between border-b border-rule/60 pb-1">
              <dt className="text-ink-2">Optimistic Version</dt>
              <dd className="text-ink">v{project.version}</dd>
            </div>
          </dl>

          <div className="pt-2 space-y-2">
            <div className="small-caps-heading">
              Habitation Clusters ({settlements?.items.length ?? 0})
            </div>
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
              {(settlements?.items ?? []).map((h) => (
                <div
                  key={h.id}
                  onClick={() => setSelectedClusterId(h.id)}
                  className={`p-2 border rounded-xs space-y-1 cursor-pointer transition-colors ${
                    selectedClusterId === h.id
                      ? 'bg-accent-tint/50 border-accent'
                      : 'bg-paper border-rule hover:bg-sheet'
                  }`}
                >
                  <div className="flex items-center justify-between font-medium text-ink">
                    <span>
                      {h.label} · {h.name}
                    </span>
                    <span className="font-mono text-[11px]">{h.est_households} HH</span>
                  </div>
                  <ClassificationBadge
                    proxyClass={h.proxy_class}
                    verificationState={h.verification_state}
                  />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Milestone M6: Traceable Cost Estimation, BOQ & Scenario Comparison */}
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

      {/* Milestone M5: Network Layout Routing, Voltage Drop, Technical Losses & Off-Grid Sizing */}
      <NetworkEngineeringPanel
        projectId={project.id}
        scenariosState={scenariosState}
        constants={engineeringConstants}
        onScenariosUpdated={() => fetchScenariosAndConstants(project.id)}
      />

      {/* Milestone M4: Infrastructure Gap Analysis, Assumptions Register & 7-Category Demand Engine */}
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

      {/* Milestone M3: Habitation Clustering, Two-Axis Classification & Verification Ledger */}
      <SettlementAssessmentPanel
        projectId={project.id}
        settlements={settlements}
        ledger={verificationLedger}
        selectedClusterId={selectedClusterId}
        onSelectCluster={(cid) => setSelectedClusterId(cid)}
        onSettlementsUpdated={() => fetchSettlementsAndLedger(project.id)}
      />

      {/* Milestone M2: Data Management, Layer Toggles & Provenance Registry Panel */}
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
    </div>
  );
};
