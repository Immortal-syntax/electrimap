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

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Compass,
  FileUp,
  MapPin,
  PenTool,
  RotateCcw,
  Search,
} from 'lucide-react';
import { apiRequest } from '../lib/apiClient';
import { useSessionStore } from '../stores/sessionStore';
import { MapCanvas } from '../components/map/MapCanvas';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Callout } from '../components/ui/Callout';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Textarea } from '../components/ui/Input';
import { PageHeader, Panel } from '../components/ui/Panel';
import { QualityTag } from '../components/ui/QualityTag';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { ProjectDto } from './ProjectsPage';

interface CensusInfoDto {
  census2011_code: str;
  name: str;
  total_pop: number;
  households: number;
  st_pop: number;
  sc_pop: number;
  amenities: Record<string, unknown>;
  power_supply_2011: Record<string, unknown>;
}

type str = string;

interface AdminUnitDto {
  lgd_code: string;
  level: string;
  name: string;
  parent_lgd_code: string | null;
  census2011_code: string | null;
  boundary_source: string;
  has_polygon_geometry: boolean;
  centroid_lon: number | null;
  centroid_lat: number | null;
  census_info: CensusInfoDto | null;
}

interface AdminBoundaryDto {
  lgd_code: string;
  name: string;
  level: string;
  census2011_code: string | null;
  boundary_source: string;
  area_km2: number;
  metric_epsg: number;
  warnings: string[];
  geojson_geometry: GeoJSON.Geometry;
  census_info: CensusInfoDto | null;
}

interface ProjectAoiDto {
  project_id: string;
  boundary_source: string;
  area_km2: number;
  metric_epsg: number;
  lgd_code: string | null;
  census2011_code: string | null;
  upload_filename: string | null;
  original_crs: string | null;
  warnings: string[];
  geojson_geometry: GeoJSON.Geometry;
}

type AoiMethodTab = 'ADMIN_UNIT' | 'USER_DRAWN' | 'FILE_UPLOAD';

export const NewProjectWizardPage: React.FC = () => {
  const { user, login } = useSessionStore();
  const navigate = useNavigate();

  // Step 1: Project metadata
  const [name, setName] = useState('Koraput — Nandapur Tribal Habitation Study');
  const [description, setDescription] = useState(
    'Pre-feasibility assessment and 24-section DPR for tribal electrification.',
  );
  const [scheme, setScheme] = useState('DA-JGUA / RDSS');
  const [baseYear, setBaseYear] = useState(2026);
  const [horizonYears, setHorizonYears] = useState(10);
  const [discountRate, setDiscountRate] = useState(0.08);
  const [loadTier, setLoadTier] = useState('TIER_3_STANDARD');

  // Step 2: AOI method & state
  const [methodTab, setMethodTab] = useState<AoiMethodTab>('ADMIN_UNIT');
  const [villages, setVillages] = useState<AdminUnitDto[]>([]);
  const [loadingVillages, setLoadingVillages] = useState(true);
  const [searchingVillages, setSearchingVillages] = useState(false);
  const [selectedLgd, setSelectedLgd] = useState<string>('398712');
  const [resolvedBoundary, setResolvedBoundary] = useState<AdminBoundaryDto | null>(null);
  const [loadingBoundary, setLoadingBoundary] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchNoMatch, setSearchNoMatch] = useState(false);

  // Drawn polygon state
  const [drawnPolygon, setDrawnPolygon] = useState<GeoJSON.Polygon | null>(null);
  const [drawnVertexCount, setDrawnVertexCount] = useState(0);

  // Uploaded file state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAllVillages = async () => {
    setLoadingVillages(true);
    setSearchNoMatch(false);
    try {
      if (!user) {
        await login('planner@electrimap.in', 'ElectriMap#2026');
      }
      const vList = await apiRequest<AdminUnitDto[]>(
        '/api/v1/admin-units?level=VILLAGE',
      );
      setVillages(vList);
      if (vList.length > 0 && !vList.some((v) => v.lgd_code === selectedLgd)) {
        setSelectedLgd(vList[0]!.lgd_code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load administrative units.');
    } finally {
      setLoadingVillages(false);
    }
  };

  useEffect(() => {
    let active = true;
    async function initAdminUnits() {
      setLoadingVillages(true);
      try {
        if (!user) {
          await login('planner@electrimap.in', 'ElectriMap#2026');
        }
        const vList = await apiRequest<AdminUnitDto[]>(
          '/api/v1/admin-units?level=VILLAGE',
        );
        if (!active) return;
        setVillages(vList);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load administrative units.');
      } finally {
        if (active) setLoadingVillages(false);
      }
    }
    void initAdminUnits();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    async function loadBoundary() {
      if (!selectedLgd || methodTab !== 'ADMIN_UNIT') return;
      setLoadingBoundary(true);
      try {
        if (!user) {
          await login('planner@electrimap.in', 'ElectriMap#2026');
        }
        const b = await apiRequest<AdminBoundaryDto>(
          `/api/v1/admin-units/${selectedLgd}/boundary`,
        );
        if (!active) return;
        setResolvedBoundary(b);
      } catch {
        // Ignore transient lookup errors before auth completes
      } finally {
        if (active) setLoadingBoundary(false);
      }
    }
    void loadBoundary();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLgd, methodTab, user]);

  const handleSearchVillages = async () => {
    const q = searchQuery.trim();
    if (!q) {
      await loadAllVillages();
      return;
    }
    setSearchingVillages(true);
    setError(null);
    setSearchNoMatch(false);
    try {
      const results = await apiRequest<AdminUnitDto[]>(
        `/api/v1/admin-units/search?q=${encodeURIComponent(q)}`,
      );
      const villageMatches = results.filter((u: AdminUnitDto) => u.level === 'VILLAGE');
      if (villageMatches.length > 0) {
        setVillages(villageMatches);
        setSelectedLgd(villageMatches[0]!.lgd_code);
      } else {
        setVillages([]);
        setSearchNoMatch(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Village search failed.');
    } finally {
      setSearchingVillages(false);
    }
  };

  const handleCreateAndSetAoi = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!user) {
        await login('planner@electrimap.in', 'ElectriMap#2026');
      }

      const selectedVillageObj = villages.find((v) => v.lgd_code === selectedLgd);

      const createdProj = await apiRequest<ProjectDto>('/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          scheme,
          target_state: 'Odisha',
          target_district: 'Koraput',
          target_block: 'Nandapur',
          village_names:
            methodTab === 'ADMIN_UNIT' ? (selectedVillageObj?.name ?? 'Bheja') : undefined,
          base_year: baseYear,
          horizon_years: horizonYears,
          discount_rate: discountRate,
          load_tier: loadTier,
        }),
      });

      if (methodTab === 'ADMIN_UNIT') {
        await apiRequest<ProjectAoiDto>(`/api/v1/projects/${createdProj.id}/aoi`, {
          method: 'PUT',
          body: JSON.stringify({
            mode: 'ADMIN_UNIT',
            lgd_code: selectedLgd,
          }),
        });
      } else if (methodTab === 'USER_DRAWN') {
        if (!drawnPolygon || drawnVertexCount < 3) {
          throw new Error(
            'Please click at least 3 vertices on the map to draw a valid AOI polygon.',
          );
        }
        await apiRequest<ProjectAoiDto>(`/api/v1/projects/${createdProj.id}/aoi`, {
          method: 'PUT',
          body: JSON.stringify({
            mode: 'USER_DRAWN',
            geojson_geometry: drawnPolygon,
            source_crs: 'EPSG:4326',
          }),
        });
      } else if (methodTab === 'FILE_UPLOAD') {
        if (!selectedFile) {
          throw new Error(
            'Please select a boundary file (.geojson, .kml, or Shapefile .zip) to upload.',
          );
        }
        const formData = new FormData();
        formData.append('file', selectedFile);
        await apiRequest<ProjectAoiDto>(
          `/api/v1/projects/${createdProj.id}/aoi/upload`,
          {
            method: 'POST',
            body: formData,
          },
        );
      }

      navigate(`/projects/${createdProj.id}/workspace`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project and set AOI.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container section-stack">
      <PageHeader
        overline="Project & Area of Interest (AOI) Definition"
        title="Create Electrification Project & Define Study Boundary"
        subtitle="Configure planning horizon parameters and select a village administrative unit, draw a custom polygon, or upload a GIS boundary file."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <QualityTag kind="ESTIMATED" label="CRS: WGS 84 ↔ DYNAMIC UTM (EPSG:32644)" />
            <Link to="/projects">
              <Button size="sm" variant="secondary" leftIcon={ArrowLeft}>
                Back to Portfolio
              </Button>
            </Link>
          </div>
        }
      />

      {error && (
        <Callout tone="error" title="Validation or Submission Error">
          {error}
        </Callout>
      )}

      <form
        onSubmit={(e) => void handleCreateAndSetAoi(e)}
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
      >
        {/* Left Column: Metadata & AOI Method Selector */}
        <div className="lg:col-span-5 space-y-5">
          <Panel
            overline="Step 1 of 2"
            title="1. Project Metadata & Planning Horizon"
            subtitle="Sets scheme template, demand growth horizon, and economic discount parameters."
          >
            <div className="space-y-3.5">
              <Input
                id="proj-name"
                label="Project Title"
                type="text"
                required
                minLength={2}
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <Textarea
                id="proj-desc"
                label="Scope / Engineering Notes"
                rows={2}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  id="proj-scheme"
                  label="Target Scheme"
                  value={scheme}
                  onChange={(e) => setScheme(e.target.value)}
                  options={[
                    { value: 'DA-JGUA / RDSS', label: 'DA-JGUA / RDSS' },
                    { value: 'RDSS Feeder Separation', label: 'RDSS Feeder Separation' },
                    {
                      value: 'MNRE Off-Grid / Mini-Grid',
                      label: 'MNRE Off-Grid / Mini-Grid',
                    },
                    {
                      value: 'State Tribal Sub-Plan (TSP)',
                      label: 'State Tribal Sub-Plan (TSP)',
                    },
                  ]}
                />

                <Select
                  id="proj-tier"
                  label="Consumer Load Tier"
                  value={loadTier}
                  onChange={(e) => setLoadTier(e.target.value)}
                  options={[
                    { value: 'TIER_2_SUBSISTENCE', label: 'TIER_2 (0.25 kW/HH)' },
                    { value: 'TIER_3_STANDARD', label: 'TIER_3 (0.50 kW/HH)' },
                    { value: 'TIER_4_PRODUCTIVE', label: 'TIER_4 (1.00 kW/HH)' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <Input
                  id="proj-base-year"
                  label="Base Year"
                  type="number"
                  min={2020}
                  max={2035}
                  mono
                  value={baseYear}
                  onChange={(e) => setBaseYear(Number(e.target.value))}
                />
                <Input
                  id="proj-horizon"
                  label="Horizon (yrs)"
                  type="number"
                  min={1}
                  max={30}
                  mono
                  value={horizonYears}
                  onChange={(e) => setHorizonYears(Number(e.target.value))}
                />
                <Input
                  id="proj-discount"
                  label="Discount Rate"
                  type="number"
                  step="0.01"
                  min={0.01}
                  max={0.25}
                  mono
                  value={discountRate}
                  onChange={(e) => setDiscountRate(Number(e.target.value))}
                />
              </div>
            </div>
          </Panel>

          <Panel
            overline="Step 2 of 2"
            title="2. Area of Interest (AOI) Definition Method"
            subtitle="All AOI geometries are validated in WGS 84 and projected to dynamic UTM."
          >
            <div className="space-y-3">
              <Tabs
                variant="segmented"
                value={methodTab}
                onValueChange={(v) => setMethodTab(v as AoiMethodTab)}
              >
                <TabsList
                  aria-label="AOI definition method"
                  className="grid grid-cols-3 w-full"
                >
                  <TabsTrigger value="ADMIN_UNIT" icon={MapPin}>
                    Admin Unit (LGD)
                  </TabsTrigger>
                  <TabsTrigger value="USER_DRAWN" icon={PenTool}>
                    Draw Polygon
                  </TabsTrigger>
                  <TabsTrigger value="FILE_UPLOAD" icon={FileUp}>
                    Upload GIS File
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {methodTab === 'ADMIN_UNIT' && (
                <div className="space-y-3 pt-1">
                  <div className="flex gap-1.5 items-end">
                    <Input
                      type="search"
                      leftIcon={Search}
                      aria-label="Search village by name or LGD code"
                      placeholder="Search village name or LGD / Census code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleSearchVillages();
                        }
                      }}
                      containerClassName="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      isLoading={searchingVillages}
                      onClick={() => void handleSearchVillages()}
                    >
                      Search
                    </Button>
                    {(searchQuery || searchNoMatch) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        leftIcon={RotateCcw}
                        onClick={() => {
                          setSearchQuery('');
                          void loadAllVillages();
                        }}
                        title="Restore all reference villages"
                      >
                        Reset
                      </Button>
                    )}
                  </div>

                  {loadingVillages ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-ink-2">
                      <Spinner size="sm" />
                      <span>Loading LGD village directory...</span>
                    </div>
                  ) : searchNoMatch || villages.length === 0 ? (
                    <EmptyState
                      compact
                      icon={Compass}
                      title="No Matching Reference Villages"
                      description="No LGD village matched your query. Reset the search or switch to Draw Polygon / Upload GIS File."
                      action={
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => {
                            setSearchQuery('');
                            void loadAllVillages();
                          }}
                        >
                          Show All Villages
                        </Button>
                      }
                    />
                  ) : (
                    <Select
                      id="select-village-lgd"
                      label="Select Target Village / Habitation (Koraput District, Odisha)"
                      value={selectedLgd}
                      onChange={(e) => setSelectedLgd(e.target.value)}
                      options={villages.map((v) => ({
                        value: v.lgd_code,
                        label: `${v.name} (LGD ${v.lgd_code} · ${v.boundary_source})`,
                      }))}
                    />
                  )}

                  {loadingBoundary && (
                    <div className="flex items-center gap-2 py-1 text-xs text-ink-2">
                      <Spinner size="xs" />
                      <span>Resolving boundary polygon &amp; Census 2011 baseline...</span>
                    </div>
                  )}

                  {resolvedBoundary && !loadingBoundary && (
                    <div className="p-4 bg-paper/75 border border-rule-subtle rounded-md space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-semibold text-ink">
                          {resolvedBoundary.name} (LGD {resolvedBoundary.lgd_code})
                        </span>
                        <QualityTag
                          kind={
                            resolvedBoundary.boundary_source === 'APPROXIMATE_BUFFER'
                              ? 'ASSUMED'
                              : 'ESTIMATED'
                          }
                          label={resolvedBoundary.boundary_source}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs text-ink-2 tabular-nums">
                        <div>Area: {resolvedBoundary.area_km2.toFixed(2)} km²</div>
                        <div>Metric CRS: EPSG:{resolvedBoundary.metric_epsg}</div>
                        {resolvedBoundary.census_info && (
                          <>
                            <div>
                              Census 2011 HH: {resolvedBoundary.census_info.households}
                            </div>
                            <div>
                              Population: {resolvedBoundary.census_info.total_pop} (ST:{' '}
                              {resolvedBoundary.census_info.st_pop})
                            </div>
                          </>
                        )}
                      </div>
                      {resolvedBoundary.warnings.includes(
                        'APPROXIMATE_BOUNDARY_BUFFER_1500M',
                      ) && (
                        <Callout
                          tone="warn"
                          title="Approximate Circular Buffer Boundary"
                        >
                          Official village polygon unavailable in reference layer; generated a
                          1.5 km metric circular buffer around village centroid.
                        </Callout>
                      )}
                    </div>
                  )}
                </div>
              )}

              {methodTab === 'USER_DRAWN' && (
                <div className="p-4 bg-paper/75 border border-rule-subtle rounded-md text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">
                      Interactive Map Polygon Drawing Active
                    </span>
                    <Badge
                      variant={drawnVertexCount >= 3 ? 'ok' : 'warn'}
                      size="sm"
                      dot
                    >
                      {drawnVertexCount} Vertices
                    </Badge>
                  </div>
                  <p className="text-ink-2 leading-relaxed">
                    Click points directly on the MapLibre canvas on the right to place AOI
                    vertices. Minimum 3 vertices; valid study area between 0.01 km² and 500 km².
                  </p>
                  <div className="text-xs text-ink-2">
                    Status:{' '}
                    <span className={drawnVertexCount >= 3 ? 'text-ok font-semibold' : 'text-accent'}>
                      {drawnVertexCount >= 3
                        ? 'Valid Polygon Ready for Validation'
                        : 'Click map canvas to add vertices'}
                    </span>
                  </div>
                </div>
              )}

              {methodTab === 'FILE_UPLOAD' && (
                <div className="p-4 bg-paper/75 border border-rule-subtle rounded-md text-xs space-y-2">
                  <label
                    htmlFor="aoi-file-input"
                    className="field-label"
                  >
                    Upload Boundary File (.geojson, .json, .kml, or Shapefile .zip)
                  </label>
                  <input
                    id="aoi-file-input"
                    type="file"
                    accept=".geojson,.json,.kml,.zip"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-xs text-ink-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border file:border-rule file:text-xs file:font-medium file:bg-sheet file:text-ink hover:file:bg-subtle file:cursor-pointer"
                  />
                  {selectedFile && (
                    <div className="text-xs font-medium text-ok">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                  <p className="text-xs text-ink-3 leading-relaxed">
                    Shapefile .zip archives must include .shp, .shx, .dbf, and .prj. Geometries
                    are automatically reprojected to EPSG:4326 and checked for self-intersections.
                  </p>
                </div>
              )}

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={submitting}
                  fullWidth
                >
                  Validate Boundary &amp; Open Engineering Workspace →
                </Button>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right Column: Interactive MapLibre Canvas */}
        <div className="lg:col-span-7">
          <MapCanvas
            aoiGeometry={
              methodTab === 'ADMIN_UNIT'
                ? (resolvedBoundary?.geojson_geometry ?? null)
                : null
            }
            boundarySource={
              methodTab === 'ADMIN_UNIT'
                ? (resolvedBoundary?.boundary_source ?? 'HARMONISED')
                : methodTab
            }
            drawModeActive={methodTab === 'USER_DRAWN'}
            onDrawnPolygonChange={(poly, count) => {
              setDrawnPolygon(poly);
              setDrawnVertexCount(count);
            }}
            heightClass="h-[580px]"
            defaultLayerPanelOpen={false}
          />
        </div>
      </form>
    </div>
  );
};

