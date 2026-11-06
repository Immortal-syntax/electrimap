import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TitleBlock } from '../components/ui/TitleBlock';
import { StatTile } from '../components/ui/StatTile';
import { Callout } from '../components/ui/Callout';
import { ClassificationBadge, ProxyElectrificationClass } from '../components/ui/Badge';
import { QualityTag } from '../components/ui/QualityTag';
import { Button } from '../components/ui/Button';
import {
  MapSpikePreview,
  ReferenceGeoJsonBundle,
} from '../components/map/MapSpikePreview';

const DEMO_PROJECT_ID = '00000000-0000-4000-8000-000000000001';

const REFERENCE_CLUSTERS: Array<{
  code: string;
  name: string;
  buildings: number;
  estHouseholds: number;
  viirsRadNanoW: number;
  proxyClass: ProxyElectrificationClass;
  preliminaryMode: string;
}> = [
  {
    code: 'CL-01',
    name: 'Bheja Main Village Core',
    buildings: 65,
    estHouseholds: 59,
    viirsRadNanoW: 2.18,
    proxyClass: 'LIKELY_ELECTRIFIED',
    preliminaryMode: 'Existing LT Augmentation Check',
  },
  {
    code: 'CL-02',
    name: 'Podapadar Tola (Eastern Ridge)',
    buildings: 42,
    estHouseholds: 38,
    viirsRadNanoW: 0.41,
    proxyClass: 'POTENTIALLY_UNDERSERVED',
    preliminaryMode: 'Grid Extension (11 kV + 25 kVA DT)',
  },
  {
    code: 'CL-03',
    name: 'Maliaguda PVTG Hamlet (North-East Valley)',
    buildings: 28,
    estHouseholds: 26,
    viirsRadNanoW: 0.05,
    proxyClass: 'POTENTIALLY_UNSERVED',
    preliminaryMode: 'Solar Mini-Grid vs Grid Extension Compare',
  },
  {
    code: 'CL-04',
    name: 'Dispersed Forest Homesteads',
    buildings: 8,
    estHouseholds: 8,
    viirsRadNanoW: 0.02,
    proxyClass: 'UNKNOWN',
    preliminaryMode: 'Standalone Solar Home Systems (SHS)',
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [referenceGeoJson, setReferenceGeoJson] =
    useState<ReferenceGeoJsonBundle | null>(null);

  useEffect(() => {
    let active = true;
    async function loadReference() {
      try {
        const res = await fetch('/api/v1/spikes/reference-geojson');
        if (res.ok && active) {
          setReferenceGeoJson((await res.json()) as ReferenceGeoJsonBundle);
        }
      } catch {
        // Fallback smoothly in isolated unit tests
      }
    }
    void loadReference();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="max-w-[1360px] w-full mx-auto p-4 space-y-4">
      <TitleBlock
        sheetNumber="SHEET DPR-M1-01"
        projectTitle="Nandapur Tribal Electrification Pre-Feasibility Study"
        villageLabel="Bheja (LGD 398712 · Census 428914)"
        blockAndDistrict="Nandapur Block, Koraput District, Odisha"
        crsLabel="WGS 84 ↔ UTM 44N (EPSG:32644)"
        scenarioName="SC-01 · Hybrid Grid + Mini-Grid Baseline"
        dateIso="2026-11-06"
        isPreliminary={true}
      />

      <Callout
        tone="warn"
        title="What This Tool Can and Cannot Tell You (Epistemic Honesty Policy)"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => navigate(`/projects/${DEMO_PROJECT_ID}/workspace`)}
            >
              Open Koraput Demo Workspace
            </Button>
            <Link to="/projects/new">
              <Button variant="secondary">+ New Project &amp; AOI Wizard</Button>
            </Link>
          </div>
        }
      >
        Satellite building footprints and night-time radiance (VIIRS / HREA) cannot see indoor
        electricity meters, illegal tapping, daily supply hours, or low-voltage drops. Every
        habitation is classified on <strong>Axis 1 (Proxy Electrification Class)</strong> and
        remains <strong>UNVERIFIED</strong> on <strong>Axis 2 (Verification State)</strong> until
        field survey or DISCOM records are attached.
      </Callout>

      <section
        aria-label="Reference Geography & Spike Verification Metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <StatTile
          label="Detected Footprints (Bheja AOI)"
          value="143"
          unit="structures"
          quality="ESTIMATED"
          subtitle="4 settlement clusters · 131 estimated residential households"
        />
        <StatTile
          label="S2 Least-Cost 11 kV Routing"
          value="9.35"
          unit="km"
          quality="ESTIMATED"
          subtitle="MCP_Geometric over 30m DEM + WorldCover (0.044 s)"
        />
        <StatTile
          label="Solar GHI Resource (NASA POWER)"
          value="5.12"
          unit="kWh/m²/day"
          quality="PROXY"
          subtitle="Annual mean GHI · Optimal tilt 19.0° S · Temp derating 7.8%"
        />
        <StatTile
          label="S3 Cartographic DPR Map Plate"
          value="224.1"
          unit="KB PDF"
          quality="VERIFIED"
          subtitle="ReportLab Platypus + Matplotlib · Scale bar, North arrow, Watermark"
        />
      </section>

      <MapSpikePreview referenceData={referenceGeoJson} />

      <section
        aria-labelledby="cluster-schedule-heading"
        className="bg-sheet border border-rule-strong rounded-xs overflow-hidden"
      >
        <div className="p-3 border-b border-rule flex flex-wrap items-center justify-between gap-2 bg-paper/50">
          <div>
            <h2 id="cluster-schedule-heading" className="text-sm font-semibold text-ink">
              Preliminary Habitation &amp; Settlement Cluster Schedule — Village Bheja
            </h2>
            <p className="text-xs text-ink-2">
              Two-axis classification separating remote-sensing proxy status from ground
              verification state
            </p>
          </div>
          <QualityTag kind="PROXY" label="VIIRS DNB + FOOTPRINT CLUSTERING" />
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="cluster-schedule-heading"
          className="overflow-x-auto"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-rule-strong bg-paper text-ink-2 font-mono text-[11px] uppercase">
                <th className="py-2 px-3">Cluster ID</th>
                <th className="py-2 px-3">Habitation / Tola Name</th>
                <th className="py-2 px-3 text-right">Footprints</th>
                <th className="py-2 px-3 text-right">Est. HH</th>
                <th className="py-2 px-3 text-right">VIIRS Radiance (nW/cm²/sr)</th>
                <th className="py-2 px-3">Two-Axis Status (Proxy × Verification)</th>
                <th className="py-2 px-3">Preliminary Planning Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {REFERENCE_CLUSTERS.map((cluster) => (
                <tr key={cluster.code} className="hover:bg-accent-tint/30">
                  <th
                    scope="row"
                    className="py-2.5 px-3 font-mono font-semibold text-ink bg-sheet"
                  >
                    {cluster.code}
                  </th>
                  <td className="py-2.5 px-3 font-medium text-ink">{cluster.name}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-mono">
                    {cluster.buildings}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-mono">
                    {cluster.estHouseholds}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-mono">
                    {cluster.viirsRadNanoW.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3">
                    <ClassificationBadge
                      proxyClass={cluster.proxyClass}
                      verificationState="UNVERIFIED"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-ink-2">{cluster.preliminaryMode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

