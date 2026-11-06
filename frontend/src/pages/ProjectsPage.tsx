import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/apiClient';
import { useSessionStore } from '../stores/sessionStore';
import { Button } from '../components/ui/Button';
import { Callout } from '../components/ui/Callout';
import { QualityTag } from '../components/ui/QualityTag';

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

export const ProjectsPage: React.FC = () => {
  const { user, login } = useSessionStore();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

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

  const handleDelete = async (projectId: string) => {
    try {
      await apiRequest<void>(`/api/v1/projects/${projectId}`, {
        method: 'DELETE',
      });
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const filtered = projects.filter((p) => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.target_district ?? '').toLowerCase().includes(q) ||
      (p.target_block ?? '').toLowerCase().includes(q) ||
      (p.village_names ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-[1360px] w-full mx-auto p-4 space-y-4">
      <div className="bg-sheet border border-rule-strong rounded-xs p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-ink-2">
            PORTFOLIO REGISTER · RURAL &amp; TRIBAL ELECTRIFICATION PROJECTS
          </div>
          <h1 className="text-lg font-semibold text-ink mt-0.5">
            Pre-Feasibility DPR Projects
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="search"
            aria-label="Filter projects by name, block, or village"
            placeholder="Filter by village, block, or name..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="h-8 px-2.5 text-xs bg-paper border border-rule-strong rounded-xs w-64"
          />
          <Link to="/projects/new">
            <Button variant="primary">+ New Project &amp; AOI Wizard</Button>
          </Link>
        </div>
      </div>

      {error && (
        <Callout tone="error" title="Portfolio Operation Error">
          {error}
        </Callout>
      )}

      <div className="bg-sheet border border-rule-strong rounded-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-rule-strong bg-paper text-ink-2 font-mono text-[11px] uppercase">
                <th className="py-2.5 px-3">Project Name</th>
                <th className="py-2.5 px-3">Target Block / District</th>
                <th className="py-2.5 px-3">Scheme</th>
                <th className="py-2.5 px-3 text-right">AOI Area (km²)</th>
                <th className="py-2.5 px-3">Boundary Provenance</th>
                <th className="py-2.5 px-3 text-right">Horizon / Tier</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-ink-2 font-mono">
                    Loading project portfolio...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-ink-2">
                    No matching projects found. Click{' '}
                    <Link to="/projects/new" className="text-accent underline">
                      + New Project &amp; AOI Wizard
                    </Link>{' '}
                    to create one.
                  </td>
                </tr>
              ) : (
                filtered.map((proj) => (
                  <tr key={proj.id} className="hover:bg-accent-tint/25">
                    <th scope="row" className="py-3 px-3 font-semibold text-ink">
                      <div>{proj.name}</div>
                      {proj.village_names && (
                        <div className="text-[11px] font-normal text-ink-2 mt-0.5">
                          Habitations: {proj.village_names}
                        </div>
                      )}
                    </th>
                    <td className="py-3 px-3 text-ink-2">
                      {[proj.target_block, proj.target_district, proj.target_state]
                        .filter(Boolean)
                        .join(', ')}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">{proj.scheme}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-mono">
                      {proj.aoi ? proj.aoi.area_km2.toFixed(2) : '—'}
                    </td>
                    <td className="py-3 px-3">
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
                        <QualityTag kind="ASSUMED" label="NO AOI SET" />
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-mono">
                      {proj.horizon_years} yr · {proj.load_tier.replace('TIER_', 'T')}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      {proj.status} (v{proj.version})
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => navigate(`/projects/${proj.id}/workspace`)}
                        >
                          Open Workspace
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void handleDuplicate(proj.id)}
                        >
                          Duplicate
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleDelete(proj.id)}
                        >
                          Archive
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
