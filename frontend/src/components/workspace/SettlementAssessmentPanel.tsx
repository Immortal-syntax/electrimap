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

import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Download,
  FileDown,
  History,
  MapPin,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { apiFetchResponse, apiRequest } from '../../lib/apiClient';
import {
  formatEvidenceSourceLabel,
  formatVerificationStateLabel,
} from '../../lib/beginnerGlossary';
import {
  Badge,
  ClassificationBadge,
  ProxyElectrificationClass,
  VerificationState,
} from '../ui/Badge';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { ConfirmDialog } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { Input } from '../ui/Input';
import { Panel } from '../ui/Panel';
import { QualityTag } from '../ui/QualityTag';
import { Select } from '../ui/Select';
import { HelpTooltip } from '../ui/Tooltip';

export interface ClusterDto {
  id: string;
  cluster_run_id: string;
  project_id: string;
  label: string;
  name: string;
  is_isolated_group: boolean;
  n_detected: number;
  n_residential: number;
  n_non_residential: number;
  est_households: number;
  census_hh_ref: number | null;
  proxy_class: ProxyElectrificationClass;
  proxy_confidence: string;
  verification_state: VerificationState;
  verified_class: string | null;
  d_infra_m: number | null;
  d_road_m: number | null;
  slope_mean_deg: number;
  canopy_share: number;
  evidence: Record<string, unknown>;
  centroid_lon: number;
  centroid_lat: number;
  geojson_geometry: GeoJSON.Geometry;
  updated_at: string;
}

export interface CensusReconciliationDto {
  census2011_code: string | null;
  village_name: string | null;
  census_2011_households: number | null;
  projected_base_year_households: number | null;
  satellite_detected_buildings: number;
  satellite_residential_buildings: number;
  satellite_estimated_households: number;
  delta_households: number | null;
  delta_pct: number | null;
  divergence_exceeds_30pct: boolean;
  reconciliation_note: string;
}

export interface ClusterListResponseDto {
  project_id: string;
  cluster_run_id: string | null;
  params: Record<string, number>;
  items: ClusterDto[];
  geojson: GeoJSON.FeatureCollection;
  census_reconciliation: CensusReconciliationDto;
  verification_coverage_pct: number;
}

export interface VerificationRecordDto {
  id: string;
  project_id: string;
  target_type: string;
  target_id: string;
  cluster_label: string | null;
  attribute: string;
  previous_value: Record<string, unknown>;
  new_value: Record<string, unknown>;
  evidence_type: string;
  verifier_name: string;
  observed_on: string;
  note: string;
  import_batch_id: string | null;
  reverses_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface VerificationImportDto {
  id: string;
  project_id: string;
  filename: string;
  row_count: number;
  matched: number;
  unmatched: number;
  report: Record<string, unknown>;
  created_at: string;
}

export interface VerificationLedgerDto {
  project_id: string;
  total_clusters: number;
  verified_clusters: number;
  total_households: number;
  verified_households: number;
  verification_coverage_pct: number;
  records: VerificationRecordDto[];
  imports: VerificationImportDto[];
}

export interface SettlementAssessmentPanelProps {
  projectId: string;
  metricEpsg?: number;
  settlements: ClusterListResponseDto | null;
  ledger: VerificationLedgerDto | null;
  selectedClusterId: string | null;
  onSelectCluster: (clusterId: string) => void;
  onSettlementsUpdated: () => Promise<void>;
}

function formatConfirmedClassLabel(verifiedClass?: string | null): string {
  if (!verifiedClass) return '';
  if (verifiedClass === 'ELECTRIFIED') return 'Electrified';
  if (verifiedClass === 'UNDERSERVED') return 'Underserved';
  if (verifiedClass === 'UNSERVED') return 'Unserved';
  return verifiedClass
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export const SettlementAssessmentPanel: React.FC<SettlementAssessmentPanelProps> = ({
  projectId,
  metricEpsg,
  settlements,
  ledger,
  selectedClusterId,
  onSelectCluster,
  onSettlementsUpdated,
}) => {
  const [epsM, setEpsM] = useState<number>(settlements?.params?.eps_m ?? 150);
  const [minSamples, setMinSamples] = useState<number>(
    settlements?.params?.min_samples ?? 5,
  );
  const [householdAlpha, setHouseholdAlpha] = useState<number>(
    settlements?.params?.household_alpha ?? 0.9,
  );
  const paramsEpsM = settlements?.params?.eps_m;
  const paramsMinSamples = settlements?.params?.min_samples;
  const paramsHouseholdAlpha = settlements?.params?.household_alpha;
  useEffect(() => {
    if (
      paramsEpsM === undefined &&
      paramsMinSamples === undefined &&
      paramsHouseholdAlpha === undefined
    ) {
      return;
    }
    setEpsM(paramsEpsM ?? 150);
    setMinSamples(paramsMinSamples ?? 5);
    setHouseholdAlpha(paramsHouseholdAlpha ?? 0.9);
  }, [paramsEpsM, paramsMinSamples, paramsHouseholdAlpha]);
  const [runningCluster, setRunningCluster] = useState(false);
  const [confirmRecluster, setConfirmRecluster] = useState(false);
  const [downloadingSkeletonPdf, setDownloadingSkeletonPdf] = useState(false);

  // Verification form state
  const [verState, setVerState] = useState<'FIELD_VERIFIED' | 'UTILITY_VERIFIED'>(
    'FIELD_VERIFIED',
  );
  const [verClass, setVerClass] = useState<string>('UNSERVED');
  const [verHouseholds, setVerHouseholds] = useState<string>('');
  const [evidenceType, setEvidenceType] = useState<string>('FIELD_SURVEY');
  const [verifierName, setVerifierName] = useState<string>('');
  const [observedOn, setObservedOn] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [verNote, setVerNote] = useState<string>('');
  const [submittingVer, setSubmittingVer] = useState(false);

  const [csvUploading, setCsvUploading] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [pendingReversalRecord, setPendingReversalRecord] =
    useState<VerificationRecordDto | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & search
  const [clusterSearch, setClusterSearch] = useState('');
  const [proxyFilter, setProxyFilter] = useState<'ALL' | ProxyElectrificationClass>('ALL');
  const [verificationFilter, setVerificationFilter] = useState<'ALL' | VerificationState>(
    'ALL',
  );
  const [ledgerSearch, setLedgerSearch] = useState('');

  const clusters = useMemo(() => settlements?.items ?? [], [settlements?.items]);
  const selectedCluster =
    clusters.find((c) => c.id === selectedClusterId) ?? clusters[0] ?? null;

  const filteredClusters = useMemo(() => {
    const q = clusterSearch.trim().toLowerCase();
    return clusters.filter((c) => {
      if (proxyFilter !== 'ALL' && c.proxy_class !== proxyFilter) return false;
      if (verificationFilter !== 'ALL' && c.verification_state !== verificationFilter) {
        return false;
      }
      if (
        q &&
        !`${c.label} ${c.name} ${c.proxy_class}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [clusters, clusterSearch, proxyFilter, verificationFilter]);

  const filteredLedgerRecords = useMemo(() => {
    const recs = ledger?.records ?? [];
    const q = ledgerSearch.trim().toLowerCase();
    if (!q) return recs;
    return recs.filter((r) =>
      `${r.cluster_label ?? ''} ${r.evidence_type} ${r.verifier_name} ${r.note}`
        .toLowerCase()
        .includes(q),
    );
  }, [ledger?.records, ledgerSearch]);

  const reversedRecordIds = useMemo(
    () =>
      new Set(
        (ledger?.records ?? [])
          .map((r) => r.reverses_id)
          .filter((id): id is string => Boolean(id)),
      ),
    [ledger?.records],
  );

  const handleDownloadSkeletonPdf = async () => {
    setDownloadingSkeletonPdf(true);
    setErrorMessage(null);
    try {
      const resp = await apiFetchResponse(
        `/api/v1/projects/${projectId}/exports/preliminary-settlement-pdf?skeleton_only=true`,
      );
      const blob = await resp.blob();
      const cd = resp.headers.get('content-disposition') ?? '';
      const match = /filename="?([^";]+)"?/i.exec(cd);
      const filename = match?.[1] ?? `preliminary_settlement_skeleton_${projectId.slice(0, 8)}.pdf`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to download Preliminary DPR Skeleton PDF.',
      );
    } finally {
      setDownloadingSkeletonPdf(false);
    }
  };

  const handleRunClustering = async () => {
    setRunningCluster(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await apiRequest(`/api/v1/projects/${projectId}/clustering`, {
        method: 'POST',
        body: JSON.stringify({
          eps_m: epsM,
          min_samples: minSamples,
          household_alpha: householdAlpha,
          nl_electrified_min: 0.75,
          nl_unserved_max: 0.2,
        }),
      });
      await onSettlementsUpdated();
      setStatusMessage(
        `DBSCAN clustering completed (eps=${epsM}m, min_samples=${minSamples}, α=${householdAlpha}).`,
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to run habitation clustering.',
      );
    } finally {
      setRunningCluster(false);
    }
  };

  const handleRecordVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCluster) return;
    setSubmittingVer(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const parsedHh =
        verHouseholds.trim().length > 0 ? Number(verHouseholds.trim()) : undefined;
      await apiRequest(`/api/v1/projects/${projectId}/verifications`, {
        method: 'POST',
        body: JSON.stringify({
          target_id: selectedCluster.id,
          verification_state: verState,
          verified_class: verClass,
          verified_households:
            parsedHh !== undefined && !Number.isNaN(parsedHh) ? parsedHh : null,
          evidence_type: evidenceType,
          verifier_name: verifierName,
          observed_on: observedOn,
          note:
            verNote.trim() ||
            `Verified ${selectedCluster.label} during physical field inspection.`,
        }),
      });
      setVerNote('');
      setVerHouseholds('');
      await onSettlementsUpdated();
      setStatusMessage(
        `Recorded ${verState} entry for ${selectedCluster.label} (Axis-1 proxy class ${selectedCluster.proxy_class} preserved).`,
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to record verification.',
      );
    } finally {
      setSubmittingVer(false);
    }
  };

  const handleReverseVerification = async (verificationId: string) => {
    setReversingId(verificationId);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await apiRequest(
        `/api/v1/projects/${projectId}/verifications/${verificationId}/reverse`,
        {
          method: 'POST',
          body: JSON.stringify({
            verifier_name: verifierName || 'Planner Reversal',
            note: 'Append-only reversal to restore previous cluster verification state.',
          }),
        },
      );
      await onSettlementsUpdated();
      setStatusMessage(`Appended reversal record for verification ${verificationId.slice(0, 8)}.`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to reverse verification record.',
      );
    } finally {
      setReversingId(null);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiRequest<VerificationImportDto>(
        `/api/v1/projects/${projectId}/verifications/import`,
        {
          method: 'POST',
          body: fd,
        },
      );
      await onSettlementsUpdated();
      setStatusMessage(
        `Imported '${res.filename}': ${res.matched}/${res.row_count} rows matched to habitation clusters.`,
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'CSV verification import failed.',
      );
    } finally {
      setCsvUploading(false);
      e.target.value = '';
    }
  };

  const rec = settlements?.census_reconciliation;

  return (
    <Panel
      aria-label="Settlement Identification and Verification Ledger"
      overline="Step 2 · Habitation & Settlement Assessment"
      title="Habitation Clustering, Two-Axis Proxy Classification & Verification Ledger"
      subtitle={`Metric DBSCAN clustering in UTM${metricEpsg ? ` (EPSG:${metricEpsg})` : ''}, 4-tier proxy rules, Census 2011 reconciliation, and append-only field/utility verification ledger.`}
      icon={MapPin}
      actions={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leftIcon={FileDown}
          isLoading={downloadingSkeletonPdf}
          loadingText="Preparing Skeleton PDF…"
          onClick={() => void handleDownloadSkeletonPdf()}
        >
          Download Preliminary DPR Skeleton (PDF · Sections 1–5 + Map Plate)
        </Button>
      }
    >
      <div className="space-y-4">
        {errorMessage && (
          <Callout tone="error" title="Settlement / Verification Error">
            {errorMessage}
          </Callout>
        )}
        {statusMessage && (
          <Callout tone="info" title="Settlement & Verification Update">
            {statusMessage}
          </Callout>
        )}

        {/* Habitation Grouping Controls (Simple default + collapsible advanced controls) */}
        <div className="bg-paper border border-rule rounded-xs p-3.5 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3 flex-1 min-w-[240px]">
              <Input
                id="dbscan-eps"
                label="Village Grouping Radius"
                labelHelp={
                  <span className="inline-flex items-center gap-1">
                    <HelpTooltip glossaryKey="dbscanClustering" />
                    <HelpTooltip glossaryKey="settlementBuffer" />
                  </span>
                }
                hint="Buildings within this distance (default 150 m) are grouped into one hamlet cluster."
                type="number"
                min={25}
                max={1000}
                step={10}
                mono
                size="sm"
                unit="m"
                value={epsM}
                onChange={(e) => setEpsM(Number(e.target.value))}
                containerClassName="w-full sm:w-64"
              />
            </div>

            <Button
              size="sm"
              variant="primary"
              isLoading={runningCluster}
              loadingText="Finding Village Clusters…"
              onClick={() => {
                if (clusters.length > 0) {
                  setConfirmRecluster(true);
                } else {
                  void handleRunClustering();
                }
              }}
            >
              Group Homes into Villages
            </Button>
          </div>

          <details className="border-t border-rule-subtle pt-2.5 text-xs">
            <summary className="cursor-pointer font-medium text-ink-2 hover:text-ink select-none">
              Advanced Clustering Parameters (Minimum Buildings: {minSamples} · Home Ratio: {householdAlpha})
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 max-w-lg">
              <Input
                id="dbscan-min-samples"
                label="Minimum Buildings per Group"
                hint="Smaller hamlets with fewer buildings stay ungrouped unless lowered."
                type="number"
                min={2}
                max={50}
                mono
                size="sm"
                value={minSamples}
                onChange={(e) => setMinSamples(Number(e.target.value))}
              />
              <Input
                id="hh-alpha"
                label="Households per Building Ratio"
                labelHelp={<HelpTooltip glossaryKey="householdMultiplier" />}
                hint="Converts detected roofs into estimated households (default 0.90)."
                type="number"
                min={0.4}
                max={2.0}
                step={0.05}
                mono
                size="sm"
                value={householdAlpha}
                onChange={(e) => setHouseholdAlpha(Number(e.target.value))}
              />
            </div>
          </details>
        </div>

        {/* Census 2011 Household Reconciliation Banner */}
        {rec && (
          <div
            className={`p-3 rounded-xs border text-xs flex flex-wrap items-center justify-between gap-3 ${
              rec.census_2011_households === null || rec.census_2011_households === undefined
                ? 'bg-paper border-rule'
                : rec.divergence_exceeds_30pct
                  ? 'bg-warn-bg border-warn-border border-l-4 border-l-warn'
                  : 'bg-paper border-rule'
            }`}
          >
            <div className="space-y-1">
              <div className="font-semibold text-ink flex items-center gap-2 flex-wrap">
                <span>
                  Census 2011 Household Check ({rec.village_name ?? 'Study Village'} · Census Code{' '}
                  {rec.census2011_code ?? 'Not linked'})
                </span>
                {rec.census_2011_households === null ||
                rec.census_2011_households === undefined ? (
                  <Badge variant="neutral" size="sm">
                    No Census Baseline Linked
                  </Badge>
                ) : (
                  <QualityTag
                    kind={rec.divergence_exceeds_30pct ? 'ASSUMED' : 'ESTIMATED'}
                    label={
                      rec.divergence_exceeds_30pct
                        ? 'Differs > 30% — Field Count Needed'
                        : 'Matches Census Within ±30%'
                    }
                  />
                )}
              </div>
              <p className="text-ink-2 text-[11px]">{rec.reconciliation_note}</p>
            </div>

            <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
              <div>
                <span className="text-ink-2 block">Census 2011 Homes</span>
                <span className="font-semibold text-ink">
                  {rec.census_2011_households ?? '—'}
                </span>
              </div>
              <div>
                <span className="text-ink-2 block">Projected Today</span>
                <span className="font-semibold text-ink">
                  {rec.projected_base_year_households ?? '—'}
                </span>
              </div>
              <div>
                <span className="text-ink-2 block">Satellite Estimate</span>
                <span className="font-semibold text-ink">
                  {rec.satellite_estimated_households} ({rec.satellite_detected_buildings} roofs)
                </span>
              </div>
              <div>
                <span className="text-ink-2 block">Difference</span>
                <span
                  className={`font-semibold ${
                    rec.census_2011_households !== null &&
                    rec.census_2011_households !== undefined &&
                    rec.divergence_exceeds_30pct
                      ? 'text-warn'
                      : 'text-ink'
                  }`}
                >
                  {rec.census_2011_households !== null &&
                  rec.census_2011_households !== undefined &&
                  rec.delta_pct !== null &&
                  rec.delta_pct !== undefined
                    ? `${rec.delta_pct >= 0 ? '+' : ''}${rec.delta_pct.toFixed(1)}%`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Main Split: Habitation Cluster Inventory Table + Selected Cluster Verification Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left 7 cols: Cluster Inventory Table */}
          <div className="lg:col-span-7 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="small-caps-heading flex items-center gap-1.5 flex-wrap">
                <span>
                  Hamlets &amp; Habitation Groups ({filteredClusters.length}/{clusters.length} ·
                  Field Checked: {(settlements?.verification_coverage_pct ?? 0).toFixed(1)}%)
                </span>
                <HelpTooltip glossaryKey="verificationCoverage" />
                <HelpTooltip glossaryKey="proxyClassification" />
                <HelpTooltip glossaryKey="axis1Axis2" />
              </div>
              {(clusterSearch || proxyFilter !== 'ALL' || verificationFilter !== 'ALL') && (
                <Button
                  size="xs"
                  variant="ghost"
                  leftIcon={X}
                  onClick={() => {
                    setClusterSearch('');
                    setProxyFilter('ALL');
                    setVerificationFilter('ALL');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {clusters.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  type="search"
                  size="sm"
                  leftIcon={Search}
                  aria-label="Filter habitation clusters by label or name"
                  placeholder="Search hamlet or code..."
                  value={clusterSearch}
                  onChange={(e) => setClusterSearch(e.target.value)}
                />
                <Select
                  size="sm"
                  aria-label="Filter habitation clusters by estimated status"
                  value={proxyFilter}
                  onChange={(e) =>
                    setProxyFilter(e.target.value as 'ALL' | ProxyElectrificationClass)
                  }
                  options={[
                    { value: 'ALL', label: 'All Estimated Statuses' },
                    { value: 'LIKELY_ELECTRIFIED', label: 'Likely Electrified' },
                    { value: 'POTENTIALLY_UNDERSERVED', label: 'Potentially Underserved' },
                    { value: 'POTENTIALLY_UNSERVED', label: 'Potentially Unserved' },
                    { value: 'UNKNOWN', label: 'Unknown' },
                  ]}
                />
                <Select
                  size="sm"
                  aria-label="Filter habitation clusters by field check status"
                  value={verificationFilter}
                  onChange={(e) =>
                    setVerificationFilter(e.target.value as 'ALL' | VerificationState)
                  }
                  options={[
                    { value: 'ALL', label: 'All Field Check Statuses' },
                    { value: 'UNVERIFIED', label: 'Not Field Checked Yet' },
                    { value: 'FIELD_VERIFIED', label: 'Field Visit Verified' },
                    { value: 'UTILITY_VERIFIED', label: 'Utility Record Verified' },
                  ]}
                />
              </div>
            )}

            {clusters.length === 0 ? (
              <EmptyState
                compact
                icon={MapPin}
                title="No Hamlets Grouped Yet"
                description="Group buildings from Step 1 into settlement clusters to estimate which hamlets may need electricity. Satellite estimates are never marked verified without ground evidence."
                epistemicNote="Satellite clues cannot replace a village visit or utility record."
                action={
                  <Button
                    size="sm"
                    variant="primary"
                    isLoading={runningCluster}
                    onClick={() => void handleRunClustering()}
                  >
                    Group Village Buildings
                  </Button>
                }
              />
            ) : filteredClusters.length === 0 ? (
              <EmptyState
                compact
                icon={Search}
                title="No Matching Hamlets"
                description="Try clearing your search or status filter."
                action={
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      setClusterSearch('');
                      setProxyFilter('ALL');
                      setVerificationFilter('ALL');
                    }}
                  >
                    Reset Filters
                  </Button>
                }
              />
            ) : (
              <div className="table-scroll-container">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                      <th className="py-2.5 px-3">Group</th>
                      <th className="py-2.5 px-3">Hamlet / Village</th>
                      <th className="py-2.5 px-3">Buildings &amp; Homes</th>
                      <th className="py-2.5 px-3">Estimated vs. Checked Status</th>
                      <th className="py-2.5 px-3">Slope &amp; Trees</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-subtle">
                    {filteredClusters.map((c) => {
                      const isSelected = selectedCluster?.id === c.id;
                      return (
                        <tr
                          key={c.id}
                          tabIndex={0}
                          aria-selected={isSelected}
                          onClick={() => onSelectCluster(c.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectCluster(c.id);
                            }
                          }}
                          className={`cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${
                            isSelected ? 'bg-accent-tint/60' : 'hover:bg-surface-hover'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-semibold text-ink text-xs">
                            {c.label}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-ink">{c.name}</td>
                          <td className="py-2.5 px-3 text-xs tabular-nums">
                            {c.n_detected} bldgs · <strong>{c.est_households} homes</strong>
                          </td>
                          <td className="py-2.5 px-3 space-y-1">
                            <ClassificationBadge
                              proxyClass={c.proxy_class}
                              verificationState={c.verification_state}
                            />
                            {c.verified_class && (
                              <div className="text-xs font-medium text-ok">
                                Confirmed Status: {formatConfirmedClassLabel(c.verified_class)}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-ink-2 tabular-nums">
                            {c.slope_mean_deg.toFixed(1)}° · {(c.canopy_share * 100).toFixed(0)}%
                            trees
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right 5 cols: Selected Hamlet Inspector & Field Check Form */}
          <div className="lg:col-span-5 bg-paper border border-rule-subtle rounded-xs p-4 space-y-3.5">
            {selectedCluster ? (
              <>
                <div className="border-b border-rule pb-2.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="small-caps-heading block">
                      Selected Hamlet Details
                    </span>
                    <h4 className="text-base font-semibold text-ink">
                      {selectedCluster.label} · {selectedCluster.name}
                    </h4>
                  </div>
                  <QualityTag
                    kind={
                      selectedCluster.verification_state !== 'UNVERIFIED'
                        ? 'VERIFIED'
                        : 'PROXY'
                    }
                    label={
                      selectedCluster.verification_state !== 'UNVERIFIED'
                        ? 'Field Confirmed'
                        : `Estimate Confidence: ${selectedCluster.proxy_confidence}`
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs bg-sheet p-3 border border-rule-subtle rounded-xs">
                  <div>
                    <span className="text-ink-2 block">Satellite Estimate</span>
                    <span className="font-semibold text-ink">
                      {selectedCluster.proxy_class
                        .replace(/_/g, ' ')
                        .toLowerCase()
                        .replace(/\b\w/g, (m) => m.toUpperCase())}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-2 block">Field Check Status</span>
                    <span className="font-semibold text-ink">
                      {formatVerificationStateLabel(selectedCluster.verification_state)}
                      {selectedCluster.verified_class
                        ? ` (${formatConfirmedClassLabel(selectedCluster.verified_class)})`
                        : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-2 block">Nearest Road / Slope</span>
                    <span className="text-ink tabular-nums">
                      {selectedCluster.d_road_m !== null &&
                      selectedCluster.d_road_m !== undefined
                        ? `${Math.round(selectedCluster.d_road_m)} m`
                        : '—'}{' '}
                      · {selectedCluster.slope_mean_deg.toFixed(1)}°
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-2 flex items-center gap-1">
                      Nighttime Brightness
                      <HelpTooltip glossaryKey="viirsNighttimeLight" />
                    </span>
                    <span className="text-ink tabular-nums">
                      {selectedCluster.evidence?.['nl_lightscore'] !== undefined &&
                      selectedCluster.evidence?.['nl_lightscore'] !== null
                        ? String(selectedCluster.evidence['nl_lightscore'])
                        : selectedCluster.evidence?.['nightlights_available'] === false
                          ? 'Unavailable (No VIIRS)'
                          : 'Not recorded'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-ink-2 italic">
                  {String(
                    selectedCluster.evidence?.['rationale'] ??
                      'Satellite estimate based on outdoor nighttime brightness and distance to the nearest road.',
                  )}
                </p>

                {/* Inline Field Verification Form */}
                <form
                  onSubmit={(e) => void handleRecordVerification(e)}
                  className="space-y-2.5 pt-1"
                >
                  <div className="small-caps-heading border-t border-rule pt-2 flex items-center gap-1.5">
                    <Icon icon={ClipboardCheck} size="xs" className="text-accent" />
                    <span>Log Field Visit or Utility Confirmation</span>
                    <HelpTooltip glossaryKey="verificationStatus" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      id="ver-state"
                      label="Check Type"
                      size="sm"
                      value={verState}
                      onChange={(e) =>
                        setVerState(
                          e.target.value as 'FIELD_VERIFIED' | 'UTILITY_VERIFIED',
                        )
                      }
                      options={[
                        { value: 'FIELD_VERIFIED', label: 'Field Visit Verified' },
                        { value: 'UTILITY_VERIFIED', label: 'Utility / DISCOM Confirmed' },
                      ]}
                    />

                    <Select
                      id="ver-class"
                      label="Confirmed Power Status"
                      size="sm"
                      value={verClass}
                      onChange={(e) => setVerClass(e.target.value)}
                      options={[
                        { value: 'UNSERVED', label: 'Unserved (No Grid Supply)' },
                        {
                          value: 'UNDERSERVED',
                          label: 'Underserved (Weak / Irregular)',
                        },
                        { value: 'ELECTRIFIED', label: 'Electrified (Adequate Supply)' },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      id="ver-evidence"
                      label="Proof / Evidence Source"
                      size="sm"
                      value={evidenceType}
                      onChange={(e) => setEvidenceType(e.target.value)}
                      options={[
                        'FIELD_SURVEY',
                        'UTILITY_LEDGER',
                        'GRAM_SABHA_RESOLUTION',
                        'GEO_TAGGED_PHOTO',
                      ].map((code) => ({
                        value: code,
                        label: formatEvidenceSourceLabel(code),
                      }))}
                    />

                    <Input
                      id="ver-hh"
                      label="Counted Homes"
                      size="sm"
                      type="number"
                      min={0}
                      max={10000}
                      mono
                      unit="homes"
                      placeholder={String(selectedCluster.est_households)}
                      value={verHouseholds}
                      onChange={(e) => setVerHouseholds(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      id="ver-verifier"
                      label="Verifier Name &amp; Role"
                      size="sm"
                      type="text"
                      required
                      placeholder="e.g., Field Surveyor or Block Engineer name"
                      value={verifierName}
                      onChange={(e) => setVerifierName(e.target.value)}
                    />

                    <Input
                      id="ver-date"
                      label="Visit / Record Date"
                      size="sm"
                      type="date"
                      required
                      mono
                      value={observedOn}
                      onChange={(e) => setObservedOn(e.target.value)}
                    />
                  </div>

                  <Input
                    id="ver-note"
                    label="Notes from Visit or Record"
                    size="sm"
                    type="text"
                    placeholder="e.g., Visited hamlet; saw 0 poles or low voltage at tail end"
                    value={verNote}
                    onChange={(e) => setVerNote(e.target.value)}
                  />

                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    isLoading={submittingVer}
                    loadingText="Saving Check…"
                    fullWidth
                  >
                    Save Field Check for {selectedCluster.label}
                  </Button>
                </form>
              </>
            ) : (
              <EmptyState
                compact
                icon={ClipboardCheck}
                title="No Hamlet Selected"
                description="Click any hamlet in the table on the left to inspect its satellite clues and log a field check or utility record."
              />
            )}
          </div>
        </div>

        {/* Permanent Field Verification Log & CSV Batch Import */}
        <div className="border-t border-rule pt-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="small-caps-heading flex items-center gap-1.5">
                <Icon icon={History} size="xs" className="text-ink-2" />
                <span>
                  Permanent Field Check Log ({ledger?.records.length ?? 0} Entries)
                </span>
                <HelpTooltip glossaryKey="verificationStatus" />
              </span>
              <p className="text-xs text-ink-2">
                Saved field visits and utility records stay permanently in this log. To correct
                a mistake, reverse the entry and add a new check.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ledger && ledger.records.length > 0 && (
                <Input
                  type="search"
                  size="sm"
                  leftIcon={Search}
                  aria-label="Filter field check log"
                  placeholder="Search log entries..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  containerClassName="w-52"
                />
              )}
              <Button
                type="button"
                size="xs"
                variant="ghost"
                leftIcon={Download}
                onClick={() => {
                  const csv = [
                    'cluster_label,verification_state,verified_class,verified_households,evidence_type,verifier_name,observed_on,note',
                    'CL-01,FIELD_VERIFIED,UNSERVED,42,FIELD_SURVEY,Block Survey Team,2026-04-01,Confirmed 0 LT poles in hamlet',
                  ].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'sample_field_survey_checks.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Sample Survey CSV
              </Button>
              <label className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium bg-paper border border-rule-strong rounded-xs cursor-pointer hover:bg-sheet transition-colors">
                <Icon icon={Upload} size="xs" className="text-ink-2" />
                <span>{csvUploading ? 'Importing CSV…' : 'Upload Field Survey CSV'}</span>
                <input
                  type="file"
                  accept=".csv"
                  aria-label="Upload Field Survey CSV"
                  disabled={csvUploading}
                  onChange={(e) => void handleCsvUpload(e)}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {ledger && ledger.records.length > 0 ? (
            filteredLedgerRecords.length > 0 ? (
              <div className="table-scroll-container">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                      <th className="py-2 px-2.5">Group</th>
                      <th className="py-2 px-2.5">Proof Type</th>
                      <th className="py-2 px-2.5">Checked By &amp; Date</th>
                      <th className="py-2 px-2.5">Status Change</th>
                      <th className="py-2 px-2.5">Notes</th>
                      <th className="py-2 px-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-subtle">
                    {filteredLedgerRecords.map((recItem) => {
                      const prevState = String(
                        recItem.previous_value?.['verification_state'] ?? 'UNVERIFIED',
                      );
                      const nextState = String(
                        recItem.new_value?.['verification_state'] ?? 'FIELD_VERIFIED',
                      );
                      const nextClass = String(
                        recItem.new_value?.['verified_class'] ?? '',
                      );
                      const isReversal = Boolean(recItem.reverses_id);
                      const readableNextClass =
                        nextClass === 'UNSERVED'
                          ? 'Unserved'
                          : nextClass === 'UNDERSERVED'
                            ? 'Underserved'
                            : nextClass === 'ELECTRIFIED'
                              ? 'Electrified'
                              : nextClass;
                      return (
                        <tr key={recItem.id} className="hover:bg-surface-hover">
                          <td className="py-2 px-2.5 font-mono font-semibold text-xs">
                            {recItem.cluster_label ?? recItem.target_id.slice(0, 6)}
                          </td>
                          <td className="py-2 px-2.5 text-xs">
                            <Badge variant={isReversal ? 'warn' : 'neutral'} size="sm">
                              {formatEvidenceSourceLabel(recItem.evidence_type)}
                            </Badge>
                          </td>
                          <td className="py-2 px-2.5 text-xs">
                            <div className="font-medium text-ink">{recItem.verifier_name}</div>
                            <div className="tabular-nums text-ink-2">{recItem.observed_on}</div>
                          </td>
                          <td className="py-2 px-2.5 text-xs">
                            {formatVerificationStateLabel(prevState)} →{' '}
                            <strong>{formatVerificationStateLabel(nextState)}</strong>
                            {readableNextClass ? ` (${readableNextClass})` : ''}
                          </td>
                          <td className="py-2 px-2.5 text-xs text-ink-2">
                            {recItem.note}
                          </td>
                          <td className="py-1.5 px-2.5 text-right">
                            {!isReversal && !reversedRecordIds.has(recItem.id) && (
                              <Button
                                size="xs"
                                variant="danger-outline"
                                disabled={reversingId === recItem.id}
                                onClick={() => setPendingReversalRecord(recItem)}
                              >
                                {reversingId === recItem.id ? 'Reversing…' : 'Reverse Entry'}
                              </Button>
                            )}
                            {!isReversal && reversedRecordIds.has(recItem.id) && (
                              <span className="text-2xs text-ink-3">Reversed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                compact
                icon={Search}
                title="No Matching Log Entries"
                description="Clear the search box to see all saved field checks."
                action={
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => setLedgerSearch('')}
                  >
                    Clear Search
                  </Button>
                }
              />
            )
          ) : (
            <EmptyState
              compact
              icon={History}
              title="No Field Checks Logged Yet"
              description="Click a hamlet above or upload a survey CSV to record a field visit or utility confirmation."
            />
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Field Check Reversal */}
      <ConfirmDialog
        open={pendingReversalRecord !== null}
        onClose={() => setPendingReversalRecord(null)}
        onConfirm={() => {
          if (!pendingReversalRecord) return;
          const targetId = pendingReversalRecord.id;
          setPendingReversalRecord(null);
          void handleReverseVerification(targetId);
        }}
        title="Confirm Field Check Reversal"
        description={
          pendingReversalRecord ? (
            <div className="space-y-1.5">
              <p>
                Add a reversal entry for hamlet{' '}
                <strong className="font-mono">
                  {pendingReversalRecord.cluster_label ??
                    pendingReversalRecord.target_id.slice(0, 8)}
                </strong>{' '}
                ({formatEvidenceSourceLabel(pendingReversalRecord.evidence_type)},{' '}
                {pendingReversalRecord.observed_on})?
              </p>
              <p className="text-xs text-ink-3">
                The original entry stays safely in the log, and the hamlet returns to its
                previous check status.
              </p>
            </div>
          ) : null
        }
        confirmLabel="Add Reversal Entry"
        variant="danger"
        isLoading={reversingId !== null}
      />

      {/* Confirmation Dialog for Re-Running Building Grouping */}
      <ConfirmDialog
        open={confirmRecluster}
        onClose={() => setConfirmRecluster(false)}
        onConfirm={() => {
          setConfirmRecluster(false);
          void handleRunClustering();
        }}
        title="Re-Group Village Buildings?"
        description={`Grouping buildings again with a ${epsM} m radius (at least ${minSamples} buildings, ${householdAlpha} homes per building) will rebuild the hamlet list and refresh demand and wiring plans.`}
        confirmLabel="Re-Group Buildings"
        variant="danger"
        isLoading={runningCluster}
      />
    </Panel>
  );
};
