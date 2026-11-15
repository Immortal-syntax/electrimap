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
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';
import { Panel } from '../ui/Panel';
import { QualityTag } from '../ui/QualityTag';
import { Select } from '../ui/Select';
import { StatTile } from '../ui/StatTile';

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

interface DprExportCenterPanelProps {
  projectId: string;
  preflight: PreFlightReportDto | null;
  exportLog: ProjectExportListDto | null;
  onRefreshAuditAndLogs: () => Promise<void>;
}

export const DprExportCenterPanel: React.FC<DprExportCenterPanelProps> = ({
  projectId,
  preflight,
  exportLog,
  onRefreshAuditAndLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'checks' | 'sections' | 'exports'>('checks');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
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

  if (!preflight) {
    return (
      <Panel
        as="section"
        aria-label="Complete 24-Section DPR Pre-Flight Audit and Export Center"
        overline="Step 6 · Pre-Flight Integrity Gate & Export"
        title="Complete 24-Section DPR, Live-Formula Excel BOQ & GIS Export Center"
        icon={FileCheck2}
      >
        {refreshError && (
          <Callout tone="error" title="Pre-Flight Audit Error" className="mb-3">
            {refreshError}
          </Callout>
        )}
        <EmptyState
          icon={FileCheck2}
          overline="Pre-Flight Integrity Gate"
          title="DPR Pre-Flight Audit Not Computed Yet"
          description="Run the automated pre-flight integrity gate to inspect hard blockers, soft warnings, Schedule of Rates completeness, and the 24-section DPR compilation index."
          epistemicNote="All exported 24-section DPRs carry mandatory preliminary engineering watermarks unless field verification is 100% complete."
          action={
            <Button
              type="button"
              size="sm"
              variant="primary"
              leftIcon={RefreshCw}
              isLoading={refreshing}
              onClick={() => void handleRefresh()}
            >
              {refreshing ? 'Auditing…' : 'Run Pre-Flight Audit'}
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
      aria-label="Complete 24-Section DPR Pre-Flight Audit and Export Center"
      overline="Step 6 · Pre-Flight Integrity Gate & Export"
      title="Complete 24-Section DPR, Live-Formula Excel BOQ & GIS Export Center"
      subtitle={
        <>
          Active Scenario:{' '}
          <strong className="font-mono text-ink">{preflight.active_scenario_key}</strong> ·
          Watermark: <code className="text-xs">{preflight.watermark_text}</code>
        </>
      }
      icon={FileCheck2}
      badge={<QualityTag kind={preflight.can_export ? 'VERIFIED' : 'ASSUMED'} />}
      actions={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leftIcon={RefreshCw}
          isLoading={refreshing}
          onClick={() => void handleRefresh()}
        >
          {refreshing ? 'Auditing…' : 'Re-Run Pre-Flight Audit'}
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Deliverable Download Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-subtle border border-rule-subtle rounded-xs">
          <div className="text-xs text-ink-2 space-y-1">
            <div className="font-semibold text-ink">
              Export Deliverables (Snapshot v{preflight.project_version} ·{' '}
              <span className="font-mono text-xs tabular-nums">
                {preflight.snapshot_hash.slice(0, 12)}…
              </span>
              )
            </div>
            <p className="text-xs">
              PDF &amp; Excel BOQ downloads unlock once all hard blockers pass; GeoPackage/GeoJSON
              ZIP remains downloadable for GIS review at any stage.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {preflight.can_export ? (
              <>
                <a
                  href={`/api/v1/projects/${projectId}/exports/dpr-pdf`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    setTimeout(() => void handleRefresh(), 1500);
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium bg-accent text-white rounded-xs hover:opacity-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                  Download 24-Section DPR (.pdf)
                </a>
                <a
                  href={`/api/v1/projects/${projectId}/exports/boq-xlsx`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    setTimeout(() => void handleRefresh(), 1500);
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium bg-navy-900 text-ink-inverse rounded-xs hover:bg-navy-800 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                  Download Formula BOQ (.xlsx)
                </a>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="danger-outline"
                leftIcon={ShieldAlert}
                disabled
                title="Resolve hard blockers in Pre-Flight Checklist to enable PDF and Excel BOQ export."
              >
                PDF &amp; Excel Export Blocked ({preflight.hard_blockers_failed} Hard Blocker)
              </Button>
            )}

            <a
              href={`/api/v1/projects/${projectId}/exports/gis-package`}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                setTimeout(() => void handleRefresh(), 1500);
              }}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium border border-accent text-accent bg-accent-tint/30 rounded-xs hover:bg-accent-tint/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <FolderArchive className="w-3.5 h-3.5" aria-hidden="true" />
              Download Cleaned GIS Package (.zip)
            </a>
          </div>
        </div>

        {refreshError && (
          <Callout tone="error" title="Pre-Flight Audit Refresh Failed">
            {refreshError}
          </Callout>
        )}

        {!preflight.can_export && (
          <Callout
            tone="error"
            title="DPR & Excel BOQ Export Blocked by Pre-Flight Hard Blocker (Core Principle #4)"
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
            title="Mandatory Preliminary Engineering & Unverified Watermark Active (FR-10.3)"
          >
            Axis-2 field verification coverage is below 100%. Every page of the exported 24-section
            PDF DPR carries the diagonal watermark{' '}
            <code>{preflight.watermark_text}</code> so satellite proxy classifications are never
            mistaken for physical utility meter inspection.
          </Callout>
        )}

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="Pre-Flight Integrity Gate"
            value={preflight.can_export ? 'READY TO EXPORT' : 'BLOCKED'}
            quality={preflight.can_export ? 'VERIFIED' : 'ASSUMED'}
            subtitle={`${preflight.hard_blockers_failed} Hard Blockers · ${preflight.soft_warnings_count} Soft Warnings`}
          />
          <StatTile
            label="24-Section DPR Coverage"
            value={`${preflight.sections.length}/24`}
            unit="Sections"
            quality="VERIFIED"
            subtitle={`${populatedCount} populated · ${explicitNoDataCount} explicit 'No data available' notes`}
          />
          <StatTile
            label="Snapshot SHA-256 Digest"
            value={`${preflight.snapshot_hash.slice(0, 12)}…`}
            quality="VERIFIED"
            subtitle={`Version v${preflight.project_version} · ${preflight.active_scenario_key}`}
          />
          <StatTile
            label="Logged Export Artifacts"
            value={String(exportLog?.total_exports ?? 0)}
            unit="files"
            quality="ESTIMATED"
            subtitle="Append-only SHA-256 export audit trail"
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
            1. Pre-Flight Audit Checklist ({preflight.checks.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'sections' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('sections')}
          >
            2. 24-Section DPR Compilation Index ({preflight.sections.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'exports' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('exports')}
          >
            3. Cryptographic SHA-256 Export Audit Log ({exportLog?.total_exports ?? 0})
          </Button>
        </div>

        {activeTab === 'checks' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-subtle border border-rule-subtle rounded-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-ink-2 mr-1">Filter Status:</span>
                {(
                  [
                    { key: 'ALL', label: `All (${preflight.checks.length})` },
                    { key: 'FAIL', label: `Fail (${failChecksCount})` },
                    { key: 'WARN', label: `Warn (${warnChecksCount})` },
                    { key: 'PASS', label: `Pass (${passChecksCount})` },
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
                title="No Pre-Flight Checks Match Filter"
                description={`No checks currently have status "${checkStatusFilter}".`}
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
                      <th className="p-3">Rule Code</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Check Title &amp; Finding</th>
                      <th className="p-3">Planner Remediation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-subtle">
                    {filteredChecks.map((chk) => (
                      <tr key={chk.check_code} className="hover:bg-subtle/60">
                        <td className="p-3 font-mono font-semibold text-ink whitespace-nowrap text-xs">
                          {chk.check_code}
                        </td>
                        <td className="p-3 text-xs text-ink-2 whitespace-nowrap">
                          {chk.category}
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
                            {chk.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-ink">
                          <div className="font-medium text-xs">{chk.title}</div>
                          <div className="text-xs text-ink-2 mt-0.5">{chk.detail}</div>
                        </td>
                        <td className="p-3 text-xs text-ink-2">{chk.remediation}</td>
                      </tr>
                    ))}
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
                  label="Search 24 DPR Sections"
                  leftIcon={Search}
                  placeholder="Section #, part, title, or disclosure note…"
                  value={sectionSearch}
                  onChange={(e) => setSectionSearch(e.target.value)}
                />
              </div>
              <div className="sm:col-span-4">
                <Select
                  size="sm"
                  label="Compilation Status"
                  aria-label="Filter DPR sections by status"
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
                      label: `Populated (${populatedCount})`,
                    },
                    {
                      value: 'NO_DATA',
                      label: `Explicit No Data (${explicitNoDataCount})`,
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
                title="No DPR Sections Match Filters"
                description="Try clearing the search query or status filter to inspect all 24 sections."
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
                    Reset Section Filters
                  </Button>
                }
              />
            ) : (
              <div className="table-scroll-container max-h-[380px]">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead className="sticky top-0 bg-subtle border-b border-rule text-xs font-semibold text-ink-2 z-10">
                    <tr>
                      <th className="p-3">Sec #</th>
                      <th className="p-3">DPR Part</th>
                      <th className="p-3">Section Title</th>
                      <th className="p-3">Compilation Status</th>
                      <th className="p-3">Data / Epistemic Disclosure Note</th>
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
                            {sec.is_populated ? 'POPULATED' : 'EXPLICIT_NO_DATA_NOTE'}
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
                title="No Export Artifacts Logged Yet"
                description="No export artifacts have been downloaded in this session yet. Click one of the export actions above to generate a cryptographically hashed PDF DPR, Excel BOQ, or GIS ZIP bundle."
              />
            ) : (
              <div className="table-scroll-container">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                      <th className="p-3">Export Kind</th>
                      <th className="p-3">Filename</th>
                      <th className="p-3">Scenario</th>
                      <th className="p-3 text-right">Size (KB)</th>
                      <th className="p-3">File SHA-256</th>
                      <th className="p-3">Snapshot SHA-256</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-subtle font-mono text-xs tabular-nums">
                    {exportLog.items.map((exp) => (
                      <tr key={exp.id} className="hover:bg-subtle/60">
                        <td className="p-3 font-semibold text-ink">{exp.export_kind}</td>
                        <td className="p-3 text-ink">{exp.filename}</td>
                        <td className="p-3 text-ink-2">{exp.scenario_key}</td>
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

