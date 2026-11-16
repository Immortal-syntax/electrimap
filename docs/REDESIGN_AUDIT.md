# REDESIGN_AUDIT.md — ElectriMap DPR Pre-Redesign Audit

> **Branch:** `experiment` · **Audit date:** 2026-11-13 · **Scope:** Read-only inspection. No application code, config, schema or dependency was modified.
> **Baseline verification on this branch:** backend `pytest` **60 passed**; frontend `vitest` **14 passed**; `tsc --noEmit` and `eslint` printed no errors. (`npm run build` was not re-run during the audit, so it is **unverified** here.)

---

## 1. Executive Summary

ElectriMap DPR is a far more complete application than its UI suggests. The backend has a properly layered FastAPI service (`api → services → domain`) with 16 routers (~70 endpoints) covering auth, projects/AOI, data ingestion jobs, DBSCAN settlement clustering, two-axis classification, a verification ledger, infrastructure/tie-in registration, gap analysis, demand, scenario generation, engineering sizing, costing/BOQ, a pre-flight check and three exports (24-section PDF DPR, XLSX BOQ, GIS ZIP). All 60 backend tests pass.

The frontend has five routes. Almost all of the product sits on one very long scrolling page (`WorkspacePage.tsx`), built around a 2,547-line `MapCanvas.tsx`. The visual language ("Survey Sheet": IBM Plex, paper/ink tokens, Okabe-Ito GIS palette) is a sound base, but it is applied unevenly. The information hierarchy is weak, the text is very dense and small (≈ 280 uses of `text-[10px]`/`text-[11px]`), and the workflow panels appear in **reverse order** (DPR export first, data ingestion last).

**The most important finding for the redesign is a data-integrity problem, not a visual one.** The map layer set marketed as "Layers A–F" always merges hard-coded Koraput/Bheja demo features (`electricityGisData.ts` → `DEFAULT_*_FC`) into **every** project's map, whatever its AOI. Several backend "datasets" are also synthetic stand-ins labelled with real provider names (see §8). The redesign must not polish these into something that looks authoritative. Every layer needs to be visibly marked as **project data**, **demo/reference data** or **synthetic placeholder**.

No paid APIs, keys or billing-dependent services are in use. Some free services carry usage-policy or licence restrictions that matter (OSM tile policy, Nominatim policy, EOX 2020 = CC BY-NC-SA, MapLibre demo glyphs).

---

## 2. Existing Architecture

| Tier | Implementation | Notes |
|---|---|---|
| Frontend | React 18.3, TypeScript strict, Vite, Tailwind 3.4, MapLibre GL 6.16, Zustand 5, react-router 6, lucide-react, IBM Plex via `@fontsource` | `@tanstack/react-query` is installed but **never imported**. Terra Draw and Radix UI (required by `AGENTS.md`) are **not installed**. Data is fetched with `apiRequest` inside `useEffect` chains. |
| API client | `frontend/src/lib/apiClient.ts` | Cookie session plus `X-CSRF-Token` taken from memory/session/localStorage. |
| Session | `frontend/src/stores/sessionStore.ts` | `checkSession`, `login`, `logout`. |
| Backend | FastAPI, Pydantic v2, SQLAlchemy 2, GeoAlchemy2/dual `SpatialGeometry` type, Alembic (8 migrations) | Runs on SQLite (`data/electrimap_dev.db`) for development and PostGIS 16-3.4 in Docker. |
| Worker | `backend/app/worker.py` + `job_service.py` (DB-backed queue) | Used by data acquisition and clustering jobs. |
| Domain | `domain/gis/*` (crs, clustering, classification, gap_analysis, routing MCP_Geometric, cost_surface, layer_processing), `domain/engineering/*`, `domain/costing/*`, `domain/reporting/preflight.py` | Pure modules; no DB imports were observed. |
| Exports | `report_service`, `settlement_pdf_service` (ReportLab), `excel_export_service` (openpyxl), `gis_export_service` | SHA-256 export audit log. |
| Deploy | `docker-compose.yml` (db, backend, worker, frontend/nginx), `OFFLINE_MODE=true`; CI `.github/workflows/ci.yml` (ruff, mypy, pytest, tsc, eslint, vitest, build) | |

---

## 3. Routes and Pages

| Route | Component | Purpose | Observations |
|---|---|---|---|
| `/` | `pages/LandingPage.tsx` | "Overview & Demo": TitleBlock, epistemic callout, 4 StatTiles, `MapSpikePreview`, cluster schedule table | All stats and the cluster table are **hard-coded literals** (143 footprints, 9.35 km, 5.12 GHI, 224.1 KB). The GHI value (5.12) conflicts with the reference file (4.90 annual mean). |
| `/login` | `pages/LoginPage.tsx` | Sign-in form | Demo credentials are pre-filled. |
| `/projects` | `pages/ProjectsPage.tsx` | Portfolio table: filter, open, duplicate, archive | **Silently auto-logs in** with demo credentials when no user is present. "Archive" calls `DELETE` with no confirmation. |
| `/projects/new` | `pages/NewProjectWizardPage.tsx` | Project + AOI wizard (LGD search, boundary, draw, upload) | Uses `MapCanvas` in draw mode. |
| `/projects/:id/workspace` | `pages/WorkspacePage.tsx` | Main workbench: TitleBlock, 4 StatTiles, step rail + map + inspector, then 6 stacked panels | Also auto-logs in. Step states are hard-coded `READY`/`ACTIVE`. Steps 4 and 5 scroll to the same section. |
| `*` | redirect to `/` | | No route guards anywhere. |

There are no separate settings, admin, report-viewer or dataset-registry pages. Those functions live inside workspace panels or the backend only.

---

## 4. Feature Inventory (traced end-to-end)

| Feature | Frontend | API | Service / Domain | Status |
|---|---|---|---|---|
| Auth (Argon2, cookie, CSRF) | sessionStore, LoginPage | `/api/v1/auth/{login,logout,me}` | auth_service, core/security | **Working** (tested) |
| Project CRUD / duplicate | ProjectsPage | `/api/v1/projects[...]` | project_service | Working |
| AOI (LGD, buffer, draw, upload, make_valid) | NewProjectWizardPage | `/projects/{id}/aoi`, `/admin-units/*` | aoi_service, domain/gis/boundary | Working (tested) |
| Data acquisition job (6 layers) | DataManagementPanel, JobProgress | `/projects/{id}/data/acquire`, `/jobs/*`, `/layers*` | data_service | Pipeline works, but content is largely **synthetic** (§8) |
| Raster preview (dem_slope / landcover / nightlights PNG) | DataManagementPanel → MapCanvas `image` source | `/layers/{key}/image` | layer_processing.render_raster_layer_png | Renders correctly, but the grids are **synthetic** |
| Custom layer upload | DataManagementPanel | `/layers/upload` | data_service | Working (ZIP traversal / `.prj` checks tested) |
| Settlement clustering (DBSCAN, UTM) | SettlementAssessmentPanel | `/clustering`, `/clusters/*` | settlement_service, domain/gis/clustering | Working |
| Two-axis classification | Badge/ClassificationBadge | (embedded in clusters) | domain/gis/classification | Logic works, but its radiance/slope inputs come from **synthetic** grids |
| Verification ledger (create, reverse, CSV import) | SettlementAssessmentPanel | `/verifications*` | settlement_service | Working |
| Infrastructure assets / tie-in / GeoJSON upload | InfrastructureAndDemandPanel, map click | `/infrastructure*` | infrastructure_service | Working; correctly `USER_ASSUMED` |
| Gap analysis (straight / terrain distance, corridors) | InfrastructureAndDemandPanel, map Layer E | `/gap-analysis` | domain/gis/gap_analysis | Working; correctly returns `None` with no infrastructure |
| Assumptions register | InfrastructureAndDemandPanel | `/settings*` | infrastructure_service | Working |
| Demand engine | InfrastructureAndDemandPanel | `/demand*` | domain/engineering/demand | Working |
| Scenarios & network layout | NetworkEngineeringPanel, map Layer F | `/scenarios*`, `/engineering-constants` | planning_service, domain/engineering | Working |
| Costing, rates, SOR CSV, BOQ, comparison, pin | CostAndScenarioComparisonPanel | `/rates*`, `/boq`, `/comparison`, `/pin` | costing_service, domain/costing | Working; `UNSET` blocks export |
| Pre-flight + DPR PDF / XLSX / GIS ZIP + audit log | DprExportCenterPanel | `/report/preflight`, `/exports/*` | report_service, preflight | Working (tested) |
| Preliminary settlement PDF | SettlementAssessmentPanel link | `/exports/preliminary-settlement-pdf` | settlement_pdf_service | Working |
| Vector tiles (MVT, ETag) | **not used by the frontend** | `/tiles/{pid}/{layer}/{z}/{x}/{y}.mvt` | tiles.py | Backend only |
| Benchmark diagnostics | not surfaced | `/system/benchmark` | diagnostics.py | Backend only |
| Spike reference bundle | LandingPage, WorkspacePage (routes) | `/spikes/reference-geojson`, `/spikes/summary`, `/spikes/viirs-overlay` | spikes.py (hard-coded Layers A–F) | Works; **demo content** |
| Basemaps (Survey, OSM, OpenTopoMap, EOX S2) | MapCanvas, MapSpikePreview | external tiles | – | Working (network-dependent) |
| NASA GIBS VIIRS tiles | MapCanvas Layer B checkbox | external | – | Working, but the layer is **VIIRS_CityLights_2012** (2012 imagery, z ≤ 8) |
| VIIRS period selector (2020–2024) | MapCanvas Layer B | `/spikes/viirs-overlay?period=` | multiplies a synthetic grid by a factor | **Misleading**: not real multi-year observations |
| Search | MapCanvas | local catalog + Nominatim | – | Works; the local catalog is Koraput-only and hard-coded |
| Measure distance / area | MapCanvas | – | haversine / equirectangular in TS | Working (approximate; not UTM) |
| Feature inspector | MapCanvas | – | – | Works, but falls back to fabricated values (e.g. `?? '0.41'` nW, `?? 'TPSODL'`) |

---

## 5. Working / Partial / Broken / Unverified

- **Working (test-backed):** auth, CSRF, projects, AOI, uploads, clustering, verification, infrastructure, gap/demand, scenarios, costing, pre-flight, exports, security headers.
- **Partially working:**
  - Map Layers A–F: they render, but they mix project data with constant demo data.
  - Solar ingestion: `data/reference/koraput_nandapur_solar.json` holds real NASA POWER values under the keys `ghi_kwh_m2_day` / `t2m_deg_c`, but `data_service._ingest_solar_resource_for_aoi` reads `monthly_ghi_kwh_m2_day` / `monthly_temp_c`. The real file is therefore **never used**; hard-coded monthly values are stored instead (worst month JUL 3.82, not AUG 3.43).
  - `WorkspacePage` "Design Worst-Month GHI" falls back to a literal `'3.82'`.
- **Misleading / integrity defects (see §8):** synthetic DEM/landcover/radiance labelled Copernicus/ESA/VIIRS; synthetic building footprints labelled Google Open Buildings v3; synthetic OSM roads/amenities positioned relative to the AOI centroid; constant demo infrastructure, gaps and proposed network drawn on every project.
- **Inconsistent reference figures:** Bheja population/HH is 1142/248 in `koraput_nandapur_villages.geojson` but 562/128 in `seed_service.py` and `electricityGisData.ts`.
- **Unverified in this audit:** production `npm run build`, Docker stack, live external tiles in a browser, PDF visual output, responsive behaviour below 1024 px, and screen-reader behaviour of the map.

---

## 6. UI/UX Assessment

1. **No information architecture.** One page holds the TitleBlock, KPIs, map and six large panels in reverse workflow order. The step rail just scrolls the page; it is not real navigation. Its states are fake.
2. **Map is not the workspace.** It is a fixed `h-[460px]` card in a 7/12 column. The GIS controls (layer manager, basemap, search, measure, guide, fit) are crowded into one wrapping toolbar inside the card.
3. **Density and legibility.** Text at 10–11 px is everywhere, long uppercase labels are frequent ("Layer A · Existing Electricity Infrastructure"), and milestone jargon ("SHEET DPR-M1-01", "S2", "M7", "Core Principle #4") appears in user-facing copy.
4. **Duplicated or decorative statistics.** Landing StatTiles show hard-coded spike metrics (PDF file size, routing runtime). Workspace StatTiles mark "EPSG:32644" as `VERIFIED`, which is a quality claim about a CRS label.
5. **Dangerous actions with no confirmation:** archive/delete project, reset rates, reset settings, reverse verification.
6. **Silent auto-login** on Projects and Workspace hides the auth state and would mask real permission errors.
7. **Loading and empty states** are plain monospace text lines. There are no skeletons and no per-panel error isolation; a single failed request in the chained fetch blocks the whole workspace.
8. **Accessibility:** there is a skip link and `aria-current`, which is good. However, cluster cards in the inspector are clickable `div`s (no keyboard access), map layer toggles rely on custom styling, the colour-only legend has no pattern or shape redundancy for some classes, and there is no visible focus treatment inside map overlays.

## 7. Styling Consistency and Redundancy

- **Tokens:** `tokens.css` + `tailwind.config.ts` define paper/sheet/rule/ink/accent/feedback/GIS colours, 2 px/4 px radii and a control shadow.
- **Undefined classes in use (they render as nothing):** `CostAndScenarioComparisonPanel.tsx` uses `text-muted` (35×), `border-border` (27×), `*-primary` (18×), `*-subtle` (14×), `bg-surface` (8×). `MapCanvas`/`MapSpikePreview` use `warn-tint`, `info-tint`. `ok-bg` exists as a CSS variable but is not mapped in Tailwind.
- **Off-palette Tailwind defaults:** `red-*`, `amber-*`, `emerald-*`, `blue-*` in the Cost and DPR panels.
- **Hard-coded hex values:** MapCanvas 81, MapSpikePreview 60, NetworkEngineeringPanel 14. Map symbology is defined in TSX, not in tokens. The legend text ("solid purple 33 kV, dark-red 11 kV") differs from the token names (`--gis-existing-ht #7A1F5C`).
- **Redundant components:**
  - `MapSpikePreview.tsx` (1,787 lines) is close to a fork of `MapCanvas.tsx` (2,547 lines): same basemaps, layers A–F, inspector and legend.
  - Fixture data appears twice: `electricityGisData.ts` and `spikes.py`.
  - Each page repeats its own header/table styling instead of sharing `PageHeader`/`DataTable` components.
- **Existing UI primitives (keep and extend):** `Badge/ClassificationBadge`, `Button`, `Callout`, `JobProgress`, `ProvenanceChip`, `QualityTag`, `StatTile`, `TitleBlock`.

---

## 8. GIS and Data-Source Assessment

### 8.1 Where each map layer actually comes from

| Layer (UI name) | Project data source | Always-merged demo source | Integrity status |
|---|---|---|---|
| A · Existing infrastructure | `GET /infrastructure` (user / uploaded / `USER_ASSUMED`) | `DEFAULT_EXISTING_POWER_INFRA_FC` (33 kV line, 11 kV spur, substation, 2 DTs, towers, poles labelled `OSM_MAPPED`) is **always** drawn | **Violates AGENTS.md §1.4** on any non-demo project. These coordinates were not retrieved from OSM; they are hand-authored. |
| B · Nighttime illumination | `/layers/nightlights/image` or `/spikes/viirs-overlay` | Vector "glow halos" always come from `DEFAULT_SETTLEMENTS_FC` | Raster = analytic function (`generate_aoi_grids`), **not VIIRS**. The period selector scales it (×0.72–1.08). GIBS option = genuine NASA tiles, but 2012 CityLights. |
| C · Village electrification | AOI geometry | `DEFAULT_VILLAGE_ELECTRIFICATION_FC` (Bheja, Padwa, Maliaguda with population, HH, supply hours) | Census-like figures are hand-authored and conflict with each other (§5). |
| D · Settlements / footprints / OSM | `/clusters`, `/layers/buildings/geojson`, `/layers/osm_features/geojson` | `DEFAULT_SETTLEMENTS_FC` appended when the clusters have no point geometry | Buildings are seeded-random rectangles (`s1_data_access.py` rng 20261106, or `data_service` fallback) tagged `google_open_buildings_v3`. OSM features are synthetic and placed relative to the centroid. |
| E · Electrification gaps | `/gap-analysis` corridors | `DEFAULT_ELECTRIFICATION_GAPS_FC` **always** appended | Demo gap corridors are mixed with computed ones. |
| F · Proposed network | active scenario `network_geojson` + spike routes | `DEFAULT_PROPOSED_NETWORK_FC` **always** prepended | The demo proposed lines and mini-grid appear on every project. |

Legitimate real artefacts: `koraput_nandapur_dem_30m.tif` and `koraput_nandapur_worldcover_30m.tif` (MANIFEST says `LIVE_RETRIEVED`; not tracked in git), and `koraput_nandapur_solar.json` (live NASA POWER). The domain grid functions do **not** read these rasters. MCP routing exists (`domain/gis/routing.py`), and the spike routes were computed with it.

### 8.2 External resources currently referenced (all free, no keys)

| Resource | Where | Licence / policy | Risk |
|---|---|---|---|
| OSM standard tiles `tile.openstreetmap.org` | basemaps "Streets" and "Survey Sheet" | ODbL data; OSMF Tile Usage Policy (attribution, valid Referer/UA, no heavy or bulk use, no SLA) | Acceptable for a university demo. Not suitable for production load. |
| OpenTopoMap | "Terrain" | CC-BY-SA, fair use, volunteer server | Attribution present. Availability not guaranteed. |
| EOX Sentinel-2 cloudless **2020** | "Satellite" | **CC BY-NC-SA 4.0** (2018+ vintages); only 2016 is CC BY 4.0 | `docs/data-sources.md` says 2016/CC BY but the code uses 2020. Attribution must state NC-SA. Commercial use is not allowed. |
| NASA GIBS `VIIRS_CityLights_2012` | Layer B optional | NASA open data; attribution requested | Imagery is dated. The UI implies current observations. Newer GIBS Black Marble layers exist (verify identifiers before use). |
| MapLibre demotiles glyphs | `GLYPHS_URL` in both maps | Demo endpoint, no SLA | Should be self-hosted for offline mode. |
| Nominatim | MapCanvas search (on Enter) | OSMF policy: ≤ 1 req/s, identifying UA/Referer, no autocomplete, attribution | Compliant-ish (Enter-only). Browser cannot set the UA. Add attribution and debounce. |
| NASA POWER, Copernicus DEM, ESA WorldCover, Overpass | spike script `s1_data_access.py`, config URLs | Public domain / Copernicus licence / CC BY 4.0 / ODbL | The backend pipeline does not call them at runtime. |
| OpenFreeMap | listed in docs and backend CSP | ODbL/BSD | **Not used by code**. Documentation drift. |

**Paid or billing-dependent services: none found.** No API keys, Mapbox, Google Maps, Esri or commercial imagery.

### 8.3 CSP note

The backend CSP (`main.py`) applies only to API responses. The SPA served by Vite or nginx has **no CSP** (nginx sets only nosniff/X-Frame/Referrer). If a CSP is added later, it must allow OpenTopoMap, GIBS, demotiles and Nominatim, which the backend CSP currently omits.

---

## 9. Technical Risks

1. **`MapCanvas.tsx` monolith (2.5k lines)**: one `syncLayers` callback manages ~40 layers with style-reload races (`syncLayersRef`, `lastRasterKeyRef`, `beforeId`) that were fixed only recently. Any restructuring can bring back the blank-canvas, worker 404 or reload-loop bugs fixed in commits `9a8dca4`, `7272a42` and `a1afca9`.
2. **MapLibre worker setup**: `public/maplibre-gl-worker.mjs`, `optimizeDeps.exclude`, `setWorkerUrl`. Upgrading maplibre without refreshing the worker file will break rendering.
3. **Tests are tied to DOM text**: `AppRoutes.test.tsx` (989 lines) asserts labels such as "Survey Sheet", "Fit AOI", legend text and button names. Copy changes will break tests, so update them deliberately rather than deleting assertions.
4. **Chained fetch waterfall in WorkspacePage**: 6 sequential `await` tiers. One failure blanks the page.
5. **Removing demo fallbacks changes behaviour**: maps for real projects will look empty until data is ingested. This is correct, but it needs designed empty states.
6. **Undefined Tailwind tokens**: fixing them changes the appearance of the Cost panel.
7. **Stack deviations from AGENTS.md** (no Terra Draw, Radix or TanStack usage): adding them means installing dependencies, which needs approval.
8. **Licensing**: EOX 2020 NC-SA terms; OSM tile policy under heavy demo traffic.

---

## 10. Functionality That Must Be Preserved

- Every backend endpoint and its contract, the CSRF flow and the cookie session.
- Two-axis classification semantics (`LIKELY_ELECTRIFIED` / `POTENTIALLY_UNDERSERVED` / `POTENTIALLY_UNSERVED` / `UNKNOWN` × verification state) and `ClassificationBadge` wording. Nothing may become "verified" without a ledger entry.
- `USER_ASSUMED` tie-in placement through a map click (`placeTieInModeActive` → `POST /infrastructure`).
- AOI draw mode (`drawModeActive`, `onDrawnPolygonChange`) used by the wizard.
- `UNSET` rate blocking, pre-flight blockers and the preliminary watermark callouts.
- Export links (PDF DPR, XLSX BOQ, GIS ZIP, preliminary settlement PDF) and the SHA-256 audit table.
- Map constraints: `INDIA_MAX_BOUNDS`, `MAP_MIN_ZOOM 5`, `MAP_MAX_ZOOM 20`, `renderWorldCopies=false`, `fitBounds` to AOI, `ResizeObserver`.
- Worker configuration, glyphs, raster-beneath-vector ordering, and the raster-key cache.
- Basemap choices and their attributions, and the epistemic "dark pixel ≠ no electricity" guidance.
- Skip link, `aria-current`, the `aria-live` announcer, and keyboard step navigation.
- Okabe-Ito GIS semantic palette meanings.

---

## 11. Recommended Improvements (summary; sequencing in the plan)

1. Introduce an app shell with persistent side navigation and project context. Split the workspace into routed sub-views (Overview, Map, Settlements, Infrastructure & Demand, Network, Cost & BOQ, Reports, Data & Sources) that reuse the existing panels.
2. Make the map a full-height workspace: left layer tree, right inspector, bottom status bar (coordinates, zoom, CRS, scale), and a compact toolbar.
3. **Data-integrity layer:** gate all `DEFAULT_*_FC` fixtures behind an explicit "Reference demo data" toggle that is enabled only for the demo project. Badge every layer with its source class (Project / Reference demo / Synthetic placeholder / External tiles). Remove inspector value fallbacks. Relabel the synthetic VIIRS raster and the period selector as "illustrative". (The backend relabelling of synthetic datasets is a separate, explicitly approved task.)
4. Consolidate the design tokens: add missing tokens (`muted`, `surface`, `border`, `*-tint`, `ok-bg`), move GIS symbology to `mapStyle` constants that read the tokens, and set a type scale with a 12 px minimum for body and data.
5. Extract shared primitives (PageHeader, Panel, DataTable, EmptyState, ConfirmDialog, Tabs, LayerRow, Legend) and remove the duplicated map preview by making `MapSpikePreview` a configuration of a shared map core.
6. Replace hard-coded landing statistics with the `/spikes/summary` API or remove them. Turn the landing page into a concise product and methodology page with an entry to the demo.
7. Add confirmation dialogs for destructive actions. Show sign-in state explicitly instead of silently auto-logging in (keep a visible "Use demo account" option).
8. Fix documentation drift: EOX vintage/licence, OpenFreeMap, solar key mismatch. Record these in `KNOWN_ISSUES.md` (separate approved task).

