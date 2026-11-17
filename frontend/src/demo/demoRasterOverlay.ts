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
 * Client-side illustrative raster overlay generator for VIIRS Nighttime Lights,
 * Hillside Slope (DEM), and ESA WorldCover overlays. Produces clean PNG data URLs
 * via Canvas 2D (with deterministic SVG data URL fallback in non-canvas environments).
 */

export type DemoRasterKind = 'nightlights' | 'dem_slope' | 'landcover';

const rasterCache = new Map<string, string>();

const PERIOD_SCALE: Record<string, number> = {
  '2024_ANNUAL': 1.0,
  '2023_POST_MONSOON': 1.04,
  '2022_ANNUAL': 0.88,
  '2020_BASELINE': 0.72,
};

function buildSvgFallbackDataUrl(kind: DemoRasterKind, period: string): string {
  const scale = PERIOD_SCALE[period] ?? 1.0;
  const opacity = (0.68 * scale).toFixed(2);
  let svg = '';
  if (kind === 'nightlights') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <defs>
        <radialGradient id="core" cx="34%" cy="56%" r="24%">
          <stop offset="0%" stop-color="#fde047" stop-opacity="${opacity}" />
          <stop offset="55%" stop-color="#f97316" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.22" />
        </radialGradient>
        <radialGradient id="podapadar" cx="62%" cy="46%" r="16%">
          <stop offset="0%" stop-color="#fb923c" stop-opacity="0.42" />
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.0" />
        </radialGradient>
      </defs>
      <rect width="256" height="256" fill="#0f172a" fill-opacity="0.26" />
      <rect width="256" height="256" fill="url(#core)" />
      <rect width="256" height="256" fill="url(#podapadar)" />
    </svg>`;
  } else if (kind === 'dem_slope') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <defs>
        <linearGradient id="ridge" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="#22c55e" stop-opacity="0.28" />
          <stop offset="55%" stop-color="#eab308" stop-opacity="0.42" />
          <stop offset="100%" stop-color="#dc2626" stop-opacity="0.55" />
        </linearGradient>
      </defs>
      <rect width="256" height="256" fill="url(#ridge)" />
    </svg>`;
  } else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect width="256" height="256" fill="#fde68a" fill-opacity="0.26" />
      <ellipse cx="185" cy="80" rx="68" ry="62" fill="#15803d" fill-opacity="0.42" />
      <ellipse cx="75" cy="145" rx="52" ry="44" fill="#ca8a04" fill-opacity="0.28" />
      <path d="M128,0 C138,80 150,160 120,256" stroke="#2563eb" stroke-width="10" fill="none" stroke-opacity="0.5" />
    </svg>`;
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function generateDemoRasterOverlayDataUrl(
  kind: DemoRasterKind,
  period = '2024_ANNUAL',
): string {
  const cacheKey = `${kind}:${period}`;
  const cached = rasterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (typeof document === 'undefined') {
    const fallback = buildSvgFallbackDataUrl(kind, period);
    rasterCache.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = buildSvgFallbackDataUrl(kind, period);
      rasterCache.set(cacheKey, fallback);
      return fallback;
    }

    const scale = PERIOD_SCALE[period] ?? 1.0;

    if (kind === 'nightlights') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.30)';
      ctx.fillRect(0, 0, 256, 256);

      // CL-01 Main Village Core radiance plume (~82.718, 18.556)
      const g1 = ctx.createRadialGradient(84, 166, 4, 84, 166, 62);
      g1.addColorStop(0, `rgba(253, 224, 71, ${Math.min(0.95, 0.82 * scale)})`);
      g1.addColorStop(0.45, `rgba(249, 115, 22, ${Math.min(0.75, 0.50 * scale)})`);
      g1.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, 256, 256);

      // CL-02 Podapadar weak glow (~82.738, 18.564)
      const g2 = ctx.createRadialGradient(156, 132, 2, 156, 132, 34);
      g2.addColorStop(0, `rgba(251, 146, 60, ${Math.min(0.6, 0.38 * scale)})`);
      g2.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, 256, 256);

      // Faint grid cells (~500 m VIIRS pixel grid cue)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 256; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 256);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(256, i);
        ctx.stroke();
      }
    } else if (kind === 'dem_slope') {
      const grad = ctx.createLinearGradient(0, 256, 256, 0);
      grad.addColorStop(0, 'rgba(34, 197, 94, 0.32)');
      grad.addColorStop(0.55, 'rgba(234, 179, 8, 0.45)');
      grad.addColorStop(1, 'rgba(220, 38, 38, 0.62)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      // Stylized topographic elevation ridges
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.35)';
      ctx.lineWidth = 1.5;
      for (let r = 30; r <= 220; r += 38) {
        ctx.beginPath();
        ctx.arc(210, 52, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // ESA WorldCover 10m classes (Cropland, Tree Cover NE ridge, Shrubland, Waterway)
      ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
      ctx.fillRect(0, 0, 256, 256);

      ctx.fillStyle = 'rgba(21, 128, 61, 0.45)';
      ctx.beginPath();
      ctx.ellipse(188, 72, 74, 62, -0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(134, 239, 172, 0.35)';
      ctx.beginPath();
      ctx.ellipse(76, 152, 58, 46, 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(132, 0);
      ctx.bezierCurveTo(148, 86, 118, 172, 146, 256);
      ctx.stroke();
    }

    const url = canvas.toDataURL('image/png');
    rasterCache.set(cacheKey, url);
    return url;
  } catch {
    const fallback = buildSvgFallbackDataUrl(kind, period);
    rasterCache.set(cacheKey, fallback);
    return fallback;
  }
}

