// Copyright 2026 Swayam Kumar
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React from 'react';
import { X, Crosshair, Info, ShieldAlert, CheckCircle2 } from 'lucide-react';
import {
  Badge,
  ClassificationBadge,
  LayerSourceBadge,
  type ProxyElectrificationClass,
  type VerificationState,
} from '../ui/Badge';
import { QualityTag, type QualityTagKind } from '../ui/QualityTag';
import { Button } from '../ui/Button';
import { HelpTooltip } from '../ui/Tooltip';
import {
  formatModalityLabel,
  formatVerificationStateLabel,
} from '../../lib/beginnerGlossary';
import {
  resolveInfraCategoryMeta,
  type InfrastructureCategorySpec,
  type LayerSourceClass,
} from './symbology';
import {
  DEFAULT_EXISTING_POWER_INFRA_FC,
  DEFAULT_SETTLEMENTS_FC,
  DEFAULT_VILLAGE_ELECTRIFICATION_FC,
  type SearchableLocationItem,
} from './electricityGisData';

export interface InspectedFeatureState {
  layerGroupTitle: string;
  title: string;
  subtitle: string;
  provenanceBadge: string;
  beginnerExplanation: string;
  epistemicCaveat: string;
  attributes: Array<{ label: string; value: string }>;
  /** Optional Phase 4/5 provenance, symbology and epistemic tags */
  sourceClass?: LayerSourceClass;
  qualityKind?: QualityTagKind;
  proxyClass?: ProxyElectrificationClass;
  verificationState?: VerificationState;
  infraSpec?: InfrastructureCategorySpec;
  coordinates?: [number, number];
  clusterId?: string;
}

export interface GisFeatureInspectorDrawerProps {
  feature: InspectedFeatureState | null;
  onClose: () => void;
  onFlyToFeature?: (lon: number, lat: number, zoom?: number) => void;
  onSelectClusterInWorkbench?: (clusterId: string) => void;
}

function formatInspectorProvenance(badge: string): string {
  switch (badge) {
    case 'VIIRS DNB VNL v2.2 (~500 m)':
      return 'NASA Nighttime Light (~500 m)';
    case 'VIIRS DNB + Footprint DBSCAN':
      return 'Night Light + Roof Grouping';
    case 'BUILDING_FOOTPRINT_PROXY':
      return 'Satellite Roof Detection';
    case 'PROPOSED_PRELIMINARY':
      return 'Preliminary Design Estimate';
    case 'MODEL_ESTIMATED_GAP':
      return 'Estimated Gap Corridor';
    case 'CENSUS 2011 DCHB + LGD':
      return 'Census 2011 + Village Map';
    case 'OSM_MAPPED':
      return 'OpenStreetMap Grid Data';
    case 'USER_ASSUMED':
      return 'User-Marked Point';
    case 'UTILITY_RECORD':
      return 'Utility Record';
    case 'FIELD_SURVEY':
      return 'Field Survey';
    default:
      return badge.replace(/_/g, ' ');
  }
}

/**
 * Structured GIS Feature Inspector Drawer.
 *
 * Displays genuine feature attributes, data provenance badges,
 * epistemic quality tags, plain-English explanation
 * for non-technical evaluators, and mandatory epistemic caveats.
 */
export const GisFeatureInspectorDrawer: React.FC<GisFeatureInspectorDrawerProps> = ({
  feature,
  onClose,
  onFlyToFeature,
  onSelectClusterInWorkbench,
}) => {
  if (!feature) return null;

  const isProposed =
    feature.provenanceBadge.includes('PROPOSED') ||
    feature.layerGroupTitle.includes('Layer F');

  const friendlyProvenance = formatInspectorProvenance(feature.provenanceBadge);

  return (
    <div
      role="region"
      aria-label="Selected GIS Feature Inspector"
      className="absolute bottom-10 left-3 right-3 sm:left-auto sm:right-3 z-20 sm:w-96 max-h-[82%] overflow-y-auto bg-sheet/95 backdrop-blur-md text-ink border border-rule-subtle rounded-lg shadow-overlay p-4 space-y-3 text-xs"
    >
      {/* Header with Layer Group, Title & Close Button */}
      <div className="flex items-start justify-between gap-2 border-b border-rule-subtle pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-xs font-semibold text-accent">
              {feature.layerGroupTitle}
            </span>
          </div>
          <h3 className="text-base font-semibold text-ink leading-snug break-words">
            {feature.title}
          </h3>
          <div className="text-xs text-ink-2 mt-0.5">{feature.subtitle}</div>
        </div>
        <button
          type="button"
          aria-label="Close feature inspector"
          onClick={onClose}
          className="p-1.5 text-xs bg-paper border border-rule-subtle rounded-sm text-ink-2 hover:text-ink hover:bg-subtle transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Provenance & Epistemic Classification Badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        {feature.sourceClass && <LayerSourceBadge source={feature.sourceClass} />}
        <QualityTag
          kind={feature.qualityKind ?? (isProposed ? 'ASSUMED' : 'ESTIMATED')}
          label={friendlyProvenance}
        />
        {isProposed && (
          <Badge variant="warn" size="sm" dashed>
            Preliminary Plan (Not Built)
          </Badge>
        )}
        {!isProposed &&
          feature.layerGroupTitle.includes('Layer A') &&
          feature.provenanceBadge !== 'USER_ASSUMED' && (
            <Badge variant="primary" size="sm">
              Mapped Existing Grid
            </Badge>
          )}
        {feature.provenanceBadge === 'USER_ASSUMED' && (
          <Badge variant="warn" size="sm" dashed>
            Assumed Connection Point
          </Badge>
        )}
        <HelpTooltip glossaryKey="dataSourceProvenance" label="About this data source" />
      </div>

      {/* Infrastructure Symbology & Voltage Swatch (when inspecting Layer A / Layer F) */}
      {feature.infraSpec && (
        <div className="px-3 py-2 bg-paper/80 border border-rule-subtle rounded-md flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-2 font-semibold text-ink">
            {feature.infraSpec.geometryKind === 'LINE' ? (
              <span
                className="w-5 h-0 inline-block shrink-0"
                style={{
                  borderBottomWidth: `${Math.max(2, Math.round(feature.infraSpec.lineWidthPx ?? 3))}px`,
                  borderBottomStyle: feature.infraSpec.dashArray ? 'dashed' : 'solid',
                  borderBottomColor: feature.infraSpec.color,
                }}
              />
            ) : (
              <span
                className="w-3.5 h-3.5 rounded-full inline-block shrink-0"
                style={{
                  backgroundColor: feature.infraSpec.color,
                  border: `2px solid ${feature.infraSpec.strokeColor ?? '#FFFFFF'}`,
                }}
              />
            )}
            <span>{feature.infraSpec.shortLabel}</span>
          </span>
          <span className="font-mono tabular-nums text-ink-2">
            {feature.infraSpec.voltageLabel}
          </span>
        </div>
      )}

      {/* Settlement 2-Axis Proxy Classification Badge if inspecting a settlement cluster */}
      {feature.proxyClass && (
        <div className="pt-0.5 flex flex-wrap items-center gap-1.5">
          <ClassificationBadge
            proxyClass={feature.proxyClass}
            verificationState={feature.verificationState ?? 'UNVERIFIED'}
          />
          <HelpTooltip glossaryKey="proxyClassification" label="What this satellite tag means" />
        </div>
      )}

      {/* Structured Engineering & Demographic Attributes Table */}
      <div className="grid grid-cols-2 gap-2.5 bg-paper/80 p-3 rounded-md border border-rule-subtle text-xs">
        {feature.attributes.map((attr) => (
          <div key={attr.label} className="min-w-0">
            <div className="text-xs text-ink-3 font-medium truncate" title={attr.label}>
              {attr.label}
            </div>
            <div className="font-semibold text-ink tabular-nums break-words">
              {attr.value}
            </div>
          </div>
        ))}
        {feature.coordinates && (
          <div className="col-span-2 pt-2 border-t border-rule-subtle flex items-center justify-between text-xs text-ink-2">
            <span>Map Coordinates (Lat/Lon)</span>
            <span className="font-mono tabular-nums font-semibold text-ink">
              {feature.coordinates[0].toFixed(5)}°E, {feature.coordinates[1].toFixed(5)}°N
            </span>
          </div>
        )}
      </div>

      {/* Plain-English Contextual Explanation */}
      <div className="p-3 bg-subtle/60 border border-rule-subtle rounded-md text-xs text-ink-2 leading-relaxed flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <strong className="text-ink">What this means:</strong>{' '}
          {feature.beginnerExplanation}
        </div>
      </div>

      {/* Mandatory Epistemic Caveat Callout */}
      <div className="p-3 bg-warn-tint border border-warn/25 rounded-md text-xs text-warn font-medium leading-relaxed flex items-start gap-2">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <strong>Data Accuracy &amp; Provenance ({friendlyProvenance}):</strong>{' '}
          {feature.epistemicCaveat}
        </div>
      </div>

      {/* Quick Actions Footer */}
      {(feature.coordinates || feature.clusterId) && (
        <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-rule-subtle">
          {feature.coordinates && onFlyToFeature && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                onFlyToFeature(feature.coordinates![0], feature.coordinates![1], 15.2)
              }
            >
              <Crosshair className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              Zoom to Feature
            </Button>
          )}
          {feature.clusterId && onSelectClusterInWorkbench && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSelectClusterInWorkbench(feature.clusterId!)}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              Active in Workbench
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function formatQuickJumpLabel(loc: SearchableLocationItem): string {
  if (loc.id === 'sub-nandapur') return 'Inspect: SS Nandapur 33/11kV';
  if (loc.id.startsWith('cl-')) {
    const code = loc.id.toUpperCase();
    const parts = loc.label.split('·');
    const shortName = (parts[1] ?? loc.label).split('(')[0]?.trim() ?? loc.label;
    return `Inspect: ${code} ${shortName}`;
  }
  if (loc.id.startsWith('vil-')) {
    const shortVillage = loc.label.split('Revenue')[0]?.split('PVTG')[0]?.trim() ?? loc.label;
    return `Inspect: Village ${shortVillage}`;
  }
  return `Inspect: ${loc.label.split('(')[0]?.trim() ?? loc.label}`;
}

/**
 * Builds an InspectedFeatureState from raw GeoJSON properties without inventing
 * any missing values (zero fabricated fallbacks).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function buildInspectedFeatureFromMapProperties(
  layerId: string,
  props: Record<string, unknown>,
  coordinates: [number, number],
  hasProjectData = false,
): InspectedFeatureState {
  if (
    layerId === 'clusters-centroid-circle' ||
    layerId === 'clusters-hull-fill' ||
    layerId === 'ref-cluster-circles' ||
    layerId === 'viirs-radiance-glow-outer'
  ) {
    const proxyClass = (props.proxy_class ?? 'UNKNOWN') as ProxyElectrificationClass;
    const verificationState = (props.verification_state ??
      'UNVERIFIED') as VerificationState;
    const bldgs = props.building_count ?? props.n_detected;
    const estHh = props.estimated_households ?? props.est_households;
    const rad2024 = props.viirs_radiance_2024_nw ?? props.mean_radiance;
    const rad2023 = props.viirs_radiance_2023_nw;
    const rad2022 = props.viirs_radiance_2022_nw;
    const rad2020 = props.viirs_radiance_2020_nw;
    const dist11kv = props.distance_to_11kv_m;
    const terrainDist = props.terrain_effective_dist_m;
    const estPop = props.estimated_population;
    const stShare = props.st_share_pct;

    const multiYearParts: string[] = [];
    if (rad2020 !== undefined && rad2020 !== null) multiYearParts.push(`2020: ${String(rad2020)}`);
    if (rad2022 !== undefined && rad2022 !== null) multiYearParts.push(`2022: ${String(rad2022)}`);
    if (rad2023 !== undefined && rad2023 !== null) multiYearParts.push(`2023: ${String(rad2023)}`);
    if (rad2024 !== undefined && rad2024 !== null) multiYearParts.push(`2024: ${String(rad2024)}`);
    const multiYearTrend =
      multiYearParts.length > 1
        ? `${multiYearParts.join(' → ')} nW/cm²/sr`
        : rad2024 !== undefined && rad2024 !== null
          ? `${String(rad2024)} nW/cm²/sr`
          : 'Not recorded in source';

    const isViirsLayerClick = layerId === 'viirs-radiance-glow-outer';

    return {
      layerGroupTitle: isViirsLayerClick
        ? 'Layer B · NASA VIIRS Nighttime Illumination & Radiance Series'
        : 'Layer D · Settlement & Habitation Assessment',
      title: `${String(props.cluster_code ?? props.label ?? 'Cluster')} — ${String(props.name ?? 'Habitation')}`,
      subtitle: `${formatVerificationStateLabel(verificationState)} · Satellite Estimate`,
      provenanceBadge: isViirsLayerClick
        ? 'VIIRS DNB VNL v2.2 (~500 m)'
        : 'VIIRS DNB + Footprint DBSCAN',
      sourceClass: hasProjectData ? 'PROJECT' : 'REFERENCE_DEMO',
      qualityKind: verificationState !== 'UNVERIFIED' ? 'VERIFIED' : 'ESTIMATED',
      proxyClass,
      verificationState,
      coordinates,
      clusterId: props.id ? String(props.id) : undefined,
      beginnerExplanation: isViirsLayerClick
        ? 'NASA / NOAA Suomi NPP VIIRS Day/Night Band measures upward outdoor radiance at ~01:30 AM local time (~500 m resolution). Bright halos indicate consistent outdoor/street lighting; low values (<0.2 nW/cm²/sr) indicate near-background nighttime emission but NEVER prove absence of indoor electricity meters or solar home systems.'
        : 'A habitation cluster groups nearby detected building footprints (within 100 m in UTM coordinates) to estimate household electricity demand and check whether existing grid lines reach the community.',
      epistemicCaveat: String(
        props.evidence_summary ??
          'Satellite proxy classification only; requires Gram Sabha or DISCOM feeder verification.',
      ),
      attributes: [
        {
          label: 'Detected Structures',
          value: bldgs !== undefined && bldgs !== null ? `${String(bldgs)} footprints` : 'Not recorded in source',
        },
        {
          label: 'Estimated Households',
          value: estHh !== undefined && estHh !== null ? `${String(estHh)} HH` : 'Not recorded in source',
        },
        {
          label: 'Population & ST Share',
          value:
            estPop !== undefined && estPop !== null
              ? `${String(estPop)} pop${stShare !== undefined ? ` (${String(stShare)}% ST)` : ''}`
              : stShare !== undefined && stShare !== null
                ? `ST Share: ${String(stShare)}%`
                : 'Not recorded in source',
        },
        {
          label: '2024 VIIRS Radiance',
          value:
            rad2024 !== undefined && rad2024 !== null
              ? `${String(rad2024)} nW/cm²/sr`
              : 'Not recorded in source',
        },
        {
          label: '2020 Baseline Radiance',
          value:
            rad2020 !== undefined && rad2020 !== null
              ? `${String(rad2020)} nW/cm²/sr`
              : 'Not recorded in source',
        },
        {
          label: 'Multi-Year VIIRS Trend',
          value: multiYearTrend,
        },
        {
          label: '11 kV Grid Distance',
          value:
            dist11kv !== undefined && dist11kv !== null
              ? `${String(dist11kv)} m${terrainDist !== undefined ? ` (${String(terrainDist)} m terrain)` : ''}`
              : 'Not recorded in source',
        },
        {
          label: 'Preliminary Modality',
          value: props.preliminary_mode
            ? formatModalityLabel(String(props.preliminary_mode))
            : 'Pending Gap Evaluation',
        },
      ],
    };
  }

  if (
    layerId === 'ref-buildings-fill' ||
    layerId === 'buildings-mvt-fill' ||
    layerId === 'project-buildings-fill'
  ) {
    const areaVal =
      props.area_m2 !== undefined && props.area_m2 !== null
        ? Number(props.area_m2)
        : null;
    const isExcluded = Boolean(props.is_excluded ?? props.excluded);
    const sizeClass = props.size_class
      ? String(props.size_class)
      : areaVal !== null
        ? areaVal < 20
          ? 'Small Outbuilding (<20 m² · Excluded from HH Count)'
          : areaVal > 180
            ? 'Large / Institutional Footprint (>180 m²)'
            : 'Residential-Scale Footprint (20–180 m²)'
        : 'Mapped Building Structure Footprint';
    const clusterRef = props.cluster_code ?? props.cluster_label;

    return {
      layerGroupTitle: 'Layer D · Building Structure Footprint',
      title: String(props.name ?? props.building_id ?? props.id ?? 'Building Structure'),
      subtitle: `Source: ${String(props.source ?? props.provenance ?? 'Open Buildings / Vector Tile')}`,
      provenanceBadge: 'BUILDING_FOOTPRINT_PROXY',
      sourceClass: hasProjectData ? 'PROJECT' : 'REFERENCE_DEMO',
      qualityKind: 'ESTIMATED',
      coordinates,
      clusterId: props.cluster_id ? String(props.cluster_id) : undefined,
      beginnerExplanation:
        'Individual building rooftop polygon detected from satellite optical imagery. Footprints between 20 m² and 180 m² feed DBSCAN habitation clustering to estimate household demand.',
      epistemicCaveat:
        'Satellite rooftop footprints indicate physical structures only. They cannot reveal interior electricity meters, occupancy, or supply reliability without ground verification.',
      attributes: [
        {
          label: 'Footprint Area',
          value:
            areaVal !== null && !Number.isNaN(areaVal)
              ? `${areaVal.toFixed(1)} m²`
              : 'Vector tile geometry (attribute omitted in MVT)',
        },
        {
          label: 'Size Classification',
          value: sizeClass,
        },
        {
          label: 'Cluster Assignment',
          value: clusterRef ? String(clusterRef) : 'Pending / Unassigned',
        },
        {
          label: 'Clustering Filter',
          value: isExcluded ? 'Excluded (Non-HH / <20 m²)' : 'Included in Habitation Demand',
        },
      ],
    };
  }

  if (layerId.startsWith('layer-a-')) {
    const rawCat = String(props.infra_category ?? props.asset_type ?? 'GRID_ASSET');
    const prov = String(props.provenance ?? 'OSM_MAPPED');
    const vKv =
      typeof props.voltage_kv === 'number'
        ? props.voltage_kv
        : props.voltage_kv !== undefined
          ? Number(props.voltage_kv)
          : undefined;
    const spec = resolveInfraCategoryMeta(rawCat, prov, vKv);

    return {
      layerGroupTitle: 'Layer A · Mapped Electricity Infrastructure',
      title: String(props.name ?? spec.label),
      subtitle: `${spec.shortLabel} (${spec.voltageLabel})`,
      provenanceBadge: prov,
      sourceClass:
        prov === 'USER_ASSUMED' || Boolean(props.asset_type)
          ? 'PROJECT'
          : 'REFERENCE_DEMO',
      qualityKind:
        prov === 'USER_ASSUMED'
          ? 'ASSUMED'
          : prov === 'UTILITY_RECORD' || prov === 'FIELD_SURVEY'
            ? 'VERIFIED'
            : 'ESTIMATED',
      infraSpec: spec,
      coordinates,
      beginnerExplanation: spec.description,
      epistemicCaveat: String(
        props.epistemic_note ??
          'Missing infrastructure in OpenStreetMap must never be interpreted as proof that infrastructure does not exist on the ground.',
      ),
      attributes: [
        {
          label: 'Nominal Voltage',
          value:
            vKv !== undefined && !Number.isNaN(vKv)
              ? rawCat === 'SUBSTATION' && vKv === 33
                ? '33/11 kV'
                : `${String(vKv)} kV`
              : 'Not recorded in source',
        },
        {
          label: 'Installed Capacity / Rating',
          value:
            props.rating_kva !== undefined && props.rating_kva !== null
              ? Number(props.rating_kva) >= 1000
                ? `${String(props.rating_kva)} kVA (${(Number(props.rating_kva) / 1000).toFixed(2)} MVA)`
                : `${String(props.rating_kva)} kVA`
              : 'Linear / Support Structure',
        },
        {
          label: 'Conductor / Structure Spec',
          value: props.conductor
            ? String(props.conductor)
            : 'Not recorded in source',
        },
        {
          label: 'Operator / Source Note',
          value:
            props.operator || props.source_note
              ? String(props.operator ?? props.source_note)
              : 'Not recorded in source',
        },
      ],
    };
  }

  if (layerId.startsWith('network-') || layerId.startsWith('ref-routes')) {
    const rawType = String(props.layer_type ?? 'HT_11KV_PROPOSED');
    const spec = resolveInfraCategoryMeta(rawType, 'PROPOSED_PRELIMINARY');
    const vKv = props.voltage_kv;
    const lenKm = props.length_km;
    const lenM = props.length_m;

    return {
      layerGroupTitle: 'Layer F · Proposed Electricity Network Extension',
      title: String(props.name ?? props.target_name ?? spec.label),
      subtitle: `${spec.shortLabel} · Preliminary Plan (Not Built)`,
      provenanceBadge: 'PROPOSED_PRELIMINARY',
      sourceClass: hasProjectData ? 'PROJECT' : 'REFERENCE_DEMO',
      qualityKind: 'ASSUMED',
      infraSpec: spec,
      coordinates,
      beginnerExplanation: spec.description,
      epistemicCaveat: String(
        props.engineering_disclaimer ??
          'NOT INSTALLED INFRASTRUCTURE. Preliminary engineering estimate requiring field peg-marking and DISCOM load-flow study.',
      ),
      attributes: [
        {
          label: 'Design Voltage',
          value:
            vKv !== undefined && vKv !== null
              ? Number(vKv) < 1
                ? `${Math.round(Number(vKv) * 1000)} V (${String(vKv)} kV)`
                : `${String(vKv)} kV`
              : spec.voltageLabel,
        },
        {
          label: 'Route Length / Span',
          value:
            lenKm !== undefined && lenKm !== null
              ? `${String(lenKm)} km${lenM !== undefined ? ` (${String(lenM)} m)` : ''}`
              : 'Point Asset (DT / Mini-Grid)',
        },
        {
          label: 'Conductor / Rating Spec',
          value: props.conductor
            ? String(props.conductor)
            : props.rating_kva !== undefined && props.rating_kva !== null
              ? `${String(props.rating_kva)} kVA`
              : 'Not recorded in source',
        },
        {
          label: 'Terrain / Voltage Check',
          value:
            props.mean_slope_deg !== undefined
              ? `Mean Slope: ${String(props.mean_slope_deg)}°`
              : props.estimated_voltage_drop_pct !== undefined
                ? `Est. V-Drop: ${String(props.estimated_voltage_drop_pct)}%`
                : props.target_cluster
                  ? `Target: ${String(props.target_cluster)}`
                  : 'Preliminary Layout',
        },
      ],
    };
  }

  if (layerId === 'gap-corridors-line') {
    return {
      layerGroupTitle: 'Layer E · Potential Electrification Gap Corridor',
      title: String(props.gap_code ?? 'Unserved / Underserved Gap Corridor'),
      subtitle:
        props.gap_severity === 'HIGH_PRIORITY_GAP' ||
        props.gap_severity === 'CRITICAL_GAP'
          ? 'High Priority Field Check'
          : 'Preliminary Investigation Corridor',
      provenanceBadge: String(props.estimation_type ?? 'MODEL_ESTIMATED_GAP'),
      sourceClass: hasProjectData ? 'PROJECT' : 'REFERENCE_DEMO',
      qualityKind: 'ESTIMATED',
      coordinates,
      beginnerExplanation:
        'A Potential Electrification Gap highlights a settlement where multiple indicators (distance from existing 11 kV lines, Census supply history, and low nighttime light) suggest households may lack reliable grid power.',
      epistemicCaveat:
        'Model-estimated investigation corridor. Dark satellite pixels are never automatically classified as unelectrified without field survey confirmation.',
      attributes: [
        {
          label: 'Target Habitation',
          value: props.target_cluster
            ? `${String(props.target_cluster)}${props.affected_households_est !== undefined ? ` (${String(props.affected_households_est)} Est. HH)` : ''}`
            : 'Not recorded in source',
        },
        {
          label: 'Straight-Line Distance',
          value:
            props.straight_line_dist_m !== undefined
              ? `${String(props.straight_line_dist_m)} m`
              : 'Not recorded in source',
        },
        {
          label: 'Terrain-Weighted Distance',
          value:
            props.terrain_weighted_dist_m !== undefined
              ? `${String(props.terrain_weighted_dist_m)} m`
              : 'Not recorded in source',
        },
        {
          label: 'Recommended Action',
          value: props.recommended_action
            ? String(props.recommended_action)
            : 'Field survey verification',
        },
      ],
    };
  }

  // Default: Layer C · Village Electrification & Census Profile
  const totalPop = props.total_pop !== undefined ? Number(props.total_pop) : null;
  const stPop = props.st_pop !== undefined ? Number(props.st_pop) : null;
  const stPct =
    totalPop && totalPop > 0 && stPop !== null
      ? ` (${((stPop / totalPop) * 100).toFixed(1)}% ST)`
      : '';

  return {
    layerGroupTitle: 'Layer C · Village Electrification & Census Profile',
    title: props.village_name
      ? `Village ${String(props.village_name)} (LGD ${String(props.lgd_code ?? 'Unspecified')})`
      : 'Revenue Village Boundary',
    subtitle: String(
      props.status_label ?? props.electrification_status ?? 'Census 2011 DCHB Profile',
    ),
    provenanceBadge: 'CENSUS 2011 DCHB + LGD',
    sourceClass: 'REFERENCE_DEMO',
    qualityKind: 'ESTIMATED',
    coordinates,
    beginnerExplanation:
      'Displays official revenue village boundaries, Census 2011 demographics, Scheduled Tribe (ST) population share, and historical power supply availability hours.',
    epistemicCaveat: String(
      props.missing_data_notice ??
        'Post-2011 household-level connection progress requires verified DISCOM billing ledgers.',
    ),
    attributes: [
      {
        label: 'Census 2011 Population',
        value:
          totalPop !== null
            ? `${String(totalPop)} (ST: ${String(stPop ?? 'N/A')}${stPct})`
            : 'Not recorded in source',
      },
      {
        label: 'Census 2011 Households',
        value:
          props.households_2011 !== undefined
            ? `${String(props.households_2011)} HH`
            : 'Not recorded in source',
      },
      {
        label: '2026 Detected Footprints',
        value:
          props.detected_footprints_2026 !== undefined
            ? `${String(props.detected_footprints_2026)} structures${props.estimated_households_2026 !== undefined ? ` (~${String(props.estimated_households_2026)} HH)` : ''}`
            : 'Not recorded in source',
      },
      {
        label: 'Census 2011 Power Supply',
        value:
          props.summer_supply_hrs_2011 !== undefined
            ? `Summer: ${String(props.summer_supply_hrs_2011)} hrs/day · Winter: ${String(props.winter_supply_hrs_2011 ?? 0)} hrs/day`
            : 'Not recorded in source',
      },
      {
        label: 'Power Sector Use (2011)',
        value:
          props.domestic_power_2011 !== undefined
            ? `Domestic: ${props.domestic_power_2011 ? 'Yes' : 'No'} · Agri: ${props.agricultural_power_2011 ? 'Yes' : 'No'}`
            : 'Not recorded in source',
      },
      {
        label: 'Proxy HH Split (2026)',
        value:
          props.reported_electrified_hh_proxy !== undefined
            ? `${String(props.reported_electrified_hh_proxy)} Electrified · ${String(props.reported_underserved_or_unserved_hh_proxy ?? 0)} Gap Proxy`
            : 'Not recorded in source',
      },
    ],
  };
}

/**
 * Resolves a SearchableLocationItem into a full InspectedFeatureState using genuine
 * properties from the underlying GIS feature collections.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function buildInspectedFeatureFromSearchItem(
  loc: SearchableLocationItem,
): InspectedFeatureState {
  if (loc.category === 'SUBSTATION') {
    const match = DEFAULT_EXISTING_POWER_INFRA_FC.features.find(
      (f) =>
        f.properties?.id === loc.id ||
        f.properties?.infra_category === 'SUBSTATION',
    );
    return buildInspectedFeatureFromMapProperties(
      'layer-a-substations',
      (match?.properties ?? { name: loc.label, infra_category: 'SUBSTATION' }) as Record<
        string,
        unknown
      >,
      [loc.lon, loc.lat],
      false,
    );
  }

  if (loc.category === 'SETTLEMENT' || loc.category === 'GAP_ZONE') {
    const match = DEFAULT_SETTLEMENTS_FC.features.find(
      (f) =>
        f.properties?.id === loc.id ||
        f.properties?.id === `cluster-${loc.id}` ||
        String(f.properties?.cluster_code ?? '').toLowerCase() ===
          loc.id.toLowerCase(),
    );
    const props = (match?.properties ?? {
      id: loc.id,
      cluster_code: loc.id.toUpperCase(),
      name: loc.label,
      proxy_class:
        loc.category === 'GAP_ZONE' ? 'POTENTIALLY_UNSERVED' : 'LIKELY_ELECTRIFIED',
    }) as Record<string, unknown>;
    return buildInspectedFeatureFromMapProperties(
      'clusters-centroid-circle',
      props,
      [loc.lon, loc.lat],
      false,
    );
  }

  // Default: VILLAGE
  const match = DEFAULT_VILLAGE_ELECTRIFICATION_FC.features.find(
    (f) =>
      f.properties?.id === loc.id ||
      (f.properties?.village_name &&
        loc.label
          .toLowerCase()
          .includes(String(f.properties.village_name).toLowerCase())),
  );
  const props = (match?.properties ?? {
    village_name: loc.label,
    status_label: loc.summary,
  }) as Record<string, unknown>;
  return buildInspectedFeatureFromMapProperties(
    'village-status-fill',
    props,
    [loc.lon, loc.lat],
    false,
  );
}
