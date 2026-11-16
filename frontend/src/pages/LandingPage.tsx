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
import { Badge, ClassificationBadge, LayerSourceBadge, ProxyElectrificationClass } from '../components/ui/Badge';
import { QualityTag } from '../components/ui/QualityTag';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { HelpTooltip } from '../components/ui/Tooltip';
import { formatSchemeLabel } from '../lib/beginnerGlossary';
import {
  MapSpikePreview,
  type ReferenceGeoJsonBundle,
} from '../components/map/MapSpikePreview';
import {
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
    sourceBadge: 'REFERENCE_DEMO' as const,
  },
  {
    key: 'copernicus_dem',
    name: 'Copernicus DEM GLO-30 Elevation & Slope',
    provider: 'ESA / Copernicus',
    resolution: '30 m raster',
    licence: 'Copernicus Free & Open',
    sourceBadge: 'REFERENCE_DEMO' as const,
  },
  {
    key: 'esa_worldcover',
    name: 'ESA WorldCover 2021 Land Use & Canopy',
    provider: 'ESA / VITO',
    resolution: '10 m / 30 m harmonised',
    licence: 'CC BY 4.0',
    sourceBadge: 'REFERENCE_DEMO' as const,
  },
  {
    key: 'nasa_power',
    name: 'NASA POWER Solar GHI & Temperature Climatology',
    provider: 'NASA Langley Research Center',
    resolution: '0.5° × 0.5° monthly climatology',
    licence: 'Public Domain (US Govt)',
    sourceBadge: 'REFERENCE_DEMO' as const,
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

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [referenceGeoJson, setReferenceGeoJson] =
    useState<ExtendedReferenceGeoJsonBundle | null>(null);
  const [spikeSummary, setSpikeSummary] = useState<SpikeSummaryPayload | null>(null);
  const [referenceNotice, setReferenceNotice] = useState<string | null>(null);
  const [policyExpanded, setPolicyExpanded] = useState(false);
  const [techMetaExpanded, setTechMetaExpanded] = useState(false);
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
        let failed = false;
        if (geoRes.status === 'fulfilled' && geoRes.value.ok) {
          setReferenceGeoJson(
            (await geoRes.value.json()) as ExtendedReferenceGeoJsonBundle,
          );
        } else {
          failed = true;
        }
        if (sumRes.status === 'fulfilled' && sumRes.value.ok) {
          setSpikeSummary((await sumRes.value.json()) as SpikeSummaryPayload);
        }
        setReferenceNotice(
          failed
            ? 'Live reference API unavailable — displaying bundled Koraput example snapshot.'
            : null,
        );
      } catch {
        if (active) {
          setReferenceNotice(
            'Live reference API unreachable — displaying bundled Koraput example snapshot.',
          );
        }
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
        viirs2020:
          typeof p.viirs_radiance_2020_nw === 'number' &&
          Number.isFinite(p.viirs_radiance_2020_nw)
            ? p.viirs_radiance_2020_nw
            : null,
        viirsRadNanoW:
          typeof p.viirs_radiance_2024_nw === 'number' &&
          Number.isFinite(p.viirs_radiance_2024_nw)
            ? p.viirs_radiance_2024_nw
            : null,
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
    const lengthKm = apiTotalKm > 0 ? apiTotalKm.toFixed(2) : '—';
    const elapsedSec = spikeSummary?.spikes?.S2_least_cost_routing?.elapsed_seconds;
    const timingNote =
      typeof elapsedSec === 'number' && elapsedSec > 0
        ? `${elapsedSec.toFixed(3)} s solver`
        : 'Awaiting live API';
    return { lengthKm, timingNote };
  }, [spikeSummary]);

  const pdfSizeKb =
    spikeSummary?.spikes?.S3_cartographic_pdf?.pdf_size_bytes &&
    spikeSummary.spikes.S3_cartographic_pdf.pdf_size_bytes > 0
      ? (spikeSummary.spikes.S3_cartographic_pdf.pdf_size_bytes / 1024).toFixed(1)
      : '—';

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
      desc: 'Traceable Schedule of Rates, BOQ & horizon-configured NPC',
      path: `/projects/${DEMO_PROJECT_ID}/cost`,
    },
    {
      num: '06',
      title: 'DPR & Exports',
      status: pdfSizeKb !== '—' ? `${pdfSizeKb} KB plate` : '24-sec export gate',
      desc: 'Pre-flight audit gate, 24-section PDF & formula Excel BOQ',
      path: `/projects/${DEMO_PROJECT_ID}/reports`,
    },
  ];

  return (
    <div className="max-w-[1460px] mx-auto px-5 sm:px-8 lg:px-10 py-7 lg:py-9 space-y-10">
      {/* BAND 1: Map-Centered Geospatial Intelligence Hero */}
      <section
        aria-label="Geospatial Study Overview and Interactive Map"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Left 5 Cols: Editorial Identity, Key Indicators & Collapsible Epistemic Rules */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
                Pre-Loaded Sample Study
              </span>
              <span className="text-rule-strong" aria-hidden="true">
                ·
              </span>
              <span>Nandapur Block, Koraput (Odisha)</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full border border-dashed border-warn-border bg-warn-bg text-warn">
                <span>Preliminary Screening Estimate</span>
                <HelpTooltip glossaryKey="preliminaryDisclaimer" placement="bottom" />
              </span>
            </div>

            <h1 className="text-2xl sm:text-[2rem] font-bold text-ink tracking-tight leading-[1.15]">
              Plan Rural &amp; Tribal Village Electrification Using Open Maps
            </h1>

            <p className="text-sm text-ink-2 leading-relaxed">
              See which hamlets are dark at night, estimate how much power they need, compare grid lines vs. village solar microgrids, and prepare a 24-section Detailed Project Report ({formatSchemeLabel('DA-JGUA / RDSS')}) — starting with this example across Bheja, Padwa, and Maliaguda.
            </p>

            <div>
              <button
                type="button"
                aria-expanded={techMetaExpanded}
                onClick={() => setTechMetaExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-accent transition-colors"
              >
                <span>{techMetaExpanded ? 'Hide technical study codes' : 'Show technical study codes (LGD / CRS)'}</span>
                <Icon icon={techMetaExpanded ? ChevronUp : ChevronDown} size="xs" />
              </button>
              {techMetaExpanded && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-ink-3 tabular-nums">
                  <span>Village Bheja (LGD 398712 · C2011 428914)</span>
                  <span>·</span>
                  <span>Metric Grid: EPSG:32644</span>
                  <HelpTooltip glossaryKey="crsEpsgUtm" placement="right" />
                </div>
              )}
            </div>
          </div>

          {/* Primary Navigation Actions (2 Clear Hero CTAs + Sign-in Note) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="primary"
                size="md"
                leftIcon={Compass}
                rightIcon={ArrowRight}
                onClick={() => navigate(`/projects/${DEMO_PROJECT_ID}/workspace`)}
              >
                Explore Sample Study
              </Button>
              <Button
                variant="secondary"
                size="md"
                leftIcon={Plus}
                onClick={() => navigate('/projects/new')}
              >
                Create New Village Project
              </Button>
              <div className="flex items-center gap-3 pl-1 text-xs font-medium text-ink-2">
                <Link
                  to={`/projects/${DEMO_PROJECT_ID}/map`}
                  className="inline-flex items-center gap-1 hover:text-accent transition-colors whitespace-nowrap"
                >
                  <Icon icon={MapIcon} size="xs" />
                  GIS Map
                </Link>
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-1 hover:text-accent transition-colors whitespace-nowrap"
                >
                  <Icon icon={FolderKanban} size="xs" />
                  My Projects
                </Link>
              </div>
            </div>
            <p className="text-[11px] text-ink-3">
              Creating your own village study or opening saved workspaces will ask you to sign in (a 1-click demo planner account is available on the sign-in screen).
            </p>
            {referenceNotice && (
              <p role="status" className="text-xs text-warn bg-warn-bg/60 border border-warn-border rounded px-3 py-1.5">
                {referenceNotice}
              </p>
            )}
          </div>

          {/* Open Editorial Analytical Highlights (Varied Layout, Plain Language + Help Icons) */}
          <div className="bg-sheet border border-rule/80 rounded-lg p-5 shadow-card space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 divide-y-0">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-3">
                    <span>Detected Buildings</span>
                    <HelpTooltip glossaryKey="buildingFootprints" placement="top" />
                  </span>
                  <QualityTag kind="ESTIMATED" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-ink tabular-nums">
                    {detectedBuildingsCount}
                  </span>
                  <span className="text-xs text-ink-3">
                    roofs · ~{totalEstHouseholds} homes
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-1.5 w-full rounded-full overflow-hidden bg-subtle flex mt-1"
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
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-3">
                    <span>Terrain Line Route</span>
                    <HelpTooltip glossaryKey="terrainCostSurface" placement="top" />
                  </span>
                  <QualityTag kind="ESTIMATED" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-ink tabular-nums">
                    {routingSummary.lengthKm}
                  </span>
                  <span className="text-xs text-ink-3">km of 11 kV line</span>
                </div>
                <div className="text-2xs text-ink-3 tabular-nums">
                  Follows gentle terrain ({routingSummary.timingNote})
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-rule-subtle">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-3">
                    <span>Average Daily Sunlight</span>
                    <HelpTooltip glossaryKey="ghiSolarIrradiance" placement="top" />
                  </span>
                  <QualityTag kind="PROXY" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tracking-tight text-ink tabular-nums">
                    {solarData.annualMeanGhi.toFixed(2)}
                  </span>
                  <span className="text-xs text-ink-3">kWh/m²/d</span>
                </div>
                <div className="text-2xs text-ink-3">
                  Cloudiest month ({solarData.worstMonth}): {solarData.worstGhi.toFixed(2)}
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-rule-subtle">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-3">
                    <span>24-Section PDF Report</span>
                    <HelpTooltip glossaryKey="dpr" placement="top" />
                  </span>
                  <Badge
                    variant={
                      spikeSummary?.spikes?.S3_cartographic_pdf?.status === 'PASSED'
                        ? 'ok'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {spikeSummary?.spikes?.S3_cartographic_pdf?.status === 'PASSED'
                      ? 'Ready'
                      : 'Pending'}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tracking-tight text-ink tabular-nums">
                    {pdfSizeKb}
                  </span>
                  <span className="text-xs text-ink-3">KB preview plate</span>
                </div>
                <Link
                  to={`/projects/${DEMO_PROJECT_ID}/reports`}
                  className="inline-flex items-center gap-1 text-2xs font-medium text-accent hover:underline"
                >
                  Open checklist &amp; downloads →
                </Link>
              </div>
            </div>
          </div>

          {/* Restrained Collapsible Epistemic Limitations Disclosure */}
          <aside
            aria-label="Scientific Scope and Epistemic Limits"
            className="rounded-md bg-warn-bg/60 border border-warn-border/80 px-4 py-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-semibold text-warn">
                <Icon icon={AlertTriangle} size="sm" />
                <span>Important rule: satellites cannot see inside homes</span>
              </div>
              <button
                type="button"
                aria-expanded={policyExpanded}
                onClick={() => setPolicyExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
              >
                <span>{policyExpanded ? 'Hide methodology rules' : 'How checks & safety rules work'}</span>
                <Icon icon={policyExpanded ? ChevronUp : ChevronDown} size="xs" />
              </button>
            </div>
            <p className="text-xs text-ink-2 leading-relaxed">
              Outdoor nighttime brightness only gives screening clues. Clusters stay <strong className="text-ink">Unverified</strong> until someone checks records or visits the village.
            </p>
            {policyExpanded && (
              <ul className="pt-2 border-t border-warn-border/50 space-y-1 text-xs text-ink-2 leading-relaxed list-disc pl-4">
                <li>
                  All areas, wire lengths, and village groupings measure real meters using local flat map grids (UTM Zone 44N / EPSG:32644).
                </li>
                <li>
                  Existing poles and transformers are never invented — only uploaded utility files or points you mark on the map are used.
                </li>
                <li>
                  Missing equipment prices block final DPR export until real local prices are filled in.
                </li>
              </ul>
            )}
          </aside>
        </div>

        {/* Right 7 Cols: Live Interactive MapLibre GIS Showcase Centerpiece */}
        <div className="lg:col-span-7 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 text-xs text-ink-2">
              <Icon icon={Compass} size="sm" className="text-accent" />
              <span className="font-semibold text-ink">
                Interactive Village Map — Click any Hamlet, Line, or Transformer
              </span>
            </div>
            <LayerSourceBadge source="REFERENCE_DEMO" />
          </div>

          <MapSpikePreview
            referenceData={referenceGeoJson}
            variant="hero"
            heightClass="h-[460px] lg:h-[560px]"
            onOpenFullMap={() => navigate(`/projects/${DEMO_PROJECT_ID}/map`)}
          />
        </div>
      </section>

      {/* BAND 2: Connected 6-Stage Pre-Feasibility Pipeline Rail */}
      <section aria-label="6-Stage Engineering Planning Sequence" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="heading-lg">Six-Stage Pre-Feasibility Pipeline</h2>
          <p className="text-xs text-ink-3">
            Step directly into any assessment stage · Real dataset &amp; proxy statuses
          </p>
        </div>

        <div className="bg-sheet border border-rule/80 rounded-lg shadow-card overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-rule-subtle">
          {workflowStages.map((stage) => (
            <Link
              key={stage.num}
              to={stage.path}
              className="p-4 hover:bg-accent-tint/35 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-subtle text-xs font-bold text-ink-2 tabular-nums group-hover:bg-accent group-hover:text-white transition-colors">
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
                <p className="text-xs text-ink-3 leading-relaxed">{stage.desc}</p>
              </div>

              <div className="text-2xs font-medium text-accent/90 pt-1">
                {stage.status}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* BAND 3: Clean Solar Resource Visualization & Revenue Village Context */}
      <section
        aria-label="Solar Climatology and Revenue Village Summary"
        className="grid grid-cols-1 lg:grid-cols-12 gap-7"
      >
        {/* Left 6 Cols: NASA POWER 12-Month Solar GHI */}
        <div className="lg:col-span-6 bg-sheet border border-rule/80 rounded-lg shadow-card p-6 flex flex-col justify-between gap-5">
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
            className="grid grid-cols-12 gap-2 items-end h-44 pt-4 pb-1 border-b border-rule-subtle"
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
                      className={`w-full max-w-[22px] rounded-t-md transition-colors ${
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

        {/* Right 6 Cols: Revenue Village Baseline */}
        <div className="lg:col-span-6 bg-sheet border border-rule/80 rounded-lg shadow-card p-6 flex flex-col justify-between gap-4">
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
                    <span className="text-xs font-mono text-ink-3 tabular-nums whitespace-nowrap">
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

      {/* BAND 4: Preliminary Habitation Cluster Schedule */}
      <section
        aria-labelledby="cluster-schedule-heading"
        className="bg-sheet border border-rule/80 rounded-lg shadow-card overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-rule-subtle flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="cluster-schedule-heading" className="text-base font-semibold text-ink">
              Habitation Cluster Schedule — Village Bheja
            </h2>
            <p className="text-xs text-ink-2 mt-0.5">
              Satellite clues stay clearly separated from confirmed field surveys. Hover or tap `?` on any column for a plain explanation.
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
              <tr className="border-b border-rule-subtle bg-subtle/70 text-ink-2 text-xs font-semibold">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Hamlet / Habitation Name</th>
                <th className="py-3 px-4 text-right">Roofs Detected</th>
                <th className="py-3 px-4 text-right">Est. Homes</th>
                <th className="py-3 px-4 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    <span>Night Light (nW/cm²/sr)</span>
                    <HelpTooltip glossaryKey="viirsNighttimeLight" placement="top" />
                  </span>
                </th>
                <th className="py-3 px-4 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    <span>Distance to 11 kV Line</span>
                    <HelpTooltip glossaryKey="terrainCostSurface" placement="top" />
                  </span>
                </th>
                <th className="py-3 px-4">
                  <span className="inline-flex items-center gap-1">
                    <span>Satellite Clue &amp; Check State</span>
                    <HelpTooltip glossaryKey="verificationStatus" placement="top" />
                  </span>
                </th>
                <th className="py-3 px-4">
                  <span className="inline-flex items-center gap-1">
                    <span>Suggested Option</span>
                    <HelpTooltip glossaryKey="distributionModality" placement="top" />
                  </span>
                </th>
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
                    <span className="text-ink-3">
                      {cluster.viirs2020 != null ? cluster.viirs2020.toFixed(2) : '—'} →{' '}
                    </span>
                    <strong className="text-ink">
                      {cluster.viirsRadNanoW != null ? cluster.viirsRadNanoW.toFixed(2) : '—'}
                    </strong>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {OPEN_DATASET_REGISTRY.map((ds) => (
              <div
                key={ds.key}
                className="bg-sheet border border-rule/80 rounded-md p-4 shadow-xs space-y-1.5 text-xs"
              >
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
