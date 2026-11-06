import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/apiClient';
import { useSessionStore } from '../stores/sessionStore';
import { MapCanvas } from '../components/map/MapCanvas';
import { Button } from '../components/ui/Button';
import { Callout } from '../components/ui/Callout';
import { QualityTag } from '../components/ui/QualityTag';
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
  const [selectedLgd, setSelectedLgd] = useState<string>('398712');
  const [resolvedBoundary, setResolvedBoundary] = useState<AdminBoundaryDto | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Drawn polygon state
  const [drawnPolygon, setDrawnPolygon] = useState<GeoJSON.Polygon | null>(null);
  const [drawnVertexCount, setDrawnVertexCount] = useState(0);

  // Uploaded file state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function initAdminUnits() {
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
      try {
        const b = await apiRequest<AdminBoundaryDto>(
          `/api/v1/admin-units/${selectedLgd}/boundary`,
        );
        if (!active) return;
        setResolvedBoundary(b);
      } catch {
        // Ignore transient lookup errors before auth completes
      }
    }
    void loadBoundary();
    return () => {
      active = false;
    };
  }, [selectedLgd, methodTab]);

  const handleSearchVillages = async () => {
    if (!searchQuery.trim()) return;
    try {
      const results = await apiRequest<AdminUnitDto[]>(
        `/api/v1/admin-units/search?q=${encodeURIComponent(searchQuery.trim())}`,
      );
      const villageMatches = results.filter((u) => u.level === 'VILLAGE');
      if (villageMatches.length > 0) {
        setVillages(villageMatches);
        setSelectedLgd(villageMatches[0]!.lgd_code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Village search failed.');
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
    <div className="max-w-[1360px] w-full mx-auto p-4 space-y-4">
      <div className="bg-sheet border border-rule-strong rounded-xs p-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-ink-2">
            SHEET WIZARD-M1 · PROJECT &amp; AREA OF INTEREST (AOI) DEFINITION
          </div>
          <h1 className="text-lg font-semibold text-ink mt-0.5">
            Create Electrification Project &amp; Define Study Boundary
          </h1>
        </div>
        <QualityTag kind="ESTIMATED" label="CRS: WGS 84 ↔ DYNAMIC UTM (EPSG:32644)" />
      </div>

      {error && (
        <Callout tone="error" title="Validation or Submission Error">
          {error}
        </Callout>
      )}

      <form
        onSubmit={(e) => void handleCreateAndSetAoi(e)}
        className="grid grid-cols-1 lg:grid-cols-12 gap-4"
      >
        {/* Left Column: Metadata & AOI Method Selector */}
        <div className="lg:col-span-5 space-y-4">
          <section className="bg-sheet border border-rule-strong rounded-xs p-4 space-y-3">
            <h2 className="small-caps-heading border-b border-rule pb-1.5">
              1. Project Metadata &amp; Planning Horizon
            </h2>

            <div>
              <label
                htmlFor="proj-name"
                className="block text-xs font-medium text-ink mb-1"
              >
                Project Title
              </label>
              <input
                id="proj-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-8 px-2.5 text-xs bg-paper border border-rule-strong rounded-xs"
              />
            </div>

            <div>
              <label
                htmlFor="proj-desc"
                className="block text-xs font-medium text-ink mb-1"
              >
                Scope / Engineering Notes
              </label>
              <textarea
                id="proj-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 text-xs bg-paper border border-rule-strong rounded-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="proj-scheme"
                  className="block text-xs font-medium text-ink mb-1"
                >
                  Target Scheme
                </label>
                <select
                  id="proj-scheme"
                  value={scheme}
                  onChange={(e) => setScheme(e.target.value)}
                  className="w-full h-8 px-2 text-xs bg-paper border border-rule-strong rounded-xs"
                >
                  <option value="DA-JGUA / RDSS">DA-JGUA / RDSS</option>
                  <option value="RDSS Feeder Separation">RDSS Feeder Separation</option>
                  <option value="MNRE Off-Grid / Mini-Grid">MNRE Off-Grid / Mini-Grid</option>
                  <option value="State Tribal Sub-Plan (TSP)">State Tribal Sub-Plan (TSP)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="proj-tier"
                  className="block text-xs font-medium text-ink mb-1"
                >
                  Consumer Load Tier
                </label>
                <select
                  id="proj-tier"
                  value={loadTier}
                  onChange={(e) => setLoadTier(e.target.value)}
                  className="w-full h-8 px-2 text-xs bg-paper border border-rule-strong rounded-xs font-mono"
                >
                  <option value="TIER_2_SUBSISTENCE">TIER_2 (0.25 kW/HH)</option>
                  <option value="TIER_3_STANDARD">TIER_3 (0.50 kW/HH)</option>
                  <option value="TIER_4_PRODUCTIVE">TIER_4 (1.00 kW/HH)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label
                  htmlFor="proj-base-year"
                  className="block text-xs font-medium text-ink mb-1"
                >
                  Base Year
                </label>
                <input
                  id="proj-base-year"
                  type="number"
                  min={2020}
                  max={2035}
                  value={baseYear}
                  onChange={(e) => setBaseYear(Number(e.target.value))}
                  className="w-full h-8 px-2 text-xs font-mono bg-paper border border-rule-strong rounded-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="proj-horizon"
                  className="block text-xs font-medium text-ink mb-1"
                >
                  Horizon (yrs)
                </label>
                <input
                  id="proj-horizon"
                  type="number"
                  min={1}
                  max={30}
                  value={horizonYears}
                  onChange={(e) => setHorizonYears(Number(e.target.value))}
                  className="w-full h-8 px-2 text-xs font-mono bg-paper border border-rule-strong rounded-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="proj-discount"
                  className="block text-xs font-medium text-ink mb-1"
                >
                  Discount Rate
                </label>
                <input
                  id="proj-discount"
                  type="number"
                  step="0.01"
                  min={0.01}
                  max={0.25}
                  value={discountRate}
                  onChange={(e) => setDiscountRate(Number(e.target.value))}
                  className="w-full h-8 px-2 text-xs font-mono bg-paper border border-rule-strong rounded-xs"
                />
              </div>
            </div>
          </section>

          <section className="bg-sheet border border-rule-strong rounded-xs p-4 space-y-3">
            <h2 className="small-caps-heading border-b border-rule pb-1.5">
              2. Area of Interest (AOI) Definition Method
            </h2>

            <div
              role="tablist"
              aria-label="AOI definition method"
              className="grid grid-cols-3 border border-rule-strong rounded-xs overflow-hidden text-xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={methodTab === 'ADMIN_UNIT'}
                onClick={() => setMethodTab('ADMIN_UNIT')}
                className={`py-1.5 px-2 font-medium ${
                  methodTab === 'ADMIN_UNIT'
                    ? 'bg-accent text-white'
                    : 'bg-paper text-ink-2 hover:text-ink'
                }`}
              >
                Admin Unit (LGD)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={methodTab === 'USER_DRAWN'}
                onClick={() => setMethodTab('USER_DRAWN')}
                className={`py-1.5 px-2 font-medium border-l border-rule ${
                  methodTab === 'USER_DRAWN'
                    ? 'bg-accent text-white'
                    : 'bg-paper text-ink-2 hover:text-ink'
                }`}
              >
                Draw Polygon
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={methodTab === 'FILE_UPLOAD'}
                onClick={() => setMethodTab('FILE_UPLOAD')}
                className={`py-1.5 px-2 font-medium border-l border-rule ${
                  methodTab === 'FILE_UPLOAD'
                    ? 'bg-accent text-white'
                    : 'bg-paper text-ink-2 hover:text-ink'
                }`}
              >
                Upload GIS File
              </button>
            </div>

            {methodTab === 'ADMIN_UNIT' && (
              <div className="space-y-3 pt-1">
                <div className="flex gap-1.5">
                  <input
                    type="search"
                    aria-label="Search village by name or LGD code"
                    placeholder="Search village name or LGD / Census code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 h-8 px-2.5 text-xs bg-paper border border-rule-strong rounded-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleSearchVillages()}
                  >
                    Search
                  </Button>
                </div>

                <div>
                  <label
                    htmlFor="select-village-lgd"
                    className="block text-xs font-medium text-ink mb-1"
                  >
                    Select Target Village / Habitation (Koraput District, Odisha)
                  </label>
                  <select
                    id="select-village-lgd"
                    value={selectedLgd}
                    onChange={(e) => setSelectedLgd(e.target.value)}
                    className="w-full h-8 px-2 text-xs font-mono bg-paper border border-rule-strong rounded-xs"
                  >
                    {villages.map((v) => (
                      <option key={v.lgd_code} value={v.lgd_code}>
                        {v.name} (LGD {v.lgd_code} · {v.boundary_source})
                      </option>
                    ))}
                  </select>
                </div>

                {resolvedBoundary && (
                  <div className="p-2.5 bg-paper border border-rule rounded-xs space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
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
                    <div className="grid grid-cols-2 gap-1 font-mono text-[11px] text-ink-2">
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
                      <div className="text-[11px] text-warn font-medium border-t border-rule pt-1">
                        ⚠ Official village polygon unavailable in reference layer; generated a
                        1.5 km metric circular buffer around village centroid.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {methodTab === 'USER_DRAWN' && (
              <div className="p-3 bg-paper border border-rule rounded-xs text-xs space-y-1.5">
                <div className="font-semibold text-ink">
                  Interactive Map Polygon Drawing Active
                </div>
                <p className="text-ink-2">
                  Click points directly on the MapLibre canvas on the right to place AOI
                  vertices. Minimum 3 vertices; area must be between 0.01 km² and 500 km².
                </p>
                <div className="font-mono text-[11px] text-accent">
                  Current Vertices Placed: {drawnVertexCount}{' '}
                  {drawnVertexCount >= 3 ? '(Valid Polygon Ready)' : '(Add more points)'}
                </div>
              </div>
            )}

            {methodTab === 'FILE_UPLOAD' && (
              <div className="p-3 bg-paper border border-rule rounded-xs text-xs space-y-2">
                <label
                  htmlFor="aoi-file-input"
                  className="block font-semibold text-ink"
                >
                  Upload Boundary File (.geojson, .json, .kml, or Shapefile .zip)
                </label>
                <input
                  id="aoi-file-input"
                  type="file"
                  accept=".geojson,.json,.kml,.zip"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-ink-2 file:mr-3 file:py-1 file:px-2.5 file:rounded-xs file:border file:border-rule-strong file:text-xs file:font-medium file:bg-sheet file:text-ink"
                />
                <p className="text-[11px] text-ink-3 font-mono">
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
                className="w-full"
              >
                Validate Boundary &amp; Open Engineering Workspace →
              </Button>
            </div>
          </section>
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
            heightClass="h-[540px]"
          />
        </div>
      </form>
    </div>
  );
};

