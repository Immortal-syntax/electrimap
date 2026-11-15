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

import React from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Compass,
  Database,
  FileCheck2,
  GitBranch,
  Home,
  Layers,
  Map as MapIcon,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { WorkspaceSectionKey } from '../layout/navigationConfig';
import type { ProjectDto } from '../../pages/ProjectsPage';
import type { ProjectLayerDto } from './DataManagementPanel';
import type { ClusterListResponseDto, VerificationLedgerDto } from './SettlementAssessmentPanel';
import type {
  InfrastructureListDto,
  ProjectDemandSummaryDto,
  ProjectGapAnalysisDto,
} from './InfrastructureAndDemandPanel';
import type { PlanningScenarioListDto } from './NetworkEngineeringPanel';
import type {
  ProjectRateListDto,
  ProjectScenarioComparisonDto,
} from './CostAndScenarioComparisonPanel';
import type { PreFlightReportDto, ProjectExportListDto } from './DprExportCenterPanel';
import type { JobStatusDto } from '../ui/JobProgress';
import type { LayerSourceClass } from '../map/symbology';
import {
  Badge,
  ClassificationBadge,
  LayerSourceBadge,
} from '../ui/Badge';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { QualityTag } from '../ui/QualityTag';

export interface ProjectOverviewDashboardProps {
  project: ProjectDto;
  layers: ProjectLayerDto[];
  settlements: ClusterListResponseDto | null;
  verificationLedger: VerificationLedgerDto | null;
  infrastructure: InfrastructureListDto | null;
  gapAnalysis: ProjectGapAnalysisDto | null;
  demand: ProjectDemandSummaryDto | null;
  scenariosState: PlanningScenarioListDto | null;
  ratesState: ProjectRateListDto | null;
  comparisonState: ProjectScenarioComparisonDto | null;
  preflightState: PreFlightReportDto | null;
  exportLogState: ProjectExportListDto | null;
  jobsState?: JobStatusDto[];
  onNavigateSection: (section: WorkspaceSectionKey) => void;
  /** Interactive MapCanvas centerpiece embedded when hosted in WorkspacePage overview */
  heroMapSlot?: React.ReactNode;
  /** Explicit navigation callback to launch the full /map workstation */
  onOpenFullMap?: () => void;
}

const CANONICAL_LAYER_LABELS: Record<string, string> = {
  buildings: 'Building Footprints (Google-MS-OSM Open Buildings)',
  dem_slope: 'Copernicus DEM GLO-30 Elevation & Slope',
  landcover: 'ESA WorldCover 10 m Land Use / Canopy',
  solar_resource: 'NASA POWER Solar GHI & Tilt Climatology',
  nightlights: 'NASA VIIRS VNP46A4 Nighttime Radiance',
  osm_features: 'OpenStreetMap Roads, Waterways & Barriers',
};

function inferLayerSourceType(layer: ProjectLayerDto): LayerSourceClass {
  const ck = (layer.cache_key ?? '').toLowerCase();
  if (ck.includes('ref_pack') || ck.includes('reference')) return 'REFERENCE_DEMO';
  if (ck.includes('synthetic')) return 'SYNTHETIC_PLACEHOLDER';
  return 'PROJECT';
}

export const ProjectOverviewDashboard: React.FC<ProjectOverviewDashboardProps> = ({
  project,
  layers,
  settlements,
  verificationLedger,
  infrastructure,
  gapAnalysis,
  demand,
  scenariosState,
  ratesState,
  comparisonState,
  preflightState,
  exportLogState,
  jobsState = [],
  onNavigateSection,
  heroMapSlot,
  onOpenFullMap,
}) => {
  // ── 1. Derived API-Grounded Metrics (Zero Fabricated Numbers) ──
  const readyLayers = layers.filter((l) => l.status === 'READY');
  const buildingsLayer = layers.find((l) => l.layer_key === 'buildings' && l.status === 'READY');
  const solarLayer = layers.find((l) => l.layer_key === 'solar_resource' && l.status === 'READY');
  const nightlightsLayer = layers.find(
    (l) => l.layer_key === 'nightlights' && l.status === 'READY',
  );

  const detectedStructuresCount =
    buildingsLayer && typeof buildingsLayer.feature_count === 'number'
      ? buildingsLayer.feature_count
      : settlements?.census_reconciliation?.satellite_detected_buildings ?? null;

  const residentialStructuresCount =
    buildingsLayer && typeof buildingsLayer.summary_metrics?.residential_count === 'number'
      ? Number(buildingsLayer.summary_metrics.residential_count)
      : settlements?.census_reconciliation?.satellite_residential_buildings ?? null;

  const worstMonthGhi =
    solarLayer && typeof solarLayer.summary_metrics?.worst_ghi_kwh_m2_day === 'number'
      ? Number(solarLayer.summary_metrics.worst_ghi_kwh_m2_day)
      : null;

  const meanAnnualGhi =
    solarLayer && typeof solarLayer.summary_metrics?.mean_ghi_kwh_m2_day === 'number'
      ? Number(solarLayer.summary_metrics.mean_ghi_kwh_m2_day)
      : null;

  const optimalTiltDeg =
    solarLayer && typeof solarLayer.summary_metrics?.optimal_tilt_deg === 'number'
      ? Number(solarLayer.summary_metrics.optimal_tilt_deg)
      : null;

  const clusterItems = React.useMemo(
    () => settlements?.items ?? [],
    [settlements?.items],
  );
  const totalClustersCount = clusterItems.length;
  const totalEstimatedHouseholds =
    demand?.total_households ??
    (clusterItems.length > 0
      ? clusterItems.reduce((acc, c) => acc + c.est_households, 0)
      : null);

  const verificationCoveragePct =
    settlements && clusterItems.length > 0 ? settlements.verification_coverage_pct : null;
  const verifiedClustersCount = verificationLedger?.verified_clusters ?? 0;

  const activeScenario = scenariosState?.active_scenario ?? null;
  const comparisonScenarios = comparisonState?.scenarios ?? [];
  const activeScenarioComparison =
    comparisonScenarios.find((s) => s.is_active_baseline) ?? comparisonScenarios[0] ?? null;

  // Proxy Class distribution across clusters & households
  const proxyDistribution = React.useMemo(() => {
    const counts = {
      LIKELY_ELECTRIFIED: { clusters: 0, households: 0 },
      POTENTIALLY_UNDERSERVED: { clusters: 0, households: 0 },
      POTENTIALLY_UNSERVED: { clusters: 0, households: 0 },
      UNKNOWN: { clusters: 0, households: 0 },
    };
    for (const c of clusterItems) {
      const cls = c.verified_class ?? c.proxy_class;
      if (cls in counts) {
        counts[cls as keyof typeof counts].clusters += 1;
        counts[cls as keyof typeof counts].households += c.est_households;
      } else {
        counts.UNKNOWN.clusters += 1;
        counts.UNKNOWN.households += c.est_households;
      }
    }
    return counts;
  }, [clusterItems]);

  // Determine recommended next engineering action based on actual project readiness
  const recommendedNextAction = React.useMemo((): {
    stepLabel: string;
    title: string;
    detail: string;
    buttonLabel: string;
    targetSection: WorkspaceSectionKey;
    tone: 'info' | 'warn' | 'ok';
  } => {
    if (readyLayers.length === 0) {
      return {
        stepLabel: 'STAGE 1 · DATA ACQUISITION',
        title: 'Ingest Open Geospatial & Satellite Layers',
        detail:
          'No geospatial layers are marked READY yet. Run the 6-layer data acquisition pipeline to fetch building footprints, Copernicus DEM, ESA WorldCover, NASA POWER GHI, and VIIRS nightlights.',
        buttonLabel: 'Open 1. Data & Layers',
        targetSection: 'data',
        tone: 'warn',
      };
    }
    if (totalClustersCount === 0) {
      return {
        stepLabel: 'STAGE 2 · HABITATION CLUSTERING',
        title: 'Run Metric DBSCAN Habitation Clustering & Census Reconciliation',
        detail:
          'Building footprints are available, but habitation clusters have not been delineated yet. Execute DBSCAN clustering in metric UTM coordinates.',
        buttonLabel: 'Open 2. Villages & Habitations',
        targetSection: 'settlements',
        tone: 'warn',
      };
    }
    if (!infrastructure?.has_existing_infra) {
      return {
        stepLabel: 'STAGE 3 · EXISTING GRID & DEMAND',
        title: 'Register Existing 11 kV / LT Grid Assets or Place Assumed Tie-In Point',
        detail:
          'Existing electrical infrastructure is currently UNSET. Upload utility GIS feeder files or place an explicit USER_ASSUMED 11 kV tie-in point to unlock feeder distance & modality screening.',
        buttonLabel: 'Open 3. Grid & Demand',
        targetSection: 'infrastructure',
        tone: 'warn',
      };
    }
    if (!activeScenario) {
      return {
        stepLabel: 'STAGE 4 · NETWORK ENGINEERING',
        title: 'Synthesize Preliminary HT/LT & Off-Grid Network Scenarios',
        detail:
          'Habitations and grid tie-ins are ready. Run the network engineering engine to size distribution transformers, route feeders, and verify CEA voltage regulation.',
        buttonLabel: 'Open 4. Network Design',
        targetSection: 'network',
        tone: 'info',
      };
    }
    if (ratesState && ratesState.unset_count > 0) {
      return {
        stepLabel: 'STAGE 5 · SCHEDULE OF RATES',
        title: `Resolve ${ratesState.unset_count} UNSET Unit Rate(s) Blocking DPR Export`,
        detail: `Required BOQ item code(s) (${ratesState.unset_item_codes.join(', ')}) have UNSET unit rates. Populate or import verified Schedule of Rates values to unlock final DPR compilation.`,
        buttonLabel: 'Open 5. Cost & Scenarios',
        targetSection: 'cost',
        tone: 'warn',
      };
    }
    return {
      stepLabel: 'STAGE 6 · DPR COMPILATION & EXPORT',
      title: preflightState?.can_export
        ? 'Pre-Flight Audit Passed — Ready to Generate 24-Section DPR Package'
        : 'Review Pre-Flight Audit & Compile 24-Section DPR',
      detail:
        verificationCoveragePct !== null && verificationCoveragePct < 100
          ? `Engineering scenarios and BOQ rates are complete. Axis-2 field verification coverage is ${verificationCoveragePct.toFixed(1)}% — exports will carry the mandatory PRELIMINARY ENGINEERING — NOT FIELD VERIFIED watermark.`
          : 'All engineering stages, Schedule of Rates, and field verification checks are ready for 24-section PDF DPR and formula-driven Excel BOQ generation.',
      buttonLabel: 'Open 6. DPR & Exports',
      targetSection: 'reports',
      tone: preflightState?.can_export ? 'ok' : 'info',
    };
  }, [
    readyLayers.length,
    totalClustersCount,
    infrastructure?.has_existing_infra,
    activeScenario,
    ratesState,
    preflightState?.can_export,
    verificationCoveragePct,
  ]);

  // Workflow Stage Shortcut Cards
  const stageCards: Array<{
    key: WorkspaceSectionKey;
    step: string;
    title: string;
    metricLabel: string;
    statusText: string;
    statusTone: 'ok' | 'warn' | 'error' | 'primary' | 'neutral';
    icon: typeof Database;
  }> = [
    {
      key: 'map',
      step: 'GIS WORKSPACE',
      title: 'Interactive GIS Map',
      metricLabel: project.aoi
        ? `${project.aoi.area_km2.toFixed(2)} km² · EPSG:${project.metric_epsg}`
        : 'AOI Not Defined',
      statusText: project.aoi ? 'AOI VALIDATED' : 'AOI UNSET',
      statusTone: project.aoi ? 'primary' : 'warn',
      icon: MapIcon,
    },
    {
      key: 'data',
      step: 'STAGE 1',
      title: 'Data & Layers',
      metricLabel:
        layers.length > 0
          ? `${readyLayers.length}/${layers.length} Layers READY`
          : 'No layers acquired yet',
      statusText: readyLayers.length > 0 ? `${readyLayers.length} READY` : 'PENDING',
      statusTone: readyLayers.length > 0 ? 'ok' : 'warn',
      icon: Database,
    },
    {
      key: 'settlements',
      step: 'STAGE 2',
      title: 'Villages & Habitations',
      metricLabel:
        totalClustersCount > 0
          ? `${totalClustersCount} Clusters · ${totalEstimatedHouseholds ?? 0} Est. HH`
          : 'No clusters generated',
      statusText:
        verificationCoveragePct !== null
          ? `${verificationCoveragePct.toFixed(0)}% VERIFIED`
          : 'UNCLUSTERED',
      statusTone: totalClustersCount > 0 ? 'ok' : 'warn',
      icon: Home,
    },
    {
      key: 'infrastructure',
      step: 'STAGE 3',
      title: 'Grid & Demand',
      metricLabel: demand
        ? `Horizon Peak: ${demand.peak_kva_horizon.toFixed(1)} kVA`
        : 'Demand not computed',
      statusText: infrastructure?.has_existing_infra
        ? `${infrastructure.items.length} ASSETS`
        : 'INFRA UNSET',
      statusTone: infrastructure?.has_existing_infra ? 'ok' : 'warn',
      icon: Zap,
    },
    {
      key: 'network',
      step: 'STAGE 4',
      title: 'Network Design',
      metricLabel: activeScenario
        ? `HT ${(activeScenario.total_ht_length_m / 1000).toFixed(2)} km · LT ${(
            activeScenario.total_lt_length_m / 1000
          ).toFixed(2)} km`
        : 'No scenario synthesized',
      statusText: activeScenario
        ? activeScenario.vdrop_compliance_ok
          ? 'CEA COMPLIANT'
          : 'VDROP WARN'
        : 'PENDING',
      statusTone: activeScenario
        ? activeScenario.vdrop_compliance_ok
          ? 'ok'
          : 'warn'
        : 'neutral',
      icon: GitBranch,
    },
    {
      key: 'cost',
      step: 'STAGE 5',
      title: 'Cost & Scenarios',
      metricLabel: activeScenarioComparison
        ? `CAPEX ₹${activeScenarioComparison.total_capex_lakhs.toFixed(2)} L · NPC ₹${activeScenarioComparison.npc_lakhs.toFixed(2)} L`
        : 'BOQ not computed',
      statusText: !ratesState
        ? 'PENDING'
        : ratesState.unset_count === 0
          ? 'RATES OK'
          : `${ratesState.unset_count} UNSET`,
      statusTone: !ratesState ? 'neutral' : ratesState.unset_count === 0 ? 'ok' : 'error',
      icon: BarChart3,
    },
    {
      key: 'reports',
      step: 'STAGE 6',
      title: 'DPR & Exports',
      metricLabel: preflightState
        ? `${preflightState.sections.filter((s) => s.is_populated).length}/24 Sections Populated`
        : 'Audit not run',
      statusText: !preflightState
        ? 'PENDING'
        : preflightState.can_export
          ? 'EXPORT READY'
          : 'BLOCKED',
      statusTone: !preflightState
        ? 'neutral'
        : preflightState.can_export
          ? 'ok'
          : 'error',
      icon: FileCheck2,
    },
  ];

  // Combine Recent Activity items (Verifications, Exports, Background Jobs)
  const activityFeed = React.useMemo(() => {
    const items: Array<{
      id: string;
      kind: 'VERIFICATION' | 'EXPORT' | 'JOB';
      title: string;
      subtitle: string;
      timestamp: string;
      badgeText: string;
      badgeTone: 'ok' | 'primary' | 'warn' | 'neutral';
    }> = [];

    for (const rec of (verificationLedger?.records ?? []).slice(0, 5)) {
      items.push({
        id: `ver-${rec.id}`,
        kind: 'VERIFICATION',
        title: `Cluster ${rec.cluster_label} — ${rec.evidence_type.replace(/_/g, ' ')}`,
        subtitle: `Verified by ${rec.verifier_name}${rec.note ? ` · "${rec.note}"` : ''}`,
        timestamp: rec.created_at || rec.observed_on,
        badgeText: 'AXIS-2 VERIFIED',
        badgeTone: 'ok',
      });
    }

    for (const exp of (exportLogState?.items ?? []).slice(0, 5)) {
      items.push({
        id: `exp-${exp.id}`,
        kind: 'EXPORT',
        title: `${exp.export_kind} — ${exp.filename}`,
        subtitle: `SHA-256: ${exp.file_sha256.slice(0, 16)}… · ${(exp.file_size_bytes / 1024).toFixed(1)} KB`,
        timestamp: exp.created_at,
        badgeText: exp.preflight_passed ? 'AUDITED EXPORT' : 'PRELIMINARY',
        badgeTone: 'primary',
      });
    }

    for (const job of jobsState.slice(0, 5)) {
      items.push({
        id: `job-${job.id}`,
        kind: 'JOB',
        title: `Background Job: ${job.job_type}`,
        subtitle: job.stage ?? `Status: ${job.status} (${job.progress}%)`,
        timestamp: job.updated_at || job.created_at,
        badgeText: job.status,
        badgeTone:
          job.status === 'SUCCEEDED'
            ? 'ok'
            : job.status === 'FAILED'
              ? 'warn'
              : 'neutral',
      });
    }

    return items
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 8);
  }, [verificationLedger?.records, exportLogState?.items, jobsState]);

  const maxScenarioNpc = Math.max(
    1,
    ...comparisonScenarios.map((s) => Math.max(s.npc_lakhs, s.total_capex_lakhs)),
  );
  const maxCategoryKw = Math.max(
    1,
    ...(demand?.category_totals.map((c) => c.connected_kw) ?? [1]),
  );

  const workflowStagesOnly = stageCards.filter((card) => card.key !== 'map');
  const launchFullMap = onOpenFullMap ?? (() => onNavigateSection('map'));

  return (
    <section
      aria-label="Project Engineering & Electrification Overview Dashboard"
      className="space-y-7"
    >
      {/* 1. Hero Geospatial Intelligence Centerpiece & Analytical Action Column */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left/Main 7 Cols: Real Interactive GIS Canvas (when mounted) OR AOI Extent Panel */}
        <div className="xl:col-span-7 flex flex-col gap-3">
          {heroMapSlot ? (
            <div className="flex-1 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2 text-xs text-ink-2">
                  <Icon icon={Compass} size="sm" className="text-accent" />
                  <span className="font-semibold text-ink">
                    Spatial Study Area — {project.aoi ? `${project.aoi.area_km2.toFixed(2)} km²` : 'AOI Pending'}
                  </span>
                  <span className="font-mono text-2xs px-2 py-0.5 rounded-full bg-subtle text-ink-3">
                    EPSG:{project.metric_epsg}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={launchFullMap}
                  className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
                >
                  Expand Full GIS Workstation →
                </button>
              </div>
              <div className="flex-1 rounded-xl overflow-hidden shadow-overlay border border-rule/80 bg-sheet">
                {heroMapSlot}
              </div>
              {!project.aoi && (
                <EmptyState
                  compact
                  icon={Compass}
                  title="Area of Interest (AOI) Not Configured"
                  description="Define a village boundary or custom polygon in the AOI Setup Wizard to enable metric UTM calculations."
                />
              )}
            </div>
          ) : (
            <Panel
              overline="Geographic & Administrative Summary"
              title="Area of Interest (AOI) & Spatial Reference"
              subtitle="All metric distances (m), areas (km²), and clustering radii (ε) are computed in the project's dynamic local UTM projection."
              actions={
                <Badge variant="primary" mono>
                  EPSG:{project.metric_epsg}
                </Badge>
              }
            >
              {project.aoi ? (
                <div className="space-y-4">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-subtle/60 rounded-sm p-3.5">
                      <dt className="text-xs font-medium text-ink-3">
                        State / District / Block
                      </dt>
                      <dd className="text-body-sm font-semibold text-ink mt-1">
                        {project.target_state ?? 'Odisha'} · {project.target_district ?? 'Koraput'} ·{' '}
                        {project.target_block ?? 'Nandapur'}
                      </dd>
                    </div>
                    <div className="bg-subtle/60 rounded-sm p-3.5">
                      <dt className="text-xs font-medium text-ink-3">
                        Target Scheme &amp; Horizon
                      </dt>
                      <dd className="text-body-sm font-semibold text-ink mt-1">
                        {project.scheme} ({project.horizon_years} yrs @{' '}
                        {(project.discount_rate * 100).toFixed(1)}%)
                      </dd>
                    </div>
                    <div className="bg-subtle/60 rounded-sm p-3.5">
                      <dt className="text-xs font-medium text-ink-3">
                        Validated Metric Area
                      </dt>
                      <dd className="text-body-sm font-mono font-semibold text-ink mt-1">
                        {project.aoi.area_km2.toFixed(2)} km² ({project.aoi.boundary_source})
                      </dd>
                    </div>
                    <div className="bg-subtle/60 rounded-sm p-3.5">
                      <dt className="text-xs font-medium text-ink-3">
                        LGD / Census 2011 Codes
                      </dt>
                      <dd className="text-body-sm font-mono font-semibold text-ink mt-1">
                        LGD: {project.aoi.lgd_code ?? 'Unlinked'} · C2011:{' '}
                        {project.aoi.census2011_code ??
                          settlements?.census_reconciliation?.census2011_code ??
                          'Unlinked'}
                      </dd>
                    </div>
                  </dl>

                  {buildingsLayer?.bbox && buildingsLayer.bbox.length === 4 && (
                    <div className="bg-subtle/40 border border-rule-subtle rounded-sm px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
                      <span className="text-ink-3 font-medium">WGS 84 Bounding Box:</span>
                      <span className="font-mono">
                        [{buildingsLayer.bbox[0]?.toFixed(4)}°E, {buildingsLayer.bbox[1]?.toFixed(4)}
                        °N] → [{buildingsLayer.bbox[2]?.toFixed(4)}°E,{' '}
                        {buildingsLayer.bbox[3]?.toFixed(4)}°N]
                      </span>
                    </div>
                  )}

                  <div className="bg-subtle/40 border border-rule-subtle rounded-sm p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-ink text-body-sm">
                        Solar &amp; Nighttime Illumination Context
                      </span>
                      <p className="text-xs text-ink-2 mt-1">
                        {worstMonthGhi !== null
                          ? `Worst-month GHI: ${worstMonthGhi.toFixed(2)} kWh/m²/day · Annual mean: ${
                              meanAnnualGhi?.toFixed(2) ?? '—'
                            } kWh/m²/day · Tilt: ${optimalTiltDeg?.toFixed(0) ?? '19'}°`
                          : 'Solar climatology layer not yet ingested.'}
                      </p>
                    </div>
                    <QualityTag kind={worstMonthGhi !== null ? 'ESTIMATED' : 'UNSET'} />
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Compass}
                  title="Area of Interest (AOI) Not Configured"
                  description="Define a village boundary or custom polygon in the AOI Setup Wizard to enable metric UTM calculations."
                />
              )}
            </Panel>
          )}
        </div>

        {/* Right 5 Cols: Priority Action + Editorial Metrics Sheet (Zero Heavy StatTile Boxes) */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          {/* Priority Next Step Callout Card */}
          <div
            className={`rounded-lg border p-5 shadow-card space-y-3 ${
              recommendedNextAction.tone === 'ok'
                ? 'bg-ok-bg/45 border-ok-border'
                : recommendedNextAction.tone === 'warn'
                  ? 'bg-warn-bg/50 border-warn-border'
                  : 'bg-sheet border-rule/80'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    recommendedNextAction.tone === 'ok'
                      ? 'ok'
                      : recommendedNextAction.tone === 'warn'
                        ? 'warn'
                        : 'primary'
                  }
                >
                  {recommendedNextAction.stepLabel}
                </Badge>
                <span className="text-xs font-medium text-ink-3">Recommended next step</span>
              </div>
              <Badge variant="navy" mono>
                {project.scheme}
              </Badge>
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">{recommendedNextAction.title}</h2>
              <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                {recommendedNextAction.detail}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="primary"
                rightIcon={ArrowRight}
                onClick={() => onNavigateSection(recommendedNextAction.targetSection)}
              >
                {recommendedNextAction.buttonLabel}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={MapIcon}
                onClick={launchFullMap}
              >
                Open Full GIS Map
              </Button>
            </div>
          </div>

          {/* Open Editorial Key Indicators Matrix (No 6 Identical Box Borders) */}
          <div className="bg-sheet border border-rule/80 rounded-lg shadow-card p-5 flex-1 flex flex-col justify-between gap-4">
            <div className="grid grid-cols-2 gap-x-5 gap-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-ink-3">Detected Structures</span>
                  <QualityTag kind={detectedStructuresCount !== null ? 'VERIFIED' : 'UNSET'} />
                </div>
                <div className="text-xl font-bold tracking-tight tabular-nums text-ink">
                  {detectedStructuresCount !== null
                    ? detectedStructuresCount.toLocaleString()
                    : 'Not available'}
                </div>
                <div className="text-2xs text-ink-3">
                  {residentialStructuresCount !== null
                    ? `${residentialStructuresCount.toLocaleString()} residential`
                    : 'Run Step 1 acquisition'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-ink-3">Habitation Clusters</span>
                  <QualityTag kind={totalClustersCount > 0 ? 'ESTIMATED' : 'UNSET'} />
                </div>
                <div className="text-xl font-bold tracking-tight tabular-nums text-ink">
                  {totalClustersCount > 0 ? `${totalClustersCount} clusters` : 'Not available'}
                </div>
                <div className="text-2xs text-ink-3">
                  {totalEstimatedHouseholds !== null
                    ? `${totalEstimatedHouseholds.toLocaleString()} est. HH · ${verifiedClustersCount} verified`
                    : 'Run Step 2 DBSCAN'}
                </div>
              </div>

              <div className="space-y-1 pt-3 border-t border-rule-subtle">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-ink-3">Peak Demand</span>
                  <QualityTag kind={demand ? 'ESTIMATED' : 'UNSET'} />
                </div>
                <div className="text-xl font-bold tracking-tight tabular-nums text-ink">
                  {demand ? `${demand.peak_kva_horizon.toFixed(2)} kVA` : 'Not available'}
                </div>
                <div className="text-2xs text-ink-3">
                  {demand
                    ? `${demand.total_connected_kw.toFixed(1)} kW connected`
                    : 'Requires clusters'}
                </div>
              </div>

              <div className="space-y-1 pt-3 border-t border-rule-subtle">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-ink-3">Terrain Feeder Gap</span>
                  <QualityTag
                    kind={
                      gapAnalysis?.has_existing_infra
                        ? gapAnalysis.assumed_assets_count > 0
                          ? 'ASSUMED'
                          : 'VERIFIED'
                        : 'UNSET'
                    }
                  />
                </div>
                <div className="text-xl font-bold tracking-tight tabular-nums text-ink">
                  {gapAnalysis?.has_existing_infra && gapAnalysis.mean_d_terrain_m !== null
                    ? `${(gapAnalysis.mean_d_terrain_m / 1000).toFixed(2)} km`
                    : 'UNSET'}
                </div>
                <div className="text-2xs text-ink-3">
                  {gapAnalysis?.has_existing_infra && gapAnalysis.max_d_terrain_m !== null
                    ? `Max gap ${(gapAnalysis.max_d_terrain_m / 1000).toFixed(2)} km`
                    : 'Grid tie-in required'}
                </div>
              </div>

              <div className="space-y-1 pt-3 border-t border-rule-subtle">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-ink-3">Scenario CAPEX</span>
                  <QualityTag
                    kind={
                      activeScenarioComparison
                        ? activeScenarioComparison.has_unset_rates
                          ? 'UNSET'
                          : 'ESTIMATED'
                        : 'UNSET'
                    }
                  />
                </div>
                <div className="text-xl font-bold tracking-tight tabular-nums text-ink">
                  {activeScenarioComparison
                    ? `₹${activeScenarioComparison.total_capex_lakhs.toFixed(2)} L`
                    : 'Not available'}
                </div>
                <div className="text-2xs text-ink-3">
                  {activeScenarioComparison
                    ? `Utility net ₹${(activeScenarioComparison.net_utility_capex_inr / 100000).toFixed(2)} L`
                    : 'Run Step 4 & Step 5'}
                </div>
              </div>

              <div className="space-y-1 pt-3 border-t border-rule-subtle">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-ink-3">Lifecycle NPC</span>
                  <QualityTag kind={activeScenarioComparison ? 'ESTIMATED' : 'UNSET'} />
                </div>
                <div className="text-xl font-bold tracking-tight tabular-nums text-ink">
                  {activeScenarioComparison
                    ? `₹${activeScenarioComparison.npc_lakhs.toFixed(2)} L`
                    : 'Not available'}
                </div>
                <div className="text-2xs text-ink-3">
                  {activeScenarioComparison
                    ? `LCOE ₹${activeScenarioComparison.lcoe_inr_kwh.toFixed(2)}/kWh`
                    : 'Requires cost synthesis'}
                </div>
              </div>
            </div>

            {project.aoi && (
              <div className="pt-3 border-t border-rule-subtle flex flex-wrap items-center justify-between gap-2 text-2xs text-ink-3">
                <span>
                  LGD: {project.aoi.lgd_code ?? 'Unlinked'} · C2011:{' '}
                  {project.aoi.census2011_code ??
                    settlements?.census_reconciliation?.census2011_code ??
                    'Unlinked'}
                </span>
                <span>
                  {worstMonthGhi !== null
                    ? `Solar low: ${worstMonthGhi.toFixed(2)} kWh/m²/d`
                    : 'Solar climatology pending'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Connected 6-Stage Engineering Pipeline Rail */}
      <div
        aria-label="Engineering Workflow Stage Shortcuts"
        className="bg-sheet border border-rule/80 rounded-lg shadow-card overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-rule-subtle"
      >
        {workflowStagesOnly.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => onNavigateSection(card.key)}
            className="text-left hover:bg-accent-tint/35 p-4 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus flex flex-col justify-between gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs font-medium text-ink-3">{card.step}</span>
              <Badge variant={card.statusTone}>{card.statusText}</Badge>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-body-sm font-semibold text-ink group-hover:text-accent transition-colors">
                <Icon
                  icon={card.icon}
                  size="sm"
                  className="text-ink-3 group-hover:text-accent shrink-0"
                />
                <span>{card.title}</span>
              </div>
              <p className="text-xs text-ink-2 mt-1 leading-snug">{card.metricLabel}</p>
            </div>
          </button>
        ))}
      </div>

      {/* 3. Four-Dimension Electrification Epistemic Matrix */}
      <div>
        <Panel
          overline="Four-Dimension Electrification Assessment"
          title="Strict Epistemic Separation of Rural Electrification Dimensions"
          subtitle="Satellites cannot see electricity meters or daily supply hours. ElectriMap strictly separates household coverage, supply availability, voltage quality, and infrastructure adequacy."
          actions={
            project.aoi && !heroMapSlot ? (
              <Badge variant="primary" mono>
                EPSG:{project.metric_epsg}
              </Badge>
            ) : undefined
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Dimension A */}
              <div className="border border-rule-subtle rounded-sm p-4 bg-subtle/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-2">
                    Dimension A · Connection Coverage
                  </span>
                  <QualityTag
                    kind={
                      verificationCoveragePct !== null && verificationCoveragePct > 0
                        ? 'VERIFIED'
                        : totalClustersCount > 0
                          ? 'PROXY'
                          : 'UNSET'
                    }
                  />
                </div>
                <p className="text-body-sm font-semibold text-ink">
                  {totalClustersCount > 0
                    ? `${proxyDistribution.LIKELY_ELECTRIFIED.clusters} Likely Electrified · ${proxyDistribution.POTENTIALLY_UNDERSERVED.clusters} Underserved · ${proxyDistribution.POTENTIALLY_UNSERVED.clusters} Unserved`
                    : 'No habitation clusters assessed yet'}
                </p>
                <p className="text-xs text-ink-2 leading-relaxed">
                  {verificationCoveragePct !== null
                    ? `Axis-2 Field Verification: ${verificationCoveragePct.toFixed(1)}% of households (${verifiedClustersCount}/${totalClustersCount} clusters verified in ledger).`
                    : 'Run Step 2 clustering and record Gram Sabha / DISCOM ledger verifications.'}
                </p>
              </div>

              {/* Dimension B */}
              <div className="border border-rule-subtle rounded-sm p-4 bg-subtle/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-2">
                    Dimension B · Supply Availability (Hrs/Day)
                  </span>
                  <QualityTag kind={nightlightsLayer ? 'PROXY' : 'UNSET'} />
                </div>
                <p className="text-body-sm font-semibold text-ink">
                  {nightlightsLayer
                    ? 'VIIRS Nighttime Radiance Proxy Active (Requires DISCOM Feeder Logs)'
                    : 'Supply Hours Not Available from Satellite Observations'}
                </p>
                <p className="text-xs text-ink-2 leading-relaxed">
                  Daily supply duration (summer/winter hrs/day) and evening peak reliability cannot be measured from space; verify against 11 kV feeder outage registers.
                </p>
              </div>

              {/* Dimension C */}
              <div className="border border-rule-subtle rounded-sm p-4 bg-subtle/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-2">
                    Dimension C · Voltage Regulation &amp; Quality
                  </span>
                  <QualityTag kind={activeScenario ? 'ESTIMATED' : 'UNSET'} />
                </div>
                <p className="text-body-sm font-semibold text-ink">
                  {activeScenario
                    ? `Max HT Drop: ${activeScenario.max_ht_vdrop_pct.toFixed(2)}% · Max LT Drop: ${activeScenario.max_lt_vdrop_pct.toFixed(2)}%`
                    : 'Voltage Drop Analysis Pending Network Synthesis'}
                </p>
                <p className="text-xs text-ink-2 leading-relaxed">
                  {activeScenario
                    ? activeScenario.vdrop_compliance_ok
                      ? 'Complies with CEA (Measures relating to Safety and Electric Supply) Regulations (±6% HT / ±6% LT limit).'
                      : 'Exceeds CEA voltage regulation threshold — inspect feeder reconductoring or DT split in Stage 4.'
                    : 'Run Stage 4 Network Design to evaluate 11 kV ACSR Rabbit and 415 V LT AB cable voltage regulation.'}
                </p>
              </div>

              {/* Dimension D */}
              <div className="border border-rule-subtle rounded-sm p-4 bg-subtle/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-2">
                    Dimension D · Infrastructure Adequacy
                  </span>
                  <QualityTag
                    kind={
                      infrastructure?.has_existing_infra
                        ? gapAnalysis?.assumed_assets_count
                          ? 'ASSUMED'
                          : 'VERIFIED'
                        : 'UNSET'
                    }
                  />
                </div>
                <p className="text-body-sm font-semibold text-ink">
                  {activeScenario
                    ? `${activeScenario.total_dt_count} DTs (${activeScenario.total_dt_capacity_kva.toFixed(0)} kVA) · PV ${activeScenario.total_solar_kwp.toFixed(1)} kWp · BESS ${activeScenario.total_bess_kwh.toFixed(0)} kWh`
                    : infrastructure?.has_existing_infra
                      ? `${infrastructure.items.length} Existing Grid Asset(s) Registered`
                      : 'Existing Distribution Infrastructure UNSET'}
                </p>
                <p className="text-xs text-ink-2 leading-relaxed">
                  {infrastructure?.has_existing_infra
                    ? `Existing assets: ${gapAnalysis?.verified_assets_count ?? 0} uploaded/verified, ${gapAnalysis?.assumed_assets_count ?? 0} user-assumed tie-ins.`
                    : 'Upload DISCOM 11 kV / DT GIS layers or place an assumed tie-in point in Stage 3.'}
                </p>
              </div>
            </div>
          </Panel>
        </div>

      {/* 5. Analytical Charts Grid (2x2 Pure SVG / CSS Analytical Visualisations) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Village & Settlement Electrification Breakdown + Census 2011 Reconciliation */}
        <div className="lg:col-span-6">
          <Panel
            overline="Chart 1 · Habitation & Census Reconciliation"
            title="Settlement Electrification Status & Axis-2 Verification Breakdown"
            subtitle="Two-axis epistemic classification across delineated habitation clusters and Census 2011 household reconciliation."
            actions={
              <Button
                size="xs"
                variant="ghost"
                rightIcon={ArrowRight}
                onClick={() => onNavigateSection('settlements')}
              >
                Inspect Clusters
              </Button>
            }
          >
            {totalClustersCount > 0 ? (
              <div className="space-y-4">
                {/* Stacked Proportional Bar of Households by Classification */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                    <span className="font-semibold text-ink">
                      Household Distribution by Electrification Classification
                    </span>
                    <span className="font-mono text-ink-2 shrink-0 tabular-nums">
                      {totalEstimatedHouseholds ?? 0} Total Est. HH ({totalClustersCount} Clusters)
                    </span>
                  </div>
                  <div
                    role="img"
                    aria-label="Proportional bar chart of households by electrification classification"
                    className="h-4 w-full rounded-full overflow-hidden bg-subtle border border-rule-subtle flex"
                  >
                    {(
                      [
                        {
                          key: 'LIKELY_ELECTRIFIED',
                          color: 'bg-[#15803D]',
                          hh: proxyDistribution.LIKELY_ELECTRIFIED.households,
                        },
                        {
                          key: 'POTENTIALLY_UNDERSERVED',
                          color: 'bg-[#D97706]',
                          hh: proxyDistribution.POTENTIALLY_UNDERSERVED.households,
                        },
                        {
                          key: 'POTENTIALLY_UNSERVED',
                          color: 'bg-[#DC2626]',
                          hh: proxyDistribution.POTENTIALLY_UNSERVED.households,
                        },
                        {
                          key: 'UNKNOWN',
                          color: 'bg-[#64748B]',
                          hh: proxyDistribution.UNKNOWN.households,
                        },
                      ] as const
                    ).map((seg) => {
                      const pct =
                        totalEstimatedHouseholds && totalEstimatedHouseholds > 0
                          ? (seg.hh / totalEstimatedHouseholds) * 100
                          : 0;
                      if (pct <= 0) return null;
                      return (
                        <div
                          key={seg.key}
                          style={{ width: `${pct}%` }}
                          className={`${seg.color} h-full transition-all`}
                          title={`${seg.key}: ${seg.hh} HH (${pct.toFixed(1)}%)`}
                        />
                      );
                    })}
                  </div>

                  {/* Breakdown Legend Rows */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {(
                      [
                        {
                          key: 'LIKELY_ELECTRIFIED' as const,
                          dot: 'bg-[#15803D]',
                          data: proxyDistribution.LIKELY_ELECTRIFIED,
                        },
                        {
                          key: 'POTENTIALLY_UNDERSERVED' as const,
                          dot: 'bg-[#D97706]',
                          data: proxyDistribution.POTENTIALLY_UNDERSERVED,
                        },
                        {
                          key: 'POTENTIALLY_UNSERVED' as const,
                          dot: 'bg-[#DC2626]',
                          data: proxyDistribution.POTENTIALLY_UNSERVED,
                        },
                        {
                          key: 'UNKNOWN' as const,
                          dot: 'bg-[#64748B]',
                          data: proxyDistribution.UNKNOWN,
                        },
                      ]
                    ).map((row) => {
                      const pct =
                        totalEstimatedHouseholds && totalEstimatedHouseholds > 0
                          ? (row.data.households / totalEstimatedHouseholds) * 100
                          : 0;
                      return (
                        <div
                          key={row.key}
                          className="flex flex-col gap-1.5 bg-subtle/50 border border-rule-subtle rounded-sm px-3.5 py-2.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-ink font-semibold tabular-nums">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${row.dot}`} />
                              {row.data.households} HH ({pct.toFixed(0)}%)
                            </span>
                            <span className="text-ink-2 tabular-nums">
                              {row.data.clusters} cl
                            </span>
                          </div>
                          <div>
                            <ClassificationBadge proxyClass={row.key} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Census 2011 vs. Satellite Reconciliation Visual Comparison */}
                {settlements?.census_reconciliation && (
                  <div className="border-t border-rule pt-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-ink">
                        Census 2011 vs. Satellite Footprint Reconciliation (
                        {settlements.census_reconciliation.village_name ?? 'AOI'})
                      </span>
                      <Badge
                        variant={
                          settlements.census_reconciliation.divergence_exceeds_30pct
                            ? 'warn'
                            : 'ok'
                        }
                      >
                        {settlements.census_reconciliation.divergence_exceeds_30pct
                          ? `DIVERGENCE ${(settlements.census_reconciliation.delta_pct ?? 0).toFixed(1)}% (>30%)`
                          : `RECONCILED (${(settlements.census_reconciliation.delta_pct ?? 0).toFixed(1)}%)`}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5 text-xs">
                      <div className="bg-subtle/50 rounded-sm p-3">
                        <div className="text-xs text-ink-3">Census 2011 base</div>
                        <div className="text-sm font-mono font-semibold text-ink mt-0.5">
                          {settlements.census_reconciliation.census_2011_households} HH
                        </div>
                      </div>
                      <div className="bg-subtle/50 rounded-sm p-3">
                        <div className="text-xs text-ink-3">Projected baseline</div>
                        <div className="text-sm font-mono font-semibold text-ink mt-0.5">
                          {settlements.census_reconciliation.projected_base_year_households} HH
                        </div>
                      </div>
                      <div className="bg-subtle/50 rounded-sm p-3">
                        <div className="text-xs text-ink-3">Satellite estimate</div>
                        <div className="text-sm font-mono font-semibold text-accent mt-0.5">
                          {settlements.census_reconciliation.satellite_estimated_households} HH
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-ink-2">
                      {settlements.census_reconciliation.reconciliation_note}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={Home}
                title="No Habitation Clusters Generated Yet"
                description="Run DBSCAN clustering in Stage 2 (Villages & Habitations) to delineate settlement clusters and reconcile against Census 2011 household counts."
                action={
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => onNavigateSection('settlements')}
                  >
                    Go to Stage 2 · Villages & Habitations
                  </Button>
                }
              />
            )}
          </Panel>
        </div>

        {/* Chart 2: 4-Scenario Economic Comparison Chart (CAPEX vs. 20-Year NPC & LCOE) */}
        <div className="lg:col-span-6">
          <Panel
            overline="Chart 2 · Scenario Economics (₹ Lakhs)"
            title="Multi-Scenario CAPEX vs. Lifecycle Net Present Cost (NPC)"
            subtitle="Comparative evaluation of Grid Extension, Solar PV + LiFePO4 Mini-Grid, Standalone SHS, and Least-Cost Hybrid scenarios."
            actions={
              <Button
                size="xs"
                variant="ghost"
                rightIcon={ArrowRight}
                onClick={() => onNavigateSection('cost')}
              >
                Compare &amp; Pin
              </Button>
            }
          >
            {comparisonScenarios.length > 0 ? (
              <div
                role="img"
                aria-label="Scenario CAPEX and Net Present Cost comparison bar chart"
                className="space-y-3"
              >
                {comparisonScenarios.map((scen) => {
                  const capexPct = Math.min(
                    100,
                    Math.max(4, (scen.total_capex_lakhs / maxScenarioNpc) * 100),
                  );
                  const npcPct = Math.min(
                    100,
                    Math.max(4, (scen.npc_lakhs / maxScenarioNpc) * 100),
                  );
                  return (
                    <div
                      key={scen.scenario_id}
                      className={`rounded-md border p-3 space-y-2 ${
                        scen.is_active_baseline
                          ? 'bg-accent-soft/25 border-accent/40'
                          : 'bg-subtle/40 border-rule-subtle'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-ink">
                            {scen.scenario_key}
                          </span>
                          {scen.is_active_baseline && (
                            <Badge variant="primary">PINNED BASELINE</Badge>
                          )}
                          <Badge variant={scen.vdrop_compliance_ok ? 'ok' : 'warn'}>
                            {scen.vdrop_compliance_ok ? 'CEA OK' : 'VDROP WARN'}
                          </Badge>
                        </div>
                        <span className="font-mono text-[11px] text-ink-2">
                          LCOE: <strong>₹{scen.lcoe_inr_kwh.toFixed(2)}/kWh</strong> ·{' '}
                          {scen.avoided_co2_tonnes_yr.toFixed(1)} tCO₂/yr
                        </span>
                      </div>

                      {/* CAPEX Bar */}
                      <div className="grid grid-cols-12 items-center gap-2 text-[11px] font-mono">
                        <span className="col-span-2 text-ink-3">CAPEX</span>
                        <div className="col-span-7 h-2.5 bg-subtle rounded-full overflow-hidden border border-rule-subtle">
                          <div
                            style={{ width: `${capexPct}%` }}
                            className="h-full bg-accent rounded-full"
                          />
                        </div>
                        <span className="col-span-3 text-right font-semibold text-ink">
                          ₹{scen.total_capex_lakhs.toFixed(2)} L
                        </span>
                      </div>

                      {/* Lifecycle NPC Bar */}
                      <div className="grid grid-cols-12 items-center gap-2 text-[11px] font-mono">
                        <span className="col-span-2 text-ink-3">20Y NPC</span>
                        <div className="col-span-7 h-2.5 bg-subtle rounded-full overflow-hidden border border-rule-subtle">
                          <div
                            style={{ width: `${npcPct}%` }}
                            className="h-full bg-navy-800 rounded-full"
                          />
                        </div>
                        <span className="col-span-3 text-right font-bold text-ink">
                          ₹{scen.npc_lakhs.toFixed(2)} L
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="Scenario Cost Comparison Not Yet Computed"
                description="Generate network scenarios in Stage 4 and review the Schedule of Rates in Stage 5 to compare CAPEX, 20-year NPC, and LCOE across all 4 electrification modalities."
                action={
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => onNavigateSection('network')}
                  >
                    Go to Stage 4 · Network Design
                  </Button>
                }
              />
            )}
          </Panel>
        </div>

        {/* Chart 3: 7-Category Consumer Load & Horizon Demand Forecast */}
        <div className="lg:col-span-6">
          <Panel
            overline="Chart 3 · Consumer Load & Horizon Growth"
            title="7-Category Connected Load & Diversified Demand Breakdown"
            subtitle={
              demand
                ? `Base Year: ${demand.peak_kva_base.toFixed(2)} kVA → Year-${demand.horizon_years} Horizon: ${demand.peak_kva_horizon.toFixed(2)} kVA (${(demand.annual_growth_rate * 100).toFixed(1)}%/yr growth)`
                : 'Normative REC / CEA consumer category demand disaggregation.'
            }
            actions={
              <Button
                size="xs"
                variant="ghost"
                rightIcon={ArrowRight}
                onClick={() => onNavigateSection('infrastructure')}
              >
                Edit Load Norms
              </Button>
            }
          >
            {demand && demand.category_totals.length > 0 ? (
              <div className="space-y-3">
                {/* Base vs Horizon Peak kVA growth bar */}
                <div className="bg-subtle/60 border border-rule-subtle rounded-sm p-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div>
                    <span className="text-ink-3">BASE PEAK:</span>{' '}
                    <strong className="text-ink">{demand.peak_kva_base.toFixed(2)} kVA</strong> (
                    {demand.energy_kwh_day_base.toFixed(1)} kWh/day)
                  </div>
                  <span className="text-ink-3">→</span>
                  <div>
                    <span className="text-ink-3">YEAR-{demand.horizon_years} HORIZON:</span>{' '}
                    <strong className="text-accent">
                      {demand.peak_kva_horizon.toFixed(2)} kVA
                    </strong>{' '}
                    ({demand.annual_energy_mwh_horizon.toFixed(2)} MWh/yr)
                  </div>
                </div>

                {/* Category Bars */}
                <div
                  role="img"
                  aria-label="Consumer category connected load breakdown chart"
                  className="space-y-2"
                >
                  {demand.category_totals.map((cat) => {
                    const widthPct = Math.min(
                      100,
                      Math.max(3, (cat.connected_kw / maxCategoryKw) * 100),
                    );
                    return (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-ink truncate">{cat.label}</span>
                          <span className="font-mono text-[11px] text-ink-2 shrink-0">
                            {cat.consumer_count} units ·{' '}
                            <strong>{cat.connected_kw.toFixed(2)} kW</strong> (
                            {cat.energy_kwh_day.toFixed(1)} kWh/d)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-subtle border border-rule-subtle rounded-full overflow-hidden">
                          <div
                            style={{ width: `${widthPct}%` }}
                            className="h-full bg-[#0284C7] rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Activity}
                title="Consumer Load Forecast Not Available"
                description="Complete habitation clustering (Stage 2) to compute the 7-category connected load and 10-year horizon kVA demand forecast."
                action={
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => onNavigateSection('infrastructure')}
                  >
                    Go to Stage 3 · Grid & Demand
                  </Button>
                }
              />
            )}
          </Panel>
        </div>

        {/* Chart 4: Electrification Gap & Modality Split + Infrastructure Summary */}
        <div className="lg:col-span-6">
          <Panel
            overline="Chart 4 · Feeder Gap & Modality Screening"
            title="Terrain-Weighted Grid Distance & Modality Candidate Split"
            subtitle="Comparison of Euclidean straight-line distance vs. slope/land-cover terrain-penalized distance to nearest 11 kV / LT infrastructure."
            actions={
              <Button
                size="xs"
                variant="ghost"
                rightIcon={ArrowRight}
                onClick={() => onNavigateSection('infrastructure')}
              >
                Manage Grid Tie-Ins
              </Button>
            }
          >
            {gapAnalysis && gapAnalysis.has_existing_infra ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-subtle/50 rounded-sm p-3">
                    <div className="text-xs text-ink-3">Mean straight dist</div>
                    <div className="text-sm font-mono font-semibold text-ink mt-0.5">
                      {gapAnalysis.mean_d_straight_m !== null
                        ? `${(gapAnalysis.mean_d_straight_m / 1000).toFixed(2)} km`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-subtle/50 rounded-sm p-3">
                    <div className="text-xs text-ink-3">Mean terrain dist</div>
                    <div className="text-sm font-mono font-semibold text-accent mt-0.5">
                      {gapAnalysis.mean_d_terrain_m !== null
                        ? `${(gapAnalysis.mean_d_terrain_m / 1000).toFixed(2)} km`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-subtle/50 rounded-sm p-3">
                    <div className="text-xs text-ink-3">Max terrain gap</div>
                    <div className="text-sm font-mono font-semibold text-warn mt-0.5">
                      {gapAnalysis.max_d_terrain_m !== null
                        ? `${(gapAnalysis.max_d_terrain_m / 1000).toFixed(2)} km`
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* Modality Candidate Counts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="border border-rule-subtle rounded-sm p-3 bg-subtle/30">
                    <div className="text-xs text-ink-3">Grid Extension</div>
                    <div className="text-base font-mono font-semibold text-ink mt-0.5">
                      {gapAnalysis.grid_extension_candidates}
                    </div>
                    <div className="text-xs text-ink-2">clusters</div>
                  </div>
                  <div className="border border-rule-subtle rounded-sm p-3 bg-subtle/30">
                    <div className="text-xs text-ink-3">Augmentation</div>
                    <div className="text-base font-mono font-semibold text-ink mt-0.5">
                      {gapAnalysis.augmentation_candidates}
                    </div>
                    <div className="text-xs text-ink-2">clusters</div>
                  </div>
                  <div className="border border-rule-subtle rounded-sm p-3 bg-subtle/30">
                    <div className="text-xs text-ink-3">Solar Mini-Grid</div>
                    <div className="text-base font-mono font-semibold text-accent mt-0.5">
                      {gapAnalysis.minigrid_candidates}
                    </div>
                    <div className="text-xs text-ink-2">clusters</div>
                  </div>
                  <div className="border border-rule-subtle rounded-sm p-3 bg-subtle/30">
                    <div className="text-xs text-ink-3">Standalone SHS</div>
                    <div className="text-base font-mono font-semibold text-ink mt-0.5">
                      {gapAnalysis.shs_candidates}
                    </div>
                    <div className="text-xs text-ink-2">clusters</div>
                  </div>
                </div>

                {/* Cluster-level gap preview */}
                {gapAnalysis.clusters.length > 0 && (
                  <div className="border-t border-rule-subtle pt-3 space-y-2">
                    <div className="text-xs font-medium text-ink-2">
                      Habitation Modality Screening Register
                    </div>
                    {gapAnalysis.clusters.slice(0, 4).map((cl) => (
                      <div
                        key={cl.cluster_id}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs bg-subtle/40 border border-rule-subtle rounded-sm px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-ink">{cl.cluster_label}</span>
                          <span className="text-ink-2 truncate">{cl.cluster_name}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span>
                            {cl.d_terrain_m !== null
                              ? `${(cl.d_terrain_m / 1000).toFixed(2)} km eff.`
                              : 'UNSET'}
                          </span>
                          <Badge variant="primary">{cl.recommended_modality}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Callout
                  tone="warn"
                  title="Existing Electrical Infrastructure UNSET — Distances Cannot Be Fabricated"
                >
                  No existing 11 kV lines, substations, or distribution transformers are registered
                  for this project. Upload utility GIS layers or place an explicit{' '}
                  <code>USER_ASSUMED</code> 11 kV tie-in point on the map to compute feeder
                  distances.
                </Callout>
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => onNavigateSection('infrastructure')}
                  >
                    Configure Existing Grid / Place Tie-In
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* 6. Data-Source Indicators & Recent Activity / Audit Trail (2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Data-Source & Layer Provenance Indicators */}
        <div className="lg:col-span-7">
          <Panel
            overline="Data-Source & Provenance Registry"
            title="Geospatial Layer Readiness & Open-Data Licences"
            subtitle="Every satellite and vector dataset used in this project is tracked with explicit provider, spatial resolution, temporal vintage, and open licence metadata."
            actions={
              <Button
                size="xs"
                variant="ghost"
                rightIcon={ArrowRight}
                onClick={() => onNavigateSection('data')}
              >
                Manage Layers
              </Button>
            }
          >
            {layers.length > 0 ? (
              <div className="divide-y divide-rule-subtle border border-rule-subtle rounded-md overflow-hidden">
                {layers.map((lyr) => {
                  const sourceType = inferLayerSourceType(lyr);
                  const displayTitle =
                    CANONICAL_LAYER_LABELS[lyr.layer_key] ??
                    lyr.dataset?.name ??
                    lyr.layer_key;
                  return (
                    <div
                      key={lyr.id}
                      className="p-3 bg-sheet hover:bg-subtle/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-body-sm text-ink truncate">
                            {displayTitle}
                          </span>
                          <LayerSourceBadge source={sourceType} />
                        </div>
                        <p className="text-xs text-ink-2">
                          {lyr.dataset
                            ? `${lyr.dataset.provider} · ${lyr.dataset.spatial_resolution ?? 'Vector'} · ${lyr.dataset.temporal_coverage ?? 'Current'} · Licence: ${lyr.dataset.licence}`
                            : `Cache key: ${lyr.cache_key ?? 'local'}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-xs">
                        {typeof lyr.feature_count === 'number' && lyr.feature_count > 0 && (
                          <span className="font-mono text-ink-2">
                            {lyr.feature_count.toLocaleString()} features
                          </span>
                        )}
                        <Badge
                          variant={
                            lyr.status === 'READY'
                              ? 'ok'
                              : lyr.status === 'FAILED'
                                ? 'error'
                                : 'warn'
                          }
                        >
                          {lyr.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Layers}
                title="No Geospatial Layers Acquired Yet"
                description="Trigger the 6-layer open geospatial data acquisition job in Stage 1 to populate building footprints, DEM slope, land cover, solar GHI, and VIIRS nightlights."
                action={
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => onNavigateSection('data')}
                  >
                    Acquire Project Data Layers
                  </Button>
                }
              />
            )}
          </Panel>
        </div>

        {/* Right: Recent Activity, Verification Ledger & SHA-256 Export Audit Feed */}
        <div className="lg:col-span-5">
          <Panel
            overline="Recent Activity & Audit Trail"
            title="Field Verifications, Jobs & SHA-256 Exports"
            subtitle="Append-only record of Axis-2 field verifications, background processing jobs, and cryptographically hashed DPR exports."
            actions={
              <Button
                size="xs"
                variant="ghost"
                rightIcon={ArrowRight}
                onClick={() => onNavigateSection('reports')}
              >
                Export Audit Log
              </Button>
            }
          >
            {activityFeed.length > 0 ? (
              <div className="divide-y divide-rule-subtle border border-rule-subtle rounded-md overflow-hidden">
                {activityFeed.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-sheet hover:bg-subtle/40 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink truncate">{item.title}</span>
                      <Badge variant={item.badgeTone}>{item.badgeText}</Badge>
                    </div>
                    <p className="text-xs text-ink-2 line-clamp-2">{item.subtitle}</p>
                    <div className="text-2xs font-mono text-ink-3">
                      {item.timestamp.slice(0, 19).replace('T', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="No Verification or Export Activity Recorded Yet"
                description="Axis-2 field verification ledger entries and SHA-256 hashed DPR export records will appear here as planners verify clusters and compile reports."
              />
            )}
          </Panel>
        </div>
      </div>
    </section>
  );
};
