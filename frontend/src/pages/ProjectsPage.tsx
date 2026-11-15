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
import { Link, useNavigate } from 'react-router-dom';
import {
  Compass,
  FolderKanban,
  Map as MapIcon,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/apiClient';
import { useSessionStore } from '../stores/sessionStore';
import { DEMO_PROJECT_ID } from '../components/layout/navigationConfig';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Input } from '../components/ui/Input';
import { QualityTag } from '../components/ui/QualityTag';
import { Select } from '../components/ui/Select';
import { TableSkeleton } from '../components/ui/Skeleton';

export interface ProjectAoiSummaryDto {
  boundary_source: string;
  area_km2: number;
  lgd_code: string | null;
  census2011_code: string | null;
  upload_filename: string | null;
  original_crs: string | null;
  warnings: string[];
  geojson_geometry: GeoJSON.Geometry;
}

export interface ProjectDto {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  scheme: string;
  target_state: string | null;
  target_district: string | null;
  target_block: string | null;
  village_names: string | null;
  base_year: number;
  horizon_years: number;
  discount_rate: number;
  load_tier: string;
  metric_epsg: number;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
  aoi: ProjectAoiSummaryDto | null;
}

type SortKey = 'updated_desc' | 'area_desc' | 'name_asc';

export const ProjectsPage: React.FC = () => {
  const { user, login } = useSessionStore();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [schemeFilter, setSchemeFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('updated_desc');
  const [archiveTarget, setArchiveTarget] = useState<ProjectDto | null>(null);
  const [archiving, setArchiving] = useState<boolean>(false);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user) {
        await login('planner@electrimap.in', 'ElectriMap#2026');
      }
      const list = await apiRequest<ProjectDto[]>('/api/v1/projects');
      setProjects(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDuplicate = async (projectId: string) => {
    try {
      await apiRequest<ProjectDto>(`/api/v1/projects/${projectId}/duplicate`, {
        method: 'POST',
      });
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duplicate failed.');
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await apiRequest<void>(`/api/v1/projects/${archiveTarget.id}`, {
        method: 'DELETE',
      });
      setArchiveTarget(null);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed.');
      setArchiveTarget(null);
    } finally {
      setArchiving(false);
    }
  };

  // Portfolio Summary Metrics (Derived strictly from API data)
  const portfolioStats = useMemo(() => {
    const withAoi = projects.filter((p) => p.aoi !== null);
    const totalAreaKm2 =
      withAoi.length > 0
        ? withAoi.reduce((acc, p) => acc + (p.aoi?.area_km2 ?? 0), 0)
        : null;
    const schemes = Array.from(new Set(projects.map((p) => p.scheme).filter(Boolean)));
    const districts = Array.from(
      new Set(projects.map((p) => p.target_district).filter((d): d is string => Boolean(d))),
    );
    const blocks = Array.from(
      new Set(projects.map((p) => p.target_block).filter((b): b is string => Boolean(b))),
    );

    const schemeBreakdown = schemes.map((sch) => {
      const matching = projects.filter((p) => p.scheme === sch);
      const area = matching.reduce((acc, p) => acc + (p.aoi?.area_km2 ?? 0), 0);
      return { scheme: sch, count: matching.length, areaKm2: area };
    });

    return {
      totalProjects: projects.length,
      withAoiCount: withAoi.length,
      withoutAoiCount: projects.length - withAoi.length,
      totalAreaKm2,
      schemes,
      districtsCount: districts.length,
      blocksCount: blocks.length,
      schemeBreakdown,
    };
  }, [projects]);

  const filteredAndSorted = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    const list = projects.filter((p) => {
      if (schemeFilter !== 'ALL' && p.scheme !== schemeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.target_district ?? '').toLowerCase().includes(q) ||
        (p.target_block ?? '').toLowerCase().includes(q) ||
        (p.village_names ?? '').toLowerCase().includes(q) ||
        p.scheme.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'area_desc') {
        return (b.aoi?.area_km2 ?? -1) - (a.aoi?.area_km2 ?? -1);
      }
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      return b.updated_at.localeCompare(a.updated_at);
    });
  }, [projects, searchFilter, schemeFilter, sortBy]);

  return (
    <div className="page-container">
      {/* Compact Portfolio Header with Inline Grounded Telemetry */}
      <header className="bg-sheet border border-rule-subtle rounded-lg shadow-card p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="heading-overline">
              Portfolio Register · Rural &amp; Tribal Electrification Studies
            </div>
            <h1 className="heading-xl text-ink">Pre-Feasibility DPR Projects</h1>
            <p className="text-body-sm text-ink-2 max-w-3xl">
              Search and open active rural electrification workspaces, inspect AOI boundary
              provenance, or jump directly into GIS mapping, village assessment, and DPR export.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <Link to={`/projects/${DEMO_PROJECT_ID}/workspace`}>
              <Button variant="secondary" leftIcon={MapIcon}>
                Koraput Demo Workspace
              </Button>
            </Link>
            <Link to="/projects/new">
              <Button variant="primary" leftIcon={Plus}>
                New Project &amp; AOI Wizard
              </Button>
            </Link>
          </div>
        </div>

        <div
          aria-label="Portfolio Summary Telemetry"
          className="pt-3.5 border-t border-rule-subtle flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-ink-3">Registered Studies</span>
            <strong className="font-mono tabular-nums text-ink">
              {loading ? '…' : portfolioStats.totalProjects}
            </strong>
            {!loading && (
              <span className="text-ink-3">
                ({portfolioStats.withAoiCount} with AOI · {portfolioStats.withoutAoiCount} pending)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-ink-3">Validated Metric AOI</span>
            <strong className="font-mono tabular-nums text-ink">
              {loading
                ? '…'
                : portfolioStats.totalAreaKm2 !== null
                  ? `${portfolioStats.totalAreaKm2.toFixed(2)} km²`
                  : 'Not available'}
            </strong>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-ink-3">Geographies</span>
            <strong className="tabular-nums text-ink">
              {loading
                ? '…'
                : portfolioStats.blocksCount > 0
                  ? `${portfolioStats.blocksCount} Blocks / ${portfolioStats.districtsCount} District(s)`
                  : 'Not available'}
            </strong>
          </div>
        </div>
      </header>

      {/* Error State with Retry */}
      {error && (
        <ErrorState
          title="Portfolio Operation Error"
          message={error}
          onRetry={() => void loadProjects()}
        />
      )}

      {/* Search, Interactive Scheme Pills & Sort Command Bar */}
      <div className="bg-sheet border border-rule-subtle rounded-lg shadow-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
            <Input
              type="search"
              size="md"
              leftIcon={Search}
              aria-label="Filter projects by name, block, or village"
              placeholder="Filter by village, block, or project name..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              containerClassName="w-full sm:w-72"
            />
            <Select
              aria-label="Sort projects by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              options={[
                { value: 'updated_desc', label: 'Sort: Recently Updated' },
                { value: 'area_desc', label: 'Sort: Largest AOI Area (km²)' },
                { value: 'name_asc', label: 'Sort: Project Name (A–Z)' },
              ]}
            />
            {(searchFilter || schemeFilter !== 'ALL') && (
              <Button
                size="sm"
                variant="ghost"
                leftIcon={X}
                onClick={() => {
                  setSearchFilter('');
                  setSchemeFilter('ALL');
                }}
              >
                Clear
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-xs text-ink-2 tabular-nums">
            <span>
              Showing <strong className="text-ink">{filteredAndSorted.length}</strong> of{' '}
              <strong className="text-ink">{projects.length}</strong> project(s)
            </span>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={RefreshCw}
              onClick={() => void loadProjects()}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Interactive Scheme Filter Pills */}
        {!loading && portfolioStats.schemeBreakdown.length > 0 && (
          <div
            role="group"
            aria-label="Filter projects by scheme"
            className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-rule-subtle text-xs"
          >
            <span className="text-ink-3 font-medium mr-1">Schemes:</span>
            <button
              type="button"
              onClick={() => setSchemeFilter('ALL')}
              className={`px-3 py-1 rounded-full font-medium border transition-colors ${
                schemeFilter === 'ALL'
                  ? 'bg-accent text-white border-accent shadow-xs'
                  : 'bg-paper text-ink-2 border-rule-subtle hover:border-rule hover:text-ink'
              }`}
            >
              All ({projects.length})
            </button>
            {portfolioStats.schemeBreakdown.map((item) => {
              const active = schemeFilter === item.scheme;
              return (
                <button
                  key={item.scheme}
                  type="button"
                  onClick={() => setSchemeFilter(active ? 'ALL' : item.scheme)}
                  className={`px-3 py-1 rounded-full font-medium border transition-colors ${
                    active
                      ? 'bg-accent text-white border-accent shadow-xs'
                      : 'bg-paper text-ink-2 border-rule-subtle hover:border-rule hover:text-ink'
                  }`}
                >
                  {item.scheme} · {item.count} ({item.areaKm2.toFixed(1)} km²)
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Portfolio Table / Skeleton / Empty State (Foregrounded Above the Fold) */}
      <div className="bg-sheet border border-rule-subtle rounded-lg overflow-hidden shadow-card">
        {loading ? (
          <div className="p-4 space-y-2">
            <div className="text-xs text-ink-2">Loading project portfolio...</div>
            <TableSkeleton rows={4} columns={7} />
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={projects.length === 0 ? Compass : FolderKanban}
              title={
                projects.length === 0
                  ? 'No DPR Projects Registered Yet'
                  : 'No Matching Projects Found'
              }
              description={
                projects.length === 0
                  ? 'Create your first rural electrification study area using the AOI Setup Wizard, or explore the pre-loaded Koraput reference study.'
                  : 'No projects match your current search or scheme filter. Clear the filter or create a new project.'
              }
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {(searchFilter || schemeFilter !== 'ALL') && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSearchFilter('');
                        setSchemeFilter('ALL');
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                  <Link to="/projects/new" className="text-accent underline">
                    <Button size="sm" variant="primary">
                      + New Project &amp; AOI Wizard
                    </Button>
                  </Link>
                </div>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-body-sm">
              <thead>
                <tr className="border-b border-rule bg-paper text-ink-2 text-xs font-semibold">
                  <th className="py-2.5 px-3.5">Project Name &amp; Stage Shortcuts</th>
                  <th className="py-2.5 px-3.5">Target Block / District</th>
                  <th className="py-2.5 px-3.5">Scheme</th>
                  <th className="py-2.5 px-3.5 text-right">AOI Area (km²)</th>
                  <th className="py-2.5 px-3.5">Boundary Provenance</th>
                  <th className="py-2.5 px-3.5 text-right">Horizon / Tier</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule-subtle">
                {filteredAndSorted.map((proj) => (
                  <tr key={proj.id} className="hover:bg-accent-tint/25">
                    <th scope="row" className="py-3.5 px-3.5 font-semibold text-ink">
                      <div>{proj.name}</div>
                      {proj.village_names && (
                        <div className="text-xs font-normal text-ink-2 mt-0.5">
                          Habitations: {proj.village_names}
                        </div>
                      )}
                      {/* Quick Workflow Stage Deep-Link Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs font-normal">
                        <Link
                          to={`/projects/${proj.id}/map`}
                          className="px-2.5 py-0.5 rounded-full bg-accent-tint text-accent font-medium hover:bg-accent-soft border border-accent/20"
                        >
                          GIS Map
                        </Link>
                        <Link
                          to={`/projects/${proj.id}/settlements`}
                          className="px-2.5 py-0.5 rounded-full bg-subtle hover:bg-accent-soft text-ink-2 hover:text-accent border border-rule-subtle"
                        >
                          2. Villages
                        </Link>
                        <Link
                          to={`/projects/${proj.id}/network`}
                          className="px-2.5 py-0.5 rounded-full bg-subtle hover:bg-accent-soft text-ink-2 hover:text-accent border border-rule-subtle"
                        >
                          4. Network
                        </Link>
                        <Link
                          to={`/projects/${proj.id}/cost`}
                          className="px-2.5 py-0.5 rounded-full bg-subtle hover:bg-accent-soft text-ink-2 hover:text-accent border border-rule-subtle"
                        >
                          5. Cost
                        </Link>
                        <Link
                          to={`/projects/${proj.id}/reports`}
                          className="px-2.5 py-0.5 rounded-full bg-subtle hover:bg-accent-soft text-ink-2 hover:text-accent border border-rule-subtle"
                        >
                          6. DPR
                        </Link>
                      </div>
                    </th>
                    <td className="py-3.5 px-3.5 text-ink-2 text-xs">
                      {[proj.target_block, proj.target_district, proj.target_state]
                        .filter(Boolean)
                        .join(', ') || 'Not specified'}
                    </td>
                    <td className="py-3.5 px-3.5 text-xs font-medium text-ink">
                      {proj.scheme}
                    </td>
                    <td className="py-3.5 px-3.5 text-right font-mono tabular-nums">
                      {proj.aoi ? proj.aoi.area_km2.toFixed(2) : '—'}
                    </td>
                    <td className="py-3.5 px-3.5">
                      {proj.aoi ? (
                        <QualityTag
                          kind={
                            proj.aoi.boundary_source === 'APPROXIMATE_BUFFER'
                              ? 'ASSUMED'
                              : 'ESTIMATED'
                          }
                          label={proj.aoi.boundary_source}
                        />
                      ) : (
                        <QualityTag kind="UNSET" label="NO AOI SET" />
                      )}
                    </td>
                    <td className="py-3.5 px-3.5 text-right font-mono tabular-nums text-xs">
                      {proj.horizon_years} yr · {proj.load_tier.replace('TIER_', 'T')}
                    </td>
                    <td className="py-3.5 px-3.5 text-xs text-ink-2 tabular-nums">
                      {proj.status} (v{proj.version})
                    </td>
                    <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="primary"
                          className="whitespace-nowrap"
                          onClick={() => navigate(`/projects/${proj.id}/workspace`)}
                        >
                          Open Workspace
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="whitespace-nowrap"
                          onClick={() => void handleDuplicate(proj.id)}
                        >
                          Duplicate
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="whitespace-nowrap"
                          onClick={() => setArchiveTarget(proj)}
                        >
                          Archive
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog before archiving/deleting a project */}
      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive Pre-Feasibility Project?"
        description={
          archiveTarget
            ? `Are you sure you want to archive "${archiveTarget.name}"? This removes the project from the active portfolio register.`
            : ''
        }
        confirmLabel="Confirm Archive"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={archiving}
        onConfirm={() => void handleConfirmArchive()}
        onClose={() => setArchiveTarget(null)}
      />
    </div>
  );
};
