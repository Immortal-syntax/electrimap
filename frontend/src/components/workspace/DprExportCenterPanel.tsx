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
import { Callout } from '../ui/Callout';
import { QualityTag } from '../ui/QualityTag';
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

  if (!preflight) {
    return null;
  }

  const populatedCount = preflight.sections.filter((s) => s.is_populated).length;
  const explicitNoDataCount = preflight.sections.length - populatedCount;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshAuditAndLogs();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section
      aria-label="Complete 24-Section DPR Pre-Flight Audit and Export Center"
      className="bg-sheet border border-rule-strong rounded-xs p-4 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="small-caps-heading">
              Step 7 · Complete 24-Section DPR, Live-Formula Excel BOQ &amp; GIS Export Center
            </span>
            <QualityTag kind={preflight.can_export ? 'VERIFIED' : 'ASSUMED'} />
          </div>
          <p className="text-xs text-ink-2 mt-0.5">
            Active Scenario: <strong className="font-mono">{preflight.active_scenario_key}</strong>{' '}
            · Watermark: <code className="text-[11px]">{preflight.watermark_text}</code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void handleRefresh()}
            className="px-2.5 py-1.5 text-xs font-mono border border-rule-strong bg-paper hover:bg-sheet rounded-xs"
          >
            {refreshing ? 'Auditing…' : 'Re-Run Pre-Flight Audit'}
          </button>

          {preflight.can_export ? (
            <>
              <a
                href={`/api/v1/projects/${projectId}/exports/dpr-pdf`}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  setTimeout(() => void handleRefresh(), 1500);
                }}
                className="px-3 py-1.5 text-xs font-mono bg-accent text-white rounded-xs hover:opacity-90"
              >
                Download 24-Section DPR (.pdf)
              </a>
              <a
                href={`/api/v1/projects/${projectId}/exports/boq-xlsx`}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  setTimeout(() => void handleRefresh(), 1500);
                }}
                className="px-3 py-1.5 text-xs font-mono bg-emerald-800 text-white rounded-xs hover:opacity-90"
              >
                Download Formula BOQ (.xlsx)
              </a>
            </>
          ) : (
            <span
              title="Resolve hard blockers in Pre-Flight Checklist to enable PDF and Excel BOQ export."
              className="px-3 py-1.5 text-xs font-mono bg-amber-900/20 text-amber-900 border border-amber-700/40 rounded-xs cursor-not-allowed"
            >
              PDF &amp; Excel Export Blocked ({preflight.hard_blockers_failed} Hard Blocker)
            </span>
          )}

          <a
            href={`/api/v1/projects/${projectId}/exports/gis-package`}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              setTimeout(() => void handleRefresh(), 1500);
            }}
            className="px-3 py-1.5 text-xs font-mono border border-accent text-accent bg-accent-tint/30 rounded-xs hover:bg-accent-tint/60"
          >
            Download Cleaned GIS Package (.zip)
          </a>
        </div>
      </div>

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
      <div className="flex items-center gap-2 border-b border-rule pt-1">
        <button
          type="button"
          onClick={() => setActiveTab('checks')}
          className={`px-3 py-1.5 text-xs font-mono border-b-2 -mb-px ${
            activeTab === 'checks'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-ink-2 hover:text-ink'
          }`}
        >
          1. Pre-Flight Audit Checklist ({preflight.checks.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sections')}
          className={`px-3 py-1.5 text-xs font-mono border-b-2 -mb-px ${
            activeTab === 'sections'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-ink-2 hover:text-ink'
          }`}
        >
          2. 24-Section DPR Compilation Index ({preflight.sections.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('exports')}
          className={`px-3 py-1.5 text-xs font-mono border-b-2 -mb-px ${
            activeTab === 'exports'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-ink-2 hover:text-ink'
          }`}
        >
          3. Cryptographic SHA-256 Export Audit Log ({exportLog?.total_exports ?? 0})
        </button>
      </div>

      {activeTab === 'checks' && (
        <div className="overflow-x-auto border border-rule rounded-xs bg-paper">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-sheet border-b border-rule text-[11px] font-mono text-ink-2">
                <th className="p-2">Rule Code</th>
                <th className="p-2">Category</th>
                <th className="p-2">Status</th>
                <th className="p-2">Check Title &amp; Finding</th>
                <th className="p-2">Planner Remediation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/60">
              {preflight.checks.map((chk) => (
                <tr key={chk.check_code} className="hover:bg-sheet/60">
                  <td className="p-2 font-mono font-semibold text-ink">{chk.check_code}</td>
                  <td className="p-2 font-mono text-[11px] text-ink-2">{chk.category}</td>
                  <td className="p-2 font-mono">
                    <span
                      className={`px-1.5 py-0.5 rounded-xs text-[10px] font-bold ${
                        chk.status === 'PASS'
                          ? 'bg-emerald-900/15 text-emerald-800'
                          : chk.status === 'WARN'
                            ? 'bg-amber-900/15 text-amber-800'
                            : 'bg-red-900/15 text-red-800'
                      }`}
                    >
                      {chk.status}
                    </span>
                  </td>
                  <td className="p-2 text-ink">
                    <div className="font-medium">{chk.title}</div>
                    <div className="text-[11px] text-ink-2">{chk.detail}</div>
                  </td>
                  <td className="p-2 text-[11px] text-ink-2">{chk.remediation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'sections' && (
        <div className="overflow-x-auto border border-rule rounded-xs bg-paper max-h-[380px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-sheet border-b border-rule text-[11px] font-mono text-ink-2">
              <tr>
                <th className="p-2">Sec #</th>
                <th className="p-2">DPR Part</th>
                <th className="p-2">Section Title</th>
                <th className="p-2">Compilation Status</th>
                <th className="p-2">Data / Epistemic Disclosure Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/60">
              {preflight.sections.map((sec) => (
                <tr key={sec.section_key} className="hover:bg-sheet/60">
                  <td className="p-2 font-mono font-semibold text-ink">
                    Sec {sec.section_number}
                  </td>
                  <td className="p-2 font-mono text-[11px] text-ink-2">{sec.group}</td>
                  <td className="p-2 font-medium text-ink">{sec.title}</td>
                  <td className="p-2 font-mono text-[11px]">
                    {sec.is_populated ? (
                      <span className="px-1.5 py-0.5 rounded-xs bg-emerald-900/15 text-emerald-800">
                        POPULATED
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-xs bg-amber-900/15 text-amber-800">
                        EXPLICIT_NO_DATA_NOTE
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-[11px] text-ink-2">{sec.data_status_note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'exports' && (
        <div className="overflow-x-auto border border-rule rounded-xs bg-paper">
          {!exportLog || exportLog.items.length === 0 ? (
            <div className="p-4 text-xs font-mono text-ink-2">
              No export artifacts have been downloaded in this session yet. Click one of the
              export buttons above to generate a cryptographically hashed PDF DPR, Excel BOQ, or
              GIS ZIP bundle.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-sheet border-b border-rule text-[11px] font-mono text-ink-2">
                  <th className="p-2">Export Kind</th>
                  <th className="p-2">Filename</th>
                  <th className="p-2">Scenario</th>
                  <th className="p-2 text-right">Size (KB)</th>
                  <th className="p-2">File SHA-256</th>
                  <th className="p-2">Snapshot SHA-256</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/60 font-mono text-[11px]">
                {exportLog.items.map((exp) => (
                  <tr key={exp.id} className="hover:bg-sheet/60">
                    <td className="p-2 font-semibold text-ink">{exp.export_kind}</td>
                    <td className="p-2 text-ink">{exp.filename}</td>
                    <td className="p-2 text-ink-2">{exp.scenario_key}</td>
                    <td className="p-2 text-right text-ink">
                      {(exp.file_size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="p-2 text-ink-2" title={exp.file_sha256}>
                      {exp.file_sha256.slice(0, 16)}…
                    </td>
                    <td className="p-2 text-ink-2" title={exp.snapshot_hash}>
                      {exp.snapshot_hash.slice(0, 16)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
};

