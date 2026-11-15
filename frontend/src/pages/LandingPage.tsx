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
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Compass,
  FolderKanban,
  Map as MapIcon,
  Plus,
  Sun,
} from 'lucide-react';
import {
  Badge,
  ClassificationBadge,
  LayerSourceBadge,
  ProxyElectrificationClass,
} from '../components/ui/Badge';
import { QualityTag } from '../components/ui/QualityTag';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { type ReferenceGeoJsonBundle } from '../components/map/MapSpikePreview';
import {
  DEFAULT_EXISTING_POWER_INFRA_FC,
  DEFAULT_PROPOSED_NETWORK_FC,
  DEFAULT_SETTLEMENTS_FC,
  DEFAULT_VILLAGE_ELECTRIFICATION_FC,
} from '../components/map/electricityGisData';
import { DEMO_PROJECT_ID } from '../components/layout/navigationConfig';

interface SolarReferenceData {
  status?: string;
  longitude?: number;
  latitude?: number;
  ghi_kwh_m2_day?: Record<string, number>;
  t2m_deg_c?: Record<string, number>;
  worst_month?: string;
  worst_ghi_kwh_m2_day?: number;
  annual_mean_ghi_kwh_m2_day?: number;
}

interface ExtendedReferenceGeoJsonBundle extends ReferenceGeoJsonBundle {
  solar?: SolarReferenceData;
}

interface SpikeSummaryPayload {
  milestone?: string;
  spikes?: {
    S1_data_access?: { status: string; datasets_verified: number; epsg: number };
    S2_least_cost_routing?: {
      status: string;
      elapsed_seconds: number | null;
      routes: Array<{ length_km?: number }>;
    };
    S3_cartographic_pdf?: { status: string; pdf_size_bytes: number };
    S4_maplibre_50k_webgl?: { status: string; feature_count: number };
  };
}

const DEFAULT_SOLAR_REFERENCE: Required<
  Pick<
    SolarReferenceData,
    'ghi_kwh_m2_day' | 't2m_deg_c' | 'worst_month' | 'worst_ghi_kwh_m2_day' | 'annual_mean_ghi_kwh_m2_day'
  >
> = {
  ghi_kwh_m2_day: {
    JAN: 4.82,
    FEB: 5.66,
    MAR: 6.05,
    APR: 6.55,
    MAY: 6.34,
    JUN: 4.53,
    JUL: 3.47,
    AUG: 3.43,
    SEP: 4.17,
    OCT: 4.71,
    NOV: 4.67,
    DEC: 4.45,
  },
  t2m_deg_c: {
    JAN: 18.5,
    FEB: 22.0,
    MAR: 26.1,
    APR: 28.7,
    MAY: 29.2,
    JUN: 25.5,
    JUL: 23.4,
    AUG: 23.1,
    SEP: 23.1,
    OCT: 21.8,
    NOV: 19.0,
    DEC: 17.3,
  },
  worst_month: 'AUG',
  worst_ghi_kwh_m2_day: 3.43,
  annual_mean_ghi_kwh_m2_day: 4.9,
};

const OPEN_DATASET_REGISTRY = [
  {
    key: 'open_buildings',
    name: 'Google-Microsoft-OSM Open Buildings v3',
    provider: 'VIDA / Source Cooperative',
    resolution: '0.5 m vector polygons',
    licence: 'CC BY 4.0 / ODbL',
    sourceBadge: 'PROJECT' as const,
  },
  {
    key: 'copernicus_dem',
    name: 'Copernicus DEM GLO-30 Elevation & Slope',
    provider: 'ESA / Copernicus',
    resolution: '30 m raster',
    licence: 'Copernicus Free & Open',
    sourceBadge: 'PROJECT' as const,
  },
  {
    key: 'esa_worldcover',
    name: 'ESA WorldCover 2021 Land Use & Canopy',
    provider: 'ESA / VITO',
    resolution: '10 m / 30 m harmonised',
    licence: 'CC BY 4.0',
    sourceBadge: 'PROJECT' as const,
  },
  {
    key: 'nasa_power',
    name: 'NASA POWER Solar GHI & Temperature Climatology',
    provider: 'NASA Langley Research Center',
    resolution: '0.5° × 0.5° monthly climatology',
    licence: 'Public Domain (US Govt)',
    sourceBadge: 'PROJECT' as const,
  },
  {
    key: 'nasa_viirs',
    name: 'NASA GIBS VIIRS_CityLights_2012 + Reference Proxy',
    provider: 'NASA Earthdata GIBS (2012 WMTS) + Reference Series',
    resolution: '15 arc-second (~500 m, GIBS z ≤ 8)',
    licence: 'Public Domain (GIBS 2012) · Illustrative Reference Series',
    sourceBadge: 'REFERENCE_DEMO' as const,
  },
  {
    key: 'census_osm',
    name: 'Census of India 2011 DCHB + OpenStreetMap Power Grid',
    provider: 'ORGI / OpenStreetMap Contributors',
    resolution: 'Village / Feeder Vector',
    licence: 'GODL-India / ODbL',
    sourceBadge: 'REFERENCE_DEMO' as const,
  },
];

const MONTHS_ORDER = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

function getProxyDotColor(proxyClass: ProxyElectrificationClass): string {
  switch (proxyClass) {
    case 'LIKELY_ELECTRIFIED':
      return '#0072B2';
    case 'POTENTIALLY_UNDERSERVED':
      return '#E69F00';
    case 'POTENTIALLY_UNSERVED':
      return '#D55E00';
    default:
      return '#64748B';
  }
}

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [referenceGeoJson, setReferenceGeoJson] =
    useState<ExtendedReferenceGeoJsonBundle | null>(null);
  const [spikeSummary, setSpikeSummary] = useState<SpikeSummaryPayload | null>(null);
  const [policyExpanded, setPolicyExpanded] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadReference() {
      try {
        const [geoRes, sumRes] = await Promise.allSettled([
          fetch('/api/v1/spikes/reference-geojson'),
          fetch('/api/v1/spikes/summary'),
        ]);
        if (!active) return;
        if (geoRes.status === 'fulfilled' && geoRes.value.ok) {
          setReferenceGeoJson(
            (await geoRes.value.json()) as ExtendedReferenceGeoJsonBundle,
          );
        }
        if (sumRes.status === 'fulfilled' && sumRes.value.ok) {
          setSpikeSummary((await sumRes.value.json()) as SpikeSummaryPayload);
        }
      } catch {
        // Fallback smoothly in offline or unit-test environments
      }
    }
    void loadReference();
    return () => {
      active = false;
    };
  }, []);

  const referenceClusters = useMemo(() => {
    const fc = referenceGeoJson?.settlements ?? DEFAULT_SETTLEMENTS_FC;
    return fc.features.map((f) => {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const coords =
        f.geometry?.type === 'Point'
          ? (f.geometry.coordinates as [number, number])
          : null;
      return {
        code: String(p.cluster_code ?? 'CL-00'),
        name: String(p.settlement_name ?? p.name ?? 'Habitation Cluster'),
        buildings: Number(p.building_count ?? 0),
        estHouseholds: Number(p.estimated_households ?? 0),
        estPopulation: Number(p.estimated_population ?? 0),
        viirs2020: Number(p.viirs_radiance_2020_nw ?? 0),
        viirsRadNanoW: Number(p.viirs_radiance_2024_nw ?? 0),
        terrainDistM: Number(p.terrain_effective_dist_m ?? 0),
        proxyClass: (p.proxy_class as ProxyElectrificationClass) ?? 'UNKNOWN',
        preliminaryMode: String(p.preliminary_mode ?? 'Field Survey Required'),
        coords,
      };
    });
  }, [referenceGeoJson]);

  const referenceVillages = useMemo(() => {
    const fc =
      referenceGeoJson?.village_electrification ?? DEFAULT_VILLAGE_ELECTRIFICATION_FC;
    return fc.features.map((f) => {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      return {
        lgdCode: String(p.lgd_code ?? '—'),
        censusCode: String(p.census2011_code ?? '—'),
        name: String(p.village_name ?? 'Village'),
        totalPop: Number(p.total_pop ?? 0),
        stPop: Number(p.st_pop ?? 0),
        households2011: Number(p.households_2011 ?? 0),
        footprints2026: Number(p.detected_footprints_2026 ?? 0),
        estHouseholds2026: Number(p.estimated_households_2026 ?? 0),
        summerHrs: Number(p.summer_supply_hrs_2011 ?? 0),
        winterHrs: Number(p.winter_supply_hrs_2011 ?? 0),
        statusLabel: String(p.status_label ?? ''),
      };
    });
  }, [referenceGeoJson]);

  const solarData = useMemo(() => {
    const raw = referenceGeoJson?.solar;
    const monthlyGhi = raw?.ghi_kwh_m2_day ?? DEFAULT_SOLAR_REFERENCE.ghi_kwh_m2_day;
    const monthlyTemp = raw?.t2m_deg_c ?? DEFAULT_SOLAR_REFERENCE.t2m_deg_c;
    const worstMonth = raw?.worst_month ?? DEFAULT_SOLAR_REFERENCE.worst_month;
    const worstGhi =
      typeof raw?.worst_ghi_kwh_m2_day === 'number'
        ? raw.worst_ghi_kwh_m2_day
        : DEFAULT_SOLAR_REFERENCE.worst_ghi_kwh_m2_day;
    const annualMeanGhi =
      typeof raw?.annual_mean_ghi_kwh_m2_day === 'number'
        ? raw.annual_mean_ghi_kwh_m2_day
        : DEFAULT_SOLAR_REFERENCE.annual_mean_ghi_kwh_m2_day;
    return {
      monthlyGhi,
      monthlyTemp,
      worstMonth,
      worstGhi,
      annualMeanGhi,
    };
  }, [referenceGeoJson]);

  const detectedBuildingsCount =
    referenceGeoJson?.buildings?.features?.length &&
    referenceGeoJson.buildings.features.length > 0
      ? referenceGeoJson.buildings.features.length
      : referenceClusters.reduce((acc, c) => acc + c.buildings, 0);

  const totalEstHouseholds = referenceClusters.reduce(
    (acc, c) => acc + c.estHouseholds,
    0,
  );

  const routingSummary = useMemo(() => {
    const routes = spikeSummary?.spikes?.S2_least_cost_routing?.routes;
    const apiTotalKm =
      routes && routes.length > 0
        ? routes.reduce((acc, r) => acc + (r.length_km ?? 0), 0)
        : 0;
    const lengthKm = apiTotalKm > 0 ? apiTotalKm.toFixed(2) : '9.35';
    const elapsedSec = spikeSummary?.spikes?.S2_least_cost_routing?.elapsed_seconds;
    const timingNote =
      typeof elapsedSec === 'number' && elapsedSec > 0
        ? `${elapsedSec.toFixed(3)} s solver`
        : '0.044 s solver';
    return { lengthKm, timingNote };
  }, [spikeSummary]);

  const pdfSizeKb =
    spikeSummary?.spikes?.S3_cartographic_pdf?.pdf_size_bytes &&
    spikeSummary.spikes.S3_cartographic_pdf.pdf_size_bytes > 0
      ? (spikeSummary.spikes.S3_cartographic_pdf.pdf_size_bytes / 1024).toFixed(1)
      : '224.1';

  const clusterProportions = useMemo(() => {
    const buckets: Record<ProxyElectrificationClass, number> = {
      LIKELY_ELECTRIFIED: 0,
      POTENTIALLY_UNDERSERVED: 0,
      POTENTIALLY_UNSERVED: 0,
      UNKNOWN: 0,
    };
    for (const c of referenceClusters) {
      buckets[c.proxyClass] = (buckets[c.proxyClass] ?? 0) + Math.max(c.estHouseholds, 1);
    }
    const sum = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
    return [
      { key: 'LIKELY_ELECTRIFIED', pct: (buckets.LIKELY_ELECTRIFIED / sum) * 100, color: '#0072B2' },
      { key: 'POTENTIALLY_UNDERSERVED', pct: (buckets.POTENTIALLY_UNDERSERVED / sum) * 100, color: '#E69F00' },
      { key: 'POTENTIALLY_UNSERVED', pct: (buckets.POTENTIALLY_UNSERVED / sum) * 100, color: '#D55E00' },
      { key: 'UNKNOWN', pct: (buckets.UNKNOWN / sum) * 100, color: '#64748B' },
    ];
  }, [referenceClusters]);

  // Project genuine study extent polygons, grid feeders & settlement points into a clean SVG schematic
  const schematicSvgData = useMemo(() => {
    const villageFc =
      referenceGeoJson?.village_electrification ?? DEFAULT_VILLAGE_ELECTRIFICATION_FC;
    const infraFc = referenceGeoJson?.existing_power_infra ?? DEFAULT_EXISTING_POWER_INFRA_FC;
    const proposedFc = referenceGeoJson?.proposed_network ?? DEFAULT_PROPOSED_NETWORK_FC;

    const allCoords: [number, number][] = [];
    const pushRing = (coords: unknown) => {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        allCoords.push([coords[0], coords[1]]);
      } else {
        for (const item of coords) pushRing(item);
      }
    };
    for (const f of villageFc.features) pushRing((f.geometry as { coordinates?: unknown })?.coordinates);
    for (const f of infraFc.features) pushRing((f.geometry as { coordinates?: unknown })?.coordinates);
    for (const f of proposedFc.features) pushRing((f.geometry as { coordinates?: unknown })?.coordinates);
    for (const c of referenceClusters) {
      if (c.coords) allCoords.push(c.coords);
    }

    const lons = allCoords.map((p) => p[0]);
    const lats = allCoords.map((p) => p[1]);
    const minLon = lons.length ? Math.min(...lons) : 82.63;
    const maxLon = lons.length ? Math.max(...lons) : 82.77;
    const minLat = lats.length ? Math.min(...lats) : 18.49;
    const maxLat = lats.length ? Math.max(...lats) : 18.6;

    const padX = (maxLon - minLon) * 0.08 || 0.01;
    const padY = (maxLat - minLat) * 0.12 || 0.01;
    const bMinLon = minLon - padX;
    const bMaxLon = maxLon + padX;
    const bMinLat = minLat - padY;
    const bMaxLat = maxLat + padY;

    const width = 420;
    const height = 210;
    const project = ([lon, lat]: [number, number]): [number, number] => {
      const x = ((lon - bMinLon) / Math.max(bMaxLon - bMinLon, 1e-6)) * width;
      const y = height - ((lat - bMinLat) / Math.max(bMaxLat - bMinLat, 1e-6)) * height;
      return [Number(x.toFixed(1)), Number(y.toFixed(1))];
    };

    const villagePolys = villageFc.features
      .map((f, idx) => {
        if (f.geometry?.type !== 'Polygon') return null;
        const ring = f.geometry.coordinates[0] as [number, number][];
        const pts = ring.map(project).map(([x, y]) => `${x},${y}`).join(' ');
        const name = String((f.properties as Record<string, unknown>)?.village_name ?? `Village ${idx + 1}`);
        return { key: name, points: pts };
      })
      .filter((v): v is { key: string; points: string } => v !== null);

    const existingLines = infraFc.features
      .filter((f) => f.geometry?.type === 'LineString')
      .map((f, idx) => {
        const coords = (f.geometry as GeoJSON.LineString).coordinates as [number, number][];
        const cat = String((f.properties as Record<string, unknown>)?.infra_category ?? '');
        const isTransmission = cat.includes('TRANSMISSION');
        return {
          key: `ex-line-${idx}`,
          points: coords.map(project).map(([x, y]) => `${x},${y}`).join(' '),
          isTransmission,
        };
      });

    const proposedLines = proposedFc.features
      .filter((f) => f.geometry?.type === 'LineString')
      .map((f, idx) => {
        const coords = (f.geometry as GeoJSON.LineString).coordinates as [number, number][];
        return {
          key: `pr-line-${idx}`,
          points: coords.map(project).map(([x, y]) => `${x},${y}`).join(' '),
        };
      });

    const substations = infraFc.features
      .filter((f) => {
        const props = (f.properties ?? {}) as Record<string, unknown>;
        const cat = String(props.infra_category ?? props.asset_type ?? '').toUpperCase();
        return f.geometry?.type === 'Point' && cat.includes('SUBSTATION');
      })
      .map((f, idx) => {
        const [x, y] = project((f.geometry as GeoJSON.Point).coordinates as [number, number]);
        return {
          key: `sub-${idx}`,
          x,
          y,
          label: 'SS Nandapur 33/11 kV',
        };
      });

    const clusterPts = referenceClusters
      .filter((c): c is typeof c & { coords: [number, number] } => c.coords !== null)
      .map((c) => {
        const [x, y] = project(c.coords);
        return {
          code: c.code,
          proxyClass: c.proxyClass,
          color: getProxyDotColor(c.proxyClass),
          x,
          y,
        };
      });

    return {
      width,
      height,
      villagePolys,
      existingLines,
      proposedLines,
      substations,
      clusterPts,
      boundsLabel: `${minLon.toFixed(2)}°E–${maxLon.toFixed(2)}°E · ${minLat.toFixed(2)}°N–${maxLat.toFixed(2)}°N`,
    };
  }, [referenceGeoJson, referenceClusters]);

  const verifiedDatasetsCount = spikeSummary?.spikes?.S1_data_access?.datasets_verified ?? 0;

  const workflowStages = [
    {
      num: '01',
      title: 'Data & Layers',
      status:
        verifiedDatasetsCount > 0
          ? `${verifiedDatasetsCount} verified datasets`
          : `${OPEN_DATASET_REGISTRY.length} open data sources`,
      desc: 'Buildings, Copernicus DEM, WorldCover, VIIRS & solar resource',
      path: `/projects/${DEMO_PROJECT_ID}/data`,
    },
    {
      num: '02',
      title: 'Villages & Habitations',
      status: `${referenceClusters.length} clusters · Unverified`,
      desc: 'UTM DBSCAN clustering, Census 2011 DCHB & field ledger',
      path: `/projects/${DEMO_PROJECT_ID}/settlements`,
    },
    {
      num: '03',
      title: 'Grid & Demand',
      status: 'Utility tie-in pending',
      desc: 'Existing 11 kV assets, terrain penalty & 7-category load',
      path: `/projects/${DEMO_PROJECT_ID}/infrastructure`,
    },
    {
      num: '04',
      title: 'Network Design',
      status: `${routingSummary.lengthKm} km baseline`,
      desc: 'Least-cost 11 kV routing, 415 V MST, DTs & CEA voltage drop',
      path: `/projects/${DEMO_PROJECT_ID}/network`,
    },
    {
      num: '05',
      title: 'Cost & Scenarios',
      status: 'SoR & 4 scenarios',
      desc: 'Traceable Schedule of Rates, BOQ & 20-year lifecycle NPC',
      path: `/projects/${DEMO_PROJECT_ID}/cost`,
    },
    {
      num: '06',
      title: 'DPR & Exports',
      status: `${pdfSizeKb} KB plate`,
      desc: 'Pre-flight audit gate, 24-section PDF & formula Excel BOQ',
      path: `/projects/${DEMO_PROJECT_ID}/reports`,
    },
  ];

  return (
    <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 py-8 lg:py-10 space-y-10">
      {/* BAND 1: Editorial Project Masthead & Compact Epistemic Disclosure */}
      <header className="pb-8 border-b border-rule space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 font-medium text-ink">
              <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
              Active Reference Study
            </span>
            <span className="text-rule-strong" aria-hidden="true">
              ·
            </span>
            <span>Nandapur Block, Koraput District, Odisha</span>
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-xs border border-dashed border-warn-border bg-warn-bg text-warn">
              Preliminary — Not Field Verified
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3 tabular-nums">
            <span>Village Bheja (LGD 398712 · Census 428914)</span>
            <span>SC-01 Hybrid Grid + Mini-Grid</span>
            <span>WGS 84 · EPSG:32644</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-4">
            <h1 className="text-2xl sm:text-[1.75rem] font-semibold text-ink tracking-tight leading-snug">
              Nandapur Tribal Electrification Pre-Feasibility Study
            </h1>
            <p className="text-sm text-ink-2 leading-relaxed max-w-2xl">
              Pre-feasibility GIS assessment evaluating household clustering, terrain-penalised
              11 kV extension, and solar mini-grid sizing across Bheja, Padwa, and Maliaguda PVTG
              habitations using free, open-access satellite and Census baselines.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="primary"
                size="md"
                leftIcon={MapIcon}
                rightIcon={ArrowRight}
                onClick={() => navigate(`/projects/${DEMO_PROJECT_ID}/map`)}
              >
                Open Full GIS Workspace
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => navigate(`/projects/${DEMO_PROJECT_ID}/workspace`)}
              >
                Open Planning Workspace
              </Button>
              <Link
                to="/projects/new"
                className="inline-flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium text-ink-2 hover:text-accent transition-colors whitespace-nowrap"
              >
                <Icon icon={Plus} size="sm" />
                New Project
              </Link>
              <Link
                to="/projects"
                className="inline-flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium text-ink-2 hover:text-accent transition-colors whitespace-nowrap"
              >
                <Icon icon={FolderKanban} size="sm" />
                Portfolio
              </Link>
            </div>
          </div>

          {/* Compact, Non-Intrusive Epistemic Limitations Note */}
          <aside
            aria-label="Scientific Scope and Epistemic Limits"
            className="lg:col-span-4 border-l-2 border-warn pl-5 py-1 space-y-2.5"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-warn">
              <Icon icon={AlertTriangle} size="sm" />
              <span>Scientific limitations &amp; verification policy</span>
            </div>
            <p className="text-xs text-ink-2 leading-relaxed">
              Satellites cannot observe indoor electricity meters, illegal connections, supply hours,
              or voltage drops. Habitation statuses reflect remote-sensing proxies (Axis 1) and
              remain <strong className="text-ink">UNVERIFIED</strong> (Axis 2) until confirmed by
              field survey or DISCOM asset records.
            </p>
            <button
              type="button"
              aria-expanded={policyExpanded}
              onClick={() => setPolicyExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
            >
              <span>{policyExpanded ? 'Hide methodology details' : 'View verification rules'}</span>
              <Icon icon={policyExpanded ? ChevronUp : ChevronDown} size="xs" />
            </button>
            {policyExpanded && (
              <ul className="pt-2 border-t border-rule-subtle space-y-1.5 text-xs text-ink-2 leading-relaxed list-disc pl-4">
                <li>
                  All areas, conductor lengths, and DBSCAN radii compute dynamically in local UTM
                  metric coordinates (EPSG:32644).
                </li>
                <li>
                  Existing grid infrastructure is never invented — unmapped lines remain UNSET until
                  uploaded or logged as an explicit USER_ASSUMED tie-in.
                </li>
                <li>
                  Missing unit cost rates block DPR export rather than substituting placeholder
                  prices.
                </li>
              </ul>
            )}
          </aside>
        </div>
      </header>

      {/* BAND 2: Core Analytical Indicators (Left) + Dedicated GIS Workspace Portal (Right) */}
      <section
        aria-label="Primary Analytical Indicators and Spatial Workspace"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch"
      >
        {/* Left 7 Cols: Restrained 2x2 Analytical Sheet */}
        <div className="lg:col-span-7 bg-sheet border border-rule-subtle rounded-md overflow-hidden grid grid-cols-1 sm:grid-cols-2 bg-rule-subtle gap-px">
          {/* Indicator 1: Detected Footprints */}
          <div className="bg-sheet p-6 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink-2">
                Detected Building Footprints
              </span>
              <QualityTag kind="ESTIMATED" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-ink tabular-nums">
                  {detectedBuildingsCount}
                </span>
                <span className="text-sm text-ink-3">structures</span>
              </div>
              <p className="text-xs text-ink-2 mt-1.5 leading-relaxed">
                {referenceClusters.length} habitation clusters · {totalEstHouseholds} estimated
                residential households (Bheja AOI)
              </p>
            </div>
            <div className="space-y-1.5">
              <div
                aria-hidden="true"
                className="h-1.5 w-full rounded-full overflow-hidden bg-subtle flex"
              >
                {clusterProportions.map(
                  (seg) =>
                    seg.pct > 0 && (
                      <div
                        key={seg.key}
                        style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
                        className="h-full"
                      />
                    ),
                )}
              </div>
              <div className="text-xs text-ink-3">
                Proxy mix across electrified, underserved &amp; unserved clusters
              </div>
            </div>
          </div>

          {/* Indicator 2: Least-Cost 11 kV Routing */}
          <div className="bg-sheet p-6 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink-2">
                Least-Cost 11 kV Routing
              </span>
              <QualityTag kind="ESTIMATED" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-ink tabular-nums">
                  {routingSummary.lengthKm}
                </span>
                <span className="text-sm text-ink-3">km</span>
              </div>
              <p className="text-xs text-ink-2 mt-1.5 leading-relaxed">
                Terrain-weighted feeder routing across slope &amp; forest canopy friction surface
              </p>
            </div>
            <div className="text-xs text-ink-3 tabular-nums">
              MCP_Geometric over 30 m Copernicus DEM + WorldCover ({routingSummary.timingNote})
            </div>
          </div>

          {/* Indicator 3: Solar Resource */}
          <div className="bg-sheet p-6 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink-2">
                Solar Resource (NASA POWER)
              </span>
              <QualityTag kind="PROXY" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-ink tabular-nums">
                  {solarData.annualMeanGhi.toFixed(2)}
                </span>
                <span className="text-sm text-ink-3">kWh/m²/day</span>
              </div>
              <p className="text-xs text-ink-2 mt-1.5 leading-relaxed">
                Worst-month monsoon autonomy design baseline ({solarData.worstMonth}):{' '}
                <strong className="text-ink tabular-nums">
                  {solarData.worstGhi.toFixed(2)} kWh/m²/day
                </strong>
              </p>
            </div>
            <div className="text-xs text-ink-3">
              Climatological multi-year mean · Optimal PV array tilt 19.0° South
            </div>
          </div>

          {/* Indicator 4: Cartographic DPR Output */}
          <div className="bg-sheet p-6 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink-2">
                Cartographic DPR Output
              </span>
              <Badge variant="ok" size="md">
                Sample Plate Ready
              </Badge>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-ink tabular-nums">
                  {pdfSizeKb}
                </span>
                <span className="text-sm text-ink-3">KB PDF plate</span>
              </div>
              <p className="text-xs text-ink-2 mt-1.5 leading-relaxed">
                ReportLab Platypus + Matplotlib 24-section survey map plate with scale bar &amp;
                watermark
              </p>
            </div>
            <div>
              <Link
                to={`/projects/${DEMO_PROJECT_ID}/reports`}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
              >
                Inspect 24-Section DPR &amp; Export Gate
                <Icon icon={ArrowRight} size="xs" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Focused GIS Workspace Portal (Separates Full GIS Tooling into /map) */}
        <div className="lg:col-span-5 bg-sheet border border-rule-subtle rounded-md p-6 flex flex-col justify-between gap-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-3">
                <Icon icon={Compass} size="xs" className="text-accent" />
                <span>Dedicated Spatial Workbench</span>
              </div>
              <h2 className="text-lg font-semibold text-ink mt-1">
                Koraput Study Area GIS Map
              </h2>
            </div>
            <LayerSourceBadge source="REFERENCE_DEMO" />
          </div>

          {/* Schematic Geographic Preview of Real Study Coordinates (Zero Heavy Toolbar Clutter) */}
          <div className="bg-paper border border-rule-subtle rounded-sm relative overflow-hidden">
            <svg
              role="img"
              aria-label="Geographic extent schematic showing Nandapur revenue villages, cluster centroids, and preliminary 11 kV corridors"
              viewBox={`0 0 ${schematicSvgData.width} ${schematicSvgData.height}`}
              className="w-full h-48 block"
            >
              {/* Subtle Graticule Lines */}
              {[1, 2, 3].map((row) => (
                <line
                  key={`gy-${row}`}
                  x1={0}
                  y1={(schematicSvgData.height / 4) * row}
                  x2={schematicSvgData.width}
                  y2={(schematicSvgData.height / 4) * row}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />
              ))}
              {[1, 2, 3, 4].map((col) => (
                <line
                  key={`gx-${col}`}
                  x1={(schematicSvgData.width / 5) * col}
                  y1={0}
                  x2={(schematicSvgData.width / 5) * col}
                  y2={schematicSvgData.height}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />
              ))}

              {/* Real Village Boundaries */}
              {schematicSvgData.villagePolys.map((poly) => (
                <polygon
                  key={poly.key}
                  points={poly.points}
                  fill="#0B5CAD"
                  fillOpacity="0.06"
                  stroke="#64748B"
                  strokeWidth="1.25"
                  strokeDasharray="4 3"
                />
              ))}

              {/* Mapped Existing Power Lines */}
              {schematicSvgData.existingLines.map((ln) => (
                <polyline
                  key={ln.key}
                  points={ln.points}
                  fill="none"
                  stroke={ln.isTransmission ? '#4C1D95' : '#7A1F5C'}
                  strokeWidth={ln.isTransmission ? '2.25' : '1.75'}
                  strokeOpacity="0.9"
                />
              ))}

              {/* Preliminary Proposed Corridors */}
              {schematicSvgData.proposedLines.map((ln) => (
                <polyline
                  key={ln.key}
                  points={ln.points}
                  fill="none"
                  stroke="#CC79A7"
                  strokeWidth="1.75"
                  strokeDasharray="5 3"
                />
              ))}

              {/* Mapped Primary Substation */}
              {schematicSvgData.substations.map((sub) => (
                <g key={sub.key} transform={`translate(${sub.x}, ${sub.y})`}>
                  <rect
                    x="-5"
                    y="-5"
                    width="10"
                    height="10"
                    rx="1.5"
                    fill="#4C1D95"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  <text
                    x="10"
                    y="4"
                    fontSize="12"
                    fontFamily="IBM Plex Sans, sans-serif"
                    fontWeight="600"
                    fill="#334155"
                    stroke="#F4F6F9"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {sub.label}
                  </text>
                </g>
              ))}

              {/* Habitation Cluster Centroids Colored by Proxy Class */}
              {schematicSvgData.clusterPts.map((pt) => {
                const isBottomRightOffset = pt.code === 'CL-01';
                return (
                  <g key={pt.code} transform={`translate(${pt.x}, ${pt.y})`}>
                    <circle
                      r="5.5"
                      fill={pt.color}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                    <text
                      x={isBottomRightOffset ? 9 : 9}
                      y={isBottomRightOffset ? 11 : 4}
                      fontSize="12"
                      fontFamily="IBM Plex Sans, sans-serif"
                      fontWeight="600"
                      fill="#0F172A"
                      stroke="#F4F6F9"
                      strokeWidth="3"
                      paintOrder="stroke"
                    >
                      {pt.code}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="px-3 py-2 bg-sheet border-t border-rule-subtle space-y-1 text-xs text-ink-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="tabular-nums">AOI: 59.91 km² ({schematicSvgData.boundsLabel})</span>
                <span className="text-ink-3">4 clusters · 3 villages</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#4C1D95] inline-block" aria-hidden="true" />
                  Substation
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-0.5 bg-[#7A1F5C] inline-block" aria-hidden="true" />
                  Existing 33/11 kV
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 border-t-2 border-dashed border-[#CC79A7] inline-block" aria-hidden="true" />
                  Proposed 11 kV
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-ink-2 leading-relaxed">
              Launch the dedicated MapLibre GIS environment to switch Sentinel-2 satellite imagery,
              blend NASA VIIRS nightlights, measure spans, and inspect feature-level provenance.
            </p>
            <Button
              variant="navy"
              size="md"
              className="w-full"
              leftIcon={MapIcon}
              rightIcon={ArrowRight}
              onClick={() => navigate(`/projects/${DEMO_PROJECT_ID}/map`)}
            >
              Launch Full Interactive GIS Workspace
            </Button>
          </div>
        </div>
      </section>

      {/* BAND 3: Clean Numbered 6-Stage Planning Sequence */}
      <section aria-label="6-Stage Engineering Planning Sequence" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">
            Six-Stage Pre-Feasibility Workflow
          </h2>
          <p className="text-xs text-ink-3">
            Direct navigation into each engineering module · Statuses reflect loaded baseline data
          </p>
        </div>

        <div className="bg-rule-subtle border border-rule-subtle rounded-md overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-px">
          {workflowStages.map((stage) => (
            <Link
              key={stage.num}
              to={stage.path}
              className="bg-sheet hover:bg-surface-hover p-4 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus flex flex-col justify-between gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-subtle text-xs font-semibold text-ink-2 tabular-nums group-hover:bg-accent group-hover:text-white transition-colors">
                  {stage.num}
                </span>
                <Icon
                  icon={ArrowRight}
                  size="xs"
                  className="text-ink-3 group-hover:text-accent group-hover:translate-x-0.5 transition-all"
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-semibold text-ink group-hover:text-accent leading-snug">
                  {stage.title}
                </div>
                <p className="text-xs text-ink-2 leading-relaxed">{stage.desc}</p>
              </div>

              <div className="text-xs font-medium text-ink-3 pt-1 border-t border-rule-subtle">
                {stage.status}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* BAND 4: Clean Solar Resource Visualization & Revenue Village Context */}
      <section
        aria-label="Solar Climatology and Revenue Village Summary"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8"
      >
        {/* Left 6 Cols: NASA POWER 12-Month Solar GHI */}
        <div className="lg:col-span-6 bg-sheet border border-rule-subtle rounded-md p-6 flex flex-col justify-between gap-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">
                NASA POWER 12-Month Solar GHI &amp; Monsoon Curve
              </h2>
              <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                Off-grid solar PV + LiFePO4 sizing uses the worst-month monsoon irradiance (
                {solarData.worstMonth}: {solarData.worstGhi.toFixed(2)} kWh/m²/day).
              </p>
            </div>
            <LayerSourceBadge source="PROJECT" />
          </div>

          <div
            role="img"
            aria-label="NASA POWER 12-month solar GHI bar chart for Koraput reference study"
            className="grid grid-cols-12 gap-2 items-end h-44 pt-4 pb-1 border-b border-rule"
          >
            {MONTHS_ORDER.map((m) => {
              const val = solarData.monthlyGhi[m] ?? 0;
              const temp = solarData.monthlyTemp[m] ?? 0;
              const heightPct = Math.min(100, Math.max(12, (val / 7.0) * 100));
              const isWorst = m === solarData.worstMonth;
              return (
                <div
                  key={m}
                  className="flex flex-col items-center justify-end h-full gap-1.5"
                  title={`${m}: ${val.toFixed(2)} kWh/m²/day · ${temp.toFixed(1)}°C`}
                >
                  <span className="text-xs tabular-nums text-ink-2">
                    {val.toFixed(1)}
                  </span>
                  <div className="w-full flex-1 flex items-end justify-center">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[22px] rounded-t-sm transition-colors ${
                        isWorst
                          ? 'bg-warn'
                          : 'bg-accent hover:bg-accent-hover'
                      }`}
                    />
                  </div>
                  <span
                    className={`text-xs ${
                      isWorst ? 'font-semibold text-warn' : 'text-ink-3'
                    }`}
                  >
                    {m}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 divide-x divide-rule-subtle text-xs">
            <div className="pr-3">
              <div className="text-ink-3">Annual Mean GHI</div>
              <div className="text-sm font-semibold tabular-nums text-ink mt-0.5">
                {solarData.annualMeanGhi.toFixed(2)} kWh/m²/d
              </div>
            </div>
            <div className="px-3">
              <div className="text-warn font-medium">Worst Month ({solarData.worstMonth})</div>
              <div className="text-sm font-semibold tabular-nums text-warn mt-0.5">
                {solarData.worstGhi.toFixed(2)} kWh/m²/d
              </div>
            </div>
            <div className="pl-3">
              <div className="text-ink-3">Optimal Tilt</div>
              <div className="text-sm font-semibold text-ink inline-flex items-center gap-1 mt-0.5">
                <Icon icon={Sun} size="xs" className="text-warn" />
                19.0° South
              </div>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Revenue Village Baseline (Borderless Divided List) */}
        <div className="lg:col-span-6 bg-sheet border border-rule-subtle rounded-md p-6 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">
                Nandapur Block Revenue Villages (Census 2011 DCHB vs. 2026 Footprints)
              </h2>
              <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                Official District Census Handbook household supply compared with detected structures.
              </p>
            </div>
            <LayerSourceBadge source="REFERENCE_DEMO" />
          </div>

          <div className="divide-y divide-rule-subtle">
            {referenceVillages.map((vil) => (
              <div key={vil.lgdCode} className="py-3.5 first:pt-1 last:pb-0 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-ink">{vil.name}</span>{' '}
                    <span className="text-xs text-ink-3 tabular-nums whitespace-nowrap">
                      LGD {vil.lgdCode} · C2011 {vil.censusCode}
                    </span>
                  </div>
                  <Badge
                    className="shrink-0 whitespace-nowrap"
                    variant={
                      vil.summerHrs >= 8
                        ? 'ok'
                        : vil.summerHrs > 0
                          ? 'warn'
                          : 'error'
                    }
                  >
                    C2011 Supply: {vil.summerHrs}–{vil.winterHrs} hrs/day
                  </Badge>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 text-xs tabular-nums pt-0.5">
                  <div>
                    <span className="text-ink-3">Pop (ST): </span>
                    <span className="font-semibold text-ink">
                      {vil.totalPop} ({vil.stPop})
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-3">C2011 HH: </span>
                    <span className="font-semibold text-ink">{vil.households2011}</span>
                  </div>
                  <div>
                    <span className="text-ink-3">Sat. Est.: </span>
                    <span className="font-semibold text-accent">
                      {vil.estHouseholds2026} HH ({vil.footprints2026} bldgs)
                    </span>
                  </div>
                </div>
                {vil.statusLabel && (
                  <p className="text-xs text-ink-2">{vil.statusLabel}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BAND 5: Preliminary Habitation Cluster Schedule & Collapsible Open-Data Attribution */}
      <section
        aria-labelledby="cluster-schedule-heading"
        className="bg-sheet border border-rule-subtle rounded-md overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-rule-subtle flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="cluster-schedule-heading" className="text-base font-semibold text-ink">
              Habitation Cluster Schedule — Village Bheja
            </h2>
            <p className="text-xs text-ink-2 mt-0.5">
              Two-axis classification keeping satellite proxy indicators distinct from ground verification
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LayerSourceBadge source="REFERENCE_DEMO" />
            <QualityTag kind="PROXY" label="VIIRS DNB + FOOTPRINT CLUSTERING" />
          </div>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="cluster-schedule-heading"
          className="overflow-x-auto"
        >
          <table className="w-full text-left border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-rule-subtle bg-subtle text-ink-2 text-xs font-semibold">
                <th className="py-3 px-4">Cluster</th>
                <th className="py-3 px-4">Habitation Name</th>
                <th className="py-3 px-4 text-right">Footprints</th>
                <th className="py-3 px-4 text-right">Est. HH</th>
                <th className="py-3 px-4 text-right">VIIRS 2020 → 2024 (nW/cm²/sr)</th>
                <th className="py-3 px-4 text-right">11 kV Terrain Dist</th>
                <th className="py-3 px-4">Two-Axis Status</th>
                <th className="py-3 px-4">Preliminary Planning Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule-subtle">
              {referenceClusters.map((cluster) => (
                <tr key={cluster.code} className="hover:bg-surface-hover transition-colors">
                  <th scope="row" className="py-3.5 px-4 font-semibold text-ink tabular-nums">
                    {cluster.code}
                  </th>
                  <td className="py-3.5 px-4 font-medium text-ink">{cluster.name}</td>
                  <td className="py-3.5 px-4 text-right tabular-nums">{cluster.buildings}</td>
                  <td className="py-3.5 px-4 text-right tabular-nums">{cluster.estHouseholds}</td>
                  <td className="py-3.5 px-4 text-right tabular-nums">
                    <span className="text-ink-3">{cluster.viirs2020.toFixed(2)} → </span>
                    <strong className="text-ink">{cluster.viirsRadNanoW.toFixed(2)}</strong>
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-ink-2">
                    {(cluster.terrainDistM / 1000).toFixed(2)} km
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <ClassificationBadge
                      proxyClass={cluster.proxyClass}
                      verificationState="UNVERIFIED"
                    />
                  </td>
                  <td className="py-3.5 px-4 text-xs text-ink-2">{cluster.preliminaryMode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Open-Data Provenance Attribution Footer (Expandable Detail Matrix) */}
      <footer
        aria-label="Open-Data Provenance Attribution"
        className="pt-4 border-t border-rule-subtle space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-2">
          <div className="flex flex-wrap items-center gap-2">
            <LayerSourceBadge source="PROJECT" />
            <span>
              100% free, open-access public data pipeline: Open Buildings v3 · Copernicus GLO-30
              DEM · ESA WorldCover · NASA POWER · NASA VIIRS · Census 2011 &amp; OSM
            </span>
          </div>
          <button
            type="button"
            aria-expanded={sourcesExpanded}
            onClick={() => setSourcesExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover transition-colors shrink-0"
          >
            <span>
              {sourcesExpanded
                ? 'Hide dataset attributions'
                : `Inspect dataset licences & resolutions (${OPEN_DATASET_REGISTRY.length})`}
            </span>
            <Icon icon={sourcesExpanded ? ChevronUp : ChevronDown} size="xs" />
          </button>
        </div>

        {sourcesExpanded && (
          <div className="bg-rule-subtle border border-rule-subtle rounded-md overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px">
            {OPEN_DATASET_REGISTRY.map((ds) => (
              <div key={ds.key} className="bg-sheet p-4 space-y-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-ink">{ds.name}</span>
                  <LayerSourceBadge source={ds.sourceBadge} />
                </div>
                <div className="text-ink-2">
                  {ds.provider} · {ds.resolution}
                </div>
                <div className="text-ink-3">Licence: {ds.licence}</div>
              </div>
            ))}
          </div>
        )}
      </footer>
    </div>
  );
};
