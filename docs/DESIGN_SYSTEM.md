# DESIGN_SYSTEM.md — ElectriMap DPR

> **Status:** Approved & Implemented (v1.0 — Milestones M0–M8 Complete) · Applies to the React SPA and (where noted) the PDF DPR.

---

## 1. Visual Direction — "Survey Sheet"

The product should feel like a **Survey of India topo sheet crossed with an engineering drawing set**, not a SaaS admin template.

- Warm off-white "paper" surfaces, dark "ink" text, thin hairline rules, and a quiet grid.
- Colour is reserved for **data** (status, network, terrain). The chrome stays neutral so the map carries the meaning.
- Numbers are set in a monospaced, tabular face: coordinates, kVA, km, ₹ and percentages line up like a schedule.
- Labels use small-caps headings and drawing-sheet "title blocks", which also appear on DPR pages.
- Deliberately avoided: gradients, glassmorphism, oversized hero illustrations, rounded "bubbly" cards, purple-blue SaaS palettes, emoji icons.

## 2. Design Principles
1. **Map first.** The map is the primary interface. Panels explain what is on it, and selecting something in one updates the other.
2. **Show provenance, always.** Every number has a quality tag, and every layer shows its source and date one click away.
3. **Progressive disclosure.** Defaults and presets come first. "Advanced" reveals parameters, and each workspace tab loads only the layers relevant to that step.
4. **Estimated ≠ verified, visually.** Verified things are drawn with a solid outline plus a ✓. Estimated things use a dashed outline, with no exceptions.
5. **Explain, don't just flag.** Every warning says what is wrong, why it matters and what to do next.
6. **Calm density.** Dense information is fine when it is aligned, consistently formatted and given visual hierarchy.

## 3. Colour Tokens

### 3.1 UI neutrals and brand
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F7F5F0` | App background |
| `--sheet` | `#FFFFFF` | Panels, cards, tables |
| `--rule` | `#D9D4C7` | Hairline borders, dividers |
| `--rule-strong` | `#B8B09C` | Table headers, focus outlines on paper |
| `--ink` | `#1F2328` | Primary text |
| `--ink-2` | `#4A4F57` | Secondary text |
| `--ink-3` | `#6E737B` | Tertiary/meta text (≥ 4.5:1 on sheet) |
| `--accent` | `#0B5D57` | Primary actions, active tab, links (deep "survey teal") |
| `--accent-hover` | `#084842` | Hover/pressed |
| `--accent-tint` | `#E3EFED` | Selected rows, active chips |
| `--focus` | `#1A73E8` | Keyboard focus ring (2 px + 2 px offset) |

### 3.2 Feedback
| Token | Hex | Use |
|---|---|---|
| `--ok` | `#1E7B34` | Passed checks |
| `--warn` | `#9A6100` (text) / `#FFF4D6` (bg) | Soft warnings |
| `--error` | `#B42318` (text) / `#FDECEA` (bg) | Hard errors, failed checks |
| `--info` | `#1F5FAD` / `#E8F0FB` | Notices |

### 3.3 GIS semantic palette (Okabe-Ito based, colour-blind safe, always paired with shape or pattern)
| Meaning | Colour | Secondary encoding |
|---|---|---|
| Likely electrified (proxy) | `#0072B2` blue | Dashed outline |
| Potentially underserved (proxy) | `#E69F00` orange | Dashed outline, diagonal hatch |
| Potentially unserved (proxy) | `#D55E00` vermillion | Dashed outline, cross-hatch |
| Unknown | `#8C8C8C` grey | Dashed outline, dot pattern |
| Verified (any outcome) | Same hue as its outcome | **Solid 2 px outline + ✓ marker** |
| AOI boundary | `#1F2328` | 2 px solid with white halo |
| Approximate boundary | `#1F2328` | 2 px long-dash + "≈" label |
| Existing HT 11 kV (utility/field) | `#7A1F5C` | Solid 2.5 px |
| Existing (OSM) | `#7A1F5C` | Solid, 60 % opacity |
| Assumed / proxy tie-in | `#7A1F5C` | Hollow diamond with "A" |
| Proposed HT 11 kV | `#CC79A7` | Dashed 2.5 px |
| Proposed LT | `#009E73` | Dashed 1.5 px |
| Proposed DT | `#1F2328` fill / white stroke | Triangle symbol, kVA label |
| Mini-grid zone | `#56B4E9` | 25 % fill, sun glyph at generation site |
| SHS households | `#F0E442` with dark stroke | Small square markers |
| Building footprints | `#5B5F66` fill 70 % | Non-residential: hollow; excluded: struck through |
| Voltage-drop failure | `--error` | Thick halo on the segment + ⚠ |

Raster ramps: slope uses a sequential ramp (`#F7F4E9 → #C9A66B → #7F4F24`) with class breaks at 5°, 15° and 25°. Night lights use `viridis`, and land cover uses the official ESA WorldCover class colours, so they stay recognisable.

## 4. Typography
| Role | Font (free, OFL, self-hosted via Fontsource) | Size / line height |
|---|---|---|
| UI text | **IBM Plex Sans** | 14/20 base; 13/18 dense tables |
| Numbers, coordinates, codes | **IBM Plex Mono** (tabular) | 13/18 |
| Headings | IBM Plex Sans SemiBold | H1 24/32 · H2 20/28 · H3 16/24 · H4 14/20 small-caps, +4 % tracking |
| Map labels | Plex Sans (via glyph PBFs) or basemap default | 11–13 |
| PDF DPR | IBM Plex Sans / Mono (embedded TTF) | 10/14 body, 8/11 tables |

Number formatting: Indian grouping (₹ 12,34,567), with a lakh/crore toggle. Units sit after a thin space (`22.48 kVA`). Coordinates use 5 decimal places (about 1 m).

## 5. Spacing, Radius, Elevation, Grid
- **Spacing scale (4 px base):** 2, 4, 8, 12, 16, 24, 32, 48, 64 → tokens `--s-0_5 … --s-16`.
- **Radius:** 2 px (inputs, chips), 4 px (panels, dialogs). Nothing is pill-shaped except toggles.
- **Elevation:** borders rather than shadows. A single shadow `0 1px 2px rgba(31,35,40,.12)` is used only for floating map controls and popovers.
- **Desktop layout grid:** 12 columns, 24 px gutters, max content width 1280 px on non-map pages.
- **Workspace frame:** top bar 48 px · left step rail 56 px (expands to 208 px) · right inspector 360–440 px (resizable) · bottom drawer 0/240/50 % · the map fills the rest.

## 6. Components (in `src/components/ui` and `src/components/map`)

| Component | Variants / notes |
|---|---|
| Button | primary (accent), secondary (outlined), ghost, danger. Sizes sm (28) and md (32). Loading state with spinner and preserved width |
| IconButton | Map toolbar (32 × 32), with a required `aria-label` |
| Input / NumberInput | Unit suffix slot, min/max shown on focus, "default" reset link when the value is edited |
| Select / Combobox | Radix. The admin-unit cascade uses Combobox with search |
| Tabs | Underline style, for the workspace steps |
| StepRail | Vertical workflow: Data → Settlements → Infrastructure → Planning → Engineering → Cost → Compare. Each step shows a state icon (not started / needs attention / done) |
| DataTable | Sticky header, mono numerals right-aligned, row ↔ map sync, column visibility, CSV copy |
| Badge / QualityTag | `VERIFIED` (solid ink), `ESTIMATED` (dashed), `ASSUMED` (italic), `PROXY` (dotted), `USER_ENTERED` (pen glyph) |
| ProvenanceChip | Source short name + date. The popover shows licence, resolution, retrieval time and status |
| StatTile | Label, value (mono), unit, quality tag, delta |
| Callout | info / warn / error, with an action button |
| Dialog / Drawer | Focus trap. Esc closes unless there are unsaved changes |
| FormulaCard | Formula (KaTeX), variables table with values, result, reference |
| JobProgress | Stage list with per-stage status, overall %, cancel |
| EmptyState | Line icon, one sentence, primary action |
| TitleBlock | Drawing-sheet style block: project, village, scenario, date, "PRELIMINARY" stamp (also used in the PDF) |
| Map: MapCanvas, LayerPanel, Legend, Inspector, DrawControl, MeasureControl, BasemapSwitcher, CoordinateReadout, ScaleBar, NorthArrow, SearchBox, PreliminaryStamp | See §9 |

## 7. States
| State | Pattern |
|---|---|
| Loading (data) | Skeleton rows in tables and shimmer-free grey blocks. The map keeps the last frame, with a small corner spinner |
| Loading (job) | JobProgress in the inspector plus a top-bar job indicator. Other work stays usable |
| Empty | EmptyState naming the next step ("No settlements yet — run data acquisition") |
| Error (recoverable) | Callout error with retry. Failed layers show `FAILED` with the reason in LayerPanel |
| Error (blocking pre-flight) | List of blockers, each with a "Go fix" link to the exact tab and field |
| Degraded | Warn callout: "Using cached data from 2026-10-12" or "Offline: basemap unavailable" |
| Success | Short toast (4 s, `aria-live=polite`) for saves. The export success shows download links that persist |
| Stale results | "Inputs changed — results out of date" bar with a Recalculate button. Never show stale numbers silently |

## 8. Motion & Micro-interactions
- Durations of 120 ms (hover/press) and 200 ms (panels). Easing `cubic-bezier(.2,0,0,1)`. `prefers-reduced-motion` disables map fly animations, which become jump-to.
- Map `flyTo` on selection, capped at 1.2 s.
- Hovering a table row highlights the feature on the map (feature-state), and hovering a feature highlights the row.
- Changing a number shows a 600 ms highlight on dependent StatTiles, so users see what moved.
- No decorative animation.

## 9. Map Workspace Specification

### 9.1 Layer organisation (LayerPanel)
Layers are grouped, collapsible, with a visibility toggle, an opacity slider and a ProvenanceChip on each:
1. **Context:** AOI, admin boundaries, roads, water, amenities
2. **Evidence:** buildings, night lights, slope, land cover
3. **Analysis:** clusters (proxy/verified), gap distance lines
4. **Infrastructure:** existing assets by provenance, tie-in points
5. **Plan (active scenario):** proposed HT, LT, DTs, poles (zoom ≥ 15), mini-grid zones, SHS markers, voltage-drop flags

**Layer presets by tab** (progressive disclosure): each workspace tab applies a preset, e.g. Settlements = AOI + buildings + clusters + night lights. Users can still toggle any layer, and a "Reset to tab preset" control restores the defaults.

### 9.2 Basemaps (BasemapSwitcher, bottom-left)
Streets (OpenFreeMap) · Satellite (EOX S2 cloudless 2016, CC BY, by default; newer years behind a licence notice) · Terrain (hillshade generated from the project DEM over the paper background, which also works offline) · None (paper). The attribution control updates per basemap.

### 9.3 Admin boundaries & AOI
The AOI is drawn with a halo. Outside the AOI the map is dimmed by a 35 % paper-colour mask. Boundary-source labels sit at the AOI's label point.

### 9.4 Buildings & settlements
- At zoom < 13 the map shows only cluster polygons, coloured by class, with a household-count label.
- At zoom ≥ 13 building footprints appear, styled by size class.
- Selecting a cluster opens the Inspector: counts (detected / residential / estimated households / verified), proxy class, confidence, a "Why this class" evidence list, verification history and an "Add verification" button.

### 9.5 Infrastructure & proposed network
Existing and proposed elements are always separated by line style (solid vs dashed). The Plan legend shows scenario name and status. Clicking a feeder segment shows length, conductor, ΔV % (pass/fail chip), slope and land-cover crossings. DTs are draggable in edit mode, and after a move the inspector shows a "Recalculate" bar.

### 9.6 Legend
Automatic. It lists only visible layers, and the symbols match the map exactly (rendered from the same style definitions). It is collapsible and printable. A "Data sources" link opens the provenance table.

### 9.7 Tools (top-right toolbar)
Search (villages from the local index, plus coordinates in "lat, lon" or UTM) · Draw AOI / point / line (Terra Draw) · Measure distance and area (Turf preview, labelled "approx."; the server's figures are authoritative) · Place tie-in · Identify (click) · Fullscreen · Export map view as PNG.
The CoordinateReadout (bottom bar) shows lat/lon, UTM E/N, elevation and slope under the cursor once the DEM is loaded.

### 9.8 Selection & editing
- Single click selects. Shift-click adds to the selection. Box select is available in the Settlements tab.
- Edit mode is explicit (a toggle with a coloured frame around the map), so geometry is never edited by accident.
- Every edit is undoable within the session and recorded (`user_edited`).

### 9.9 Analysis result panels
The Inspector (right) shows the selected item. The bottom drawer holds tables (clusters, feeders, BOQ), and the drawer table always filters to the current map extent unless "All" is chosen.

## 10. Screen-by-Screen

| Route | Purpose | Layout & hierarchy | Key components & interactions | Responsive |
|---|---|---|---|---|
| `/` Landing | Explain the product and its honesty boundaries; open the demo | Title block header, a static preview map of the Koraput demo, three-step method strip, "What this tool can't tell you" box, CTAs | Open demo project, Sign in, sample DPR link | Single column on mobile |
| `/login` | Authentication | Centred sheet 400 px | Email, password, errors without revealing which field was wrong | Same |
| `/projects` | Portfolio and history | Table of projects (name, village, scheme, last updated, verification %, last export) plus a summary strip | Search, filter by scheme/status, duplicate, archive, open | Cards on mobile |
| `/projects/new` | Create a project and set the AOI | Two-step wizard: (1) metadata, (2) AOI with a map on the right and a method selector on the left (Admin unit / Draw / Upload) | Cascade combobox, Terra Draw, file drop, validation results (area, CRS, boundary source), Confirm → starts the data job | AOI step is map-first, with the method selector in a bottom sheet |
| `/projects/:id/workspace` | All analysis | Frame from §5. StepRail on the left, map in the centre, Inspector on the right, tables in the drawer, and a top bar showing project name, active scenario selector, job indicator and data-quality meter (share of households verified) | Tabs: **Data** (layer provenance table, uploads, re-acquire) · **Settlements** (cluster table, thresholds under Advanced, verification) · **Infrastructure** (assets table, place tie-in, gap matrix) · **Planning** (per-cluster strategy mode, generate layout, edit mode) · **Engineering** (load schedule, DT, ΔV/loss table with fixes, solar sizing, FormulaCards) · **Cost** (BOQ grid with rate-source column, template selector, percentages) · **Compare** (scenario columns, pin baseline, sortable habitation table) | < 1024 px: full-screen map, tabs as a bottom sheet, editing limited to verification entry and parameters (no geometry editing) |
| `/projects/:id/report` | DPR pre-flight, preview and export | Left: 24-section TOC with readiness status per section. Centre: page preview (server-rendered PNG thumbnails of the PDF). Right: pre-flight checklist and export options (PDF / XLSX / GeoJSON / CSV, include verifier names?) | Map framing tool (set the extent of the DPR maps), Generate (job), export history with hashes | Read-only list and downloads on mobile |
| `/projects/:id/audit` | Verification ledger and change log | Timeline, filterable by type, with a CSV import panel | Import CSV, review the unmatched-rows report, reverse an entry (with reason) | List view |
| `/settings` | Defaults, rate templates, data sources, health | Side-nav sections | Constants table with status chips (Admin), rate template import/export, dataset registry, source health "Test" buttons | Stacked |

## 11. Accessibility (WCAG 2.1 AA target for non-map UI)
- Text contrast ≥ 4.5:1 (all neutrals above are checked against `--sheet` and `--paper`). Non-text UI contrast ≥ 3:1.
- Status is never conveyed by colour alone (pattern, outline, icon and text label).
- Full keyboard access for all panels and tables. The map provides keyboard pan/zoom, and its feature list is reachable through the drawer table, which acts as the accessible alternative to the map.
- Visible focus ring (`--focus`). Skip-to-content link. `aria-live` for job progress and toasts.
- Forms have explicit labels, units in the label text, and error messages linked via `aria-describedby`.
- Respects `prefers-reduced-motion`. Minimum 32 px targets on desktop and 44 px on touch.

## 12. Responsive Breakpoints
`sm` 640 · `md` 768 · `lg` 1024 (full workspace) · `xl` 1280 · `2xl` 1536. The workspace is designed for ≥ 1280 and is fully usable at 1024. Below 1024 it becomes a review and verification companion.

## 13. PDF DPR Styling (shared tokens)
A4 portrait (maps can use A4 landscape) · 20 mm margins · TitleBlock footer on every page (project, section, page n/N, "PRELIMINARY — NOT FIELD VERIFIED" stamp when applicable) · Plex Sans/Mono embedded · tables with hairline rules and alternating `--paper` rows · map frame: neatline, graticule labels, scale bar (metric CRS), north arrow, legend panel, CRS and data-date note, attribution line.
