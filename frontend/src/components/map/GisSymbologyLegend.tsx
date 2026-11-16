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

import React, { useState } from 'react';
import { Layers, ChevronUp, ChevronDown, ShieldAlert } from 'lucide-react';
import { Badge, LayerSourceBadge } from '../ui/Badge';
import { QualityTag } from '../ui/QualityTag';
import { HelpTooltip } from '../ui/Tooltip';
import {
  RASTER_LEGEND_SPECS,
  SATELLITE_SOURCES_ATTRIBUTION,
} from './symbology';

export interface GisSymbologyLegendProps {
  /** Cursor longitude in decimal degrees */
  lon: number;
  /** Cursor latitude in decimal degrees */
  lat: number;
  /** Active MapLibre zoom level */
  zoom: number;
  /** Active metric CRS label (default EPSG:32644) */
  metricCrsLabel?: string;
  /** Count of currently enabled GIS overlay groups */
  activeLayerCount?: number;
  /** Total GIS overlay groups */
  totalLayerCount?: number;
  /** Optional status text (e.g., S1 50k stress test telemetry) */
  statusText?: string;
  /** Whether expanded legend is open by default */
  defaultExpanded?: boolean;
  /** Whether to show settlement proxy pills in the compact strip (default true) */
  showSettlementProxyPills?: boolean;
  /** Active basemap mode for telemetry display */
  activeBasemap?: 'survey_paper' | 'streets' | 'terrain' | 'satellite';
  /** Whether NASA VIIRS Nighttime Illumination (Layer B) is enabled */
  layerBEnabled?: boolean;
  /** Active VIIRS observation composite label */
  viirsPeriodLabel?: string;
  /** Active environmental raster overlay ('none' | 'dem_slope' | 'landcover' | 'nightlights') */
  activeRasterOverlay?: 'none' | 'dem_slope' | 'landcover' | 'nightlights';
}

/**
 * Unified GIS Symbology Legend & Cartographic Telemetry Bar.
 *
 * Clearly distinguishes:
 * - Existing infrastructure (solid lines, OSM / utility provenance)
 * - Proposed infrastructure (dashed lines, preliminary computer-generated routes)
 * - Verified vs. inferred/proxy settlement status (solid vs. dashed borders)
 * - Satellite VIIRS nighttime radiance scale, DEM slope, ESA WorldCover, and epistemic rules
 */
export const GisSymbologyLegend: React.FC<GisSymbologyLegendProps> = ({
  lon,
  lat,
  zoom,
  metricCrsLabel = 'UTM 44N (EPSG:32644)',
  activeLayerCount = 6,
  totalLayerCount = 6,
  statusText,
  defaultExpanded = false,
  showSettlementProxyPills = true,
  activeBasemap,
  layerBEnabled = false,
  viirsPeriodLabel,
  activeRasterOverlay = 'none',
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-t border-rule-subtle bg-sheet/95 backdrop-blur-sm text-ink select-none">
      {/* Expandable Full Cartographic & Epistemic Symbology Matrix */}
      {expanded && (
        <div
          role="region"
          aria-label="Expanded GIS Symbology and Epistemic Legend"
          className="p-4 bg-sheet border-b border-rule-subtle space-y-3.5 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule-subtle pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" aria-hidden="true" />
              <span className="text-sm font-semibold text-ink">
                Cartographic Symbology &amp; Epistemic Provenance Specification
              </span>
              <Badge variant="navy" size="sm">
                IS 10821 / REC Rural SLD Aligned
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <LayerSourceBadge source="PROJECT" />
              <LayerSourceBadge source="REFERENCE_DEMO" />
              <LayerSourceBadge source="EXTERNAL_TILES" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {/* Column 1: Existing Infrastructure */}
            <div className="p-3.5 bg-paper/75 border border-rule-subtle rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">
                  1. Existing Grid (Layer A)
                </span>
                <QualityTag kind="ESTIMATED" label="OSM / UTILITY" />
              </div>
              <ul className="space-y-1.5 text-xs text-ink-2">
                <li className="flex items-center gap-2">
                  <span className="w-5 h-1 inline-block bg-[#6D28D9] shrink-0 rounded-full" />
                  <span>33 kV Sub-Transmission Feeder (Solid)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-0.5 inline-block bg-[#991B1B] shrink-0" />
                  <span>11 kV Primary Distribution Feeder (Solid)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full inline-block bg-[#4C1D95] border-2 border-[#FDE047] shrink-0" />
                  <span>33/11 kV Primary Substation</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block bg-[#0F766E] border border-white shrink-0" />
                  <span>Existing Distribution Transformer (DT)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block bg-[#D97706] border border-white shrink-0" />
                  <span>User-Assumed 11 kV Tie-In Point</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#334155] border border-white shrink-0" />
                  <span>33 kV Lattice Tower / 11 kV PSC Pole</span>
                </li>
              </ul>
              <p className="text-xs text-ink-3 leading-relaxed pt-1.5 border-t border-rule-subtle">
                <strong>Epistemic Rule:</strong> Missing OpenStreetMap lines never prove that
                physical grid infrastructure is absent on the ground.
              </p>
            </div>

            {/* Column 2: Proposed Preliminary Infrastructure */}
            <div className="p-3.5 bg-paper/75 border border-rule-subtle rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">
                  2. Proposed Network (Layer F)
                </span>
                <QualityTag kind="ASSUMED" label="PRELIMINARY" />
              </div>
              <ul className="space-y-1.5 text-xs text-ink-2">
                <li className="flex items-center gap-2">
                  <span className="w-5 h-0 inline-block border-b-2 border-dashed border-[#DC2626] shrink-0" />
                  <span>Proposed 11 kV HT Spur (Dashed)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-0 inline-block border-b-2 border-dashed border-[#0284C7] shrink-0" />
                  <span>Proposed 415 V LT AB-Cable (Dashed)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full inline-block bg-[#DC2626] border-2 border-[#FEF08A] shrink-0" />
                  <span>Proposed Distribution Transformer (25/63 kVA)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full inline-block bg-[#0284C7] border-2 border-[#FEF08A] shrink-0" />
                  <span>Proposed Solar PV Mini-Grid Node</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-0 inline-block border-b-2 border-dotted border-[#DC2626] shrink-0" />
                  <span>Unserved Electrification Gap Corridor (Layer E)</span>
                </li>
              </ul>
              <p className="text-xs text-ink-3 leading-relaxed pt-1.5 border-t border-rule-subtle">
                <strong>Engineering Watermark:</strong> Dashed routes are computer-generated
                pre-feasibility layouts, NOT installed utility lines.
              </p>
            </div>

            {/* Column 3: Settlement Electrification Proxy & Verification */}
            <div className="p-3.5 bg-paper/75 border border-rule-subtle rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">
                  3. Settlement Status (Layer C &amp; D)
                </span>
                <QualityTag kind="ESTIMATED" label="2-AXIS PROXY" />
              </div>
              <ul className="space-y-1.5 text-xs text-ink-2">
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block bg-[#009E73] border-2 border-[#0F172A] shrink-0" />
                  <span>Survey Verified Settlement (Axis-2 Evidence · Solid Ring)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block bg-[#0072B2] border-2 border-dashed border-white shrink-0" />
                  <span>Likely Electrified (Proxy: Grid &lt;500m + VIIRS)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block bg-[#E69F00] border-2 border-dashed border-white shrink-0" />
                  <span>Potentially Underserved (Partial / Low Supply)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block bg-[#D55E00] border-2 border-dashed border-white shrink-0" />
                  <span>Potentially Unserved Gap (&gt;1.5 km from 11 kV)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block bg-[#64748B] border-2 border-dashed border-white shrink-0" />
                  <span>Unknown / Insufficient Evidence</span>
                </li>
                <li className="flex items-center gap-2 pt-1.5 border-t border-rule-subtle">
                  <span className="px-1.5 py-0.5 text-xs border-2 border-solid border-ink bg-sheet font-medium">
                    Solid Ring
                  </span>
                  <span>Field / DISCOM Verified Status</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 text-xs border border-dashed border-ink-2 bg-sheet font-medium">
                    Dashed Ring
                  </span>
                  <span>Unverified Remote-Sensing Proxy</span>
                </li>
              </ul>
            </div>

            {/* Column 4: NASA VIIRS Nighttime Illumination & Rasters */}
            <div className="p-3.5 bg-paper/75 border border-rule-subtle rounded-md space-y-2">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-semibold text-ink">
                  4. VIIRS Radiance (Layer B)
                </span>
                <QualityTag kind="ESTIMATED" label="nW/cm²/sr" />
              </div>
              <div className="space-y-1">
                <div
                  aria-label="VIIRS Radiance Continuous Colorbar"
                  className="h-2 w-full rounded-full border border-rule-subtle"
                  style={{
                    background: `linear-gradient(to right, ${RASTER_LEGEND_SPECS.nightlights.stops
                      .map((s) => s.color)
                      .join(', ')})`,
                  }}
                />
                <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-ink-3">
                  <span>{RASTER_LEGEND_SPECS.nightlights.stops[0]?.rangeText}</span>
                  <span>
                    {(() => {
                      const lastRange =
                        RASTER_LEGEND_SPECS.nightlights.stops[
                          RASTER_LEGEND_SPECS.nightlights.stops.length - 1
                        ]?.rangeText ?? '> 2.5';
                      return lastRange.endsWith('nW')
                        ? `${lastRange}/cm²/sr`
                        : `${lastRange} nW/cm²/sr`;
                    })()}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-ink-2">
                {RASTER_LEGEND_SPECS.nightlights.stops.map((stop) => (
                  <div key={stop.rangeText} className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3 inline-block rounded-xs border border-rule shrink-0"
                        style={{ backgroundColor: stop.color }}
                      />
                      <span className="truncate">
                        <span className="font-mono tabular-nums">{stop.rangeText}</span> ·{' '}
                        <strong className="text-ink font-medium">{stop.label}</strong>
                      </span>
                    </div>
                    {stop.interpretation && (
                      <div className="text-[11px] text-ink-3 leading-snug pl-5">
                        {stop.interpretation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {activeRasterOverlay !== 'none' &&
                activeRasterOverlay !== 'nightlights' && (
                  <div className="pt-1.5 border-t border-rule-subtle space-y-1.5 text-xs text-ink-2">
                    <div className="font-semibold text-ink">
                      Active Raster: {RASTER_LEGEND_SPECS[activeRasterOverlay].title}
                    </div>
                    {RASTER_LEGEND_SPECS[activeRasterOverlay].stops.map((st) => (
                      <div key={st.rangeText} className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-2.5 inline-block rounded-xs border border-rule shrink-0"
                            style={{ backgroundColor: st.color }}
                          />
                          <span className="truncate">
                            <span className="font-mono tabular-nums">{st.rangeText}</span> ·{' '}
                            <strong className="text-ink font-medium">{st.label}</strong>
                          </span>
                        </div>
                        {st.interpretation && (
                          <div className="text-[11px] text-ink-3 leading-snug pl-4">
                            {st.interpretation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              <div className="p-2 bg-warn-tint border border-warn/30 rounded-xs text-xs text-warn leading-relaxed flex items-start gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Satellites cannot see indoor household electricity meters. Dark pixels are
                  never proof of zero electrification.
                </span>
              </div>
            </div>
          </div>

          {/* Satellite & Remote-Sensing Attribution & Licensing Strip */}
          <div className="p-2.5 bg-paper border border-rule-subtle rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
            <span className="font-semibold text-ink">
              Satellite &amp; Remote-Sensing Attribution (100% Free Open Data):
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {SATELLITE_SOURCES_ATTRIBUTION.map((src) => (
                <span key={src.id} title={`${src.sensorOrProduct} · ${src.roleInElectrimap}`}>
                  <strong className="text-ink">{src.name}:</strong> {src.resolution} ({src.license})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Compact Always-Visible Symbology Strip & Live Coordinate Telemetry Bar */}
      <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xs border border-rule-strong bg-sheet text-ink font-medium hover:bg-accent-tint transition-colors"
            title="Toggle full GIS symbology and epistemic provenance legend"
          >
            <Layers className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            <span>{expanded ? 'Hide Full Legend' : 'Symbology Legend'}</span>
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>

          <span
            className="inline-flex items-center gap-1"
            title="Mapped 33 kV Sub-Transmission Line (OSM)"
          >
            <span className="w-4 h-1 inline-block bg-[#6D28D9]" />
            33 kV Line (OSM)
          </span>
          <span
            className="inline-flex items-center gap-1"
            title="Mapped 11 kV Primary Distribution Feeder"
          >
            <span className="w-4 h-0.5 inline-block bg-[#991B1B]" />
            11 kV Existing
          </span>
          <span
            className="inline-flex items-center gap-1"
            title="33/11 kV Primary Distribution Substation"
          >
            <span className="w-3 h-3 rounded-full inline-block bg-[#4C1D95] border-2 border-[#FDE047]" />
            33/11 kV Substation
          </span>
          <span
            className="inline-flex items-center gap-1"
            title="Existing Distribution Transformer (DT)"
          >
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#0F766E]" />
            Existing DT
          </span>
          <span
            className="inline-flex items-center gap-1"
            title="Preliminary Proposed 11 kV HT Extension"
          >
            <span className="w-4 h-0.5 inline-block border-b-2 border-dashed border-[#DC2626]" />
            Proposed 11 kV
          </span>
          <span
            className="inline-flex items-center gap-1"
            title="Preliminary Proposed 415 V LT AB-Cable"
          >
            <span className="w-4 h-0.5 inline-block border-b-2 border-dashed border-[#0284C7]" />
            Proposed 415 V LT
          </span>
          {showSettlementProxyPills && (
            <>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#0072B2]" />
                Likely Electrified (Proxy)
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#E69F00]" />
                Underserved (Proxy)
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#D55E00]" />
                Unserved Gap (Proxy)
              </span>
            </>
          )}
        </div>

        {/* Live Coordinate, Zoom, CRS & Status Readout */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {activeBasemap === 'satellite' && (
            <span
              className="px-2 py-0.5 rounded-xs bg-sheet border border-accent/40 text-accent font-medium"
              title="EOX Sentinel-2 Cloudless 2020 Optical Mosaic (10 m · CC BY-NC-SA 4.0)"
            >
              Satellite: Sentinel-2 2020 (10 m · CC BY-NC-SA 4.0)
            </span>
          )}
          {layerBEnabled && (
            <span
              className="px-2 py-0.5 rounded-xs bg-sheet border border-warn/40 text-warn font-medium"
              title="NASA / NOAA VIIRS Nighttime Radiance Overlay Active (nW/cm²/sr)"
            >
              VIIRS: {viirsPeriodLabel ?? 'Nighttime Radiance (nW/cm²/sr)'}
            </span>
          )}
          <span
            className="px-2 py-0.5 rounded-xs bg-sheet border border-rule text-ink-2"
            title="Active Data Layers Loaded and Visible"
          >
            {activeLayerCount > 0 ? (
              <>
                Layers On:{' '}
                <strong className="font-mono tabular-nums text-ink">
                  {activeLayerCount}/{totalLayerCount}
                </strong>
              </>
            ) : (
              <span>No Data Layers Loaded</span>
            )}
          </span>
          <span
            className="px-2 py-0.5 rounded-xs bg-sheet border border-rule text-ink-2 hidden sm:inline-flex items-center gap-1"
            title="Flat meter-accurate grid projection used automatically for distance measurements"
          >
            <span>Map Grid: <strong className="text-ink">{metricCrsLabel}</strong></span>
            <HelpTooltip glossaryKey="crsEpsgUtm" placement="top" />
          </span>
          <span className="font-mono tabular-nums" title="Cursor Latitude & Longitude">
            Lat <strong className="text-ink">{lat.toFixed(4)}°N</strong> · Lon{' '}
            <strong className="text-ink">{lon.toFixed(4)}°E</strong>
          </span>
          <span className="font-mono tabular-nums">Zoom {zoom.toFixed(1)}</span>
          {statusText && (
            <span className="text-ink font-medium truncate max-w-md">{statusText}</span>
          )}
        </div>
      </div>
    </div>
  );
};
