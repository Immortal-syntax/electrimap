import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../lib/apiClient';
import { useSessionStore } from '../stores/sessionStore';
import { MapCanvas } from '../components/map/MapCanvas';
import { ClassificationBadge, ProxyElectrificationClass } from '../components/ui/Badge';
import { Callout } from '../components/ui/Callout';
import { StatTile } from '../components/ui/StatTile';
import { TitleBlock } from '../components/ui/TitleBlock';
import { ProjectDto } from './ProjectsPage';

interface ReferenceGeoJsonPayload {
  villages: GeoJSON.FeatureCollection;
  buildings: GeoJSON.FeatureCollection;
  routes: GeoJSON.FeatureCollection;
}

const WORKFLOW_STEPS = [
  { key: 'data', label: '1. Data & AOI', state: 'ACTIVE' },
  { key: 'settlements', label: '2. Settlements', state: 'READY' },
  { key: 'infrastructure', label: '3. Infrastructure', state: 'READY' },
  { key: 'planning', label: '4. Planning', state: 'READY' },
  { key: 'engineering', label: '5. Engineering', state: 'READY' },
  { key: 'cost', label: '6. Cost & BOQ', state: 'READY' },
  { key: 'compare', label: '7. Compare & DPR', state: 'READY' },
];

const DEMO_HABITATIONS: Array<{
  code: string;
  name: string;
  buildings: number;
  estHh: number;
  proxyClass: ProxyElectrificationClass;
}> = [
  {
    code: 'CL-01',
    name: 'Bheja Main Village Core',
    buildings: 65,
    estHh: 59,
    proxyClass: 'LIKELY_ELECTRIFIED',
  },
  {
    code: 'CL-02',
    name: 'Podapadar Tola (Eastern Ridge)',
    buildings: 42,
    estHh: 38,
    proxyClass: 'POTENTIALLY_UNDERSERVED',
  },
  {
    code: 'CL-03',
    name: 'Maliaguda PVTG Hamlet',
    buildings: 28,
    estHh: 26,
    proxyClass: 'POTENTIALLY_UNSERVED',
  },
  {
    code: 'CL-04',
    name: 'Dispersed Forest Homesteads',
    buildings: 8,
    estHh: 8,
    proxyClass: 'UNKNOWN',
  },
];

export const WorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, login } = useSessionStore();

  const [project, setProject] = useState<ProjectDto | null>(null);
  const [refLayers, setRefLayers] = useState<ReferenceGeoJsonPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadWorkspace() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        if (!user) {
          await login('planner@electrimap.in', 'ElectriMap#2026');
        }
        const [projData, geoData] = await Promise.all([
          apiRequest<ProjectDto>(`/api/v1/projects/${id}`),
          apiRequest<ReferenceGeoJsonPayload>('/api/v1/spikes/reference-geojson'),
        ]);
        if (!active) return;
        setProject(projData);
        setRefLayers(geoData);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load project workspace.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadWorkspace();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-center font-mono text-xs text-ink-2">
        Loading GIS engineering workbench...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-3">
        <Callout tone="error" title="Workspace Load Error">
          {error ?? 'Project not found.'}
        </Callout>
        <Link to="/projects" className="text-xs font-mono text-accent underline">
          ← Return to Projects Portfolio
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] w-full mx-auto p-4 space-y-4">
      <TitleBlock
        sheetNumber={`SHEET PRJ-v${project.version}`}
        projectTitle={project.name}
        villageLabel={
          project.village_names ??
          (project.aoi?.lgd_code ? `LGD ${project.aoi.lgd_code}` : 'Custom AOI Polygon')
        }
        blockAndDistrict={`${project.target_block ?? 'Nandapur'}, ${
          project.target_district ?? 'Koraput'
        }, ${project.target_state ?? 'Odisha'}`}
        crsLabel={`WGS 84 ↔ EPSG:${project.metric_epsg}`}
        scenarioName={`${project.scheme} · ${project.horizon_years}-Year Horizon`}
        dateIso={project.updated_at.slice(0, 10)}
        isPreliminary={true}
      />

      {project.aoi?.warnings.includes('APPROXIMATE_BOUNDARY_BUFFER_1500M') && (
        <Callout
          tone="warn"
          title="Approximate AOI Boundary Active (1.5 km Metric Circular Buffer)"
        >
          Official village polygon geometry was unavailable for LGD{' '}
          <code>{project.aoi.lgd_code}</code>. The workbench generated a 1.5 km metric buffer in
          EPSG:{project.metric_epsg}. Confirm exact revenue village boundaries during field
          survey.
        </Callout>
      )}

      {project.aoi?.warnings.includes('SELF_INTERSECTION_REPAIRED') && (
        <Callout tone="info" title="Geometry Topology Automatically Repaired">
          A self-intersection in the submitted boundary polygon was automatically repaired using
          OGC <code>make_valid</code> rules prior to metric area calculation.
        </Callout>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Validated AOI Area"
          value={project.aoi ? project.aoi.area_km2.toFixed(2) : '0.00'}
          unit="km²"
          quality={
            project.aoi?.boundary_source === 'APPROXIMATE_BUFFER' ? 'ASSUMED' : 'ESTIMATED'
          }
          subtitle={`Boundary Source: ${project.aoi?.boundary_source ?? 'UNSET'}`}
        />
        <StatTile
          label="Metric Computation CRS"
          value={`EPSG:${project.metric_epsg}`}
          unit="UTM"
          quality="VERIFIED"
          subtitle="All distances (m) and areas (m²) computed in UTM"
        />
        <StatTile
          label="Consumer Load Tier"
          value={project.load_tier.replace('TIER_', 'TIER ')}
          quality="ASSUMED"
          subtitle={`Base Year ${project.base_year} · ${project.horizon_years}-Yr Horizon`}
        />
        <StatTile
          label="Verification Coverage"
          value="0.0"
          unit="% HH verified"
          quality="PROXY"
          subtitle="All settlement clusters currently UNVERIFIED on Axis 2"
        />
      </div>

      {/* Main Workbench Grid: Step Rail + MapCanvas + Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Step Rail */}
        <aside
          aria-label="Engineering workflow steps"
          className="lg:col-span-2 bg-sheet border border-rule-strong rounded-xs p-2.5 space-y-1"
        >
          <div className="small-caps-heading px-2 py-1 border-b border-rule mb-1">
            Workflow Steps
          </div>
          {WORKFLOW_STEPS.map((step) => (
            <div
              key={step.key}
              className={`px-2.5 py-2 rounded-xs text-xs font-medium flex items-center justify-between ${
                step.state === 'ACTIVE'
                  ? 'bg-accent-tint text-accent border border-accent/40'
                  : 'text-ink-2'
              }`}
            >
              <span>{step.label}</span>
              <span className="font-mono text-[10px]">{step.state}</span>
            </div>
          ))}
        </aside>

        {/* Center MapCanvas */}
        <div className="lg:col-span-7">
          <MapCanvas
            aoiGeometry={project.aoi?.geojson_geometry ?? null}
            boundarySource={project.aoi?.boundary_source ?? 'HARMONISED'}
            referenceBuildings={refLayers?.buildings ?? null}
            referenceRoutes={refLayers?.routes ?? null}
            heightClass="h-[460px]"
          />
        </div>

        {/* Right Inspector Panel */}
        <aside
          aria-label="AOI and Provenance Inspector"
          className="lg:col-span-3 bg-sheet border border-rule-strong rounded-xs p-3.5 space-y-3 text-xs"
        >
          <div className="small-caps-heading border-b border-rule pb-1.5">
            AOI &amp; Provenance Inspector
          </div>

          <dl className="space-y-2 font-mono text-[11px]">
            <div className="flex justify-between border-b border-rule/60 pb-1">
              <dt className="text-ink-2">Project ID</dt>
              <dd className="text-ink">{project.id.slice(0, 8)}…</dd>
            </div>
            <div className="flex justify-between border-b border-rule/60 pb-1">
              <dt className="text-ink-2">Boundary Source</dt>
              <dd className="text-ink">{project.aoi?.boundary_source ?? 'NONE'}</dd>
            </div>
            <div className="flex justify-between border-b border-rule/60 pb-1">
              <dt className="text-ink-2">LGD / Census 2011</dt>
              <dd className="text-ink">
                {project.aoi?.lgd_code ?? '—'} / {project.aoi?.census2011_code ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between border-b border-rule/60 pb-1">
              <dt className="text-ink-2">Source CRS</dt>
              <dd className="text-ink">{project.aoi?.original_crs ?? 'EPSG:4326'}</dd>
            </div>
            <div className="flex justify-between border-b border-rule/60 pb-1">
              <dt className="text-ink-2">Optimistic Version</dt>
              <dd className="text-ink">v{project.version}</dd>
            </div>
          </dl>

          <div className="pt-2 space-y-2">
            <div className="small-caps-heading">Habitation Clusters (Preview)</div>
            <div className="space-y-1.5">
              {DEMO_HABITATIONS.map((h) => (
                <div
                  key={h.code}
                  className="p-2 bg-paper border border-rule rounded-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-medium text-ink">
                    <span>
                      {h.code} · {h.name}
                    </span>
                    <span className="font-mono text-[11px]">{h.estHh} HH</span>
                  </div>
                  <ClassificationBadge
                    proxyClass={h.proxyClass}
                    verificationState="UNVERIFIED"
                  />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
