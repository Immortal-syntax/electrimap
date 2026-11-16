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
import {
  classifyLayerHonesty,
  computeMapDataReadiness,
  type ProjectLayerDto,
} from '../../lib/mapDataReadiness';
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
import {
  Badge,
  ClassificationBadge,
} from '../ui/Badge';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { QualityTag } from '../ui/QualityTag';
import { HelpTooltip } from '../ui/Tooltip';
import {
  formatBoundarySourceLabel,
  formatJobStatusLabel,
  formatJobTypeLabel,
  formatModalityLabel,
  formatScenarioLabel,
  formatSchemeLabel,
} from '../../lib/beginnerGlossary';

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
  buildings: 'Building Footprints',
  dem_slope: 'Terrain Slope & Elevation',
  landcover: 'Land Cover (Trees, Crops & Water)',
  solar_resource: 'Solar Sunlight Resource',
  nightlights: 'Nighttime Lights',
  osm_features: 'Roads, Waterways & Amenities',
};

export const ProjectOverviewDashboard: React.FC<ProjectOverviewDashboardProps> = ({
  project,
  layers,
  settlements,
  verificationLedger,
  infrastructure,
  gapAnalysis,
  demand: rawDemand,
  scenariosState: rawScenariosState,
  ratesState,
  comparisonState: rawComparisonState,
  preflightState,
  exportLogState,
  jobsState = [],
  onNavigateSection,
  heroMapSlot,
  onOpenFullMap,
}) => {
  // ── 1. Derived API-Grounded Metrics (Zero Fabricated Numbers) ──
  const mapReadiness = computeMapDataReadiness(layers);
  const readyLayers = layers.filter((l) => l.status === 'READY');
  const buildingsLayer = layers.find((l) => l.layer_key === 'buildings' && l.status === 'READY');
  const solarLayer = layers.find((l) => l.layer_key === 'solar_resource' && l.status === 'READY');
  const nightlightsLayer = layers.find(
    (l) => l.layer_key === 'nightlights' && l.status === 'READY',
  );

  const clusterItems = React.useMemo(
    () => settlements?.items ?? [],
    [settlements?.items],
  );
  const totalClustersCount = clusterItems.length;

  const detectedStructuresCount =
    buildingsLayer && typeof buildingsLayer.feature_count === 'number'
      ? buildingsLayer.feature_count
      : totalClustersCount > 0 ||
          readyLayers.length > 0 ||
          (settlements?.census_reconciliation?.satellite_detected_buildings ?? 0) > 0
        ? settlements?.census_reconciliation?.satellite_detected_buildings ?? null
        : null;

  const residentialStructuresCount =
    buildingsLayer && typeof buildingsLayer.summary_metrics?.residential_count === 'number'
      ? Number(buildingsLayer.summary_metrics.residential_count)
      : totalClustersCount > 0 ||
          readyLayers.length > 0 ||
          (settlements?.census_reconciliation?.satellite_residential_buildings ?? 0) > 0
        ? settlements?.census_reconciliation?.satellite_residential_buildings ?? null
        : null;

  const worstMonthGhi =
    solarLayer && typeof solarLayer.summary_metrics?.worst_ghi_kwh_m2_day === 'number'
      ? Number(solarLayer.summary_metrics.worst_ghi_kwh_m2_day)
      : null;

  const meanAnnualGhi =
    solarLayer &&
    typeof (
      solarLayer.summary_metrics?.annual_mean_ghi_kwh_m2_day ??
      solarLayer.summary_metrics?.mean_ghi_kwh_m2_day
    ) === 'number'
      ? Number(
          solarLayer.summary_metrics?.annual_mean_ghi_kwh_m2_day ??
            solarLayer.summary_metrics?.mean_ghi_kwh_m2_day,
        )
      : null;

  const optimalTiltDeg =
    solarLayer && typeof solarLayer.summary_metrics?.optimal_tilt_deg === 'number'
      ? Number(solarLayer.summary_metrics.optimal_tilt_deg)
      : null;

  // Empty projects receive zeroed placeholder demand/scenario/comparison payloads from API;
  // withhold them until clusters exist or non-zero outputs are present.
  const demand =
    rawDemand &&
    (totalClustersCount > 0 ||
      rawDemand.total_households > 0 ||
      rawDemand.peak_kva_horizon > 0 ||
      rawDemand.total_connected_kw > 0)
      ? rawDemand
      : null;

  const totalEstimatedHouseholds =
    demand?.total_households ??
    (clusterItems.length > 0
      ? clusterItems.reduce((acc, c) => acc + c.est_households, 0)
      : null);

  const verificationCoveragePct =
    settlements && clusterItems.length > 0 ? settlements.verification_coverage_pct : null;
  const verifiedClustersCount = verificationLedger?.verified_clusters ?? 0;

  const rawActiveScenario = rawScenariosState?.active_scenario ?? null;
  const activeScenario =
    rawActiveScenario &&
    (totalClustersCount > 0 ||
      rawActiveScenario.total_ht_length_m > 0 ||
      rawActiveScenario.total_lt_length_m > 0 ||
      rawActiveScenario.total_solar_kwp > 0 ||
      rawActiveScenario.total_dt_count > 0)
      ? rawActiveScenario
      : null;

  const rawComparisonScenarios = rawComparisonState?.scenarios ?? [];
  const hasSubstantiveComparison =
    totalClustersCount > 0 ||
    rawComparisonScenarios.some(
      (s) => s.total_capex_lakhs > 0 || s.npc_lakhs > 0 || s.has_unset_rates || s.totals_withheld,
    );
  const comparisonScenarios = hasSubstantiveComparison ? rawComparisonScenarios : [];
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
    const normalizeClass = (rawCls: string | null | undefined): keyof typeof counts => {
      switch (rawCls) {
        case 'LIKELY_ELECTRIFIED':
        case 'ELECTRIFIED':
        case 'GRID_CONNECTED':
          return 'LIKELY_ELECTRIFIED';
        case 'POTENTIALLY_UNDERSERVED':
        case 'UNDERSERVED':
          return 'POTENTIALLY_UNDERSERVED';
        case 'POTENTIALLY_UNSERVED':
        case 'UNSERVED':
          return 'POTENTIALLY_UNSERVED';
        default:
          return 'UNKNOWN';
      }
    };
    for (const c of clusterItems) {
      const cls = normalizeClass(c.verified_class ?? c.proxy_class);
      counts[cls].clusters += 1;
      counts[cls].households += c.est_households;
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
        stepLabel: 'STEP 1 · STUDY DATA',
        title: 'Fetch Free Map & Satellite Data for Your Area',
        detail:
          'No map or satellite layers have been loaded yet. Run the free open-data step to download building footprints, elevation slope, tree cover, sunlight, and night-light layers.',
        buttonLabel: 'Open Step 1 · Data & Layers',
        targetSection: 'data',
        tone: 'warn',
      };
    }
    if (totalClustersCount === 0) {
      return {
        stepLabel: 'STEP 2 · HAMLETS & HOUSES',
        title: 'Group Detected Houses into Hamlets & Check Counts',
        detail:
          'Building footprints are loaded, but hamlets (habitation clusters) have not been grouped yet. Group nearby roofs and compare counts with local Census records.',
        buttonLabel: 'Open Step 2 · Villages & Habitations',
        targetSection: 'settlements',
        tone: 'warn',
      };
    }
    if (!infrastructure?.has_existing_infra) {
      return {
        stepLabel: 'STEP 3 · EXISTING GRID & DEMAND',
        title: 'Add Nearby Power Lines or Mark a Connection Point',
        detail:
          'No existing power lines or connection points are saved yet. Upload local utility files or click the map to mark a proposed 11 kV connection pole so distances can be measured.',
        buttonLabel: 'Open Step 3 · Grid & Demand',
        targetSection: 'infrastructure',
        tone: 'warn',
      };
    }
    if (!activeScenario) {
      return {
        stepLabel: 'STEP 4 · NETWORK DESIGN',
        title: 'Design Power Lines, Transformers & Solar Options',
        detail:
          'Hamlets and connection points are ready. Run the network designer to choose grid or solar options, size transformers, and check safe voltage levels.',
        buttonLabel: 'Open Step 4 · Network Design',
        targetSection: 'network',
        tone: 'info',
      };
    }
    if (ratesState && ratesState.unset_count > 0) {
      return {
        stepLabel: 'STEP 5 · COSTS & RATES',
        title: `Enter ${ratesState.unset_count} Missing Unit Price(s) Before Export`,
        detail: `Some equipment items (${ratesState.unset_item_codes.join(', ')}) do not have a unit cost yet. Fill in or upload unit rates before downloading your final report.`,
        buttonLabel: 'Open Step 5 · Costs & Scenarios',
        targetSection: 'cost',
        tone: 'warn',
      };
    }
    return {
      stepLabel: 'STEP 6 · FINAL CHECK & REPORT',
      title: preflightState?.can_export
        ? 'All Checks Passed — Ready to Download Project Report & Cost Sheet'
        : 'Review Final Checklist & Generate Project Report',
      detail:
        verificationCoveragePct !== null && verificationCoveragePct < 100
          ? `Technical design and unit costs are ready. Ground checks currently cover ${verificationCoveragePct.toFixed(1)}% of hamlets — downloads will carry a "Preliminary — Not Field Verified" notice.`
          : 'All planning steps, unit costs, and field checks are complete for downloading the 24-section PDF report and Excel cost workbook.',
      buttonLabel: 'Open Step 6 · Final Check & Report',
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

  const populatedDprSectionsCount =
    preflightState?.sections.filter((s) => s.is_populated).length ?? 0;
  const hasAnySubstantiveData =
    readyLayers.length > 0 && totalClustersCount > 0;

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
      step: 'GIS MAP',
      title: 'Interactive GIS Map',
      metricLabel: project.aoi
        ? `${project.aoi.area_km2.toFixed(2)} km² study area`
        : 'Study area not defined',
      statusText: project.aoi ? 'Area Ready' : 'Needs Area',
      statusTone: project.aoi ? 'primary' : 'warn',
      icon: MapIcon,
    },
    {
      key: 'data',
      step: 'STEP 1',
      title: 'Study Area & Data',
      metricLabel:
        layers.length > 0
          ? `${mapReadiness.usableCount} of ${mapReadiness.totalCount} layers usable`
          : 'No data fetched yet',
      statusText: mapReadiness.label,
      statusTone: mapReadiness.badgeVariant,
      icon: Database,
    },
    {
      key: 'settlements',
      step: 'STEP 2',
      title: 'Villages & Habitations',
      metricLabel:
        totalClustersCount > 0
          ? `${totalClustersCount} Hamlets · ${totalEstimatedHouseholds ?? 0} Est. Homes`
          : 'No hamlets grouped yet',
      statusText:
        verificationCoveragePct === null
          ? 'Not Run'
          : verificationCoveragePct >= 100
            ? 'Field Confirmed'
            : verificationCoveragePct > 0
              ? `${verificationCoveragePct.toFixed(0)}% Confirmed`
              : 'Needs Ground Check',
      statusTone:
        totalClustersCount === 0
          ? 'warn'
          : (verificationCoveragePct ?? 0) >= 100
            ? 'ok'
            : (verificationCoveragePct ?? 0) > 0
              ? 'primary'
              : 'warn',
      icon: Home,
    },
    {
      key: 'infrastructure',
      step: 'STEP 3',
      title: 'Grid & Demand',
      metricLabel: demand
        ? `Future Peak Load: ${demand.peak_kva_horizon.toFixed(1)} kVA`
        : 'Load not estimated yet',
      statusText: infrastructure?.has_existing_infra
        ? `${infrastructure.items.length} Grid Point(s)`
        : 'No Grid Added',
      statusTone: infrastructure?.has_existing_infra ? 'ok' : 'warn',
      icon: Zap,
    },
    {
      key: 'network',
      step: 'STEP 4',
      title: 'Network Design',
      metricLabel: activeScenario
        ? `Main 11 kV: ${(activeScenario.total_ht_length_m / 1000).toFixed(2)} km · Street LT: ${(
            activeScenario.total_lt_length_m / 1000
          ).toFixed(2)} km`
        : 'No routes designed yet',
      statusText: activeScenario
        ? activeScenario.vdrop_compliance_ok
          ? 'Voltage OK'
          : 'Voltage Drop Alert'
        : 'Pending',
      statusTone: activeScenario
        ? activeScenario.vdrop_compliance_ok
          ? 'ok'
          : 'warn'
        : 'neutral',
      icon: GitBranch,
    },
    {
      key: 'cost',
      step: 'STEP 5',
      title: 'Costs & Scenarios',
      metricLabel: activeScenarioComparison
        ? activeScenarioComparison.has_unset_rates || activeScenarioComparison.totals_withheld
          ? 'Totals paused — prices needed'
          : `Upfront ₹${activeScenarioComparison.total_capex_lakhs.toFixed(2)} L · Lifetime ₹${activeScenarioComparison.npc_lakhs.toFixed(2)} L`
        : 'No cost estimate yet',
      statusText: !ratesState || ratesState.items.length === 0
        ? 'Pending'
        : ratesState.unset_count > 0
          ? `${ratesState.unset_count} Missing`
          : activeScenarioComparison
            ? 'Prices Set'
            : 'Default Rates',
      statusTone:
        !ratesState || ratesState.items.length === 0
          ? 'neutral'
          : ratesState.unset_count > 0
            ? 'error'
            : activeScenarioComparison
              ? 'ok'
              : 'neutral',
      icon: BarChart3,
    },
    {
      key: 'reports',
      step: 'STEP 6',
      title: 'Final Check & Report',
      metricLabel: !preflightState
        ? 'Checklist not run yet'
        : !hasAnySubstantiveData
          ? 'Complete Steps 1–5 first'
          : `${populatedDprSectionsCount}/24 Sections Ready`,
      statusText: !preflightState
        ? 'Pending'
        : preflightState.can_export
          ? 'Ready to Export'
          : 'Not Ready',
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
        title: `Hamlet ${rec.cluster_label} — ${rec.evidence_type.replace(/_/g, ' ')}`,
        subtitle: `Checked by ${rec.verifier_name}${rec.note ? ` · "${rec.note}"` : ''}`,
        timestamp: rec.created_at || rec.observed_on,
        badgeText: 'Field Verified',
        badgeTone: 'ok',
      });
    }

    for (const exp of (exportLogState?.items ?? []).slice(0, 5)) {
      items.push({
        id: `exp-${exp.id}`,
        kind: 'EXPORT',
        title: `${exp.export_kind} — ${exp.filename}`,
        subtitle: `Verification ID: ${exp.file_sha256.slice(0, 12)}… · ${(exp.file_size_bytes / 1024).toFixed(1)} KB`,
        timestamp: exp.created_at,
        badgeText: exp.preflight_passed ? 'Final Export' : 'Preliminary',
        badgeTone: 'primary',
      });
    }

    for (const job of jobsState.slice(0, 5)) {
      items.push({
        id: `job-${job.id}`,
        kind: 'JOB',
        title: formatJobTypeLabel(job.job_type),
        subtitle: job.stage ?? `${formatJobStatusLabel(job.status)} (${job.progress}%)`,
        timestamp: job.updated_at || job.created_at,
        badgeText: formatJobStatusLabel(job.status),
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
                    Study Area — {project.aoi ? `${project.aoi.area_km2.toFixed(2)} km²` : 'Boundary Needed'}
                  </span>
                  <span className="font-mono text-2xs px-2 py-0.5 rounded-full bg-subtle text-ink-3">
                    Grid EPSG:{project.metric_epsg}
                  </span>
                  <HelpTooltip glossaryKey="crsEpsgUtm" label="About map grid projection" />
                </div>
                <button
                  type="button"
                  onClick={launchFullMap}
                  className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
                >
                  Open Full GIS Map →
                </button>
              </div>
              <div className="flex-1 rounded-xl overflow-hidden shadow-overlay border border-rule/80 bg-sheet">
                {heroMapSlot}
              </div>
              {!project.aoi && (
                <EmptyState
                  compact
                  icon={Compass}
                  title="Study Boundary Not Configured"
                  description="Define a village boundary or draw an area in New Project Setup to enable measurements."
                />
              )}
            </div>
          ) : (
            <Panel
              overline="Geographic & Scheme Summary"
              title="Study Area Boundary & Spatial Grid"
              subtitle="All distances (m), areas (km²), and hamlet sizes are measured using a flat local meter grid."
              actions={
                <div className="flex items-center gap-1.5">
                  <Badge variant="primary" mono>
                    EPSG:{project.metric_epsg}
                  </Badge>
                  <HelpTooltip glossaryKey="crsEpsgUtm" label="About map coordinate grid" />
                </div>
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
                        {[project.target_state, project.target_district, project.target_block]
                          .filter(Boolean)
                          .join(' · ') || 'Study Boundary Defined'}
                      </dd>
                    </div>
                    <div className="bg-subtle/60 rounded-sm p-3.5">
                      <dt className="text-xs font-medium text-ink-3">
                        Funding Scheme &amp; Lifespan
                      </dt>
                      <dd className="text-body-sm font-semibold text-ink mt-1">
                        {formatSchemeLabel(project.scheme)} ({project.horizon_years} yrs @{' '}
                        {(project.discount_rate * 100).toFixed(1)}%)
                      </dd>
                    </div>
                    <div className="bg-subtle/60 rounded-sm p-3.5">
                      <dt className="text-xs font-medium text-ink-3">
                        Study Area Size &amp; Source
                      </dt>
                      <dd className="text-body-sm font-mono font-semibold text-ink mt-1">
                        {project.aoi.area_km2.toFixed(2)} km² ({formatBoundarySourceLabel(project.aoi.boundary_source)})
                      </dd>
                    </div>
                    <div className="bg-subtle/60 rounded-sm p-3.5">
                      <dt className="text-xs font-medium text-ink-3">
                        Village &amp; Census Codes
                      </dt>
                      <dd className="text-body-sm font-mono font-semibold text-ink mt-1">
                        Village: {project.aoi.lgd_code ?? 'Unlinked'} · Census:{' '}
                        {project.aoi.census2011_code ??
                          settlements?.census_reconciliation?.census2011_code ??
                          'Unlinked'}
                      </dd>
                    </div>
                  </dl>

                  {buildingsLayer?.bbox && buildingsLayer.bbox.length === 4 && (
                    <div className="bg-subtle/40 border border-rule-subtle rounded-sm px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
                      <span className="text-ink-3 font-medium">Map Bounding Box (Lat/Lon):</span>
                      <span className="font-mono">
                        [{buildingsLayer.bbox[0]?.toFixed(4)}°E, {buildingsLayer.bbox[1]?.toFixed(4)}
                        °N] → [{buildingsLayer.bbox[2]?.toFixed(4)}°E,{' '}
                        {buildingsLayer.bbox[3]?.toFixed(4)}°N]
                      </span>
                    </div>
                  )}

                  <div className="bg-subtle/40 border border-rule-subtle rounded-sm p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-ink text-body-sm inline-flex items-center gap-1.5">
                        Sunlight &amp; Nighttime Satellite Context
                        <HelpTooltip glossaryKey="ghiSolarIrradiance" label="About solar irradiance" />
                      </span>
                      <p className="text-xs text-ink-2 mt-1">
                        {worstMonthGhi !== null
                          ? `Cloudiest month sunlight: ${worstMonthGhi.toFixed(2)} kWh/m²/day · Yearly avg: ${
                              meanAnnualGhi?.toFixed(2) ?? '—'
                            } kWh/m²/day · Panel tilt: ${optimalTiltDeg?.toFixed(0) ?? '19'}°`
                          : 'Sunlight data not yet loaded (run Step 1).'}
                      </p>
                    </div>
                    <QualityTag kind={worstMonthGhi !== null ? 'ESTIMATED' : 'UNSET'} />
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Compass}
                  title="Study Boundary Not Configured"
                  description="Pick a village or draw a boundary in New Project Setup to enable measurements."
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
              <Badge variant="navy">
                {formatSchemeLabel(project.scheme).split(' (')[0]}
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

          {/* Open Editorial Key Indicators Matrix */}
          <div className="bg-sheet border border-rule/80 rounded-lg shadow-card p-5 flex-1 flex flex-col justify-between gap-4">
            <div className="grid grid-cols-2 gap-x-5 gap-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-ink-3 inline-flex items-center gap-1">
                    Detected Houses
                    <HelpTooltip glossaryKey="buildingFootprints" label="About detected houses" />
                  </span>
                  <QualityTag kind={detectedStructuresCount !== null ? 'ESTIMATED' : 'UNSET'} />
                </div>
                <div className="text-xl font-bold tracking-tight tabular-nums text-ink">
                  {detectedStructuresCount !== null
                    ? detectedStructuresCount.toLocaleString()
                    : 'Not loaded'}
                </div>
                <div className="text-2xs text-ink-3">
                  {residentialStructuresCount !== null
                    ? `${residentialStructuresCount.toLocaleString()} residential`
                    : 'Run Step 1 first'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-ink-3">
                    Hamlet Groups
                  </span>
                  <QualityTag kind={totalClustersCount > 0 ? 'ESTIMATED' : 'UNSET'} />
                </div>
                <div className="text-xl font-bold tracking-tight tabular-nums text-ink">
                  {totalClustersCount > 0 ? `${totalClustersCount} hamlets` : 'Not grouped'}
                </div>
                <div className="text-2xs text-ink-3">
                  {totalEstimatedHouseholds !== null
                    ? `${totalEstimatedHouseholds.toLocaleString()} est. homes · ${verifiedClustersCount} verified`
                    : 'Run Step 2 first'}
                </div>
              </div>

              <div className="space-y-1 pt-3 border-t border-rule-subtle">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-ink-3 inline-flex items-center gap-1">
                    Peak Load
                    <HelpTooltip glossaryKey="loadFactorPowerFactor" label="About peak electricity load" />
                  </span>
                  <QualityTag kind={demand ? 'ESTIMATED' : 'UNSET'} />
                </div>
                <div className="text-xl font-bold tracking-tight tabular-nums text-ink">
                  {demand ? `${demand.peak_kva_horizon.toFixed(2)} kVA` : 'Not estimated'}
                </div>
                <div className="text-2xs text-ink-3">
                  {demand
                    ? `${demand.total_connected_kw.toFixed(1)} kW total appliances`
                    : 'Needs hamlets'}
                </div>
              </div>

              <div className="space-y-1 pt-3 border-t border-rule-subtle">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-ink-3 inline-flex items-center gap-1">
                    Distance to Grid
                    <HelpTooltip glossaryKey="terrainCostSurface" label="About terrain feeder distance" />
                  </span>
                  <QualityTag
                    kind={
                      gapAnalysis?.has_existing_infra
                        ? gapAnalysis.assumed_assets_count > 0
                          ? 'ASSUMED'
                          : 'ESTIMATED'
                        : 'UNSET'
                    }
                  />
                </div>
                <div className="text-xl font-bold tracking-tight tabular-nums text-ink">
                  {gapAnalysis?.has_existing_infra && gapAnalysis.mean_d_terrain_m !== null
                    ? `${(gapAnalysis.mean_d_terrain_m / 1000).toFixed(2)} km`
                    : 'Not added'}
                </div>
                <div className="text-2xs text-ink-3">
                  {gapAnalysis?.has_existing_infra && gapAnalysis.max_d_terrain_m !== null
                    ? `Farthest hamlet ${(gapAnalysis.max_d_terrain_m / 1000).toFixed(2)} km`
                    : 'Add connection point in Step 3'}
                </div>
              </div>

              <div className="space-y-1 pt-3 border-t border-rule-subtle">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-ink-3 inline-flex items-center gap-1">
                    Estimated Build Cost
                    <HelpTooltip glossaryKey="capexOpexNpvLcoe" label="About CAPEX and unit prices" />
                  </span>
                  <QualityTag
                    kind={
                      activeScenarioComparison
                        ? activeScenarioComparison.has_unset_rates ||
                          activeScenarioComparison.totals_withheld
                          ? 'UNSET'
                          : 'ESTIMATED'
                        : 'UNSET'
                    }
                  />
                </div>
                <div className="text-xl font-bold tracking-tight tabular-nums text-ink">
                  {activeScenarioComparison
                    ? activeScenarioComparison.has_unset_rates ||
                      activeScenarioComparison.totals_withheld
                      ? 'Prices Needed'
                      : `₹${activeScenarioComparison.total_capex_lakhs.toFixed(2)} L`
                    : 'Not computed'}
                </div>
                <div className="text-2xs text-ink-3">
                  {activeScenarioComparison
                    ? activeScenarioComparison.has_unset_rates ||
                      activeScenarioComparison.totals_withheld
                      ? 'Enter missing item prices in Step 5'
                      : `Utility net ₹${(activeScenarioComparison.net_utility_capex_inr / 100000).toFixed(2)} L`
                    : 'Run Steps 4 & 5'}
                </div>
              </div>

              <div className="space-y-1 pt-3 border-t border-rule-subtle">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-ink-3">
                    {project.horizon_years}-Yr Total Cost
                  </span>
                  <QualityTag
                    kind={
                      activeScenarioComparison
                        ? activeScenarioComparison.has_unset_rates ||
                          activeScenarioComparison.totals_withheld
                          ? 'UNSET'
                          : 'ESTIMATED'
                        : 'UNSET'
                    }
                  />
                </div>
                <div className="text-xl font-bold tracking-tight tabular-nums text-ink">
                  {activeScenarioComparison
                    ? activeScenarioComparison.has_unset_rates ||
                      activeScenarioComparison.totals_withheld
                      ? 'Prices Needed'
                      : `₹${activeScenarioComparison.npc_lakhs.toFixed(2)} L`
                    : 'Not computed'}
                </div>
                <div className="text-2xs text-ink-3">
                  {activeScenarioComparison
                    ? activeScenarioComparison.has_unset_rates ||
                      activeScenarioComparison.totals_withheld
                      ? 'Unit cost waiting on Step 5 rates'
                      : `Avg ₹${activeScenarioComparison.lcoe_inr_kwh.toFixed(2)}/kWh`
                    : 'Needs cost step'}
                </div>
              </div>
            </div>

            {project.aoi && (
              <div className="pt-3 border-t border-rule-subtle flex flex-wrap items-center justify-between gap-2 text-2xs text-ink-3">
                <span>
                  Village Code: {project.aoi.lgd_code ?? 'Unlinked'} · Census:{' '}
                  {project.aoi.census2011_code ??
                    settlements?.census_reconciliation?.census2011_code ??
                    'Unlinked'}
                </span>
                <span>
                  {worstMonthGhi !== null
                    ? `Cloudiest month sun: ${worstMonthGhi.toFixed(2)} kWh/m²/d`
                    : 'Sunlight data pending'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Connected 6-Step Planning Pipeline */}
      <div
        aria-label="Planning Workflow Steps"
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

      {/* 3. Four-Dimension Electrification Check */}
      <div>
        <Panel
          overline="Four Dimensions of Rural Electricity"
          title="Why Satellite Clues Are Separate from Ground Reality"
          subtitle="Satellites cannot see house wires, hours of daily power, or low voltage. ElectriMap tracks household coverage, hours of supply, voltage health, and poles separately."
          actions={
            <div className="flex items-center gap-1.5">
              <HelpTooltip
                glossaryKey="fourElectrificationDimensions"
                label="Learn about the 4 dimensions of electrification"
              />
              {project.aoi && !heroMapSlot ? (
                <Badge variant="primary" mono>
                  EPSG:{project.metric_epsg}
                </Badge>
              ) : null}
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Dimension A */}
              <div className="border border-rule-subtle rounded-sm p-4 bg-subtle/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-2">
                    1. Home Connections
                  </span>
                  <QualityTag
                    kind={
                      verificationCoveragePct !== null && verificationCoveragePct >= 100
                        ? 'VERIFIED'
                        : verificationCoveragePct !== null && verificationCoveragePct > 0
                          ? 'ESTIMATED'
                          : totalClustersCount > 0
                            ? 'PROXY'
                            : 'UNSET'
                    }
                    label={
                      verificationCoveragePct !== null &&
                      verificationCoveragePct > 0 &&
                      verificationCoveragePct < 100
                        ? 'Partially Verified'
                        : undefined
                    }
                  />
                </div>
                <p className="text-body-sm font-semibold text-ink">
                  {totalClustersCount > 0
                    ? `${proxyDistribution.LIKELY_ELECTRIFIED.clusters} Likely Connected · ${proxyDistribution.POTENTIALLY_UNDERSERVED.clusters} Underserved · ${proxyDistribution.POTENTIALLY_UNSERVED.clusters} Off-Grid`
                    : 'No hamlets grouped yet'}
                </p>
                <p className="text-xs text-ink-2 leading-relaxed">
                  {verificationCoveragePct !== null
                    ? `Ground verification: ${verificationCoveragePct.toFixed(1)}% of homes checked (${verifiedClustersCount}/${totalClustersCount} hamlets confirmed).`
                    : 'Run Step 2 hamlet grouping and record local village / utility confirmations.'}
                </p>
              </div>

              {/* Dimension B */}
              <div className="border border-rule-subtle rounded-sm p-4 bg-subtle/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-2">
                    2. Daily Supply Hours
                  </span>
                  <QualityTag kind={nightlightsLayer ? 'PROXY' : 'UNSET'} />
                </div>
                <p className="text-body-sm font-semibold text-ink">
                  {nightlightsLayer
                    ? 'Night-Light Clue Loaded (Needs Utility Supply Log)'
                    : 'Supply Hours Not Visible from Space'}
                </p>
                <p className="text-xs text-ink-2 leading-relaxed">
                  Satellites cannot measure how many hours per day homes get electricity — verify against local feeder logs or village surveys.
                </p>
              </div>

              {/* Dimension C */}
              <div className="border border-rule-subtle rounded-sm p-4 bg-subtle/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-2 inline-flex items-center gap-1">
                    3. Voltage Stability
                    <HelpTooltip glossaryKey="voltageRegulation" label="About safe voltage limits" />
                  </span>
                  <QualityTag kind={activeScenario ? 'ESTIMATED' : 'UNSET'} />
                </div>
                <p className="text-body-sm font-semibold text-ink">
                  {activeScenario
                    ? `Main Line Drop: ${activeScenario.max_ht_vdrop_pct.toFixed(2)}% · Street Drop: ${activeScenario.max_lt_vdrop_pct.toFixed(2)}%`
                    : 'Voltage Drop Checked in Step 4'}
                </p>
                <p className="text-xs text-ink-2 leading-relaxed">
                  {activeScenario
                    ? activeScenario.vdrop_compliance_ok
                      ? 'Meets national CEA safe-voltage rules (≤ 5% main 11 kV / ≤ 6% street wires).'
                      : 'Exceeds safe voltage drop — shorten street runs or split transformers in Step 4.'
                    : 'Run Step 4 Network Design to check if wires keep lights and pumps running reliably.'}
                </p>
              </div>

              {/* Dimension D */}
              <div className="border border-rule-subtle rounded-sm p-4 bg-subtle/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-2">
                    4. Grid Lines &amp; Transformers
                  </span>
                  <QualityTag
                    kind={
                      infrastructure?.has_existing_infra
                        ? gapAnalysis?.assumed_assets_count
                          ? 'ASSUMED'
                          : 'ESTIMATED'
                        : 'UNSET'
                    }
                  />
                </div>
                <p className="text-body-sm font-semibold text-ink">
                  {activeScenario
                    ? `${activeScenario.total_dt_count} Transformers (${activeScenario.total_dt_capacity_kva.toFixed(0)} kVA) · ${activeScenario.total_solar_kwp.toFixed(1)} kWp Solar`
                    : infrastructure?.has_existing_infra
                      ? `${infrastructure.items.length} Existing Grid Point(s) Added`
                      : 'Existing Grid Not Added Yet'}
                </p>
                <p className="text-xs text-ink-2 leading-relaxed">
                  {infrastructure?.has_existing_infra
                    ? `Added equipment: ${gapAnalysis?.verified_assets_count ?? 0} uploaded/verified, ${gapAnalysis?.assumed_assets_count ?? 0} user-marked tie-in points.`
                    : 'Upload utility line maps or place a connection point on the map in Step 3.'}
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
            overline="Step 2 Summary · Village Homes & Census Match"
            title={
              <span className="inline-flex items-center gap-1.5">
                <span>Village Electricity Status &amp; Census Check</span>
                <HelpTooltip glossaryKey="censusReconciliation" />
              </span>
            }
            subtitle="How village home clusters are estimated from satellite night lights and compared with Census 2011 records and field checks."
            actions={
              <Button
                size="xs"
                variant="ghost"
                rightIcon={ArrowRight}
                onClick={() => onNavigateSection('settlements')}
              >
                Inspect Villages
              </Button>
            }
          >
            {totalClustersCount > 0 ? (
              <div className="space-y-4">
                {/* Stacked Proportional Bar of Households by Classification */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                    <span className="font-semibold text-ink inline-flex items-center gap-1.5">
                      <span>Estimated Homes by Electricity Status</span>
                      <HelpTooltip glossaryKey="proxyClassification" />
                    </span>
                    <span className="font-mono text-ink-2 shrink-0 tabular-nums">
                      {totalEstimatedHouseholds ?? 0} Est. Homes ({totalClustersCount} Clusters)
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
                          label: 'Likely Electrified',
                          color: 'bg-[#0072B2]',
                          hh: proxyDistribution.LIKELY_ELECTRIFIED.households,
                        },
                        {
                          key: 'POTENTIALLY_UNDERSERVED',
                          label: 'Potentially Underserved',
                          color: 'bg-[#E69F00]',
                          hh: proxyDistribution.POTENTIALLY_UNDERSERVED.households,
                        },
                        {
                          key: 'POTENTIALLY_UNSERVED',
                          label: 'Potentially Unserved',
                          color: 'bg-[#D55E00]',
                          hh: proxyDistribution.POTENTIALLY_UNSERVED.households,
                        },
                        {
                          key: 'UNKNOWN',
                          label: 'Needs Field Check',
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
                          title={`${seg.label}: ${seg.hh} homes (${pct.toFixed(1)}%)`}
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
                          dot: 'bg-[#0072B2]',
                          data: proxyDistribution.LIKELY_ELECTRIFIED,
                        },
                        {
                          key: 'POTENTIALLY_UNDERSERVED' as const,
                          dot: 'bg-[#E69F00]',
                          data: proxyDistribution.POTENTIALLY_UNDERSERVED,
                        },
                        {
                          key: 'POTENTIALLY_UNSERVED' as const,
                          dot: 'bg-[#D55E00]',
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
                              {row.data.households} homes ({pct.toFixed(0)}%)
                            </span>
                            <span className="text-ink-2 tabular-nums">
                              {row.data.clusters} cluster{row.data.clusters === 1 ? '' : 's'}
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
                        Census 2011 vs. Satellite Building Count (
                        {settlements.census_reconciliation.village_name ?? 'Study Area'})
                      </span>
                      {settlements.census_reconciliation.census_2011_households !== null &&
                      settlements.census_reconciliation.census_2011_households !== undefined ? (
                        <Badge
                          variant={
                            settlements.census_reconciliation.divergence_exceeds_30pct
                              ? 'warn'
                              : 'ok'
                          }
                        >
                          {settlements.census_reconciliation.divergence_exceeds_30pct
                            ? `Differs by ${(settlements.census_reconciliation.delta_pct ?? 0).toFixed(1)}% (>30%)`
                            : `Matches within 30% (${(settlements.census_reconciliation.delta_pct ?? 0).toFixed(1)}% diff)`}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">No Census Baseline Linked</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2.5 text-xs">
                      <div className="bg-subtle/50 rounded-sm p-3">
                        <div className="text-xs text-ink-3">Census 2011 count</div>
                        <div className="text-sm font-mono font-semibold text-ink mt-0.5">
                          {settlements.census_reconciliation.census_2011_households !== null
                            ? `${settlements.census_reconciliation.census_2011_households} homes`
                            : 'Not linked'}
                        </div>
                      </div>
                      <div className="bg-subtle/50 rounded-sm p-3">
                        <div className="text-xs text-ink-3">Projected today</div>
                        <div className="text-sm font-mono font-semibold text-ink mt-0.5">
                          {settlements.census_reconciliation.projected_base_year_households !== null
                            ? `${settlements.census_reconciliation.projected_base_year_households} homes`
                            : 'Not linked'}
                        </div>
                      </div>
                      <div className="bg-subtle/50 rounded-sm p-3">
                        <div className="text-xs text-ink-3">Satellite estimate</div>
                        <div className="text-sm font-mono font-semibold text-accent mt-0.5">
                          {settlements.census_reconciliation.satellite_estimated_households} homes
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
                title="No Village Clusters Created Yet"
                description="Run village grouping in Step 2 (Villages & Homes) to count homes in each cluster and compare against Census 2011 records."
                action={
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => onNavigateSection('settlements')}
                  >
                    Go to Step 2 · Villages &amp; Homes
                  </Button>
                }
              />
            )}
          </Panel>
        </div>

        {/* Chart 2: 4-Scenario Economic Comparison Chart (CAPEX vs. 20-Year NPC & LCOE) */}
        <div className="lg:col-span-6">
          <Panel
            overline="Step 4 Summary · Cost Comparison (₹ Lakhs)"
            title={
              <span className="inline-flex items-center gap-1.5">
                <span>Upfront Build Cost vs. Lifetime System Cost</span>
                <HelpTooltip glossaryKey="capexOpexNpvLcoe" />
              </span>
            }
            subtitle={`Compares Grid Extension, Solar Mini-Grid, Home Solar Systems, and Best-Mix options across build cost and ${project.horizon_years}-year total cost.`}
            actions={
              <Button
                size="xs"
                variant="ghost"
                rightIcon={ArrowRight}
                onClick={() => onNavigateSection('cost')}
              >
                Compare &amp; Pick
              </Button>
            }
          >
            {comparisonScenarios.length > 0 ? (
              <div
                role="img"
                aria-label="Scenario build cost and lifetime system cost comparison bar chart"
                className="space-y-3"
              >
                {comparisonScenarios.map((scen) => {
                  const isWithheld = Boolean(scen.totals_withheld || scen.has_unset_rates);
                  const capexPct = isWithheld
                    ? 0
                    : Math.min(100, Math.max(4, (scen.total_capex_lakhs / maxScenarioNpc) * 100));
                  const npcPct = isWithheld
                    ? 0
                    : Math.min(100, Math.max(4, (scen.npc_lakhs / maxScenarioNpc) * 100));
                  return (
                    <div
                      key={scen.scenario_id}
                      className={`rounded-md border p-3 space-y-2 ${
                        scen.is_active_baseline
                          ? 'bg-accent-tint/40 border-accent/40'
                          : 'bg-subtle/40 border-rule-subtle'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-ink">
                            {formatScenarioLabel(scen.scenario_key)}
                          </span>
                          {scen.is_active_baseline && (
                            <Badge variant="primary">Selected Plan</Badge>
                          )}
                          <Badge variant={scen.vdrop_compliance_ok ? 'ok' : 'warn'}>
                            {scen.vdrop_compliance_ok ? 'Voltage OK' : 'Voltage Alert'}
                          </Badge>
                        </div>
                        <span className="font-mono text-[11px] text-ink-2">
                          Avg. Cost:{' '}
                          <strong>
                            {isWithheld ? 'Prices Needed' : `₹${scen.lcoe_inr_kwh.toFixed(2)}/kWh`}
                          </strong>{' '}
                          · {scen.avoided_co2_tonnes_yr.toFixed(1)} t CO₂ saved/yr
                        </span>
                      </div>

                      {/* CAPEX Bar */}
                      <div className="grid grid-cols-12 items-center gap-2 text-[11px] font-mono">
                        <span className="col-span-3 sm:col-span-2 text-ink-3 font-sans">
                          Build Cost
                        </span>
                        <div className="col-span-6 sm:col-span-7 h-2.5 bg-subtle rounded-full overflow-hidden border border-rule-subtle">
                          <div
                            style={{ width: `${capexPct}%` }}
                            className="h-full bg-accent rounded-full"
                          />
                        </div>
                        <span className="col-span-3 text-right font-semibold text-ink">
                          {isWithheld ? 'Prices Needed' : `₹${scen.total_capex_lakhs.toFixed(2)} L`}
                        </span>
                      </div>

                      {/* Lifecycle NPC Bar */}
                      <div className="grid grid-cols-12 items-center gap-2 text-[11px] font-mono">
                        <span className="col-span-3 sm:col-span-2 text-ink-3 font-sans">
                          {project.horizon_years}Y Total
                        </span>
                        <div className="col-span-6 sm:col-span-7 h-2.5 bg-subtle rounded-full overflow-hidden border border-rule-subtle">
                          <div
                            style={{ width: `${npcPct}%` }}
                            className="h-full bg-navy-800 rounded-full"
                          />
                        </div>
                        <span className="col-span-3 text-right font-bold text-ink">
                          {isWithheld ? 'Prices Needed' : `₹${scen.npc_lakhs.toFixed(2)} L`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="Cost Comparison Not Ready Yet"
                description={`Generate electricity plans in Step 4 and confirm equipment unit prices in Step 5 to compare upfront cost, ${project.horizon_years}-year cost, and per-unit electricity cost.`}
                action={
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => onNavigateSection('network')}
                  >
                    Go to Step 4 · Network Plans
                  </Button>
                }
              />
            )}
          </Panel>
        </div>

        {/* Chart 3: 7-Category Consumer Load & Horizon Demand Forecast */}
        <div className="lg:col-span-6">
          <Panel
            overline="Step 3 Summary · Electricity Demand"
            title={
              <span className="inline-flex items-center gap-1.5">
                <span>Electricity Demand by Consumer Type</span>
                <HelpTooltip glossaryKey="serviceLoadTier" />
              </span>
            }
            subtitle={
              demand
                ? `Today: ${demand.peak_kva_base.toFixed(2)} kVA → Year-${demand.horizon_years} Forecast: ${demand.peak_kva_horizon.toFixed(2)} kVA (${(demand.annual_growth_rate * 100).toFixed(1)}%/yr growth)`
                : 'Standard daily electricity demand across homes, shops, schools, health clinics, and farms.'
            }
            actions={
              <Button
                size="xs"
                variant="ghost"
                rightIcon={ArrowRight}
                onClick={() => onNavigateSection('infrastructure')}
              >
                Edit Demand
              </Button>
            }
          >
            {demand && demand.category_totals.length > 0 ? (
              <div className="space-y-3">
                {/* Base vs Horizon Peak kVA growth bar */}
                <div className="bg-subtle/60 border border-rule-subtle rounded-sm p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-ink-3 font-medium">Peak Today:</span>{' '}
                    <strong className="font-mono text-ink">
                      {demand.peak_kva_base.toFixed(2)} kVA
                    </strong>{' '}
                    <span className="font-mono text-ink-2">
                      ({demand.energy_kwh_day_base.toFixed(1)} kWh/day)
                    </span>
                  </div>
                  <span className="text-ink-3">→</span>
                  <div>
                    <span className="text-ink-3 font-medium">
                      Year-{demand.horizon_years} Forecast:
                    </span>{' '}
                    <strong className="font-mono text-accent">
                      {demand.peak_kva_horizon.toFixed(2)} kVA
                    </strong>{' '}
                    <span className="font-mono text-ink-2">
                      ({demand.annual_energy_mwh_horizon.toFixed(2)} MWh/yr)
                    </span>
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
                            {cat.consumer_count} connections ·{' '}
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
                title="Electricity Demand Not Calculated Yet"
                description={`Find village clusters in Step 2 first so ElectriMap can estimate total electricity demand across homes and community facilities over ${project.horizon_years} years.`}
                action={
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => onNavigateSection('infrastructure')}
                  >
                    Go to Step 3 · Grid &amp; Demand
                  </Button>
                }
              />
            )}
          </Panel>
        </div>

        {/* Chart 4: Electrification Gap & Modality Split + Infrastructure Summary */}
        <div className="lg:col-span-6">
          <Panel
            overline="Step 3 Summary · Distance to Power Grid"
            title={
              <span className="inline-flex items-center gap-1.5">
                <span>Distance to Nearest Power Line &amp; Best Option</span>
                <HelpTooltip glossaryKey="terrainCostSurface" />
              </span>
            }
            subtitle="Straight-line distance compared with actual terrain distance (accounting for hills, forests, and rivers) to the nearest 11 kV power line."
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
                    <div className="text-xs text-ink-3">Straight-line avg.</div>
                    <div className="text-sm font-mono font-semibold text-ink mt-0.5">
                      {gapAnalysis.mean_d_straight_m !== null
                        ? `${(gapAnalysis.mean_d_straight_m / 1000).toFixed(2)} km`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-subtle/50 rounded-sm p-3">
                    <div className="text-xs text-ink-3">Terrain avg.</div>
                    <div className="text-sm font-mono font-semibold text-accent mt-0.5">
                      {gapAnalysis.mean_d_terrain_m !== null
                        ? `${(gapAnalysis.mean_d_terrain_m / 1000).toFixed(2)} km`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-subtle/50 rounded-sm p-3">
                    <div className="text-xs text-ink-3">Farthest village</div>
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
                    <div className="text-xs text-ink-3">Grid Upgrade</div>
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
                    <div className="text-xs text-ink-3">Home Solar</div>
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
                      Suggested Electrification Option by Village Cluster
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
                              ? `${(cl.d_terrain_m / 1000).toFixed(2)} km terrain`
                              : 'Not added'}
                          </span>
                          <Badge variant="primary">
                            {formatModalityLabel(cl.recommended_modality)}
                          </Badge>
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
                  title="No Existing Power Lines Added Yet — Distances Require a Starting Point"
                >
                  No existing 11 kV power lines, substations, or transformers have been added for
                  this area yet. Upload a utility map file or click on the map in Step 3 to place
                  an assumed starting connection point before measuring distances.
                </Callout>
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => onNavigateSection('infrastructure')}
                  >
                    Add Power Line or Starting Point
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* 6. Data-Source Indicators & Recent Activity / Audit Trail (2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Compact Data Availability Summary + Collapsed Technical Provenance */}
        <div className="lg:col-span-7">
          <Panel
            overline="Study Area Data"
            title={
              <span className="inline-flex items-center gap-1.5">
                <span>Map Data Availability</span>
                <HelpTooltip glossaryKey="dataSourceProvenance" />
              </span>
            }
            subtitle={mapReadiness.summaryText}
            badge={
              <Badge variant={mapReadiness.badgeVariant} size="sm">
                {mapReadiness.label}
              </Badge>
            }
            actions={
              <Button
                size="xs"
                variant="ghost"
                rightIcon={ArrowRight}
                onClick={() => onNavigateSection('data')}
              >
                Manage Data
              </Button>
            }
          >
            {layers.length > 0 ? (
              <div className="space-y-3">
                <div className="divide-y divide-rule-subtle border border-rule-subtle rounded-md overflow-hidden">
                  {layers.map((lyr) => {
                    const honesty = classifyLayerHonesty(lyr);
                    const displayTitle =
                      CANONICAL_LAYER_LABELS[lyr.layer_key] ??
                      lyr.dataset?.name ??
                      lyr.layer_key;
                    return (
                      <div
                        key={lyr.id}
                        className="px-3 py-2.5 bg-sheet hover:bg-subtle/40 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-body-sm text-ink truncate">
                            {displayTitle}
                          </span>
                          <QualityTag kind={honesty.qualityKind} label={honesty.originLabel} />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {typeof lyr.feature_count === 'number' && lyr.feature_count > 0 && (
                            <span className="font-mono text-ink-3 tabular-nums">
                              {lyr.feature_count.toLocaleString()} items
                            </span>
                          )}
                          <Badge variant={honesty.badgeVariant} size="sm">
                            {honesty.statusLabel}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <details className="border border-rule-subtle rounded-xs bg-paper/70 p-2.5 text-xs">
                  <summary className="cursor-pointer font-semibold text-ink select-none">
                    Data sources &amp; technical information ({layers.length} layers · CRS EPSG:{project.metric_epsg})
                  </summary>
                  <div className="mt-2 pt-2 border-t border-rule-subtle divide-y divide-rule-subtle text-[11px] text-ink-2">
                    {layers.map((lyr) => (
                      <div key={`${lyr.id}-tech`} className="py-1.5 flex flex-wrap justify-between gap-1">
                        <span className="font-medium text-ink">
                          {CANONICAL_LAYER_LABELS[lyr.layer_key] ?? lyr.layer_key}
                        </span>
                        <span>
                          {lyr.dataset
                            ? `${lyr.dataset.provider} · ${lyr.dataset.spatial_resolution ?? 'Vector'} · ${lyr.dataset.temporal_coverage ?? 'Current'} · ${lyr.dataset.licence}`
                            : 'User-uploaded GeoJSON layer'}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ) : (
              <EmptyState
                icon={Layers}
                title="No Map Data Fetched Yet"
                description="Fetch the 6 free satellite and map layers in Step 1 to see buildings, ground slopes, tree cover, sunlight, and night-light brightness."
                action={
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => onNavigateSection('data')}
                  >
                    Go to Step 1 · Map Data
                  </Button>
                }
              />
            )}
          </Panel>
        </div>

        {/* Right: Recent Activity, Verification Ledger & SHA-256 Export Audit Feed */}
        <div className="lg:col-span-5">
          <Panel
            overline="Activity Log"
            title="Recent Checks, Jobs &amp; Saved Reports"
            subtitle="Permanent log of field checks, background data tasks, and verified report exports."
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
                title="No Checks or Report Downloads Yet"
                description="Field survey entries and saved report download logs will appear here automatically as you progress through Steps 2 and 6."
              />
            )}
          </Panel>
        </div>
      </div>
    </section>
  );
};
