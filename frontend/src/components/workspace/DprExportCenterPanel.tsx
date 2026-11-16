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

import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { formatScenarioLabel } from '../../lib/beginnerGlossary';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';
import { Panel } from '../ui/Panel';
import { QualityTag } from '../ui/QualityTag';
import { Select } from '../ui/Select';
import { StatTile } from '../ui/StatTile';
import { HelpTooltip } from '../ui/Tooltip';

export interface PreFlightCheckItemDto {
  check_code: string;
  title: string;
  category: 'HARD_BLOCKER' | 'SOFT_WARNING' | string;
  status: 'PASS' | 'WARN' | 'FAIL' | string;
  detail: string;
  remediation: string;
}

export interface DprSectionStatusItemDto {
  section_number: number;
  section_key: string;
  title: string;
  group: string;
  is_populated: boolean;
  data_status_note: string;
}

export interface PreFlightReportDto {
  project_id: string;
  project_version: number;
  active_scenario_key: string;
  can_export: boolean;
  hard_blockers_failed: number;
  soft_warnings_count: number;
  requires_not_field_verified_watermark: boolean;
  watermark_text: string;
  snapshot_hash: string;
  checks: PreFlightCheckItemDto[];
  sections: DprSectionStatusItemDto[];
}

export interface ProjectExportRecordDto {
  id: string;
  project_id: string;
  scenario_id: string;
  scenario_key: string;
  export_kind: string;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  file_sha256: string;
  snapshot_hash: string;
  preflight_passed: boolean;
  preflight_warnings_count: number;
  created_by: string | null;
  notes: string;
  created_at: string;
}

export interface ProjectExportListDto {
  project_id: string;
  total_exports: number;
  items: ProjectExportRecordDto[];
}

type FixableSectionKey = 'data' | 'settlements' | 'infrastructure' | 'network' | 'cost';

function resolveStepNavigation(checkCode: string): {
  section: FixableSectionKey;
  label: string;
} {
  if (/SYNTHETIC|AOI|LAYER|RASTER|DATA|INGEST/i.test(checkCode)) {
    return { section: 'data', label: 'Fix in Step 1' };
  }
  if (/CLUSTER|SETTLEMENT|CENSUS|VERIF|AXIS_2/i.test(checkCode)) {
    return { section: 'settlements', label: 'Fix in Step 2' };
  }
  if (/TIE_?IN|INFRA|DEMAND|GAP|EXISTING/i.test(checkCode)) {
    return { section: 'infrastructure', label: 'Fix in Step 3' };
  }
  if (/CEA|VOLTAGE|NETWORK|SCENARIO|ROUT|LINE|TRANSFORMER/i.test(checkCode)) {
    return { section: 'network', label: 'Fix in Step 4' };
  }
  if (/BOQ|RATE|SOR|COST|ECON|FINANC/i.test(checkCode)) {
    return { section: 'cost', label: 'Fix in Step 5' };
  }
  return { section: 'data', label: 'Review Step 1' };
}

interface DprExportCenterPanelProps {
  projectId: string;
  preflight: PreFlightReportDto | null;
  exportLog: ProjectExportListDto | null;
  onRefreshAuditAndLogs: () => Promise<void>;
  onNavigateSection?: (section: FixableSectionKey) => void;
}

export const DprExportCenterPanel: React.FC<DprExportCenterPanelProps> = ({
  projectId,
  preflight,
  exportLog,
  onRefreshAuditAndLogs,
  onNavigateSection,
}) => {
  const [activeTab, setActiveTab] = useState<'checks' | 'sections' | 'exports'>('checks');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [downloadingArtifact, setDownloadingArtifact] = useState<
    'dpr-pdf' | 'boq-xlsx' | 'gis-package' | null
  >(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [checkStatusFilter, setCheckStatusFilter] = useState<'ALL' | 'FAIL' | 'WARN' | 'PASS'>(
    'ALL',
  );
  const [sectionFilter, setSectionFilter] = useState<'ALL' | 'POPULATED' | 'NO_DATA'>('ALL');
  const [sectionSearch, setSectionSearch] = useState('');

  const filteredChecks = useMemo(() => {
    const items = preflight?.checks ?? [];
    if (checkStatusFilter === 'ALL') return items;
    return items.filter((chk) => chk.status === checkStatusFilter);
  }, [preflight, checkStatusFilter]);

  const filteredSections = useMemo(() => {
    const items = preflight?.sections ?? [];
    const q = sectionSearch.trim().toLowerCase();
    return items.filter((sec) => {
      if (sectionFilter === 'POPULATED' && !sec.is_populated) return false;
      if (sectionFilter === 'NO_DATA' && sec.is_populated) return false;
      if (!q) return true;
      return (
        String(sec.section_number).includes(q) ||
        sec.title.toLowerCase().includes(q) ||
        sec.group.toLowerCase().includes(q) ||
        sec.data_status_note.toLowerCase().includes(q)
      );
    });
  }, [preflight, sectionFilter, sectionSearch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await onRefreshAuditAndLogs();
    } catch (err) {
      setRefreshError(
        err instanceof Error
          ? err.message
          : 'Unable to refresh pre-flight audit and export logs.',
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadArtifact = async (
    artifact: 'dpr-pdf' | 'boq-xlsx' | 'gis-package',
    fallbackFilename: string,
  ) => {
    setDownloadingArtifact(artifact);
    setDownloadError(null);
    try {
      const resp = await fetch(`/api/v1/projects/${projectId}/exports/${artifact}`, {
        credentials: 'include',
      });
      if (!resp.ok) {
        let msg = `Export '${artifact}' failed (HTTP ${resp.status}).`;
        try {
          const payload = (await resp.json()) as {
            detail?: string | { message?: string };
            message?: string;
            error?: { message?: string; code?: string };
          };
          const detailMsg =
            typeof payload.detail === 'string'
              ? payload.detail
              : payload.detail?.message;
          msg = payload.error?.message ?? payload.message ?? detailMsg ?? msg;
        } catch {
          // ignore non-JSON body
        }
        throw new Error(msg);
      }
      const blob = await resp.blob();
      const cd = resp.headers.get('content-disposition') ?? '';
      const match = /filename="?([^";]+)"?/i.exec(cd);
      const filename = match?.[1] ?? fallbackFilename;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      await handleRefresh();
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : 'Unable to download export artifact. Check pre-flight audit and session status.',
      );
    } finally {
      setDownloadingArtifact(null);
    }
  };

  if (!preflight) {
    return (
      <Panel
        as="section"
        aria-label="Final Report and Cost Workbook Download"
        overline="Step 6 · Final Checks &amp; Report Download"
        title={
          <span className="inline-flex items-center gap-1.5">
            Final Report &amp; Cost Workbook Download
            <HelpTooltip glossaryKey="dpr" />
          </span>
        }
        icon={FileCheck2}
      >
        {refreshError && (
          <Callout tone="error" title="Readiness Check Failed" className="mb-3">
            {refreshError}
          </Callout>
        )}
        <EmptyState
          icon={FileCheck2}
          overline="Export Readiness Gate"
          title="Final Readiness Check Not Run Yet"
          description="Check which planning steps are complete, whether all item prices are filled in, and how many of the 24 report sections have real data."
          epistemicNote="Exported reports carry a preliminary watermark unless field verification reaches 100%."
          action={
            <Button
              type="button"
              size="sm"
              variant="primary"
              leftIcon={RefreshCw}
              isLoading={refreshing}
              onClick={() => void handleRefresh()}
            >
              {refreshing ? 'Checking…' : 'Check Readiness Now'}
            </Button>
          }
        />
      </Panel>
    );
  }

  const populatedCount = preflight.sections.filter((s) => s.is_populated).length;
  const explicitNoDataCount = preflight.sections.length - populatedCount;
  const failChecksCount = preflight.checks.filter((c) => c.status === 'FAIL').length;
  const warnChecksCount = preflight.checks.filter((c) => c.status === 'WARN').length;
  const passChecksCount = preflight.checks.filter((c) => c.status === 'PASS').length;

  return (
    <Panel
      as="section"
      aria-label="Final Report and Cost Workbook Download"
      overline="Step 6 · Final Checks &amp; Report Download"
      title={
        <span className="inline-flex items-center gap-1.5">
          Final Report &amp; Cost Workbook Download
          <HelpTooltip glossaryKey="dpr" />
        </span>
      }
      subtitle={
        <>
          Selected Plan:{' '}
          <strong className="text-ink">
            {formatScenarioLabel(preflight.active_scenario_key)}
          </strong>{' '}
          · Report Stamp: <span className="text-ink-2">{preflight.watermark_text}</span>
        </>
      }
      icon={FileCheck2}
      badge={
        <QualityTag
          kind={preflight.can_export ? 'ESTIMATED' : 'ASSUMED'}
          label={
            preflight.can_export
              ? 'Ready to Export'
              : `Steps Needed (${preflight.hard_blockers_failed})`
          }
        />
      }
      actions={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leftIcon={RefreshCw}
          isLoading={refreshing}
          onClick={() => void handleRefresh()}
        >
          {refreshing ? 'Checking…' : 'Re-Check Readiness'}
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Deliverable Download Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-subtle border border-rule-subtle rounded-xs">
          <div className="text-xs text-ink-2 space-y-1 max-w-xl">
            <div className="font-semibold text-ink">
              Downloadable Project Files (Saved Version {preflight.project_version} ·{' '}
              <span className="font-mono text-xs tabular-nums">
                {preflight.snapshot_hash.slice(0, 12)}…
              </span>
              )
            </div>
            <p className="text-xs leading-relaxed">
              The <strong>24-Section PDF Report</strong> and{' '}
              <strong>Excel Cost Workbook (.xlsx)</strong> unlock once all required steps
              pass. You can download the <strong>Map Files (.zip)</strong> for review at any
              time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {preflight.can_export ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  leftIcon={FileText}
                  isLoading={downloadingArtifact === 'dpr-pdf'}
                  loadingText="Building 24-Section PDF…"
                  disabled={downloadingArtifact !== null}
                  onClick={() =>
                    void handleDownloadArtifact(
                      'dpr-pdf',
                      `electrimap_dpr_${projectId.slice(0, 8)}.pdf`,
                    )
                  }
                >
                  Download 24-Section Report (.pdf)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  leftIcon={FileSpreadsheet}
                  isLoading={downloadingArtifact === 'boq-xlsx'}
                  loadingText="Building Excel Workbook…"
                  disabled={downloadingArtifact !== null}
                  onClick={() =>
                    void handleDownloadArtifact(
                      'boq-xlsx',
                      `electrimap_boq_${projectId.slice(0, 8)}.xlsx`,
                    )
                  }
                >
                  Download Cost Workbook (.xlsx)
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="danger-outline"
                leftIcon={ShieldAlert}
                disabled
                title="Resolve required items in Readiness Checks below to unlock PDF and Excel downloads."
              >
                PDF &amp; Excel Locked ({preflight.hard_blockers_failed}{' '}
                {preflight.hard_blockers_failed === 1 ? 'Step' : 'Steps'} Needed)
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={FolderArchive}
              isLoading={downloadingArtifact === 'gis-package'}
              loadingText="Preparing Map ZIP…"
              disabled={downloadingArtifact !== null}
              onClick={() =>
                void handleDownloadArtifact(
                  'gis-package',
                  `electrimap_gis_${projectId.slice(0, 8)}.zip`,
                )
              }
            >
              Download Map Files (.zip)
            </Button>
          </div>
        </div>

        {downloadError && (
          <Callout
            tone="error"
            title="File Download Failed"
            action={
              <Button size="xs" variant="ghost" onClick={() => setDownloadError(null)}>
                Dismiss
              </Button>
            }
          >
            {downloadError}
          </Callout>
        )}

        {refreshError && (
          <Callout tone="error" title="Could Not Refresh Readiness Check">
            {refreshError}
          </Callout>
        )}

        {!preflight.can_export && (
          <Callout
            tone="error"
            title={
              <span className="inline-flex items-center gap-1.5">
                Complete Required Steps Before Exporting PDF or Excel
                <HelpTooltip glossaryKey="exportReadinessGate" />
              </span>
            }
          >
            {preflight.checks
              .filter((c) => c.category === 'HARD_BLOCKER' && c.status === 'FAIL')
              .map((c) => `${c.title}: ${c.detail} (${c.remediation})`)
              .join(' | ')}
          </Callout>
        )}

        {preflight.requires_not_field_verified_watermark && preflight.can_export && (
          <Callout
            tone="warn"
            title={
              <span className="inline-flex items-center gap-1.5">
                Preliminary Engineering Watermark Active
                <HelpTooltip glossaryKey="preliminaryDisclaimer" />
              </span>
            }
          >
            Field verification is below 100%, so every page of the exported PDF carries the
            diagonal note <code>{preflight.watermark_text}</code>. This prevents satellite
            estimates from being mistaken for inspected home meters.
          </Callout>
        )}

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="Export Readiness"
            value={preflight.can_export ? 'Ready to Export' : 'Steps Needed'}
            quality={preflight.can_export ? 'ESTIMATED' : 'ASSUMED'}
            subtitle={`${preflight.hard_blockers_failed} required · ${preflight.soft_warnings_count} advisories`}
          />
          <StatTile
            label="24-Section Report Outline"
            value={
              failChecksCount > 0
                ? `${populatedCount}/24 Populated`
                : `${preflight.sections.length}/24 Ready`
            }
            quality={failChecksCount > 0 && populatedCount === 0 ? 'UNSET' : 'ESTIMATED'}
            subtitle={
              failChecksCount > 0
                ? `Complete Steps 1–5 to fill remaining ${explicitNoDataCount} sections`
                : `${populatedCount} data-backed · ${explicitNoDataCount} marked "No data yet"`
            }
          />
          <StatTile
            label="Verification Fingerprint"
            value={`${preflight.snapshot_hash.slice(0, 12)}…`}
            quality="ESTIMATED"
            subtitle={`Saved v${preflight.project_version} · ${formatScenarioLabel(preflight.active_scenario_key)}`}
          />
          <StatTile
            label="Downloaded Files Log"
            value={String(exportLog?.total_exports ?? 0)}
            unit="files"
            quality="ESTIMATED"
            subtitle="Permanent file verification history"
          />
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-subtle border border-rule-subtle rounded-xs w-fit">
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'checks' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('checks')}
          >
            1. Readiness Checks ({preflight.checks.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'sections' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('sections')}
          >
            2. 24 Report Sections ({preflight.sections.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'exports' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('exports')}
          >
            3. Download History ({exportLog?.total_exports ?? 0})
          </Button>
        </div>

        {activeTab === 'checks' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-subtle border border-rule-subtle rounded-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-ink-2 mr-1">Filter:</span>
                {(
                  [
                    { key: 'ALL', label: `All (${preflight.checks.length})` },
                    { key: 'FAIL', label: `Action Needed (${failChecksCount})` },
                    { key: 'WARN', label: `Advisories (${warnChecksCount})` },
                    { key: 'PASS', label: `Passed (${passChecksCount})` },
                  ] as const
                ).map((opt) => (
                  <Button
                    key={opt.key}
                    type="button"
                    size="xs"
                    variant={checkStatusFilter === opt.key ? 'primary' : 'secondary'}
                    onClick={() => setCheckStatusFilter(opt.key)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <span className="text-xs text-ink-3 tabular-nums">
                Showing {filteredChecks.length} of {preflight.checks.length} checks
              </span>
            </div>

            {filteredChecks.length === 0 ? (
              <EmptyState
                compact
                title="No Checks Match Filter"
                description={`No checks currently match "${checkStatusFilter}".`}
                action={
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() => setCheckStatusFilter('ALL')}
                  >
                    Show All Checks
                  </Button>
                }
              />
            ) : (
              <div className="table-scroll-container">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                      <th className="p-3">Rule</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">What Was Checked</th>
                      <th className="p-3">How to Fix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-subtle">
                    {filteredChecks.map((chk) => {
                      const stepTarget = resolveStepNavigation(chk.check_code);
                      return (
                        <tr key={chk.check_code} className="hover:bg-subtle/60">
                          <td className="p-3 font-mono font-semibold text-ink whitespace-nowrap text-xs">
                            {chk.check_code}
                          </td>
                          <td className="p-3 text-xs text-ink-2 whitespace-nowrap">
                            {chk.category === 'HARD_BLOCKER'
                              ? 'Required for Export'
                              : chk.category === 'SOFT_WARNING'
                                ? 'Advisory'
                                : chk.category}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                chk.status === 'PASS'
                                  ? 'ok'
                                  : chk.status === 'WARN'
                                    ? 'warn'
                                    : 'error'
                              }
                              size="sm"
                            >
                              {chk.status === 'PASS'
                                ? 'Passed'
                                : chk.status === 'WARN'
                                  ? 'Advisory'
                                  : 'Needed'}
                            </Badge>
                          </td>
                          <td className="p-3 text-ink">
                            <div className="font-medium text-xs">{chk.title}</div>
                            <div className="text-xs text-ink-2 mt-0.5">{chk.detail}</div>
                          </td>
                          <td className="p-3 text-xs text-ink-2 space-y-1.5">
                            <div>{chk.remediation}</div>
                            {chk.status !== 'PASS' && onNavigateSection && (
                              <Button
                                type="button"
                                size="xs"
                                variant={chk.status === 'FAIL' ? 'primary' : 'secondary'}
                                rightIcon={ArrowRight}
                                onClick={() => onNavigateSection(stepTarget.section)}
                              >
                                {stepTarget.label}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sections' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end p-3 bg-subtle border border-rule-subtle rounded-xs">
              <div className="sm:col-span-6">
                <Input
                  size="sm"
                  label="Search 24 Report Sections"
                  leftIcon={Search}
                  placeholder="Section #, part, title, or note…"
                  value={sectionSearch}
                  onChange={(e) => setSectionSearch(e.target.value)}
                />
              </div>
              <div className="sm:col-span-4">
                <Select
                  size="sm"
                  label="Section Data Status"
                  aria-label="Filter report sections by status"
                  value={sectionFilter}
                  onChange={(e) =>
                    setSectionFilter(e.target.value as 'ALL' | 'POPULATED' | 'NO_DATA')
                  }
                  options={[
                    {
                      value: 'ALL',
                      label: `All Sections (${preflight.sections.length})`,
                    },
                    {
                      value: 'POPULATED',
                      label: `Data Ready (${populatedCount})`,
                    },
                    {
                      value: 'NO_DATA',
                      label: `No Data Yet (${explicitNoDataCount})`,
                    },
                  ]}
                />
              </div>
              <div className="sm:col-span-2 flex items-center justify-end gap-2">
                {(sectionSearch || sectionFilter !== 'ALL') && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSectionSearch('');
                      setSectionFilter('ALL');
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {filteredSections.length === 0 ? (
              <EmptyState
                compact
                title="No Report Sections Match Filters"
                description="Clear your search text or status filter to see all 24 sections."
                action={
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      setSectionSearch('');
                      setSectionFilter('ALL');
                    }}
                  >
                    Reset Filters
                  </Button>
                }
              />
            ) : (
              <div className="table-scroll-container max-h-[380px]">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead className="sticky top-0 bg-subtle border-b border-rule text-xs font-semibold text-ink-2 z-10">
                    <tr>
                      <th className="p-3">Sec #</th>
                      <th className="p-3">Report Part</th>
                      <th className="p-3">Section Title</th>
                      <th className="p-3">Data Status</th>
                      <th className="p-3">Data &amp; Disclaimer Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-subtle">
                    {filteredSections.map((sec) => (
                      <tr key={sec.section_key} className="hover:bg-subtle/60">
                        <td className="p-3 font-mono font-semibold text-ink whitespace-nowrap text-xs">
                          Sec {sec.section_number}
                        </td>
                        <td className="p-3 text-xs text-ink-2 whitespace-nowrap">
                          {sec.group}
                        </td>
                        <td className="p-3 font-medium text-ink text-xs">{sec.title}</td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge
                            variant={sec.is_populated ? 'ok' : 'warn'}
                            size="sm"
                          >
                            {sec.is_populated ? 'Data Ready' : 'No Data Yet'}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-ink-2">{sec.data_status_note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'exports' && (
          <div>
            {!exportLog || exportLog.items.length === 0 ? (
              <EmptyState
                compact
                icon={FileText}
                title="No Downloads Recorded Yet"
                description="Use the buttons above to download your PDF report, Excel cost workbook, or GIS map package."
              />
            ) : (
              <div className="table-scroll-container">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                      <th className="p-3">File Type</th>
                      <th className="p-3">Filename</th>
                      <th className="p-3">Plan Option</th>
                      <th className="p-3 text-right">Size (KB)</th>
                      <th className="p-3">File Checksum</th>
                      <th className="p-3">Version Checksum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-subtle font-mono text-xs tabular-nums">
                    {exportLog.items.map((exp) => (
                      <tr key={exp.id} className="hover:bg-subtle/60">
                        <td className="p-3 font-semibold text-ink">{exp.export_kind}</td>
                        <td className="p-3 text-ink">{exp.filename}</td>
                        <td className="p-3 font-sans text-ink-2">
                          {formatScenarioLabel(exp.scenario_key)}
                        </td>
                        <td className="p-3 text-right text-ink">
                          {(exp.file_size_bytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="p-3 text-ink-2" title={exp.file_sha256}>
                          {exp.file_sha256.slice(0, 16)}…
                        </td>
                        <td className="p-3 text-ink-2" title={exp.snapshot_hash}>
                          {exp.snapshot_hash.slice(0, 16)}…
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
};

