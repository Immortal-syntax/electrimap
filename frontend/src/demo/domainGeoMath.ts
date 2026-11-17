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

/**
 * Pure client-side geospatial, metric UTM projection, DBSCAN clustering,
 * two-axis proxy classification, gap analysis, and SHA-256 math.
 *
 * Adheres to AGENTS.md Domain Purity & Explicit Units standards.
 */

import type {
  CensusReconciliationDto,
  ClusterDto,
} from '../components/workspace/SettlementAssessmentPanel';
import type {
  ClusterGapAnalysisDto,
  InfrastructureAssetDto,
  ProjectGapAnalysisDto,
} from '../components/workspace/InfrastructureAndDemandPanel';
import type {
  ProxyElectrificationClass,
  VerificationState,
} from '../components/ui/Badge';
import type { ReferenceCensusInfo } from './referenceData/referenceCatalog';

export interface UtmPoint {
  x_m: number;
  y_m: number;
}

export interface BuildingInputItem {
  id: string;
  lon: number;
  lat: number;
  area_m2: number;
  size_class: 'RESIDENTIAL' | 'NON_RESIDENTIAL' | 'OUTBUILDING';
  confidence: number;
  hamlet_hint?: string;
  lightscore_override?: number;
  geometry: GeoJSON.Polygon;
}

// ---------------------------------------------------------------------------
// Deterministic Synchronous SHA-256 Digest (FIPS 180-4)
// ---------------------------------------------------------------------------

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

export function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = [
      h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!,
    ];
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + SHA256_K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0;
    h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0;
    h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0;
    h[5] = (h[5]! + f) >>> 0;
    h[6] = (h[6]! + g) >>> 0;
    h[7] = (h[7]! + hh) >>> 0;
  }

  return Array.from(h)
    .map((val) => val.toString(16).padStart(8, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// WGS84 <-> Transverse Mercator UTM Projection & Metric Geometry Helpers
// ---------------------------------------------------------------------------

const WGS84_A = 6378137.0;
const WGS84_E2 = 0.00669437999014;
const UTM_K0 = 0.9996;

export function selectUtmEpsgFromLonLat(lonDeg: number, latDeg: number): number {
  const zone = Math.max(1, Math.min(60, Math.floor((lonDeg + 180.0) / 6.0) + 1));
  return (latDeg >= 0 ? 32600 : 32700) + zone;
}

function resolveZoneCentralMeridianDeg(metricEpsg: number): { lon0Deg: number; isSouth: boolean } {
  const isSouth = metricEpsg >= 32700 && metricEpsg <= 32760;
  const zone = isSouth ? metricEpsg - 32700 : metricEpsg - 32600;
  const safeZone = Number.isFinite(zone) && zone >= 1 && zone <= 60 ? zone : 44;
  return { lon0Deg: (safeZone - 1) * 6 - 180 + 3, isSouth };
}

export function wgs84ToUtm(lonDeg: number, latDeg: number, metricEpsg = 32644): UtmPoint {
  const { lon0Deg, isSouth } = resolveZoneCentralMeridianDeg(metricEpsg);
  const phi = (latDeg * Math.PI) / 180.0;
  const lam = (lonDeg * Math.PI) / 180.0;
  const lam0 = (lon0Deg * Math.PI) / 180.0;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const ep2 = WGS84_E2 / (1.0 - WGS84_E2);

  const N = WGS84_A / Math.sqrt(1.0 - WGS84_E2 * sinPhi * sinPhi);
  const T = tanPhi * tanPhi;
  const C = ep2 * cosPhi * cosPhi;
  const A = cosPhi * (lam - lam0);

  const e4 = WGS84_E2 * WGS84_E2;
  const e6 = e4 * WGS84_E2;
  const M =
    WGS84_A *
    ((1 - WGS84_E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * WGS84_E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi));

  const x_m =
    500000.0 +
    UTM_K0 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120);
  const y_m =
    (isSouth ? 10000000.0 : 0.0) +
    UTM_K0 *
      (M +
        N *
          tanPhi *
          ((A * A) / 2 +
            ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720));

  return { x_m, y_m };
}

export function utmToWgs84(x_m: number, y_m: number, metricEpsg = 32644): [number, number] {
  const { lon0Deg, isSouth } = resolveZoneCentralMeridianDeg(metricEpsg);
  const e1 = (1 - Math.sqrt(1 - WGS84_E2)) / (1 + Math.sqrt(1 - WGS84_E2));
  const x = x_m - 500000.0;
  const y = isSouth ? y_m - 10000000.0 : y_m;
  const M = y / UTM_K0;
  const mu =
    M /
    (WGS84_A *
      (1 -
        WGS84_E2 / 4 -
        (3 * WGS84_E2 * WGS84_E2) / 64 -
        (5 * WGS84_E2 * WGS84_E2 * WGS84_E2) / 256));

  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const ep2 = WGS84_E2 / (1 - WGS84_E2);
  const C1 = ep2 * cos1 * cos1;
  const T1 = tan1 * tan1;
  const N1 = WGS84_A / Math.sqrt(1 - WGS84_E2 * sin1 * sin1);
  const R1 = (WGS84_A * (1 - WGS84_E2)) / Math.pow(1 - WGS84_E2 * sin1 * sin1, 1.5);
  const D = x / (N1 * UTM_K0);

  const latRad =
    phi1 -
    ((N1 * tan1) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720);
  const lonRad =
    (lon0Deg * Math.PI) / 180.0 +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) /
      cos1;

  return [
    Number(((lonRad * 180.0) / Math.PI).toFixed(6)),
    Number(((latRad * 180.0) / Math.PI).toFixed(6)),
  ];
}

export function extractGeometryCoords(geom: GeoJSON.Geometry): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const visit = (g: GeoJSON.Geometry) => {
    if (g.type === 'Point') {
      pts.push([g.coordinates[0] ?? 0, g.coordinates[1] ?? 0]);
    } else if (g.type === 'MultiPoint' || g.type === 'LineString') {
      for (const c of g.coordinates) pts.push([c[0] ?? 0, c[1] ?? 0]);
    } else if (g.type === 'MultiLineString' || g.type === 'Polygon') {
      for (const ring of g.coordinates) {
        for (const c of ring) pts.push([c[0] ?? 0, c[1] ?? 0]);
      }
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) {
        for (const ring of poly) {
          for (const c of ring) pts.push([c[0] ?? 0, c[1] ?? 0]);
        }
      }
    } else if (g.type === 'GeometryCollection') {
      for (const child of g.geometries) visit(child);
    }
  };
  visit(geom);
  return pts;
}

export function computeGeometryCentroidAndBbox(geom: GeoJSON.Geometry): {
  centroidLon: number;
  centroidLat: number;
  bbox: [number, number, number, number];
} {
  const pts = extractGeometryCoords(geom);
  if (pts.length === 0) {
    return { centroidLon: 82.73, centroidLat: 18.565, bbox: [82.695, 18.535, 82.765, 18.595] };
  }
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of pts) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
    sumLon += lon;
    sumLat += lat;
  }
  return {
    centroidLon: sumLon / pts.length,
    centroidLat: sumLat / pts.length,
    bbox: [minLon, minLat, maxLon, maxLat],
  };
}

export function selectMetricEpsgForGeometry(geom: GeoJSON.Geometry): number {
  const { centroidLon, centroidLat } = computeGeometryCentroidAndBbox(geom);
  return selectUtmEpsgFromLonLat(centroidLon, centroidLat);
}

function ringSignedAreaM2(ring: number[][], metricEpsg: number): number {
  if (ring.length < 3) return 0;
  const pts = ring.map((c) => wgs84ToUtm(c[0] ?? 0, c[1] ?? 0, metricEpsg));
  let area2 = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    area2 += a.x_m * b.y_m - b.x_m * a.y_m;
  }
  return area2 * 0.5;
}

export function computePolygonAreaM2(poly: GeoJSON.Polygon, metricEpsg?: number): number {
  const epsg = metricEpsg ?? selectMetricEpsgForGeometry(poly);
  const outer = poly.coordinates[0] ?? [];
  let area = Math.abs(ringSignedAreaM2(outer, epsg));
  for (let i = 1; i < poly.coordinates.length; i += 1) {
    area -= Math.abs(ringSignedAreaM2(poly.coordinates[i]!, epsg));
  }
  return Math.max(0, area);
}

export function computeGeometryAreaKm2(geom: GeoJSON.Geometry, metricEpsg?: number): number {
  const epsg = metricEpsg ?? selectMetricEpsgForGeometry(geom);
  if (geom.type === 'Polygon') {
    return Number((computePolygonAreaM2(geom, epsg) / 1_000_000).toFixed(4));
  }
  if (geom.type === 'MultiPolygon') {
    let totalM2 = 0;
    for (const rings of geom.coordinates) {
      totalM2 += computePolygonAreaM2({ type: 'Polygon', coordinates: rings }, epsg);
    }
    return Number((totalM2 / 1_000_000).toFixed(4));
  }
  return 0;
}

export function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0] ?? 0;
    const yi = ring[i]?.[1] ?? 0;
    const xj = ring[j]?.[0] ?? 0;
    const yj = ring[j]?.[1] ?? 0;
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-15) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(lon: number, lat: number, geom: GeoJSON.Geometry): boolean {
  if (geom.type === 'Polygon') {
    const outer = geom.coordinates[0] ?? [];
    if (!pointInRing(lon, lat, outer)) return false;
    for (let i = 1; i < geom.coordinates.length; i += 1) {
      if (pointInRing(lon, lat, geom.coordinates[i]!)) return false;
    }
    return true;
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.some((rings) =>
      pointInGeometry(lon, lat, { type: 'Polygon', coordinates: rings }),
    );
  }
  return false;
}

export function computeMetricDistanceM(
  a: [number, number],
  b: [number, number],
  metricEpsg = 32644,
): number {
  const pa = wgs84ToUtm(a[0], a[1], metricEpsg);
  const pb = wgs84ToUtm(b[0], b[1], metricEpsg);
  return Math.hypot(pb.x_m - pa.x_m, pb.y_m - pa.y_m);
}

function pointToSegmentDistM(
  p: UtmPoint,
  a: UtmPoint,
  b: UtmPoint,
): { distM: number; nearest: UtmPoint } {
  const dx = b.x_m - a.x_m;
  const dy = b.y_m - a.y_m;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) {
    return { distM: Math.hypot(p.x_m - a.x_m, p.y_m - a.y_m), nearest: a };
  }
  const t = Math.max(0, Math.min(1, ((p.x_m - a.x_m) * dx + (p.y_m - a.y_m) * dy) / len2));
  const proj = { x_m: a.x_m + t * dx, y_m: a.y_m + t * dy };
  return { distM: Math.hypot(p.x_m - proj.x_m, p.y_m - proj.y_m), nearest: proj };
}

export function nearestPointOnGeometryM(
  ptWgs84: [number, number],
  geom: GeoJSON.Geometry,
  metricEpsg: number,
): { distM: number; lon: number; lat: number } {
  const pUtm = wgs84ToUtm(ptWgs84[0], ptWgs84[1], metricEpsg);
  let bestDist = Infinity;
  let bestUtm: UtmPoint = pUtm;

  const checkPolyline = (coords: number[][]) => {
    for (let i = 0; i < coords.length - 1; i += 1) {
      const a = wgs84ToUtm(coords[i]![0] ?? 0, coords[i]![1] ?? 0, metricEpsg);
      const b = wgs84ToUtm(coords[i + 1]![0] ?? 0, coords[i + 1]![1] ?? 0, metricEpsg);
      const { distM, nearest } = pointToSegmentDistM(pUtm, a, b);
      if (distM < bestDist) {
        bestDist = distM;
        bestUtm = nearest;
      }
    }
  };

  if (geom.type === 'Point') {
    const gUtm = wgs84ToUtm(geom.coordinates[0] ?? 0, geom.coordinates[1] ?? 0, metricEpsg);
    bestDist = Math.hypot(pUtm.x_m - gUtm.x_m, pUtm.y_m - gUtm.y_m);
    bestUtm = gUtm;
  } else if (geom.type === 'LineString') {
    checkPolyline(geom.coordinates);
  } else if (geom.type === 'MultiLineString' || geom.type === 'Polygon') {
    for (const line of geom.coordinates) checkPolyline(line);
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      for (const ring of poly) checkPolyline(ring);
    }
  }

  const [lon, lat] = utmToWgs84(bestUtm.x_m, bestUtm.y_m, metricEpsg);
  return { distM: Number.isFinite(bestDist) ? bestDist : 0, lon, lat };
}

function segmentsIntersect(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
): boolean {
  const ccw = (p1: [number, number], p2: [number, number], p3: [number, number]) =>
    (p3[1] - p1[1]) * (p2[0] - p1[0]) > (p2[1] - p1[1]) * (p3[0] - p1[0]);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

export function lineCrossesWaterway(
  start: [number, number],
  end: [number, number],
  waterways: GeoJSON.Geometry[],
): number {
  let crossings = 0;
  for (const w of waterways) {
    const lines =
      w.type === 'LineString'
        ? [w.coordinates]
        : w.type === 'MultiLineString'
          ? w.coordinates
          : [];
    let hit = false;
    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i += 1) {
        const p1: [number, number] = [line[i]![0] ?? 0, line[i]![1] ?? 0];
        const p2: [number, number] = [line[i + 1]![0] ?? 0, line[i + 1]![1] ?? 0];
        if (segmentsIntersect(start, end, p1, p2)) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    if (hit) crossings += 1;
  }
  return crossings;
}

// ---------------------------------------------------------------------------
// Reference Buildings Normalization & Sample Footprint Synthesis
// ---------------------------------------------------------------------------

export function parseBuildingsFromFeatureCollection(
  fc: GeoJSON.FeatureCollection,
  metricEpsg = 32644,
): BuildingInputItem[] {
  const result: BuildingInputItem[] = [];
  let idx = 0;
  for (const feat of fc.features) {
    idx += 1;
    if (!feat.geometry || feat.geometry.type !== 'Polygon') continue;
    const poly = feat.geometry;
    const area_m2 = Math.max(12, computePolygonAreaM2(poly, metricEpsg));
    const { centroidLon, centroidLat } = computeGeometryCentroidAndBbox(poly);
    const props = (feat.properties ?? {}) as Record<string, unknown>;
    const rawClass = String(props.size_class ?? '').toUpperCase();
    const size_class: BuildingInputItem['size_class'] =
      rawClass === 'NON_RESIDENTIAL' || area_m2 > 220
        ? 'NON_RESIDENTIAL'
        : rawClass === 'OUTBUILDING' || area_m2 < 18
          ? 'OUTBUILDING'
          : 'RESIDENTIAL';
    result.push({
      id: String(props.source_feature_id ?? props.id ?? `BLD-${idx}`),
      lon: centroidLon,
      lat: centroidLat,
      area_m2: Number(area_m2.toFixed(1)),
      size_class,
      confidence: typeof props.confidence === 'number' ? props.confidence : 0.88,
      hamlet_hint: props.hamlet_hint ? String(props.hamlet_hint) : undefined,
      lightscore_override:
        typeof props.hrea_lightscore === 'number' ? props.hrea_lightscore : undefined,
      geometry: poly,
    });
  }
  return result;
}

export function buildDemoBuildingsInsidePolygon(
  aoiGeom: GeoJSON.Geometry,
  metricEpsg: number,
  seedName: string,
): GeoJSON.FeatureCollection {
  const { centroidLon, centroidLat, bbox } = computeGeometryCentroidAndBbox(aoiGeom);
  const hashSeed = sha256Hex(`${seedName}:${centroidLon.toFixed(4)}:${centroidLat.toFixed(4)}`);
  const spanLon = Math.max(0.008, bbox[2] - bbox[0]);
  const spanLat = Math.max(0.008, bbox[3] - bbox[1]);

  // Create 3 natural settlement pockets inside the AOI (+ 5 dispersed structures)
  const anchors: Array<{ cx: number; cy: number; count: number; label: string; nl: number }> = [
    {
      cx: centroidLon - spanLon * 0.16,
      cy: centroidLat - spanLat * 0.08,
      count: 26,
      label: `${seedName} Main Settlement`,
      nl: 0.78,
    },
    {
      cx: centroidLon + spanLon * 0.14,
      cy: centroidLat + spanLat * 0.06,
      count: 18,
      label: `${seedName} East Tola`,
      nl: 0.34,
    },
    {
      cx: centroidLon + spanLon * 0.18,
      cy: centroidLat + spanLat * 0.22,
      count: 14,
      label: `${seedName} Upland Hamlet`,
      nl: 0.06,
    },
  ];

  const features: GeoJSON.Feature[] = [];
  let seq = 1;
  anchors.forEach((anc, aIdx) => {
    for (let i = 0; i < anc.count; i += 1) {
      const hByte = parseInt(hashSeed.slice((i * 2 + aIdx * 4) % 58, (i * 2 + aIdx * 4) % 58 + 2), 16);
      const angle = ((i * 137.5 + hByte) % 360) * (Math.PI / 180);
      const radiusM = 18 + (i % 5) * 16 + (hByte % 15);
      const centerUtm = wgs84ToUtm(anc.cx, anc.cy, metricEpsg);
      const bUtm: UtmPoint = {
        x_m: centerUtm.x_m + radiusM * Math.cos(angle),
        y_m: centerUtm.y_m + radiusM * Math.sin(angle),
      };
      const [bLon, bLat] = utmToWgs84(bUtm.x_m, bUtm.y_m, metricEpsg);
      const finalLon = pointInGeometry(bLon, bLat, aoiGeom) ? bLon : centroidLon;
      const finalLat = pointInGeometry(bLon, bLat, aoiGeom) ? bLat : centroidLat;
      const dLon = 0.000035;
      const dLat = 0.000032;
      features.push({
        type: 'Feature',
        properties: {
          source_feature_id: `DEMO_BLD_${String(seq).padStart(4, '0')}`,
          confidence: 0.85,
          dataset_key: 'demo_sample_footprints',
          hamlet_hint: anc.label,
          hrea_lightscore: anc.nl,
          is_demo_sample: true,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [finalLon - dLon, finalLat - dLat],
              [finalLon + dLon, finalLat - dLat],
              [finalLon + dLon, finalLat + dLat],
              [finalLon - dLon, finalLat + dLat],
              [finalLon - dLon, finalLat - dLat],
            ],
          ],
        },
      });
      seq += 1;
    }
  });

  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// DBSCAN Clustering & Convex Hull + Two-Axis Classification
// ---------------------------------------------------------------------------

function convexHullUtm(points: UtmPoint[]): UtmPoint[] {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) =>
    a.x_m !== b.x_m ? a.x_m - b.x_m : a.y_m - b.y_m,
  );
  const cross = (o: UtmPoint, a: UtmPoint, b: UtmPoint) =>
    (a.x_m - o.x_m) * (b.y_m - o.y_m) - (a.y_m - o.y_m) * (b.x_m - o.x_m);
  const lower: UtmPoint[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: UtmPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function buildBufferedClusterPolygonWgs84(
  ptsUtm: UtmPoint[],
  metricEpsg: number,
  bufferM = 32,
): GeoJSON.Polygon {
  const hull = convexHullUtm(ptsUtm);
  const cx = hull.reduce((s, p) => s + p.x_m, 0) / Math.max(1, hull.length);
  const cy = hull.reduce((s, p) => s + p.y_m, 0) / Math.max(1, hull.length);
  if (hull.length < 3) {
    const ring: Array<[number, number]> = [];
    for (let i = 0; i < 16; i += 1) {
      const ang = (2 * Math.PI * i) / 16;
      ring.push(utmToWgs84(cx + bufferM * Math.cos(ang), cy + bufferM * Math.sin(ang), metricEpsg));
    }
    ring.push(ring[0]!);
    return { type: 'Polygon', coordinates: [ring] };
  }
  const expanded = hull.map((p) => {
    const dx = p.x_m - cx;
    const dy = p.y_m - cy;
    const d = Math.hypot(dx, dy) || 1;
    return utmToWgs84(p.x_m + (dx / d) * bufferM, p.y_m + (dy / d) * bufferM, metricEpsg);
  });
  expanded.push(expanded[0]!);
  return { type: 'Polygon', coordinates: [expanded] };
}

export interface ClusteringRunParams {
  eps_m: number;
  min_samples: number;
  household_alpha: number;
  nl_electrified_min: number;
  nl_unserved_max: number;
}

export function runClusteringAndClassification(params: {
  projectId: string;
  buildings: BuildingInputItem[];
  infraAssets: InfrastructureAssetDto[];
  roads: GeoJSON.Geometry[];
  clusterParams: ClusteringRunParams;
  metricEpsg: number;
  hasNightlights: boolean;
  isKoraputReference: boolean;
}): {
  clusterRunId: string;
  clusters: ClusterDto[];
  buildingCoordsByClusterId: Record<string, Array<[number, number]>>;
} {
  const {
    projectId,
    buildings,
    infraAssets,
    roads,
    clusterParams,
    metricEpsg,
    hasNightlights,
    isKoraputReference,
  } = params;
  const runId = `run-${sha256Hex(`${projectId}:${clusterParams.eps_m}:${clusterParams.min_samples}`).slice(0, 12)}`;
  const nowIso = new Date().toISOString();

  if (buildings.length === 0) {
    return { clusterRunId: runId, clusters: [], buildingCoordsByClusterId: {} };
  }

  const ptsUtm = buildings.map((b) => wgs84ToUtm(b.lon, b.lat, metricEpsg));
  const labels = new Array<number>(buildings.length).fill(-99); // -99 unvisited, -1 noise
  let currentCluster = 0;

  const regionQuery = (idx: number): number[] => {
    const p = ptsUtm[idx]!;
    const nbrs: number[] = [];
    for (let j = 0; j < ptsUtm.length; j += 1) {
      const q = ptsUtm[j]!;
      if (Math.hypot(q.x_m - p.x_m, q.y_m - p.y_m) <= clusterParams.eps_m) {
        nbrs.push(j);
      }
    }
    return nbrs;
  };

  for (let i = 0; i < buildings.length; i += 1) {
    if (labels[i] !== -99) continue;
    const neighbors = regionQuery(i);
    if (neighbors.length < clusterParams.min_samples) {
      labels[i] = -1;
      continue;
    }
    const cid = currentCluster;
    currentCluster += 1;
    labels[i] = cid;
    const queue = [...neighbors];
    let qPtr = 0;
    while (qPtr < queue.length) {
      const ptIdx = queue[qPtr++]!;
      if (labels[ptIdx] === -1) {
        labels[ptIdx] = cid;
      }
      if (labels[ptIdx] !== -99) continue;
      labels[ptIdx] = cid;
      const ptNbrs = regionQuery(ptIdx);
      if (ptNbrs.length >= clusterParams.min_samples) {
        for (const n of ptNbrs) {
          if (!queue.includes(n)) queue.push(n);
        }
      }
    }
  }

  const coreGroups = new Map<number, number[]>();
  const noiseIndices: number[] = [];
  labels.forEach((lbl, idx) => {
    if (lbl < 0) {
      noiseIndices.push(idx);
    } else {
      const arr = coreGroups.get(lbl) ?? [];
      arr.push(idx);
      coreGroups.set(lbl, arr);
    }
  });

  const sortedCore = Array.from(coreGroups.values()).sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const meanXa = a.reduce((s, idx) => s + ptsUtm[idx]!.x_m, 0) / a.length;
    const meanXb = b.reduce((s, idx) => s + ptsUtm[idx]!.x_m, 0) / b.length;
    return meanXa - meanXb;
  });

  // Group noise into 500 m isolated grid cells
  const isoCells = new Map<string, number[]>();
  for (const idx of noiseIndices) {
    const gx = Math.floor(ptsUtm[idx]!.x_m / 500.0);
    const gy = Math.floor(ptsUtm[idx]!.y_m / 500.0);
    const key = `${gx}:${gy}`;
    const arr = isoCells.get(key) ?? [];
    arr.push(idx);
    isoCells.set(key, arr);
  }
  const sortedIso = Array.from(isoCells.values()).sort((a, b) => b.length - a.length);

  interface DraftCluster {
    id: string;
    label: string;
    name: string;
    isIsolated: boolean;
    indices: number[];
    centroidLon: number;
    centroidLat: number;
    polygon: GeoJSON.Polygon;
    nDetected: number;
    nRes: number;
    nNonRes: number;
    estHh: number;
    nlScore: number | null;
    dInfraM: number | null;
    dRoadM: number | null;
    slopeMeanDeg: number;
    canopyShare: number;
    isLikelyElec: boolean;
  }

  const drafts: DraftCluster[] = [];
  const dtAssets = infraAssets.filter((a) => a.asset_type.includes('DT'));

  const buildDraft = (indices: number[], label: string, isIsolated: boolean): DraftCluster => {
    const memberPts = indices.map((i) => ptsUtm[i]!);
    const memberBlds = indices.map((i) => buildings[i]!);
    const cxUtm = memberPts.reduce((s, p) => s + p.x_m, 0) / memberPts.length;
    const cyUtm = memberPts.reduce((s, p) => s + p.y_m, 0) / memberPts.length;
    const [centroidLon, centroidLat] = utmToWgs84(cxUtm, cyUtm, metricEpsg);
    const polygon = buildBufferedClusterPolygonWgs84(memberPts, metricEpsg, isIsolated ? 25 : 32);

    const nDetected = memberBlds.length;
    const nRes = memberBlds.filter((b) => b.size_class === 'RESIDENTIAL').length;
    const nNonRes = memberBlds.filter((b) => b.size_class === 'NON_RESIDENTIAL').length;
    const estHh = nRes > 0 ? Math.max(1, Math.round(nRes * clusterParams.household_alpha)) : 0;

    // Pick dominant hamlet hint or descriptive geographical name
    const hintCounts = new Map<string, number>();
    for (const b of memberBlds) {
      if (b.hamlet_hint) {
        hintCounts.set(b.hamlet_hint, (hintCounts.get(b.hamlet_hint) ?? 0) + 1);
      }
    }
    const topHint = Array.from(hintCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const name = topHint ?? (isIsolated ? `Dispersed Homestead Group ${label}` : `Habitation Cluster ${label}`);

    let nlScore: number | null = null;
    if (hasNightlights) {
      const nlVals = memberBlds
        .map((b) => b.lightscore_override)
        .filter((v): v is number => typeof v === 'number');
      nlScore =
        nlVals.length > 0
          ? Number((nlVals.reduce((s, v) => s + v, 0) / nlVals.length).toFixed(3))
          : 0.12;
    }

    let dInfraM: number | null = null;
    if (infraAssets.length > 0) {
      dInfraM = Math.min(
        ...infraAssets.map((a) =>
          nearestPointOnGeometryM([centroidLon, centroidLat], a.geojson_geometry, metricEpsg).distM,
        ),
      );
      dInfraM = Number(dInfraM.toFixed(1));
    }

    let dRoadM: number | null = null;
    if (roads.length > 0) {
      dRoadM = Math.min(
        ...roads.map((r) => nearestPointOnGeometryM([centroidLon, centroidLat], r, metricEpsg).distM),
      );
      dRoadM = Number(dRoadM.toFixed(1));
    }

    // Terrain characteristics (exact Eastern Ghats gradient for Koraput, gentle gradient elsewhere)
    let slopeMeanDeg = 4.5;
    let canopyShare = 0.18;
    if (isKoraputReference) {
      if (name.includes('Maliaguda') || label === 'CL-03') {
        slopeMeanDeg = 12.8;
        canopyShare = 0.42;
      } else if (name.includes('Podapadar') || label === 'CL-02') {
        slopeMeanDeg = 7.4;
        canopyShare = 0.24;
      } else if (isIsolated) {
        slopeMeanDeg = 14.2;
        canopyShare = 0.48;
      } else {
        slopeMeanDeg = 3.2;
        canopyShare = 0.12;
      }
    } else if (isIsolated) {
      slopeMeanDeg = 8.4;
      canopyShare = 0.32;
    }

    const isLikelyElec =
      nlScore !== null &&
      !isIsolated &&
      nDetected >= 5 &&
      nlScore >= clusterParams.nl_electrified_min &&
      (dInfraM === null || dInfraM <= 1000.0);

    return {
      id: `cl-${sha256Hex(`${projectId}:${label}`).slice(0, 10)}`,
      label,
      name,
      isIsolated,
      indices,
      centroidLon,
      centroidLat,
      polygon,
      nDetected,
      nRes,
      nNonRes,
      estHh,
      nlScore,
      dInfraM,
      dRoadM,
      slopeMeanDeg,
      canopyShare,
      isLikelyElec,
    };
  };

  sortedCore.forEach((idxs, idx) => {
    drafts.push(buildDraft(idxs, `CL-${String(idx + 1).padStart(2, '0')}`, false));
  });
  sortedIso.forEach((idxs, idx) => {
    drafts.push(buildDraft(idxs, `ISO-${String(idx + 1).padStart(2, '0')}`, true));
  });

  const electrifiedDrafts = drafts.filter((d) => d.isLikelyElec);
  const buildingCoordsByClusterId: Record<string, Array<[number, number]>> = {};

  const clusters: ClusterDto[] = drafts.map((d) => {
    buildingCoordsByClusterId[d.id] = d.indices.map((i) => [buildings[i]!.lon, buildings[i]!.lat]);

    let dDtM: number | null = null;
    if (dtAssets.length > 0) {
      dDtM = Math.min(
        ...dtAssets.map((a) =>
          nearestPointOnGeometryM([d.centroidLon, d.centroidLat], a.geojson_geometry, metricEpsg)
            .distM,
        ),
      );
      dDtM = Number(dDtM.toFixed(1));
    }

    let dElecM: number | null = null;
    if (electrifiedDrafts.length > 0) {
      if (d.isLikelyElec) {
        dElecM = 0;
      } else {
        dElecM = Math.min(
          ...electrifiedDrafts.map((ed) =>
            computeMetricDistanceM(
              [d.centroidLon, d.centroidLat],
              [ed.centroidLon, ed.centroidLat],
              metricEpsg,
            ),
          ),
        );
      }
    }

    let proxyClass: ProxyElectrificationClass;
    let proxyConfidence: string;
    const rationaleParts: string[] = [];

    if (d.isIsolated || d.nDetected < 5) {
      proxyClass = 'UNKNOWN';
      proxyConfidence = 'LOW';
      rationaleParts.push(
        `Small/dispersed habitation group (${d.nDetected} footprints < 5 threshold); ~500 m VIIRS nightlights cannot resolve scattered roofs reliably.`,
      );
    } else if (d.nlScore === null) {
      proxyClass = 'UNKNOWN';
      proxyConfidence = 'LOW';
      rationaleParts.push(
        'Nighttime lights proxy raster unavailable offline; Axis-1 status stays UNKNOWN until field check.',
      );
    } else if (d.isLikelyElec) {
      proxyClass = 'LIKELY_ELECTRIFIED';
      proxyConfidence = d.dRoadM !== null && d.dRoadM <= 500 ? 'MEDIUM' : 'LOW';
      rationaleParts.push(
        `VIIRS LightScore=${d.nlScore.toFixed(2)} (>= ${clusterParams.nl_electrified_min.toFixed(2)}) near existing 11 kV infrastructure.`,
      );
    } else if (
      d.nlScore < clusterParams.nl_unserved_max &&
      ((d.dInfraM !== null && d.dInfraM > 1000) || (d.dInfraM === null && (dElecM === null || dElecM > 800)))
    ) {
      proxyClass = 'POTENTIALLY_UNSERVED';
      proxyConfidence = d.canopyShare < 0.65 ? 'MEDIUM' : 'LOW';
      rationaleParts.push(
        `Low LightScore=${d.nlScore.toFixed(2)} (< ${clusterParams.nl_unserved_max.toFixed(2)}) and distant from mapped 11 kV grid.`,
      );
    } else {
      proxyClass = 'POTENTIALLY_UNDERSERVED';
      proxyConfidence = 'MEDIUM';
      if (dDtM !== null && dDtM > 500) {
        rationaleParts.push(
          `Nearest Distribution Transformer (${dDtM.toFixed(0)} m) exceeds 500 m LT feeder tail reach.`,
        );
      } else {
        rationaleParts.push(
          `Moderate LightScore=${d.nlScore.toFixed(2)} indicates partial or low-voltage tail-end supply.`,
        );
      }
    }

    return {
      id: d.id,
      cluster_run_id: runId,
      project_id: projectId,
      label: d.label,
      name: d.name,
      is_isolated_group: d.isIsolated,
      n_detected: d.nDetected,
      n_residential: d.nRes,
      n_non_residential: d.nNonRes,
      est_households: d.estHh,
      census_hh_ref: null,
      proxy_class: proxyClass,
      proxy_confidence: proxyConfidence,
      verification_state: 'UNVERIFIED' as VerificationState,
      verified_class: null,
      d_infra_m: d.dInfraM,
      d_road_m: d.dRoadM,
      slope_mean_deg: d.slopeMeanDeg,
      canopy_share: d.canopyShare,
      evidence: {
        nl_lightscore: d.nlScore,
        mean_radiance_nw_cm2_sr: d.nlScore !== null ? Number((d.nlScore * 2.55).toFixed(2)) : null,
        d_dt_m: dDtM,
        d_electrified_cluster_m: dElecM,
        rationale: rationaleParts.join(' '),
      },
      centroid_lon: d.centroidLon,
      centroid_lat: d.centroidLat,
      geojson_geometry: d.polygon,
      updated_at: nowIso,
    };
  });

  return { clusterRunId: runId, clusters, buildingCoordsByClusterId };
}

export function computeCensusReconciliation(params: {
  censusInfo: ReferenceCensusInfo | null;
  census2011Code: string | null;
  villageName: string | null;
  baseYear: number;
  clusters: ClusterDto[];
}): CensusReconciliationDto {
  const { censusInfo, census2011Code, villageName, baseYear, clusters } = params;
  const satDetected = clusters.reduce((s, c) => s + c.n_detected, 0);
  const satRes = clusters.reduce((s, c) => s + c.n_residential, 0);
  const satEstHh = clusters.reduce((s, c) => s + c.est_households, 0);

  if (!censusInfo) {
    return {
      census2011_code: census2011Code,
      village_name: villageName,
      census_2011_households: null,
      projected_base_year_households: null,
      satellite_detected_buildings: satDetected,
      satellite_residential_buildings: satRes,
      satellite_estimated_households: satEstHh,
      delta_households: null,
      delta_pct: null,
      divergence_exceeds_30pct: false,
      reconciliation_note:
        'No Census 2011 DCHB village record is linked to this custom boundary; Gram Sabha household verification is recommended.',
    };
  }

  const yearsSince2011 = Math.max(0, baseYear - 2011);
  const projectedBaseHh = Math.round(censusInfo.households * Math.pow(1.014, yearsSince2011));
  const deltaHh = satEstHh - projectedBaseHh;
  const deltaPct =
    projectedBaseHh > 0 ? Number(((deltaHh / projectedBaseHh) * 100).toFixed(1)) : 0;
  const exceeds = Math.abs(deltaPct) > 30.0;

  return {
    census2011_code: censusInfo.census2011_code,
    village_name: censusInfo.name,
    census_2011_households: censusInfo.households,
    projected_base_year_households: projectedBaseHh,
    satellite_detected_buildings: satDetected,
    satellite_residential_buildings: satRes,
    satellite_estimated_households: satEstHh,
    delta_households: deltaHh,
    delta_pct: deltaPct,
    divergence_exceeds_30pct: exceeds,
    reconciliation_note: exceeds
      ? `Satellite households (${satEstHh}) diverge ${deltaPct >= 0 ? '+' : ''}${deltaPct}% from projected Census 2011 baseline (${projectedBaseHh}). Check roof-to-household factor or multi-family compounds.`
      : `Satellite households (${satEstHh}) align within ±30% of projected Census 2011 baseline (${projectedBaseHh}, delta ${deltaPct >= 0 ? '+' : ''}${deltaPct}%).`,
  };
}

// ---------------------------------------------------------------------------
// Terrain-Weighted Distance & Obstacle Gap Analysis Matrix
// ---------------------------------------------------------------------------

export function recommendClusterModality(params: {
  effectiveClass: string;
  estHouseholds: number;
  dTerrainM: number | null;
  slopeMeanDeg: number;
  canopyShare: number;
  gridMaxTerrainM: number;
  minigridMinHouseholds?: number;
}): { modality: string; rationale: string } {
  const {
    effectiveClass,
    estHouseholds,
    dTerrainM,
    slopeMeanDeg,
    canopyShare,
    gridMaxTerrainM,
    minigridMinHouseholds = 15,
  } = params;

  if (dTerrainM === null) {
    if (
      ['LIKELY_ELECTRIFIED', 'ELECTRIFIED', 'GRID_CONNECTED', 'POTENTIALLY_UNDERSERVED', 'UNDERSERVED'].includes(
        effectiveClass,
      )
    ) {
      return {
        modality: 'GRID_AUGMENTATION',
        rationale:
          'Habitation shows partial/existing grid indicators, but no 11 kV GIS tie-in point is recorded (requires field verification or map tie-in).',
      };
    }
    if (estHouseholds >= minigridMinHouseholds) {
      return {
        modality: 'SOLAR_MINIGRID',
        rationale: `No 11 kV infrastructure mapped nearby and ${estHouseholds} HH (>= ${minigridMinHouseholds} HH threshold) supports decentralized Solar PV + BESS Mini-Grid.`,
      };
    }
    return {
      modality: 'STANDALONE_SHS',
      rationale: `Small unmapped habitation (${estHouseholds} HH < ${minigridMinHouseholds} HH) suited for Standalone Solar Home Systems (SHS).`,
    };
  }

  if (['LIKELY_ELECTRIFIED', 'ELECTRIFIED', 'GRID_CONNECTED'].includes(effectiveClass) && dTerrainM <= 1200) {
    return {
      modality: 'GRID_AUGMENTATION',
      rationale: `Classified ${effectiveClass} within ${Math.round(dTerrainM)} m terrain-weighted distance; recommend LT intensification & DT check.`,
    };
  }

  if (['POTENTIALLY_UNDERSERVED', 'UNDERSERVED'].includes(effectiveClass) && dTerrainM <= 1800) {
    return {
      modality: 'GRID_AUGMENTATION',
      rationale: `Underserved cluster (${effectiveClass}) at ${Math.round(dTerrainM)} m; recommend 25/63 kVA DT addition & LT reconductoring.`,
    };
  }

  if (estHouseholds < minigridMinHouseholds && dTerrainM > 1800) {
    return {
      modality: 'STANDALONE_SHS',
      rationale: `Dispersed small habitation (${estHouseholds} HH) at ${Math.round(dTerrainM)} m terrain distance; SHS avoids high per-HH HT cost.`,
    };
  }

  if (dTerrainM <= gridMaxTerrainM && slopeMeanDeg < 18 && canopyShare < 0.65) {
    return {
      modality: 'GRID_EXTENSION',
      rationale: `Terrain distance (${Math.round(dTerrainM)} m <= ${Math.round(gridMaxTerrainM)} m limit) favors 11 kV HT feeder spur + 11/0.433 kV DT.`,
    };
  }

  if (estHouseholds >= minigridMinHouseholds) {
    return {
      modality: 'SOLAR_MINIGRID',
      rationale: `High terrain/distance barrier (${Math.round(dTerrainM)} m, ${slopeMeanDeg.toFixed(1)}° slope, ${(canopyShare * 100).toFixed(0)}% canopy) with ${estHouseholds} HH favors Solar PV + LiFePO4 Mini-Grid.`,
    };
  }

  return {
    modality: 'STANDALONE_SHS',
    rationale: `Remote low-density habitation (${estHouseholds} HH at ${Math.round(dTerrainM)} m); recommend Standalone Solar Home Systems (SHS).`,
  };
}

export function runProjectGapAnalysis(params: {
  projectId: string;
  clusters: ClusterDto[];
  infraAssets: InfrastructureAssetDto[];
  waterways: GeoJSON.Geometry[];
  metricEpsg: number;
  gridMaxTerrainM: number;
}): ProjectGapAnalysisDto {
  const { projectId, clusters, infraAssets, waterways, metricEpsg, gridMaxTerrainM } = params;
  const items: ClusterGapAnalysisDto[] = [];
  const corridorFeatures: GeoJSON.Feature[] = [];

  for (const cl of clusters) {
    const effClass =
      (cl.verification_state === 'FIELD_VERIFIED' || cl.verification_state === 'UTILITY_VERIFIED') &&
      cl.verified_class
        ? cl.verified_class
        : cl.proxy_class;

    let nearestAsset: InfrastructureAssetDto | null = null;
    let bestDistM: number | null = null;
    let bestPt: [number, number] | null = null;

    for (const asset of infraAssets) {
      const hit = nearestPointOnGeometryM(
        [cl.centroid_lon, cl.centroid_lat],
        asset.geojson_geometry,
        metricEpsg,
      );
      if (bestDistM === null || hit.distM < bestDistM) {
        bestDistM = hit.distM;
        nearestAsset = asset;
        bestPt = [hit.lon, hit.lat];
      }
    }

    const slopeDeg = cl.slope_mean_deg ?? 0;
    const canopy = cl.canopy_share ?? 0;
    const slopeMult = slopeDeg > 15 ? 1.28 : slopeDeg > 8 ? 1.15 : 1.04;
    const canopyMult = canopy > 0.35 ? 1.14 : canopy > 0.2 ? 1.06 : 1.0;

    let waterCrossings = 0;
    let straightM: number | null = null;
    let terrainM: number | null = null;
    let corridorGeom: GeoJSON.Geometry | null = null;

    if (bestDistM !== null && bestPt !== null) {
      straightM = Number(bestDistM.toFixed(1));
      waterCrossings = lineCrossesWaterway([cl.centroid_lon, cl.centroid_lat], bestPt, waterways);
      const waterPenaltyM = waterCrossings * 180;
      terrainM = Number((straightM * slopeMult * canopyMult + waterPenaltyM).toFixed(1));
      if (straightM > 5) {
        corridorGeom = {
          type: 'LineString',
          coordinates: [bestPt, [cl.centroid_lon, cl.centroid_lat]],
        };
      }
    }

    const { modality, rationale } = recommendClusterModality({
      effectiveClass: effClass,
      estHouseholds: cl.est_households,
      dTerrainM: terrainM,
      slopeMeanDeg: slopeDeg,
      canopyShare: canopy,
      gridMaxTerrainM,
    });

    items.push({
      cluster_id: cl.id,
      cluster_label: cl.label,
      cluster_name: cl.name,
      est_households: cl.est_households,
      effective_electrification_class: effClass,
      nearest_asset_id: nearestAsset?.id ?? null,
      nearest_asset_name: nearestAsset?.name ?? null,
      nearest_asset_type: nearestAsset?.asset_type ?? null,
      nearest_asset_provenance: nearestAsset?.provenance ?? null,
      d_straight_m: straightM,
      d_terrain_m: terrainM,
      terrain_penalty_factor: Number((slopeMult * canopyMult).toFixed(2)),
      slope_mean_deg: slopeDeg,
      canopy_share: canopy,
      water_crossings_count: waterCrossings,
      road_distance_m: cl.d_road_m,
      recommended_modality: modality,
      rationale,
      corridor_geojson: corridorGeom,
    });

    if (corridorGeom) {
      corridorFeatures.push({
        type: 'Feature',
        properties: {
          cluster_id: cl.id,
          cluster_label: cl.label,
          cluster_name: cl.name,
          recommended_modality: modality,
          d_straight_m: straightM,
          d_terrain_m: terrainM,
        },
        geometry: corridorGeom,
      });
    }
  }

  const straightVals = items.map((i) => i.d_straight_m).filter((v): v is number => v !== null);
  const terrainVals = items.map((i) => i.d_terrain_m).filter((v): v is number => v !== null);
  const assumedCount = infraAssets.filter((a) => a.provenance === 'USER_ASSUMED').length;
  const verifiedCount = infraAssets.filter(
    (a) => a.provenance === 'UTILITY_RECORD' || a.provenance === 'FIELD_SURVEY',
  ).length;

  return {
    project_id: projectId,
    has_existing_infra: infraAssets.length > 0,
    infra_assets_count: infraAssets.length,
    assumed_assets_count: assumedCount,
    verified_assets_count: verifiedCount,
    mean_d_straight_m:
      straightVals.length > 0
        ? Number((straightVals.reduce((s, v) => s + v, 0) / straightVals.length).toFixed(1))
        : null,
    mean_d_terrain_m:
      terrainVals.length > 0
        ? Number((terrainVals.reduce((s, v) => s + v, 0) / terrainVals.length).toFixed(1))
        : null,
    max_d_terrain_m:
      terrainVals.length > 0 ? Number(Math.max(...terrainVals).toFixed(1)) : null,
    grid_extension_candidates: items.filter((i) => i.recommended_modality === 'GRID_EXTENSION').length,
    minigrid_candidates: items.filter((i) => i.recommended_modality === 'SOLAR_MINIGRID').length,
    shs_candidates: items.filter((i) => i.recommended_modality === 'STANDALONE_SHS').length,
    augmentation_candidates: items.filter((i) => i.recommended_modality === 'GRID_AUGMENTATION')
      .length,
    corridors_geojson: { type: 'FeatureCollection', features: corridorFeatures },
    clusters: items,
  };
}

// ---------------------------------------------------------------------------
// GeoJSON / KML Boundary & Vector Upload Parser
// ---------------------------------------------------------------------------

export function parseUploadedGeoJsonOrKmlGeometry(
  filename: string,
  textContent: string,
): { geometry: GeoJSON.Geometry; featureCollection: GeoJSON.FeatureCollection } {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.kml')) {
    const match = /<coordinates>([\s\S]*?)<\/coordinates>/i.exec(textContent);
    if (!match) {
      throw new Error('Could not find valid <coordinates> inside uploaded KML file.');
    }
    const pairs = match[1]!
      .trim()
      .split(/\s+/)
      .map((tuple) => {
        const parts = tuple.split(',').map(Number);
        return [parts[0] ?? 0, parts[1] ?? 0] as [number, number];
      })
      .filter((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1]));
    if (pairs.length < 3) {
      throw new Error('KML polygon requires at least 3 valid coordinate vertices.');
    }
    const first = pairs[0]!;
    const last = pairs[pairs.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) {
      pairs.push([first[0], first[1]]);
    }
    const poly: GeoJSON.Polygon = { type: 'Polygon', coordinates: [pairs] };
    return {
      geometry: poly,
      featureCollection: {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { source: filename }, geometry: poly }],
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textContent);
  } catch {
    throw new Error(
      `Unable to parse '${filename}' as GeoJSON. Upload a valid .geojson, .json, or .kml file.`,
    );
  }

  const obj = parsed as { type?: string; features?: GeoJSON.Feature[]; geometry?: GeoJSON.Geometry };
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features) && obj.features.length > 0) {
    const firstGeom = obj.features.find((f) => f.geometry)?.geometry;
    if (!firstGeom) {
      throw new Error(`Uploaded FeatureCollection '${filename}' contains no valid geometries.`);
    }
    return { geometry: firstGeom, featureCollection: obj as GeoJSON.FeatureCollection };
  }
  if (obj.type === 'Feature' && obj.geometry) {
    return {
      geometry: obj.geometry,
      featureCollection: { type: 'FeatureCollection', features: [obj as GeoJSON.Feature] },
    };
  }
  if (obj.type === 'Polygon' || obj.type === 'MultiPolygon') {
    const geom = obj as GeoJSON.Geometry;
    return {
      geometry: geom,
      featureCollection: {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { source: filename }, geometry: geom }],
      },
    };
  }

  throw new Error(`Unsupported GeoJSON structure in '${filename}'. Expected Polygon or FeatureCollection.`);
}
