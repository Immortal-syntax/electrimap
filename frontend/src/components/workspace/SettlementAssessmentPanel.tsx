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

import React, { useState } from 'react';
import { apiRequest } from '../../lib/apiClient';
import {
  ClassificationBadge,
  ProxyElectrificationClass,
  VerificationState,
} from '../ui/Badge';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { QualityTag } from '../ui/QualityTag';

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
  settlements: ClusterListResponseDto | null;
  ledger: VerificationLedgerDto | null;
  selectedClusterId: string | null;
  onSelectCluster: (clusterId: string) => void;
  onSettlementsUpdated: () => Promise<void>;
}

export const SettlementAssessmentPanel: React.FC<SettlementAssessmentPanelProps> = ({
  projectId,
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
  const [runningCluster, setRunningCluster] = useState(false);

  // Verification form state
  const [verState, setVerState] = useState<'FIELD_VERIFIED' | 'UTILITY_VERIFIED'>(
    'FIELD_VERIFIED',
  );
  const [verClass, setVerClass] = useState<string>('POTENTIALLY_UNSERVED');
  const [verHouseholds, setVerHouseholds] = useState<string>('');
  const [evidenceType, setEvidenceType] = useState<string>('FIELD_SURVEY');
  const [verifierName, setVerifierName] = useState<string>('Er. R. K. Mohanty (AE TPSODL)');
  const [observedOn, setObservedOn] = useState<string>('2026-03-15');
  const [verNote, setVerNote] = useState<string>('');
  const [submittingVer, setSubmittingVer] = useState(false);

  const [csvUploading, setCsvUploading] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clusters = settlements?.items ?? [];
  const selectedCluster =
    clusters.find((c) => c.id === selectedClusterId) ?? clusters[0] ?? null;

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
    <section
      aria-label="Settlement Identification and Verification Ledger"
      className="bg-sheet border border-rule-strong rounded-xs p-4 space-y-4"
    >
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <div>
          <div className="small-caps-heading">
            Milestone M3 · Habitation Clustering, Two-Axis Proxy Classification &amp; Verification
            Ledger
          </div>
          <p className="text-xs text-ink-2 mt-0.5">
            Metric DBSCAN clustering in UTM (EPSG:32644), 4-tier proxy rules, Census 2011
            reconciliation, and append-only field/utility verification ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/v1/projects/${projectId}/exports/preliminary-settlement-pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-xs border border-rule-strong bg-paper text-ink hover:bg-accent-tint hover:text-accent transition-colors"
          >
            Download Preliminary DPR Skeleton (PDF · Sections 1–5 + Map Plate)
          </a>
        </div>
      </div>

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

      {/* Configurable DBSCAN Controls */}
      <div className="bg-paper border border-rule rounded-xs p-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="dbscan-eps"
              className="block text-[11px] font-mono text-ink-2 mb-1"
            >
              DBSCAN Radius ε (m in UTM)
            </label>
            <input
              id="dbscan-eps"
              type="number"
              min={25}
              max={1000}
              step={10}
              value={epsM}
              onChange={(e) => setEpsM(Number(e.target.value))}
              className="w-28 px-2 py-1 text-xs font-mono bg-sheet border border-rule-strong rounded-xs"
            />
          </div>
          <div>
            <label
              htmlFor="dbscan-min-samples"
              className="block text-[11px] font-mono text-ink-2 mb-1"
            >
              Min Buildings (min_samples)
            </label>
            <input
              id="dbscan-min-samples"
              type="number"
              min={2}
              max={50}
              value={minSamples}
              onChange={(e) => setMinSamples(Number(e.target.value))}
              className="w-28 px-2 py-1 text-xs font-mono bg-sheet border border-rule-strong rounded-xs"
            />
          </div>
          <div>
            <label
              htmlFor="hh-alpha"
              className="block text-[11px] font-mono text-ink-2 mb-1"
            >
              Household Ratio (α)
            </label>
            <input
              id="hh-alpha"
              type="number"
              min={0.4}
              max={2.0}
              step={0.05}
              value={householdAlpha}
              onChange={(e) => setHouseholdAlpha(Number(e.target.value))}
              className="w-24 px-2 py-1 text-xs font-mono bg-sheet border border-rule-strong rounded-xs"
            />
          </div>
        </div>

        <Button
          size="sm"
          variant="primary"
          disabled={runningCluster}
          onClick={() => void handleRunClustering()}
        >
          {runningCluster
            ? 'Running UTM DBSCAN & Classification…'
            : 'Run Habitation Clustering'}
        </Button>
      </div>

      {/* Census 2011 Household Reconciliation Banner */}
      {rec && (
        <div
          className={`p-3 rounded-xs border text-xs flex flex-wrap items-center justify-between gap-3 ${
            rec.divergence_exceeds_30pct
              ? 'bg-warn/10 border-warn'
              : 'bg-paper border-rule'
          }`}
        >
          <div className="space-y-1">
            <div className="font-semibold text-ink flex items-center gap-2">
              <span>
                Census 2011 Household Reconciliation ({rec.village_name ?? 'Village'} · PCA{' '}
                {rec.census2011_code ?? '428914'})
              </span>
              <QualityTag
                kind={rec.divergence_exceeds_30pct ? 'ASSUMED' : 'ESTIMATED'}
                label={
                  rec.divergence_exceeds_30pct
                    ? 'DIVERGENCE > 30% — SURVEY REQUIRED'
                    : 'RECONCILED WITHIN ±30%'
                }
              />
            </div>
            <p className="text-ink-2 text-[11px]">{rec.reconciliation_note}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
            <div>
              <span className="text-ink-2 block">Census 2011 HH</span>
              <span className="font-semibold text-ink">
                {rec.census_2011_households ?? '—'}
              </span>
            </div>
            <div>
              <span className="text-ink-2 block">Projected Base HH</span>
              <span className="font-semibold text-ink">
                {rec.projected_base_year_households ?? '—'}
              </span>
            </div>
            <div>
              <span className="text-ink-2 block">Satellite Est. HH</span>
              <span className="font-semibold text-ink">
                {rec.satellite_estimated_households} ({rec.satellite_detected_buildings} bldgs)
              </span>
            </div>
            <div>
              <span className="text-ink-2 block">Delta (%)</span>
              <span
                className={`font-semibold ${
                  rec.divergence_exceeds_30pct ? 'text-warn' : 'text-ink'
                }`}
              >
                {rec.delta_pct !== null && rec.delta_pct !== undefined
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
        <div className="lg:col-span-7 space-y-2">
          <div className="small-caps-heading">
            Habitation Cluster Inventory ({clusters.length} Clusters · Coverage:{' '}
            {(settlements?.verification_coverage_pct ?? 0).toFixed(1)}%)
          </div>
          <div className="overflow-x-auto border border-rule rounded-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-paper border-b border-rule font-mono text-[11px] text-ink-2">
                  <th className="py-2 px-2.5">Cluster</th>
                  <th className="py-2 px-2.5">Habitation Name</th>
                  <th className="py-2 px-2.5">Bldgs / HH</th>
                  <th className="py-2 px-2.5">Two-Axis Classification</th>
                  <th className="py-2 px-2.5">Zonal Terrain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {clusters.map((c) => {
                  const isSelected = selectedCluster?.id === c.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCluster(c.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-accent-tint/60' : 'hover:bg-paper/60'
                      }`}
                    >
                      <td className="py-2 px-2.5 font-mono font-semibold text-ink">
                        {c.label}
                      </td>
                      <td className="py-2 px-2.5 font-medium text-ink">{c.name}</td>
                      <td className="py-2 px-2.5 font-mono text-[11px]">
                        {c.n_detected} bldgs · <strong>{c.est_households} HH</strong>
                      </td>
                      <td className="py-2 px-2.5 space-y-1">
                        <ClassificationBadge
                          proxyClass={c.proxy_class}
                          verificationState={c.verification_state}
                        />
                        {c.verified_class && (
                          <div className="font-mono text-[10px] text-ok">
                            Axis-2 Verified Class: {c.verified_class}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-[11px] text-ink-2">
                        {c.slope_mean_deg.toFixed(1)}° · {(c.canopy_share * 100).toFixed(0)}% canopy
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 5 cols: Selected Cluster Inspector & Field/Utility Verification Form */}
        <div className="lg:col-span-5 bg-paper border border-rule rounded-xs p-3.5 space-y-3">
          {selectedCluster ? (
            <>
              <div className="border-b border-rule pb-2 flex items-center justify-between">
                <div>
                  <span className="small-caps-heading block">
                    Selected Cluster Inspector
                  </span>
                  <h4 className="text-sm font-semibold text-ink">
                    {selectedCluster.label} · {selectedCluster.name}
                  </h4>
                </div>
                <QualityTag
                  kind={
                    selectedCluster.verification_state !== 'UNVERIFIED'
                      ? 'VERIFIED'
                      : 'PROXY'
                  }
                  label={`CONFIDENCE: ${
                    selectedCluster.verification_state !== 'UNVERIFIED'
                      ? 'HIGH (VERIFIED)'
                      : selectedCluster.proxy_confidence
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-sheet p-2.5 border border-rule rounded-xs">
                <div>
                  <span className="text-ink-2 block">Axis-1 Proxy Class</span>
                  <span className="font-semibold text-ink">
                    {selectedCluster.proxy_class}
                  </span>
                </div>
                <div>
                  <span className="text-ink-2 block">Axis-2 Verification</span>
                  <span className="font-semibold text-ink">
                    {selectedCluster.verification_state}
                    {selectedCluster.verified_class
                      ? ` (${selectedCluster.verified_class})`
                      : ''}
                  </span>
                </div>
                <div>
                  <span className="text-ink-2 block">Nearest Road / Slope</span>
                  <span className="text-ink">
                    {selectedCluster.d_road_m ?? 0} m · {selectedCluster.slope_mean_deg}°
                  </span>
                </div>
                <div>
                  <span className="text-ink-2 block">HREA Lightscore</span>
                  <span className="text-ink">
                    {String(selectedCluster.evidence?.['nl_lightscore'] ?? '0.45')}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-ink-2 italic">
                {String(
                  selectedCluster.evidence?.['rationale'] ??
                    'Proxy classification derived from VIIRS/HREA nightlights and OSM road proximity.',
                )}
              </p>

              {/* Inline Verification Form */}
              <form onSubmit={(e) => void handleRecordVerification(e)} className="space-y-2.5 pt-1">
                <div className="small-caps-heading border-t border-rule pt-2">
                  Record Field / Utility Verification (Axis 2)
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="ver-state"
                      className="block text-[11px] font-mono text-ink-2 mb-0.5"
                    >
                      Verification State
                    </label>
                    <select
                      id="ver-state"
                      value={verState}
                      onChange={(e) =>
                        setVerState(
                          e.target.value as 'FIELD_VERIFIED' | 'UTILITY_VERIFIED',
                        )
                      }
                      className="w-full px-2 py-1 text-xs bg-sheet border border-rule-strong rounded-xs"
                    >
                      <option value="FIELD_VERIFIED">FIELD_VERIFIED</option>
                      <option value="UTILITY_VERIFIED">UTILITY_VERIFIED</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="ver-class"
                      className="block text-[11px] font-mono text-ink-2 mb-0.5"
                    >
                      Verified Status Class
                    </label>
                    <select
                      id="ver-class"
                      value={verClass}
                      onChange={(e) => setVerClass(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-sheet border border-rule-strong rounded-xs"
                    >
                      <option value="POTENTIALLY_UNSERVED">UNSERVED / OFF-GRID</option>
                      <option value="POTENTIALLY_UNDERSERVED">
                        UNDERSERVED (WEAK TAIL-END)
                      </option>
                      <option value="LIKELY_ELECTRIFIED">ELECTRIFIED (ADEQUATE)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="ver-evidence"
                      className="block text-[11px] font-mono text-ink-2 mb-0.5"
                    >
                      Evidence Source
                    </label>
                    <select
                      id="ver-evidence"
                      value={evidenceType}
                      onChange={(e) => setEvidenceType(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-sheet border border-rule-strong rounded-xs"
                    >
                      <option value="FIELD_SURVEY">FIELD_SURVEY</option>
                      <option value="UTILITY_LEDGER">UTILITY_LEDGER</option>
                      <option value="GRAM_SABHA_RESOLUTION">GRAM_SABHA_RESOLUTION</option>
                      <option value="GEO_TAGGED_PHOTO">GEO_TAGGED_PHOTO</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="ver-hh"
                      className="block text-[11px] font-mono text-ink-2 mb-0.5"
                    >
                      Verified Households
                    </label>
                    <input
                      id="ver-hh"
                      type="number"
                      min={0}
                      max={10000}
                      placeholder={String(selectedCluster.est_households)}
                      value={verHouseholds}
                      onChange={(e) => setVerHouseholds(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono bg-sheet border border-rule-strong rounded-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="ver-verifier"
                      className="block text-[11px] font-mono text-ink-2 mb-0.5"
                    >
                      Verifier Name &amp; Designation
                    </label>
                    <input
                      id="ver-verifier"
                      type="text"
                      required
                      value={verifierName}
                      onChange={(e) => setVerifierName(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-sheet border border-rule-strong rounded-xs"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ver-date"
                      className="block text-[11px] font-mono text-ink-2 mb-0.5"
                    >
                      Observation Date
                    </label>
                    <input
                      id="ver-date"
                      type="date"
                      required
                      value={observedOn}
                      onChange={(e) => setObservedOn(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono bg-sheet border border-rule-strong rounded-xs"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="ver-note"
                    className="block text-[11px] font-mono text-ink-2 mb-0.5"
                  >
                    Audit Note
                  </label>
                  <input
                    id="ver-note"
                    type="text"
                    placeholder="e.g., Confirmed 0 LT poles in hamlet via Gram Sabha survey"
                    value={verNote}
                    onChange={(e) => setVerNote(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-sheet border border-rule-strong rounded-xs"
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  disabled={submittingVer}
                >
                  {submittingVer
                    ? 'Appending to Ledger…'
                    : `Append Verification for ${selectedCluster.label}`}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-xs text-ink-2 font-mono">
              Select a habitation cluster to inspect zonal statistics and record verification.
            </div>
          )}
        </div>
      </div>

      {/* Append-Only Verification Audit Ledger & CSV Batch Import */}
      <div className="border-t border-rule pt-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="small-caps-heading">
              Append-Only Verification Audit Ledger ({ledger?.records.length ?? 0} Entries)
            </span>
            <p className="text-[11px] text-ink-2">
              Database triggers forbid UPDATE or DELETE on verification records. Corrections append
              a linked reversal record.
            </p>
          </div>

          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-paper border border-rule-strong rounded-xs cursor-pointer hover:bg-sheet">
            <span>{csvUploading ? 'Importing CSV…' : 'Import Field Survey CSV'}</span>
            <input
              type="file"
              accept=".csv"
              aria-label="Import Field Survey CSV"
              disabled={csvUploading}
              onChange={(e) => void handleCsvUpload(e)}
              className="sr-only"
            />
          </label>
        </div>

        {ledger && ledger.records.length > 0 ? (
          <div className="overflow-x-auto border border-rule rounded-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-paper border-b border-rule font-mono text-[11px] text-ink-2">
                  <th className="py-1.5 px-2.5">Cluster</th>
                  <th className="py-1.5 px-2.5">Evidence</th>
                  <th className="py-1.5 px-2.5">Verifier &amp; Date</th>
                  <th className="py-1.5 px-2.5">State Transition (Axis 2)</th>
                  <th className="py-1.5 px-2.5">Audit Note</th>
                  <th className="py-1.5 px-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {ledger.records.map((recItem) => {
                  const prevState = String(
                    recItem.previous_value?.['verification_state'] ?? 'UNVERIFIED',
                  );
                  const nextState = String(
                    recItem.new_value?.['verification_state'] ?? 'FIELD_VERIFIED',
                  );
                  const nextClass = String(recItem.new_value?.['verified_class'] ?? '');
                  const isReversal = Boolean(recItem.reverses_id);
                  return (
                    <tr key={recItem.id} className="hover:bg-paper/40">
                      <td className="py-1.5 px-2.5 font-mono font-semibold">
                        {recItem.cluster_label ?? recItem.target_id.slice(0, 6)}
                      </td>
                      <td className="py-1.5 px-2.5 font-mono text-[11px]">
                        {recItem.evidence_type}
                      </td>
                      <td className="py-1.5 px-2.5 text-[11px]">
                        <div className="font-medium text-ink">{recItem.verifier_name}</div>
                        <div className="font-mono text-ink-2">{recItem.observed_on}</div>
                      </td>
                      <td className="py-1.5 px-2.5 font-mono text-[11px]">
                        {prevState} → <strong>{nextState}</strong>
                        {nextClass ? ` (${nextClass})` : ''}
                      </td>
                      <td className="py-1.5 px-2.5 text-[11px] text-ink-2">
                        {recItem.note}
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        {!isReversal && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={reversingId === recItem.id}
                            onClick={() => void handleReverseVerification(recItem.id)}
                          >
                            {reversingId === recItem.id ? 'Reversing…' : 'Reverse Entry'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-3 bg-paper border border-dashed border-rule rounded-xs text-xs text-ink-2 font-mono">
            No verification records logged yet. Select a cluster above or upload a field survey CSV
            to record Axis-2 verification evidence.
          </div>
        )}
      </div>
    </section>
  );
};
