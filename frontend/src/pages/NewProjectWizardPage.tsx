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
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Compass,
  Download,
  FileUp,
  MapPin,
  PenTool,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../lib/apiClient';
import {
  formatBoundarySourceLabel,
  formatLoadTierLabel,
  formatSchemeLabel,
} from '../lib/beginnerGlossary';
import { MapCanvas } from '../components/map/MapCanvas';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Callout } from '../components/ui/Callout';
import { ConfirmDialog } from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Textarea } from '../components/ui/Input';
import { PageHeader, Panel } from '../components/ui/Panel';
import { QualityTag } from '../components/ui/QualityTag';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { HelpTooltip } from '../components/ui/Tooltip';
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
  const navigate = useNavigate();

  // Step 1: Project metadata (clean slate — zero hidden Koraput prefill)
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetState, setTargetState] = useState('');
  const [targetDistrict, setTargetDistrict] = useState('');
  const [targetBlock, setTargetBlock] = useState('');
  const [villageNames, setVillageNames] = useState('');
  const [scheme, setScheme] = useState('DA-JGUA / RDSS');
  const [baseYear, setBaseYear] = useState(2026);
  const [horizonYears, setHorizonYears] = useState(10);
  const [discountRatePct, setDiscountRatePct] = useState(8);
  const [loadTier, setLoadTier] = useState('TIER_3_STANDARD');

  // Step 2: AOI method & state
  const [methodTab, setMethodTab] = useState<AoiMethodTab>('ADMIN_UNIT');
  const [villages, setVillages] = useState<AdminUnitDto[]>([]);
  const [loadingVillages, setLoadingVillages] = useState(true);
  const [searchingVillages, setSearchingVillages] = useState(false);
  const [selectedLgd, setSelectedLgd] = useState<string>('');
  const [resolvedBoundary, setResolvedBoundary] = useState<AdminBoundaryDto | null>(null);
  const [loadingBoundary, setLoadingBoundary] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchNoMatch, setSearchNoMatch] = useState(false);

  // Drawn polygon state
  const [drawnPolygon, setDrawnPolygon] = useState<GeoJSON.Polygon | null>(null);
  const [drawnVertexCount, setDrawnVertexCount] = useState(0);

  // Uploaded file state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [loadedExampleNotice, setLoadedExampleNotice] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    name.trim().length > 0 ||
    description.trim().length > 0 ||
    targetState.trim().length > 0 ||
    targetDistrict.trim().length > 0 ||
    targetBlock.trim().length > 0 ||
    villageNames.trim().length > 0 ||
    drawnVertexCount > 0 ||
    selectedFile !== null;

  const handleLoadKoraputExample = () => {
    setError(null);
    setName('Koraput — Nandapur Tribal Habitation Study');
    setDescription('Pre-feasibility assessment and 24-section DPR for tribal electrification.');
    setTargetState('Odisha');
    setTargetDistrict('Koraput');
    setTargetBlock('Nandapur');
    setVillageNames('Bheja');
    setScheme('DA-JGUA / RDSS');
    setLoadTier('TIER_3_STANDARD');
    setBaseYear(2026);
    setHorizonYears(10);
    setDiscountRatePct(8);
    setMethodTab('ADMIN_UNIT');
    setSearchNoMatch(false);
    setSearchQuery('');
    const koraputMatch =
      villages.find((v) => v.lgd_code === '398712') ??
      villages.find((v) => v.name.toLowerCase().includes('bheja')) ??
      villages[0];
    if (koraputMatch) {
      setSelectedLgd(koraputMatch.lgd_code);
    } else {
      setSelectedLgd('398712');
    }
    setLoadedExampleNotice(true);
  };

  const handleDownloadSampleGeoJson = () => {
    const sample = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name: 'Sample Village Study Boundary',
            note: 'Sample polygon (~2 km x 2 km) — replace with your own village GeoJSON',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [82.71, 18.555],
                [82.735, 18.555],
                [82.735, 18.575],
                [82.71, 18.575],
                [82.71, 18.555],
              ],
            ],
          },
        },
      ],
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], {
      type: 'application/geo+json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'electrimap-sample-boundary.geojson';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadAllVillages = async () => {
    setLoadingVillages(true);
    setSearchNoMatch(false);
    setError(null);
    try {
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
  }, []);

  useEffect(() => {
    let active = true;
    async function loadBoundary() {
      if (!selectedLgd || methodTab !== 'ADMIN_UNIT' || searchNoMatch) {
        setResolvedBoundary(null);
        return;
      }
      setLoadingBoundary(true);
      try {
        const b = await apiRequest<AdminBoundaryDto>(
          `/api/v1/admin-units/${selectedLgd}/boundary`,
        );
        if (!active) return;
        setResolvedBoundary(b);
      } catch (err) {
        if (!active) return;
        setResolvedBoundary(null);
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load administrative boundary polygon.',
        );
      } finally {
        if (active) setLoadingBoundary(false);
      }
    }
    void loadBoundary();
    return () => {
      active = false;
    };
  }, [selectedLgd, methodTab, searchNoMatch]);

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
        setResolvedBoundary(null);
        setSearchNoMatch(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Village search failed.');
    } finally {
      setSearchingVillages(false);
    }
  };

  const activeMetricEpsg = useMemo(() => {
    if (methodTab === 'ADMIN_UNIT' && resolvedBoundary?.metric_epsg) {
      return resolvedBoundary.metric_epsg;
    }
    if (methodTab === 'USER_DRAWN' && drawnPolygon?.coordinates?.[0]?.length) {
      const ring = drawnPolygon.coordinates[0];
      const meanLon = ring.reduce((acc, pt) => acc + (pt[0] ?? 0), 0) / ring.length;
      const meanLat = ring.reduce((acc, pt) => acc + (pt[1] ?? 0), 0) / ring.length;
      const zone = Math.min(60, Math.max(1, Math.floor((meanLon + 180) / 6) + 1));
      return (meanLat >= 0 ? 32600 : 32700) + zone;
    }
    return null;
  }, [methodTab, resolvedBoundary, drawnPolygon]);

  const handleCreateAndSetAoi = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('Project title must be at least 2 characters.');
      return;
    }
    if (methodTab === 'ADMIN_UNIT' && !selectedLgd) {
      setError('Select an administrative village unit before creating the project.');
      return;
    }
    if (methodTab === 'USER_DRAWN' && (!drawnPolygon || drawnVertexCount < 3)) {
      setError('Please click at least 3 vertices on the map to draw a valid AOI polygon.');
      return;
    }
    if (methodTab === 'FILE_UPLOAD' && !selectedFile) {
      setError('Please select a boundary file (.geojson, .kml, or Shapefile .zip) to upload.');
      return;
    }

    setSubmitting(true);
    let createdProjectId: string | null = null;
    try {
      const selectedVillageObj = villages.find((v) => v.lgd_code === selectedLgd);
      const isAdminUnit = methodTab === 'ADMIN_UNIT';

      const createdProj = await apiRequest<ProjectDto>('/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          scheme,
          target_state: targetState.trim() || null,
          target_district: targetDistrict.trim() || null,
          target_block: targetBlock.trim() || null,
          village_names:
            villageNames.trim() ||
            (isAdminUnit ? (selectedVillageObj?.name ?? null) : null),
          base_year: baseYear,
          horizon_years: horizonYears,
          discount_rate: Number((discountRatePct / 100).toFixed(4)),
          load_tier: loadTier,
        }),
      });
      createdProjectId = createdProj.id;

      if (methodTab === 'ADMIN_UNIT') {
        await apiRequest<ProjectAoiDto>(`/api/v1/projects/${createdProj.id}/aoi`, {
          method: 'PUT',
          body: JSON.stringify({
            mode: 'ADMIN_UNIT',
            lgd_code: selectedLgd,
          }),
        });
      } else if (methodTab === 'USER_DRAWN' && drawnPolygon) {
        await apiRequest<ProjectAoiDto>(`/api/v1/projects/${createdProj.id}/aoi`, {
          method: 'PUT',
          body: JSON.stringify({
            mode: 'USER_DRAWN',
            geojson_geometry: drawnPolygon,
            source_crs: 'EPSG:4326',
          }),
        });
      } else if (methodTab === 'FILE_UPLOAD' && selectedFile) {
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
      if (createdProjectId) {
        try {
          await apiRequest(`/api/v1/projects/${createdProjectId}`, { method: 'DELETE' });
        } catch {
          // Best-effort orphan rollback if AOI validation/upload fails
        }
      }
      setError(err instanceof Error ? err.message : 'Failed to create project and set AOI.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container section-stack">
      <PageHeader
        overline="Create a New Study · Step-by-Step Setup"
        title="Start a Village Electrification Study"
        subtitle="Give your project a name, choose how much power households need, and mark your village boundary using an official list, map drawing tool, or GIS file."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={Sparkles}
              onClick={handleLoadKoraputExample}
            >
              Load Koraput Example
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              leftIcon={ArrowLeft}
              onClick={() => {
                if (isDirty) {
                  setLeaveConfirmOpen(true);
                } else {
                  navigate('/projects');
                }
              }}
            >
              Back to My Projects
            </Button>
          </div>
        }
      />

      {loadedExampleNotice && (
        <Callout
          tone="info"
          title="Loaded Koraput Example Values"
          action={
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setLoadedExampleNotice(false)}
            >
              Dismiss
            </Button>
          }
        >
          Sample Koraput (Bheja village) details have been filled in so you can preview creation. You can edit any field before clicking the Create button below.
        </Callout>
      )}

      {error && (
        <Callout tone="error" title="Please Check Your Entry">
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
            title="1. Study Details & Location"
            subtitle="Name your project and pick how much power homes and shops will use."
          >
            <div className="space-y-3.5">
              <Input
                id="proj-name"
                label="Project Name"
                placeholder="e.g., Rampur Gram Panchayat Electrification Plan"
                type="text"
                required
                minLength={2}
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <label htmlFor="proj-scheme" className="field-label mb-0">
                      Funding Program
                    </label>
                    <HelpTooltip glossaryKey="governmentScheme" placement="top" />
                  </div>
                  <Select
                    id="proj-scheme"
                    aria-label="Funding Program"
                    value={scheme}
                    onChange={(e) => setScheme(e.target.value)}
                    options={[
                      { value: 'DA-JGUA / RDSS', label: formatSchemeLabel('DA-JGUA / RDSS') },
                      {
                        value: 'RDSS Feeder Separation',
                        label: formatSchemeLabel('RDSS Feeder Separation'),
                      },
                      {
                        value: 'MNRE Off-Grid / Mini-Grid',
                        label: formatSchemeLabel('MNRE Off-Grid / Mini-Grid'),
                      },
                      {
                        value: 'State Tribal Sub-Plan (TSP)',
                        label: formatSchemeLabel('State Tribal Sub-Plan (TSP)'),
                      },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <label htmlFor="proj-tier" className="field-label mb-0">
                      Household Service Level
                    </label>
                    <HelpTooltip glossaryKey="serviceLoadTier" placement="top" />
                  </div>
                  <Select
                    id="proj-tier"
                    aria-label="Household Service Level"
                    value={loadTier}
                    onChange={(e) => setLoadTier(e.target.value)}
                    options={[
                      {
                        value: 'TIER_2_SUBSISTENCE',
                        label: formatLoadTierLabel('TIER_2_SUBSISTENCE'),
                      },
                      {
                        value: 'TIER_3_STANDARD',
                        label: formatLoadTierLabel('TIER_3_STANDARD'),
                      },
                      {
                        value: 'TIER_4_PRODUCTIVE',
                        label: formatLoadTierLabel('TIER_4_PRODUCTIVE'),
                      },
                    ]}
                  />
                </div>
              </div>

              {/* Location Fields Available Across ALL 3 Boundary Methods */}
              <div className="p-3 bg-paper/70 border border-rule-subtle rounded-md space-y-2.5">
                <div className="text-xs font-semibold text-ink">
                  Location Information (Optional for Drawn / Uploaded Boundaries)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Input
                    id="proj-state"
                    label="State"
                    placeholder="e.g., Odisha"
                    maxLength={80}
                    value={targetState}
                    onChange={(e) => setTargetState(e.target.value)}
                  />
                  <Input
                    id="proj-district"
                    label="District"
                    placeholder="e.g., Koraput"
                    maxLength={80}
                    value={targetDistrict}
                    onChange={(e) => setTargetDistrict(e.target.value)}
                  />
                  <Input
                    id="proj-block"
                    label="Block / Taluk"
                    placeholder="e.g., Nandapur"
                    maxLength={80}
                    value={targetBlock}
                    onChange={(e) => setTargetBlock(e.target.value)}
                  />
                  <Input
                    id="proj-villages"
                    label="Village / Hamlet Name(s)"
                    placeholder="e.g., Bheja, Maliaguda"
                    maxLength={250}
                    value={villageNames}
                    onChange={(e) => setVillageNames(e.target.value)}
                  />
                </div>
              </div>

              {/* Progressive Disclosure for Financial & Technical Defaults */}
              <details className="rounded-md border border-rule-subtle bg-paper/50 p-3 text-xs">
                <summary className="cursor-pointer font-semibold text-ink select-none flex items-center justify-between gap-2">
                  <span>
                    Advanced Financial &amp; Map Settings (Defaults: {baseYear}, {horizonYears} yrs, {discountRatePct}%)
                  </span>
                  <span className="text-[11px] font-normal text-accent">Expand</span>
                </summary>
                <div className="pt-3 mt-2.5 border-t border-rule-subtle space-y-3">
                  <Textarea
                    id="proj-desc"
                    label="Optional Engineering Notes"
                    placeholder="Add context such as special tribal hamlets or priority public buildings..."
                    rows={2}
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
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
                      label="Lifespan (yrs)"
                      type="number"
                      min={1}
                      max={30}
                      mono
                      value={horizonYears}
                      onChange={(e) => setHorizonYears(Number(e.target.value))}
                    />
                    <Input
                      id="proj-discount"
                      label="Discount Rate (%)"
                      hint="Default 8%"
                      type="number"
                      step="0.5"
                      min={1}
                      max={25}
                      mono
                      value={discountRatePct}
                      onChange={(e) => setDiscountRatePct(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-2xs text-ink-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span>Map distance projection:</span>
                      <QualityTag
                        kind="ESTIMATED"
                        label={
                          activeMetricEpsg
                            ? `WGS 84 ↔ Local UTM EPSG:${activeMetricEpsg}`
                            : 'WGS 84 ↔ Auto Local UTM'
                        }
                      />
                    </span>
                    <HelpTooltip glossaryKey="crsEpsgUtm" placement="top" />
                  </div>
                </div>
              </details>
            </div>
          </Panel>

          <Panel
            overline="Step 2 of 2"
            title="2. Mark Your Study Boundary"
            subtitle="Choose an official village from the list, click corners on the map, or upload a GIS file."
          >
            <div className="space-y-3">
              <div className="flex items-center justify-end gap-1.5 text-2xs text-ink-3">
                <span>What is a study boundary (AOI)?</span>
                <HelpTooltip glossaryKey="aoI" placement="top" />
              </div>
              <Tabs
                variant="segmented"
                value={methodTab}
                onValueChange={(v) => setMethodTab(v as AoiMethodTab)}
              >
                <TabsList
                  aria-label="Study boundary selection method"
                  className="grid grid-cols-3 w-full"
                >
                  <TabsTrigger value="ADMIN_UNIT" icon={MapPin}>
                    Pick a Village
                  </TabsTrigger>
                  <TabsTrigger value="USER_DRAWN" icon={PenTool}>
                    Draw Polygon
                  </TabsTrigger>
                  <TabsTrigger value="FILE_UPLOAD" icon={FileUp}>
                    Upload File
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
                      placeholder="Type a village name (e.g., Bheja or Padwa)..."
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
                      <span>Loading village boundary directory...</span>
                    </div>
                  ) : searchNoMatch || villages.length === 0 ? (
                    <EmptyState
                      compact
                      icon={Compass}
                      title="No Matching Villages Found"
                      description="This sample directory contains reference villages from Nandapur Block. Reset search, or switch to Draw Polygon / Upload File to plan any village in India."
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
                      label="Choose Official Village Record (Sample Directory: Koraput District)"
                      value={selectedLgd}
                      onChange={(e) => {
                        const code = e.target.value;
                        setSelectedLgd(code);
                        const match = villages.find((v) => v.lgd_code === code);
                        if (match) {
                          if (match.parent_lgd_code === '030801') {
                            setTargetState((prev) => prev || 'Odisha');
                            setTargetDistrict((prev) => prev || 'Koraput');
                            setTargetBlock((prev) => prev || 'Nandapur');
                          }
                          setVillageNames(match.name);
                        }
                      }}
                      options={[
                        { value: '', label: '-- Select a village from the directory --' },
                        ...villages.map((v) => ({
                          value: v.lgd_code,
                          label: `${v.name} (Code ${v.lgd_code} · ${formatBoundarySourceLabel(v.boundary_source)})`,
                        })),
                      ]}
                    />
                  )}

                  {loadingBoundary && (
                    <div className="flex items-center gap-2 py-1 text-xs text-ink-2">
                      <Spinner size="xs" />
                      <span>Loading village boundary &amp; Census household count...</span>
                    </div>
                  )}

                  {resolvedBoundary && !loadingBoundary && (
                    <div className="p-4 bg-paper/75 border border-rule-subtle rounded-md space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-semibold text-ink">
                          {resolvedBoundary.name} (Code {resolvedBoundary.lgd_code})
                        </span>
                        <QualityTag
                          kind={
                            resolvedBoundary.boundary_source === 'APPROXIMATE_BUFFER'
                              ? 'ASSUMED'
                              : 'ESTIMATED'
                          }
                          label={formatBoundarySourceLabel(resolvedBoundary.boundary_source)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs text-ink-2 tabular-nums">
                        <div>Area: {resolvedBoundary.area_km2.toFixed(2)} km²</div>
                        <div>Grid: EPSG:{resolvedBoundary.metric_epsg}</div>
                        {resolvedBoundary.census_info && (
                          <>
                            <div>
                              Census 2011 Homes: {resolvedBoundary.census_info.households}
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
                          title="Approximate Circular Village Boundary"
                        >
                          Exact village shape was unavailable in the directory, so ElectriMap created a 1.5 km circle around the village center as a starting boundary.
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
                      Map Drawing Mode Active
                    </span>
                    <Badge
                      variant={drawnVertexCount >= 3 ? 'ok' : 'warn'}
                      size="sm"
                      dot
                    >
                      {drawnVertexCount} {drawnVertexCount === 1 ? 'Corner' : 'Corners'} Placed
                    </Badge>
                  </div>
                  <p className="text-ink-2 leading-relaxed">
                    Click corners around your village on the map to the right (at least <strong>3 corners</strong> needed; study area must be between 0.01 km² and 500 km²). Use <strong>Clear Polygon</strong> above the map to restart.
                  </p>
                  <div className="text-xs text-ink-2">
                    Status:{' '}
                    <span className={drawnVertexCount >= 3 ? 'text-ok font-semibold' : 'text-accent'}>
                      {drawnVertexCount >= 3
                        ? 'Boundary ready — click Create & Open Workspace below'
                        : 'Click 3 or more points on the map canvas'}
                    </span>
                  </div>
                </div>
              )}

              {methodTab === 'FILE_UPLOAD' && (
                <div className="p-4 bg-paper/75 border border-rule-subtle rounded-md text-xs space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="field-label mb-0">
                      Upload Village Boundary (.geojson, .json, .kml, or Shapefile .zip)
                    </span>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      leftIcon={Download}
                      onClick={handleDownloadSampleGeoJson}
                    >
                      Download Sample GeoJSON
                    </Button>
                  </div>
                  <label
                    htmlFor="aoi-file-input"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-rule-strong bg-sheet px-4 py-4 text-center cursor-pointer hover:border-accent hover:bg-accent-tint/25 transition-colors focus-within:ring-2 focus-within:ring-focus"
                  >
                    <FileUp className="w-5 h-5 text-accent" aria-hidden="true" />
                    <span className="text-xs font-medium text-ink">
                      {selectedFile
                        ? `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`
                        : 'Choose GeoJSON, KML, or Shapefile (.zip) boundary'}
                    </span>
                    <span className="text-[11px] text-ink-3">
                      Click to browse your computer
                    </span>
                    <input
                      id="aoi-file-input"
                      type="file"
                      accept=".geojson,.json,.kml,.zip"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>
                  <p className="text-xs text-ink-3 leading-relaxed">
                    Shapefile .zip files should include .shp, .shx, .dbf, and .prj files. Boundaries are checked for valid geometry automatically.
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
                  Save Study &amp; Open Workspace →
                </Button>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right Column: Interactive MapLibre Canvas */}
        <div className="lg:col-span-7">
          <MapCanvas
            wizardMode
            metricEpsg={activeMetricEpsg ?? undefined}
            aoiGeometry={
              methodTab === 'ADMIN_UNIT'
                ? (resolvedBoundary?.geojson_geometry ?? null)
                : methodTab === 'USER_DRAWN'
                  ? drawnPolygon
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

      <ConfirmDialog
        open={leaveConfirmOpen}
        title="Leave Without Creating Project?"
        description="You have entered project details or drawn a boundary that have not been saved yet. Leave this setup page?"
        confirmLabel="Discard & Go Back"
        cancelLabel="Stay on Setup"
        variant="danger"
        onConfirm={() => {
          setLeaveConfirmOpen(false);
          navigate('/projects');
        }}
        onClose={() => setLeaveConfirmOpen(false)}
      />
    </div>
  );
};

