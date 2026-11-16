# REDESIGN_IMPLEMENTATION_PLAN.md — ElectriMap DPR UI/GIS Redesign

> **Branch:** `experiment` only (never `main`). **Prerequisite reading:** `docs/REDESIGN_AUDIT.md`, `AGENTS.md`, `docs/DESIGN_SYSTEM.md`.
> **Global rules for every phase**
> - No backend contract changes unless a phase explicitly says so and the change is approved. Backend tests (60) must stay green.
> - No new paid or keyed services. Any new dependency (e.g. Radix, Terra Draw, TanStack Query usage) needs explicit approval before install; `AGENTS.md` already names them as the approved stack.
> - Never present demo, synthetic or proxy data as observed or verified. Existing and proposed infrastructure must always be visually distinct (solid vs dashed, different hue family, legend label "Proposed — preliminary").
> - Per-phase gate: `npm run typecheck && npm run lint && npm run test && npm run build`, backend `ruff`/`mypy`/`pytest`, then a manual browser check of `/`, `/projects`, `/projects/new`, and the demo workspace `00000000-0000-4000-8000-000000000001`.
> - Update tests deliberately when copy changes. Do not delete assertions that guard epistemic or safety text.
> - Commit per phase with Conventional Commits. Update `PROJECT_STATUS.md` / `TASKS.md` at the end of each phase.

---

## Phase 0 — Data-Integrity Guardrails (precondition for visual work)

- **Objective:** Stop the map from showing constant demo infrastructure, gaps, proposed network and village statistics on non-demo projects, and make every layer's provenance visible.
- **Scope:**
  - Add a `dataMode` concept in the frontend: the `DEFAULT_*_FC` fixtures and `KORAPUT_SEARCH_CATALOG` are used only when `project.id === DEMO_PROJECT_ID` or on the landing preview. They are labelled "Reference demo data (hand-authored)".
  - Remove fabricated inspector fallbacks (`?? '0.41'`, `?? 'TPSODL'`, `?? 'Standard REC Spec'`, the `'3.82'` GHI literal) and replace them with "Not available".
  - Relabel the Layer B raster and period selector "Illustrative radiance surface (not satellite observation)". Label GIBS as "NASA GIBS VIIRS City Lights 2012".
  - Define a `LayerSourceClass` enum (`PROJECT`, `REFERENCE_DEMO`, `SYNTHETIC_PLACEHOLDER`, `EXTERNAL_TILES`) shown on each layer row and in the inspector.
- **Files:** `components/map/electricityGisData.ts`, `MapCanvas.tsx` (memos `mergedLayerAInfra`, `effectiveSettlementsFc`, `effectiveGapsFc`, `effectiveProposedFc`, glow halos, inspector builders), `MapSpikePreview.tsx`, `pages/WorkspacePage.tsx`, `tests/AppRoutes.test.tsx`.
- **Depends on:** none.
- **Preserve:** demo workspace and landing preview look the same as today (fixtures still shown there); tie-in placement; draw mode; map bounds and zoom limits; worker setup.
- **Tests:** new unit tests that check (a) a non-demo project renders no `DEFAULT_*` features, (b) the demo project still does, (c) the inspector shows "Not available" for missing properties.
- **Done when:** a freshly created project shows only its own data plus basemap. Every layer row shows its source class. All gates pass.
- **Risks:** real projects look sparse, so pair this with the Phase 4 empty states. Synthetic backend datasets remain mislabelled at the source; record this in `KNOWN_ISSUES.md` as a follow-up backend task (not in scope without approval).

## Phase 1 — Design System

- **Objective:** One coherent token and primitive set, based on the existing "Survey Sheet" identity (IBM Plex, paper/ink, Okabe-Ito). Restrained: no gradients, no glassmorphism.
- **Scope:**
  - `tokens.css`: add `--surface`, `--surface-2`, `--border` alias, `--muted` (= ink-3), `--ok-bg` mapping, `--warn-tint`, `--info-tint`, an elevation scale (2 levels), and a type scale (12/13/14/16/20/24; minimum 12 px for data, 11 px only for map labels and badges).
  - Map every token in `tailwind.config.ts`. Fix the undefined classes (`text-muted`, `border-border`, `*-primary`, `*-subtle`, `bg-surface`, `warn-tint`, `info-tint`). Replace raw `red/amber/emerald/blue-*` with feedback tokens.
  - GIS symbology module `components/map/symbology.ts`: one source for line colours, widths, dash patterns, point icons/shapes and legend labels, read from CSS variables. Existing = solid; proposed = dashed plus a lighter tint; assumed tie-in = hollow diamond; unknown = grey hatched.
  - New primitives in `components/ui/`: `PageHeader`, `Panel` (header/body/footer), `DataTable`, `EmptyState`, `Skeleton`, `ConfirmDialog`, `Tabs`, `Toggle`/`Checkbox`, `Select`, `Tooltip`, `KeyValueList`. Extend `StatTile` with a `source` prop and remove the `VERIFIED` misuse.
  - Update `docs/DESIGN_SYSTEM.md` to match.
- **Files:** `styles/tokens.css`, `styles/globals.css`, `tailwind.config.ts`, `components/ui/*`, `CostAndScenarioComparisonPanel.tsx`, `DprExportCenterPanel.tsx`, `NetworkEngineeringPanel.tsx` (hex), `docs/DESIGN_SYSTEM.md`.
- **Depends on:** Phase 0 (symbology labels need the source classes).
- **Preserve:** GIS semantic colour meanings; `QualityTag` / `ClassificationBadge` text; focus-visible ring.
- **Tests:** `QualityTag.test.tsx` passes; add snapshot or render tests for the new primitives; contrast check of token pairs (≥ 4.5:1 for text).
- **Done when:** no undefined Tailwind classes remain (verify with grep), no raw hex values in non-map TSX, and the docs are updated.
- **Risks:** visible change in the Cost panel; build size if Radix is approved (scope it to the components actually used).

## Phase 2 — Application Layout and Navigation

- **Objective:** Replace the top-bar-only shell with a professional app frame and project-scoped routing.
- **Scope:**
  - `AppShell`: slim top bar (product mark, project switcher/breadcrumb, user menu, "Preliminary — pre-feasibility" badge) and a collapsible left nav for project routes.
  - Nested routes under `/projects/:id/` → `overview`, `map`, `settlements`, `infrastructure`, `network`, `cost`, `reports`, `data`. `/projects/:id/workspace` redirects to `overview` so existing links keep working.
  - Route guard: unauthenticated users go to `/login?next=`. Remove silent auto-login from `ProjectsPage`/`WorkspacePage` and replace it with an explicit "Continue with demo account" button on Login.
  - Project data loading: move the `WorkspacePage` fetch chain into a project context with independent per-section fetches (TanStack Query if approved, otherwise a small hook layer). One failing section must not blank the others.
  - Workflow progress derived from real data (layers ready, clusters count, tie-in present, scenario generated, rates set, pre-flight status) instead of hard-coded `READY`.
- **Files:** `App.tsx`, `components/layout/AppShell.tsx`, new `components/layout/{SideNav,TopBar,ProjectContext}.tsx`, `pages/WorkspacePage.tsx` (split), `pages/LoginPage.tsx`, `pages/ProjectsPage.tsx`, `stores/sessionStore.ts`, tests.
- **Depends on:** Phase 1.
- **Preserve:** skip link and landmarks; `aria-current`; all existing panel behaviour, with each panel moved intact into its route; CSRF handling.
- **Tests:** route tests for each nested path, redirect from `/workspace`, guard redirect, error isolation (mock one endpoint failing).
- **Done when:** every existing panel is reachable through the nav, deep links work, and there is no auto-login.
- **Risks:** evaluator demo flow relied on auto-login, so keep a one-click demo login. Test churn in `AppRoutes.test.tsx`.

## Phase 3 — Dashboard (Project Overview + Portfolio)

- **Objective:** A useful overview with only data-backed figures.
- **Scope:**
  - **Project Overview** (`/projects/:id/overview`): AOI summary (area, boundary source, CRS), a data-layer readiness list with source class, settlement summary by proxy class × verification state (counts from `/clusters`), infrastructure registered (counts by provenance), gap summary, active scenario summary, cost status (UNSET count), pre-flight status, and the next recommended step. A small static map thumbnail of the AOI. Every figure shows its source; missing data shows an empty state, never a placeholder number.
  - **Portfolio** (`/projects`): `DataTable` with sorting, filter, status, AOI area, last updated; ConfirmDialog for archive.
  - **Landing** (`/`): concise product statement, methodology and epistemic statement, link to the demo. Remove the hard-coded spike StatTiles, or source them from `/api/v1/spikes/summary` labelled "Technical spike results (reference geography)".
- **Files:** new `pages/project/OverviewPage.tsx`, `pages/ProjectsPage.tsx`, `pages/LandingPage.tsx`.
- **Depends on:** Phases 1–2.
- **Preserve:** duplicate/archive actions; epistemic callout content; demo entry point.
- **Tests:** overview renders correct counts from mocked API data; empty-state rendering; delete requires confirmation.
- **Done when:** no hard-coded statistic remains on dashboard surfaces.
- **Risks:** temptation to add decorative KPIs. Reject anything not traceable to an endpoint.

## Phase 4 — GIS Workspace

- **Objective:** A full-height electricity-planning map environment.
- **Scope:**
  - Layout: `/projects/:id/map` fills the viewport under the top bar. Left dock = layer tree (grouped: Basemap · Reference imagery · Night lights · Settlements & population · Existing infrastructure · Gaps · Proposed network · AOI), each row with visibility toggle, opacity, source-class badge and legend swatch. Right dock = inspector (selected feature, provenance, epistemic caveat, linked actions such as "Open cluster in Settlements"). Bottom status bar = cursor lon/lat, zoom, scale bar, CRS of metric calculations. Floating compact toolbar = search, measure, fit AOI, place tie-in, draw (wizard only), help.
  - Refactor `MapCanvas` into a map core (`useMapInstance`, style/basemap manager, worker setup) plus layer modules (`layers/infrastructure.ts`, `nightlights.ts`, `villages.ts`, `settlements.ts`, `gaps.ts`, `proposed.ts`, `measure.ts`, `draw.ts`) and React panels (`LayerTree`, `Inspector`, `Legend`, `StatusBar`). Make `MapSpikePreview` a read-only configuration of the same core, then delete the fork.
  - Lift layer visibility state into a store so other pages can deep-link (e.g. `?layers=gaps,proposed&select=cluster:ID`).
  - Empty states per layer group ("No existing infrastructure registered — upload GIS or place a USER_ASSUMED tie-in").
  - Keep Nominatim on explicit submit only, debounced, with ODbL attribution shown in results.
- **Files:** `components/map/*` (split), `pages/project/MapPage.tsx`, `NewProjectWizardPage.tsx` (draw mode consumer), `LandingPage.tsx`.
- **Depends on:** Phases 0–2.
- **Preserve (regression checklist):** `setWorkerUrl` + `public/maplibre-gl-worker.mjs` + `optimizeDeps.exclude`; glyphs URL; `INDIA_MAX_BOUNDS`, min/max zoom, `renderWorldCopies=false`; `upsertGeoJsonSource` / raster key cache / `beforeId` ordering; style-reload re-sync; `ResizeObserver`; `fitBounds` to AOI; tie-in click → POST; draw vertices callback; cluster selection sync with the inspector; basemap attributions.
- **Tests:** existing map tests adapted; unit tests per layer module (feature filtering, paint expressions from symbology); manual browser check of every basemap, each layer toggle, style switch with layers on, tie-in placement, draw in the wizard, and a resize.
- **Done when:** both old map components are replaced by the shared core with no feature regression and the files are under ~500 lines each.
- **Risks:** highest-risk phase (past blank-canvas and reload-loop bugs). Do it in small commits, migrating one layer module at a time.

## Phase 5 — Electricity Infrastructure Presentation

- **Objective:** Clear, standard-looking symbology and data tables for existing vs proposed assets.
- **Scope:**
  - Symbology: 33 kV line (solid, heavy), 11 kV (solid, medium), LT 415 V (solid, thin); proposed variants dashed and labelled "Proposed (preliminary)". Substation = square, DT = triangle, tower = cross/X, pole = small dot, tie-in (`USER_ASSUMED`) = hollow diamond with an "Assumed" label. Zoom-dependent visibility (poles/towers ≥ z14) and labels with voltage/rating only when the data has them.
  - Voltage filter kept, moved into the layer tree group.
  - Infrastructure page (`/projects/:id/infrastructure`): asset `DataTable` (type, voltage, rating, provenance, source note) with map highlight; upload; tie-in placement entry point (opens the map in tie-in mode); gap analysis table; demand; assumptions register. All reuse `InfrastructureAndDemandPanel` logic.
  - Network page: scenario selector, per-cluster modality, engineering results; proposed layout highlighted on a mini-map or via a deep link to the map.
- **Files:** `components/map/symbology.ts`, `layers/infrastructure.ts`, `layers/proposed.ts`, `InfrastructureAndDemandPanel.tsx`, `NetworkEngineeringPanel.tsx`, new route pages.
- **Depends on:** Phase 4.
- **Preserve:** `USER_ASSUMED` semantics; "Existing infrastructure UNSET" callout; tie-in-required callout; scenario regeneration and overrides.
- **Tests:** legend items match the symbology module; the provenance badge is shown for every asset row; proposed features never use existing-line styles (unit test on paint expressions).
- **Done when:** a user can tell existing, assumed and proposed apart in greyscale (dash and shape redundancy).
- **Risks:** icon sprites need self-hosted images (no external icon CDNs). Prefer SDF shapes or circle/symbol layers.

## Phase 6 — Satellite and Nighttime Illumination Presentation

- **Objective:** Honest, well-explained imagery and night-light layers.
- **Scope:**
  - Imagery group: EOX Sentinel-2 cloudless with the vintage and **CC BY-NC-SA 4.0** stated in attribution and layer info. Optionally offer the 2016 vintage (CC BY 4.0) as a licence-safer choice after verifying the tile endpoint. OpenTopoMap terrain; OSM streets. Project rasters (slope, landcover) as overlays with opacity and a legend ramp.
  - Night lights: GIBS VIIRS City Lights 2012 labelled with its year and resolution. Investigate (do not assume) newer free GIBS Black Marble layer identifiers and their max zoom before adding them. The project nightlights raster labelled "Illustrative surface — synthetic placeholder" until the backend reads real data. Remove or disable the 2020–2024 period selector while it only scales a synthetic grid (or label it clearly as an illustrative scenario).
  - Info popover on every night-light layer: what VIIRS measures, ~500 m resolution, overpass time, "darkness is not proof of no electricity", and the four-dimension distinction (connection, supply hours, quality, infrastructure).
  - Swipe/compare control (optional, no new paid deps): side-by-side opacity slider between imagery and night lights.
  - Self-host glyphs (or bundle the needed PBF ranges) so offline mode works. This changes the `GLYPHS_URL` constant and adds static assets; confirm before doing it.
- **Files:** `layers/nightlights.ts`, basemap manager, `DataManagementPanel.tsx`, `electricityGisData.ts` (`VIIRS_PERIOD_OPTIONS`), `docs/data-sources.md` (correct the EOX entry and the OpenFreeMap drift).
- **Depends on:** Phases 0, 4.
- **Preserve:** raster-beneath-vector order; raster key cache; existing attributions; epistemic guide text.
- **Tests:** attribution strings are present for each source; the night-light info text is present; no layer labelled with an observation year it does not have.
- **Done when:** every imagery or night-light layer states its source, vintage, resolution and licence, and no synthetic surface is presented as an observation.
- **Risks:** external tile availability; EOX NC licence for any non-academic use.

## Phase 7 — Remaining Pages and Workflows

- **Objective:** Bring every remaining surface onto the new system.
- **Scope:**
  - **Settlements:** cluster table + detail (evidence, two-axis badge, verification history, add/reverse verification with ConfirmDialog, CSV import, preliminary settlement PDF).
  - **Cost & BOQ:** rates table with UNSET highlighting, inline edit with citation required, SOR CSV import/export, reset (confirm), BOQ, scenario comparison, pin.
  - **Reports:** pre-flight checklist grouped by blocker/warning, export buttons disabled with reasons, export audit log table.
  - **Data & Sources:** layer readiness and job progress, upload, and a dataset provenance registry from `GET /api/v1/datasets` (licence and attribution text).
  - **New Project Wizard:** stepper (Details → AOI method → Boundary review → Create) on the shared map core.
  - **Login:** clean form plus an explicit demo-account option.
- **Files:** the six `components/workspace/*Panel.tsx` (split into route pages and subcomponents), `NewProjectWizardPage.tsx`, `LoginPage.tsx`.
- **Depends on:** Phases 1–2 (and 4 for wizard maps).
- **Preserve:** every API call and payload these panels send today; UNSET export blocking; watermark callouts; CSV formats.
- **Tests:** existing panel tests adapted; new tests for confirm dialogs and for the disabled-export reason text.
- **Done when:** no page uses legacy ad-hoc styling and every destructive action asks for confirmation.
- **Risks:** large panels (700–990 lines). Split them without changing logic: move code first, restyle second.

## Phase 8 — Responsive Design and Accessibility

- **Objective:** WCAG 2.1 AA and usable layouts from 1280 px desktop down to tablet (≥ 768 px). Mobile (< 768 px) is read-only/overview level.
- **Scope:** collapsible docks and nav; tables scroll horizontally with sticky first columns; keyboard access for layer tree, inspector and cluster lists (replace clickable `div`s with buttons); focus management in dialogs; `aria-live` for job progress and map selection; legend redundancy (shape/dash, not colour only); `prefers-reduced-motion` for map fly animations; contrast audit of map labels on all basemaps.
- **Files:** all layout and page components; `globals.css`.
- **Depends on:** Phases 1–7.
- **Preserve:** skip link, landmarks, existing ARIA labels used by tests.
- **Tests:** keyboard-only walkthrough; axe (if approved as a dev dependency) or a manual audit with Chrome DevTools; viewport checks at 1440/1280/1024/768/390.
- **Done when:** no critical or serious accessibility issues remain on the audited pages and every workflow is keyboard-completable on desktop.
- **Risks:** the MapLibre canvas itself is not accessible, so provide table/list equivalents for map data.

## Phase 9 — Integration and Final Testing

- **Objective:** Prove nothing regressed and documentation is current.
- **Scope:** full gate (backend ruff/mypy/pytest; frontend typecheck/lint/test/build); end-to-end manual journey matching `test_m8_e2e_complete_journey_and_security.py` through the UI (create project → AOI → acquire data → cluster → verify → tie-in → gap/demand → scenarios → rates → pre-flight → 3 exports); demo project and a fresh non-demo project both checked for the absence of demo data leakage; Docker stack smoke test if Docker is available (KI-01 notes it is not on this machine); update `PROJECT_STATUS.md`, `TASKS.md`, `CHANGELOG.md`, `docs/DESIGN_SYSTEM.md`, `docs/USER_MANUAL.md` (new navigation), `docs/data-sources.md`, `docs/KNOWN_ISSUES.md` (synthetic dataset follow-ups, solar key mismatch, EOX licence).
- **Depends on:** all phases.
- **Preserve:** everything in Audit §10.
- **Done when:** all gates are green on `experiment`, the docs are updated, the branch is pushed to `origin/experiment`, and the user reviews before any merge decision.
- **Risks:** external tile outages during the demo; document the offline behaviour.

---

## Out-of-scope follow-ups (require separate approval; backend)

1. Fix the `data_service` solar key mismatch so the real NASA POWER reference file is used.
2. Make `layer_processing` / `classification` read the real reference DEM/WorldCover rasters, or relabel those datasets `SYNTHETIC_PLACEHOLDER` in `data_service` provenance.
3. Mark the seeded-random buildings and centroid-relative OSM features as synthetic in provenance.
4. Reconcile Bheja Census figures (villages.geojson vs seed_service).
5. Move the demo-only Layers A–F out of `spikes.py` into an explicitly named demo fixture endpoint.
6. Add a CSP to the nginx-served SPA that covers the tile, GIBS, glyph and Nominatim origins.

