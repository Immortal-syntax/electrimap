# ARCHITECTURE.md — ElectriMap DPR (DRAFT, Prompt 2)

> **Status:** Draft for approval · **Date:** 2026-11-06
> **Builds on:** Approved Prompt 0 (feasibility/methodology) and Prompt 1 (PRD v0.1, changes C1–C8 approved).
> **Hard constraints:** free resources only · solo developer + AI agents · local-first · MVP over enterprise complexity.

---

## 1. Architectural Drivers

| Driver | Consequence for architecture |
|---|---|
| Free-only (NFR-01) | Open-source stack; keyless/free data sources; no paid tiles, geocoders, queues or monitoring |
| Solo + AI agents | Few moving parts; one backend language for all science; conventional, well-documented libraries that AI agents know well |
| Heavy geospatial science | Python ecosystem (GeoPandas/Shapely/Rasterio/PyProj/scikit-learn/scikit-image) |
| Real spatial queries + integrity | PostgreSQL + PostGIS |
| Long-running jobs (data fetch, clustering, routing, PDF) | Background worker separate from the API request cycle |
| Offline demo (AC-14.1) | Reference dataset bundled; every external source cacheable; app works with no internet (basemap optional) |
| Traceability (NFR-06) | Provenance and quality tags in the schema itself, not just the UI |
| Windows dev machine | Dependencies must have Windows wheels or run in Docker |

---

## 2. Technology Evaluation & Recommendation

### 2.1 Decision table

| Concern | **Recommended** | Alternatives considered | Why recommended | Trade-offs / disadvantages |
|---|---|---|---|---|
| Frontend framework | **React 18 + TypeScript (strict) + Vite** (SPA) | Next.js (Prompt 0 suggestion), Vue/Nuxt, SvelteKit, Angular | No SSR/SEO need; backend is FastAPI, so Next.js would add a second server runtime and SSR/WebGL friction (`'use client'`, dynamic imports) for no benefit. Vite SPA = static build, served by FastAPI or any static host | No server components; landing page SEO weaker (irrelevant for this project). **This changes the Prompt 0 recommendation → decision AD-01 needs approval** |
| Routing (FE) | **React Router v6** | TanStack Router | Mature, widely known | Less type-safe route params than TanStack Router |
| Server state | **TanStack Query** | SWR, Redux Toolkit Query | Caching, retries, job polling, invalidation | One more library (justified: removes hand-written fetch state) |
| Client state | **Zustand** (map/UI state only) | Redux Toolkit, React Context only | Tiny, simple; map layer visibility, selection, active tab | Discipline needed to keep server data out of it |
| Styling | **Tailwind CSS** + CSS variables for design tokens | CSS Modules, MUI, Chakra, shadcn/ui | Tokens map directly to CSS vars; avoids generic component-library look | Utility-class verbosity; mitigated by small primitive components |
| UI primitives | **Radix UI primitives** (dialog, popover, tabs, tooltip, select) | Headless UI, MUI, build from scratch | Accessible behaviour (focus, ARIA) without imposed styling | Extra dependency per primitive; only import what is used |
| Map rendering | **MapLibre GL JS** | Leaflet, OpenLayers, deck.gl, Mapbox GL | Free (BSD), WebGL, vector tiles, smooth with 50k+ polygons, style-spec expressions for status styling | Steeper styling curve than Leaflet |
| Map drawing/editing | **Terra Draw** (MapLibre adapter) | mapbox-gl-draw (Mapbox-specific, needs shims), custom | Officially supports MapLibre; polygon/point/line drawing + vertex editing | Younger project; pin version |
| Client geometry | **Turf.js** (selected modules only) | none | Live measurement, client-side previews | Never authoritative—server recomputes all metrics |
| Charts | **Recharts** (UI) / Matplotlib (PDF) | ECharts, Chart.js, Plotly | Simple React charts; PDF charts rendered server-side for determinism | Two chart libraries (UI vs report) — acceptable separation |
| Backend | **Python 3.12 + FastAPI + Pydantic v2** | Django + GeoDjango, Node/NestJS, Flask | Geoscience stack is Python; automatic OpenAPI → typed FE client; strict validation | Async + CPU-bound work must be offloaded to worker (designed in) |
| ORM / migrations | **SQLAlchemy 2.0 + GeoAlchemy2 + Alembic** | SQLModel, raw SQL, Django ORM | Mature PostGIS support; explicit migrations | Verbosity; raw SQL allowed for complex spatial queries (documented) |
| Database | **PostgreSQL 16 + PostGIS 3.4** | SpatiaLite, DuckDB-spatial, MongoDB | Real spatial indexes (GIST), `ST_Transform`, `ST_AsMVT`, ACID audit ledger | Needs Docker or native install on Windows (checked in Prompt 3) |
| Background jobs | **Postgres-backed job table + 1 worker process** (`SELECT … FOR UPDATE SKIP LOCKED`) | Celery + Redis, RQ, Dramatiq, FastAPI BackgroundTasks | No Redis/broker to install or host; jobs persistent and inspectable in DB; retries & progress columns | Not designed for high throughput (irrelevant at this scale). FastAPI BackgroundTasks rejected: dies with API process, no progress/retry |
| Vector GIS | **GeoPandas, Shapely 2, PyProj** | PyQGIS, OGR CLI | Windows wheels, vectorised GEOS | Memory-bound for very large AOIs → AOI cap enforced |
| Raster GIS | **Rasterio** (windowed COG reads) + **NumPy** | GDAL CLI, xarray/rioxarray | Reads only the AOI window over HTTP or local files | — |
| Clustering | **scikit-learn DBSCAN** (with `ball_tree` on UTM coords) | HDBSCAN, custom grid clustering | Deterministic, explainable, approved in Prompt 0 | ε sensitive → editable + documented |
| HT routing | **scikit-image `graph.MCP_Geometric`** (least-cost path on raster cost surface) | NetworkX A* on grid graph, pgRouting | Purpose-built for raster cost paths, vectorised and fast; NetworkX on a 30 m grid creates millions of Python objects | Adds scikit-image dependency (justified) |
| LT network | **SciPy `csgraph.minimum_spanning_tree`** | NetworkX | SciPy already required by scikit-learn → zero new dependency | — |
| DT placement | Weighted medoid + rule-based split (NumPy) | K-Means, p-median solvers | Deterministic, explainable, honours LT ≤ 500 m rule | Not globally optimal (documented) |
| Footprint retrieval (live) | **DuckDB (spatial + httpfs)** querying cloud-native GeoParquet by bbox | Google S2-tile CSV downloads, Earth Engine | Pulls only AOI rows over HTTP; no account | Extra dependency; partitioning/URL to be verified in Spike S1. Offline demo does not depend on it |
| PDF DPR | **ReportLab (Platypus)** + **Matplotlib** for maps/charts | WeasyPrint (HTML→PDF), headless Chromium (Playwright) | Pure-Python wheels on Windows; deterministic pagination, tables, headers/footers, TOC; full control of cartographic elements | Layout coded in Python (less designer-friendly than HTML/CSS). WeasyPrint needs GTK/Pango on Windows; Chromium adds ~150 MB. **Validated in Spike S3** — fallback: Playwright HTML→PDF |
| Static maps in PDF | **Matplotlib** rendering vector layers from PostGIS + DEM hillshade; scale bar, north arrow, grid drawn programmatically | contextily (web tiles), QGIS server | No tile-licence or network dependency; reproducible; offline | Less "pretty" than tile basemaps; hillshade compensates |
| Excel | **openpyxl** (live formulas) | XlsxWriter, pandas.to_excel | Can write formulas & styles; free | — |
| Auth | **Server-side sessions** (httpOnly, Secure, SameSite=Lax cookie) + **Argon2id** password hashing (`argon2-cffi`) + CSRF token for mutating requests | JWT in localStorage, OAuth/Auth0/Clerk, Supabase Auth | Same-origin SPA → cookies are simplest and safest; revocable; no third party | Requires sessions table + CSRF handling (small) |
| API style | **REST + OpenAPI**, typed FE client generated by `openapi-typescript` | GraphQL, tRPC | FastAPI native; contract shared with any agent | Some over-fetching (irrelevant) |
| Map tiles for project data | **PostGIS `ST_AsMVT` endpoint** for buildings/clusters; GeoJSON for small layers; PNG image overlays for rasters | Martin/pg_tileserv, TiTiler | Zero extra services; tiles filtered by project & auth | Hand-written tile endpoint (≈50 lines) |
| File storage | **Local filesystem under `DATA_DIR`** behind a small `Storage` interface | MinIO, S3 | Free, simple; interface allows S3-compatible later | Single-machine only (fine for MVP) |
| Logging | **Python `logging` with JSON formatter** → stdout + rotating file; job table for job logs | Sentry (free tier, third party), ELK | Free, no third-party data transfer | No alerting (acceptable for MVP) |
| Testing | **pytest** (+ `pytest-postgresql`/test DB), **Vitest** + Testing Library, **Playwright** E2E | Jest, Cypress | Fast, free, Windows-compatible | Playwright browsers download (~300 MB, dev only) |
| Lint/format/type | **ruff** (lint+format), **mypy --strict** (domain/services), **ESLint + Prettier**, **tsc --noEmit** | flake8/black/pylint | ruff = one fast tool | mypy strictness relaxed only where third-party stubs missing (documented) |
| Python env | **uv** (lockfile) | pip+venv, Poetry, conda | Fast, reproducible, cross-platform | Newer tool; fallback `pip install -r` export |
| Node env | **Node 22 LTS + npm** | pnpm, yarn | Ships with Node, zero extra install | Slower than pnpm (irrelevant) |
| CI | **GitHub Actions** (free for public repos; free minutes for private) | none | Lint/type/test on every push | Private-repo minutes are capped (≈2,000/month on free plan — sufficient) |
| Containers | **Docker Compose** for PostGIS (dev) and full stack (demo) | Native installs only | Reproducible DB on Windows | Requires Docker Desktop (free for personal/education use); native PostGIS installer is the fallback |

### 2.2 Rejected on purpose (complexity control)
Kubernetes, microservices, Redis/Celery, GraphQL, Kafka, separate tile server, object storage, Mapbox, Google Maps, paid monitoring, Next.js, PyTorch (MVP), OpenDSS/pandapower (MVP).

---

## 3. High-Level System Architecture

```mermaid
flowchart LR
    subgraph Browser
        SPA["React SPA (Vite)\nMapLibre + Terra Draw\nTanStack Query / Zustand"]
    end
    subgraph Server["Single host (local or demo container)"]
        API["FastAPI app\n/api/v1 · /tiles · static SPA"]
        W["Worker process\n(job runner)"]
        FS[("DATA_DIR\nuploads · rasters · cache · exports")]
        DB[("PostgreSQL + PostGIS\nprojects · features · ledger · jobs")]
    end
    subgraph Free_External["Free external sources (cached, optional at runtime)"]
        OB["Open Buildings GeoParquet"]
        DEM["Copernicus GLO-30 COG"]
        WC["ESA WorldCover COG"]
        NL["HREA / VIIRS"]
        OSM["Overpass API"]
        NP["NASA POWER API"]
        BM["OpenFreeMap tiles · EOX Sentinel-2 cloudless"]
    end
    SPA -- "REST JSON, MVT, PNG (cookie session)" --> API
    SPA -- "basemap tiles" --> BM
    API --> DB
    API --> FS
    API -- "enqueue job" --> DB
    W -- "claim job (SKIP LOCKED)" --> DB
    W --> FS
    W --> OB & DEM & WC & NL & OSM & NP
```

### 3.1 Responsibility split

| Layer | Does | Never does |
|---|---|---|
| **Frontend** | Rendering, drawing/editing geometry, layer styling, measurement previews (Turf), forms, optimistic UI, job progress polling | Authoritative calculations, area/length for reports, authorisation decisions |
| **API (synchronous)** | Auth, validation, CRUD, cheap recalculations (demand, engineering, BOQ on existing layout ≤ 2 s), MVT tiles, enqueueing jobs, serving files | Network calls to external data sources; anything > ~2 s |
| **Worker (background)** | AOI data acquisition, raster clipping/slope/cost-surface, clustering, proxy classification, layout generation (routing), CSV verification import, PDF/Excel/GeoJSON generation | Serving HTTP |
| **Domain modules** (pure Python) | All formulas and spatial algorithms; no DB/HTTP inside → unit-testable | I/O |

---

## 4. GIS Processing Architecture

### 4.1 CRS policy
- **Storage & exchange:** EPSG:4326 (all `geometry(…, 4326)` columns, GeoJSON, MVT source).
- **Metric computation:** project-specific UTM zone stored on the project (`metric_epsg`), chosen from the AOI centroid: zone = ⌊(λ+180)/6⌋+1 → EPSG:326{zone}. Koraput (~82.5–83°E) → **EPSG:32644**.
- All areas, distances, buffers, DBSCAN, routing and line lengths are computed in `metric_epsg`. A single helper (`domain/gis/crs.py`) is the only place projections are built (PyProj `Transformer`, `always_xy=True`).
- Uploaded files: CRS read from `.prj`/GeoJSON; unknown → reject or user-supplied EPSG (FR-1.5). Axis-order bugs guarded by tests.
- DPR maps rendered in `metric_epsg` (true scale bar) with lat/lon graticule labels.

### 4.2 Processing pipeline (worker job `acquire_aoi_data`)
1. **AOI normalise:** `make_valid`, dissolve, India-extent check, area cap → `project_aoi`.
2. **Work extent:** AOI buffered by `ROUTING_BUFFER_M` (default 5 km) for routing/infrastructure context.
3. **Per-source fetchers** (`ingest/*.py`), each returning `LayerResult(status, path|rows, metadata)`:
   - Buildings → DuckDB bbox query on GeoParquet (or reference file) → clip → PostGIS `buildings`.
   - DEM → windowed COG read → GeoTIFF in `DATA_DIR/projects/{id}/dem.tif`; slope derived (Horn method) → `slope.tif`.
   - WorldCover → windowed read → `landcover.tif` (classes: tree, water, built-up, cropland…).
   - Night lights → HREA (lightscore/reliability) COG for state `IND-OR`, else VIIRS annual composite → `nightlights.tif`.
   - OSM → Overpass query (roads, waterways, power, amenities) → PostGIS `osm_features`/`infrastructure_assets` (provenance `OSM`).
   - Solar → NASA POWER climatology for AOI centroid (and per-cluster if > 0.5° spread) → `solar_resource` table.
4. **Provenance:** each fetch writes a `project_layers` row (status, dataset, retrieved_at, counts, bbox, error).
5. **Failure semantics:** fetch failure → `FAILED` or `CACHED_FALLBACK`; never synthetic data (FR-2.3).
6. **Cache:** responses keyed by (source, version, bbox-hash) under `DATA_DIR/cache`.

### 4.3 Raster vs vector handling
| Data | Kind | Storage | Served to map as |
|---|---|---|---|
| Buildings (≤ ~50k/AOI) | Vector | PostGIS + GIST | MVT via `ST_AsMVT` (zoom ≥ 13), cluster polygons at lower zoom |
| Clusters, plan elements, infrastructure, AOI | Vector | PostGIS | GeoJSON (small) |
| DEM, slope, land cover, night lights | Raster | GeoTIFF files per project | Pre-rendered colourised PNG + bounds (MapLibre `image` source) |
| Cost surface | Raster | Transient NumPy / GeoTIFF | Not shown by default (debug layer) |

### 4.4 Settlement & classification algorithm (implements approved C1, C6)
1. Footprints filtered: confidence ≥ 0.70; area classes (noise < 9, outbuilding 9–12, residential 12–250, non-residential > 250 m²).
2. DBSCAN on residential centroids (ε 150 m, min_samples 5). Noise → isolated homesteads (grouped per 500 m grid cell for display).
3. Households = residential × α (0.90); census reconciliation flag if |Δ| > 30 %.
4. Evidence per cluster: `nl` (HREA lightscore, or normalised VIIRS radiance), `nl_reliability` (if HREA), `d_infra` (only if infrastructure with provenance ≠ none), `d_dt` (only if DT data exists), `d_electrified_cluster`, `d_road`, `n_buildings`, `canopy_share`.
5. **Proxy rules (all thresholds editable, status `PROVISIONAL`):**
   - `UNKNOWN` if `nl` missing, or n_buildings < 5, or rules conflict.
   - `LIKELY_ELECTRIFIED` if nl ≥ 0.75 and (no infra data or d_infra ≤ 1 km).
   - `POTENTIALLY_UNSERVED` if nl < 0.20 and (d_infra > 1 km, or — when no infra data — d_electrified_cluster > 1 km).
   - `POTENTIALLY_UNDERSERVED` if 0.20 ≤ nl < 0.75, or (DT data exists and d_dt > 500 m), or HREA reliability low.
6. **Confidence:** `LOW` or `MEDIUM` only for proxy classes (`MEDIUM` requires ≥ 2 agreeing evidence types); `HIGH` is reserved for verified states.
7. Verification (ledger) produces the separate verified outcome; never edits proxy fields.

### 4.5 Planning algorithm
1. Strategy per cluster (auto least-cost unless forced).
2. DT: demand-weighted medoid of buildings, snapped to nearest road/track within 100 m (else medoid). If max building distance along MST > `LT_MAX_M` (500 m) → split cluster by k-means(k=2…) on coordinates until satisfied.
3. HT route: cost raster at 30 m = base 1 × (1 + β_slope·tanθ) + forest penalty + water (impassable unless crossing width ≤ max span) − road discount; `MCP_Geometric` from tie-in cell to each DT; routes merged where they share cells (trunk + spurs) → vectorised, simplified (Douglas-Peucker 15 m).
4. LT: MST over DT + building-group centroids (groups = buildings within 30 m), poles at span spacing.
5. Mini-grid: generation site at cluster medoid; LT distribution as above. SHS: one system per estimated household.
6. Outputs written as `plan_elements` (geometry + attributes + `user_edited` flag).

---

## 5. Data Model

### 5.1 Conventions
UUID primary keys (except reference tables keyed by official codes) · `created_at/updated_at` (timestamptz) · soft delete via `deleted_at` on projects · enums as PostgreSQL enums or check constraints · geometry SRID 4326 with GIST index · every analytical row has `quality_tag` and `source_ref` · append-only tables have no UPDATE/DELETE grants for the app role (enforced by trigger).

### 5.2 Tables (MVP)

| Group | Table | Key columns |
|---|---|---|
| Auth | `users` | id, email (unique, citext), password_hash, display_name, role (`ADMIN`/`PLANNER`), is_active |
| | `sessions` | id (random 256-bit, hashed at rest), user_id, csrf_token_hash, expires_at, last_seen_at, ip, user_agent |
| Reference | `admin_units` | lgd_code PK, level (state/district/subdistrict/block/gp/village), name, parent_lgd_code, census2011_code, geom (nullable MultiPolygon), boundary_source |
| | `census_villages` | census2011_code PK, state/district/subdistrict codes, name, total_pop, households, st_pop, sc_pop, amenities jsonb, power_supply_2011 jsonb |
| | `datasets` | id, key (unique), name, provider, url, licence, licence_url, attribution_text, spatial_resolution, temporal_coverage, version, notes, is_non_commercial |
| | `engineering_constants` | key PK, value, unit, description, citation, status (`PROVISIONAL`/`SOURCE_VERIFIED`), updated_by, updated_at |
| | `rate_templates` | id, name, owner_id (null=global), region, base_year, source_summary, version |
| | `rate_items` | id, template_id, item_code, description, category, unit, rate_inr (nullable ⇒ UNSET), source_type, citation, source_year |
| Project | `projects` | id, owner_id, name, description, scheme, base_year, horizon_years, discount_rate, load_tier, metric_epsg, status, version (optimistic lock), deleted_at |
| | `project_aoi` | project_id PK/FK, geom MultiPolygon, boundary_source (`HARMONISED`/`APPROXIMATE_BUFFER`/`USER_DRAWN`/`USER_UPLOADED`), area_km2, lgd_code, census2011_code, upload_filename, original_crs |
| | `project_layers` | id, project_id, dataset_id, layer_key, status, retrieved_at, feature_count, file_path, bbox, error_message, cache_key |
| | `project_settings` | project_id, key, value jsonb, default_value jsonb, unit, quality_tag, citation, is_user_edited (= assumptions register) |
| Settlements | `cluster_runs` | id, project_id, params jsonb, created_at, is_current |
| | `buildings` | id, project_id, dataset_id, source_feature_id, geom Polygon, centroid Point, area_m2, confidence, size_class, cluster_run_id, cluster_id (nullable), is_user_added, is_excluded |
| | `clusters` | id, cluster_run_id, project_id, label, geom Polygon, centroid, is_isolated_group, n_detected, n_residential, n_non_residential, est_households, census_hh_ref, evidence jsonb, proxy_class, proxy_confidence, d_infra_m, d_road_m, slope_mean_deg, canopy_share |
| Infrastructure | `infrastructure_assets` | id, project_id, asset_type (`HT_LINE`/`LT_LINE`/`POLE`/`DT`/`SUBSTATION`/`TIE_IN`), voltage_kv, rating_kva, geom (generic), provenance (`UTILITY_RECORD`/`FIELD_SURVEY`/`USER_ASSUMED`/`OSM`), dataset_id, source_note, attributes jsonb |
| | `osm_features` | id, project_id, category (road/water/amenity), tags jsonb, geom |
| | `solar_resource` | id, project_id, lat, lon, monthly_ghi jsonb, monthly_t2m jsonb, worst_month, worst_ghi, source dataset_id, retrieved_at |
| Verification | `verification_records` (append-only) | id, project_id, target_type (`CLUSTER`/`BUILDING`/`HOUSEHOLD_POINT`), target_id, attribute, previous_value jsonb, new_value jsonb, evidence_type, verifier_name, observed_on, note, geom, import_batch_id, reverses_id, created_by, created_at |
| | `verification_imports` | id, project_id, filename, row_count, matched, unmatched, report jsonb, created_by |
| Scenarios | `scenarios` | id, project_id, name, kind (`ALL_GRID`/`ALL_OFFGRID`/`HYBRID`/`CUSTOM`), is_pinned, params jsonb, input_hash, status, computed_at |
| | `cluster_strategies` | scenario_id, cluster_id, mode (`AUTO`/`FORCE_GRID`/`FORCE_MINIGRID`/`FORCE_SHS`), chosen_option, rationale jsonb |
| | `demand_results` | scenario_id, cluster_id, category, connected_kw, max_demand_kw, energy_kwh_day, peak_kw, peak_kva, peak_kva_horizon, inputs jsonb |
| | `plan_elements` | id, scenario_id, cluster_id, element_type (`DT`/`HT_LINE`/`LT_LINE`/`POLE`/`MINIGRID_SITE`/`SHS_SET`), geom, attributes jsonb, user_edited, quality_tag='ESTIMATED' |
| | `calc_results` | id, scenario_id, element_id (nullable), calc_type, formula_ref, inputs jsonb, outputs jsonb, passed (nullable), message |
| | `boq_lines` | id, scenario_id, cluster_id (nullable), rate_item_id, item_code, description, unit, quantity, rate_inr, rate_source, amount_inr, quantity_basis |
| Ops | `jobs` | id, project_id, job_type, status (`QUEUED`/`RUNNING`/`SUCCEEDED`/`FAILED`/`CANCELLED`), progress (0–100), stage, params jsonb, result jsonb, error, attempts, locked_by, locked_at, created_by, created_at, finished_at |
| | `exports` | id, project_id, scenario_id, kind (`PDF`/`XLSX`/`GEOJSON`/`CSV`), file_path, file_sha256, snapshot_hash, preflight jsonb, created_by, created_at |
| | `audit_events` | id, project_id, actor_id, event_type, entity, entity_id, diff jsonb, created_at |

### 5.3 Entity relationships

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : has
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--|| PROJECT_AOI : bounded_by
    PROJECTS ||--o{ PROJECT_LAYERS : has
    DATASETS ||--o{ PROJECT_LAYERS : describes
    PROJECTS ||--o{ PROJECT_SETTINGS : assumes
    PROJECTS ||--o{ CLUSTER_RUNS : runs
    CLUSTER_RUNS ||--o{ CLUSTERS : produces
    CLUSTERS ||--o{ BUILDINGS : groups
    PROJECTS ||--o{ INFRASTRUCTURE_ASSETS : has
    PROJECTS ||--o{ VERIFICATION_RECORDS : records
    PROJECTS ||--o{ SCENARIOS : evaluates
    SCENARIOS ||--o{ CLUSTER_STRATEGIES : assigns
    SCENARIOS ||--o{ DEMAND_RESULTS : computes
    SCENARIOS ||--o{ PLAN_ELEMENTS : lays_out
    SCENARIOS ||--o{ CALC_RESULTS : checks
    SCENARIOS ||--o{ BOQ_LINES : costs
    RATE_TEMPLATES ||--o{ RATE_ITEMS : contains
    RATE_ITEMS ||--o{ BOQ_LINES : priced_by
    PROJECTS ||--o{ JOBS : queues
    PROJECTS ||--o{ EXPORTS : exports
    ADMIN_UNITS ||--o{ ADMIN_UNITS : parent_of
    ADMIN_UNITS ||--o| CENSUS_VILLAGES : linked_to
```

### 5.4 Indexes & integrity
GIST on every `geom`/`centroid`; B-tree on all `project_id` FKs, `(project_id, cluster_run_id)`, `jobs(status, created_at)`; partial unique index `scenarios(project_id) WHERE is_pinned`; FK `ON DELETE CASCADE` from project children (hard delete only via admin purge); trigger blocking UPDATE/DELETE on `verification_records`; `CHECK (ST_IsValid(geom))` on `project_aoi`.

---

## 6. API Specification (REST, `/api/v1`, JSON; OpenAPI at `/api/docs`)

Errors use one envelope: `{"error": {"code": "AOI_TOO_LARGE", "message": "...", "details": {...}}}`. Pagination: `?limit=&cursor=`. All project routes require session + ownership (else 404, to avoid leaking existence). Mutations require `X-CSRF-Token`.

| Area | Method & path | Purpose |
|---|---|---|
| Auth | `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` | Session lifecycle (login rate-limited) |
| Projects | `GET/POST /projects` · `GET/PATCH/DELETE /projects/{id}` · `POST /projects/{id}/duplicate` | CRUD (PATCH requires `version`) |
| Admin lookup | `GET /admin-units?parent=&level=` · `GET /admin-units/search?q=` · `GET /admin-units/{lgd}/boundary` | Cascading selection, local search |
| AOI | `PUT /projects/{id}/aoi` (GeoJSON or admin unit) · `POST /projects/{id}/aoi/upload` (multipart) · `GET /projects/{id}/aoi` | Validate, normalise, store |
| Data | `POST /projects/{id}/data/acquire` → job · `GET /projects/{id}/layers` · `GET /projects/{id}/layers/{key}/image` (PNG + bounds) · `POST /projects/{id}/layers/upload` | Acquisition & provenance |
| Tiles | `GET /tiles/{project_id}/{layer}/{z}/{x}/{y}.mvt` | Buildings/clusters vector tiles |
| Settlements | `POST /projects/{id}/clustering` → job · `GET /projects/{id}/clusters` · `GET /projects/{id}/clusters/{cid}` · `PATCH /projects/{id}/buildings/{bid}` (exclude/include) · `POST /projects/{id}/buildings` (manual add) | Clustering & classification |
| Infrastructure | `GET/POST /projects/{id}/infrastructure` · `PATCH/DELETE …/{aid}` · `POST /projects/{id}/infrastructure/upload` · `POST /projects/{id}/gap-analysis` → job | Tie-ins & gap metrics |
| Settings | `GET /projects/{id}/settings` · `PATCH /projects/{id}/settings` · `POST /projects/{id}/settings/reset` | Assumptions register |
| Scenarios | `GET/POST /projects/{id}/scenarios` · `PATCH …/{sid}` (strategies, pin) · `POST …/{sid}/plan` → job · `POST …/{sid}/recalculate` (sync demand/engineering/BOQ) | Planning lifecycle |
| Results | `GET …/{sid}/demand` · `GET …/{sid}/plan-elements` · `PATCH …/{sid}/plan-elements/{eid}` (move DT / edit route) · `GET …/{sid}/calculations` · `GET …/{sid}/boq` · `GET /projects/{id}/comparison` | Outputs |
| Rates | `GET/POST /rate-templates` · `GET/PATCH /rate-templates/{tid}` · `POST /rate-templates/import` (CSV) · `GET /rate-templates/{tid}/export` · `PUT /projects/{id}/rate-template` | Cost sources |
| Verification | `POST /projects/{id}/verifications` · `POST /projects/{id}/verifications/import` (CSV) → job · `GET /projects/{id}/verifications` · `POST …/{vid}/reverse` | Ledger |
| Reports | `GET /projects/{id}/report/preflight` · `POST /projects/{id}/exports` {kinds} → job · `GET /projects/{id}/exports` · `GET /exports/{eid}/download` | DPR |
| Jobs | `GET /jobs/{jid}` · `POST /jobs/{jid}/cancel` · `GET /projects/{id}/jobs` | Progress polling |
| Admin | `GET/PATCH /admin/constants` · `GET /admin/datasets` · `GET /admin/health/sources` · `GET/POST /admin/users` (P1 UI) | Administration |
| System | `GET /health` (liveness) · `GET /health/ready` (DB) | Ops |

---

## 7. Authentication & Security Architecture

### 7.1 Login flow
```mermaid
sequenceDiagram
    participant B as Browser (SPA)
    participant A as FastAPI
    participant D as PostgreSQL
    B->>A: POST /auth/login {email, password}
    A->>D: fetch user by email
    A->>A: Argon2id verify (constant-time); rate-limit per IP+email
    A->>D: insert session (hashed id, csrf hash, expiry 12h sliding, 7d absolute)
    A-->>B: Set-Cookie: em_session (HttpOnly; Secure*; SameSite=Lax) + body {user, csrfToken}
    B->>A: PATCH /projects/{id} + Cookie + X-CSRF-Token
    A->>D: validate session, csrf, ownership
    A-->>B: 200 / 401 / 403→404
```
*`Secure` disabled only when `APP_ENV=development` on http://localhost.*

### 7.2 Security controls
- **Authorisation:** dependency `require_project_access(project_id, action)` on every project route; MVT tiles also check ownership.
- **Input validation:** Pydantic schemas with bounds (e.g. horizon 1–30, rates ≥ 0); geometry validated server-side.
- **Uploads:** size limit (`MAX_UPLOAD_MB`, default 25), extension + magic-byte check, zip: entry count/size limits, compression-ratio check (zip-bomb), reject absolute/`..` paths, extract to per-job temp dir; vertex limit; CSV row limit (default 50k).
- **Expensive operations:** AOI area cap; per-user concurrent job limit (default 2); job timeouts; Overpass/NASA calls rate-limited and cached.
- **Secrets:** only in `.env` (gitignored); `.env.example` committed; no keys required for MVP sources.
- **Headers:** CSP (self + allowed tile hosts), `X-Content-Type-Options`, `Referrer-Policy`, frame-ancestors none.
- **Privacy:** field data visible only to project owner; exports contain verifier names only if user opts in (default: initials).
- **Dependencies:** `pip-audit` and `npm audit` in CI (free).

---

## 8. Folder Structure

```
electrimap/
├── AGENTS.md  CLAUDE.md  README.md
├── PROJECT_STATUS.md  TASKS.md  CHANGELOG.md
├── docs/
│   ├── PROJECT_CONTEXT.md  PRD.md  ARCHITECTURE.md  DESIGN_SYSTEM.md
│   ├── KNOWN_ISSUES.md  DECISIONS.md
│   ├── methodology/ (gis.md, engineering.md, costing.md, classification.md)
│   ├── dpr-template.md
│   └── data-sources.md
├── backend/
│   ├── pyproject.toml  uv.lock  alembic.ini
│   ├── app/
│   │   ├── main.py
│   │   ├── core/        (config.py, logging.py, errors.py, security.py, storage.py)
│   │   ├── db/          (session.py, base.py, models/*.py)
│   │   ├── api/v1/      (auth.py, projects.py, aoi.py, data.py, tiles.py, settlements.py,
│   │   │                 infrastructure.py, settings.py, scenarios.py, rates.py,
│   │   │                 verification.py, reports.py, jobs.py, admin.py, deps.py)
│   │   ├── schemas/     (pydantic request/response models)
│   │   ├── services/    (orchestration: DB + domain + storage)
│   │   ├── domain/      (PURE logic, no I/O)
│   │   │   ├── gis/         (crs.py, validation.py, clustering.py, classification.py,
│   │   │   │                 raster_ops.py, cost_surface.py, routing.py, lt_network.py)
│   │   │   ├── engineering/ (demand.py, growth.py, transformer.py, lines.py, conductors.py,
│   │   │   │                 voltage_drop.py, losses.py, service.py, solar.py, economics.py)
│   │   │   └── costing/     (boq.py, rates.py)
│   │   ├── ingest/      (buildings.py, dem.py, landcover.py, nightlights.py, osm.py, solar.py, census.py)
│   │   ├── reports/     (dpr/ (sections/*.py, builder.py, styles.py), maps.py, charts.py,
│   │   │                 excel.py, geo_export.py)
│   │   └── worker/      (runner.py, registry.py, jobs/*.py)
│   ├── migrations/
│   └── tests/ (unit/, integration/, fixtures/)
├── frontend/
│   ├── package.json  vite.config.ts  tsconfig.json  tailwind.config.ts
│   ├── src/
│   │   ├── app/         (router.tsx, providers.tsx, layout/)
│   │   ├── pages/       (Landing, Login, Projects, NewProject, Workspace, Report, Audit, Settings)
│   │   ├── features/    (projects/, aoi/, workspace/{data,settlements,infrastructure,planning,
│   │   │                 engineering,cost,compare}/, report/, audit/, settings/, auth/)
│   │   ├── components/
│   │   │   ├── ui/      (Button, Input, Select, Tabs, Dialog, Table, Badge, QualityTag, …)
│   │   │   └── map/     (MapCanvas, LayerPanel, Legend, Inspector, DrawControl, MeasureControl,
│   │   │                 BasemapSwitcher, CoordinateReadout, ScaleBar)
│   │   ├── lib/         (api/ (generated types + client), format.ts, units.ts, mapStyles.ts)
│   │   ├── state/       (zustand stores)
│   │   └── styles/      (tokens.css, globals.css)
│   └── tests/ (unit via Vitest; e2e/ via Playwright)
├── scripts/  (fetch_reference_data.py, seed_reference.py, create_admin.py, gen_api_types.sh)
├── data/     (gitignored except data/reference/MANIFEST.json + small fixtures)
├── docker-compose.yml        (db; optional api/worker/web profile)
├── .env.example  .gitignore  .editorconfig
└── .github/workflows/ci.yml
```

---

## 9. Environment Variables (`.env.example`)

| Variable | Example / default | Purpose |
|---|---|---|
| `APP_ENV` | `development` | development / test / demo |
| `DATABASE_URL` | `postgresql+psycopg://electrimap:***@localhost:5432/electrimap` | Primary DB |
| `TEST_DATABASE_URL` | `…/electrimap_test` | Integration tests |
| `SESSION_SECRET` | *(random 64 bytes, generated locally)* | Signing/hashing session & CSRF tokens |
| `SESSION_TTL_HOURS` / `SESSION_ABSOLUTE_DAYS` | `12` / `7` | Session lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Dev only (prod is same-origin) |
| `DATA_DIR` | `./data` | Uploads, rasters, cache, exports |
| `MAX_UPLOAD_MB` · `MAX_AOI_KM2` · `MAX_JOBS_PER_USER` | `25` · `500` · `2` | Limits |
| `OFFLINE_MODE` | `false` | If true, worker uses only cache/reference data |
| `OVERPASS_URL` | `https://overpass-api.de/api/interpreter` | OSM queries |
| `NASA_POWER_URL` | `https://power.larc.nasa.gov/api` | Solar resource |
| `BUILDINGS_PARQUET_URL` | *(set after Spike S1)* | Footprint source |
| `DEM_COG_BASE` · `WORLDCOVER_COG_BASE` · `NIGHTLIGHTS_SOURCE` | public bucket URLs | Raster sources |
| `HTTP_USER_AGENT` | `ElectriMapDPR/0.1 (contact email)` | Required etiquette for free APIs |
| `VITE_API_BASE` | `/api/v1` | Frontend |
| `VITE_BASEMAP_VECTOR_STYLE` | `https://tiles.openfreemap.org/styles/liberty` | Street basemap |
| `VITE_BASEMAP_SATELLITE_URL` | EOX Sentinel-2 cloudless WMTS template | Satellite basemap |
| `LOG_LEVEL` | `INFO` | Logging |

No paid keys. If VIIRS EOG (free registration) is used, `EOG_TOKEN` is optional and only stored in `.env`.

---

## 10. Deployment Architecture

| Mode | Components | Notes |
|---|---|---|
| **Local development (primary)** | Docker: `db` (postgis/postgis:16-3.4) · native: `uv run uvicorn app.main:app --reload`, `uv run python -m app.worker.runner`, `npm run dev` (Vite proxy → API) | Fallback: native PostgreSQL + PostGIS (StackBuilder) if Docker unavailable |
| **Demo / evaluation** | `docker compose --profile full up`: `db`, `api` (serves built SPA as static files), `worker` | One command, offline-capable with reference data |
| **Optional free public hosting (P1, not MVP)** | Candidates to evaluate later: free managed Postgres with PostGIS (e.g. Neon/Supabase free tiers) + a free container host; static SPA on GitHub Pages/Cloudflare Pages | Free tiers sleep/limit storage → not relied on for evaluation (decision AD-07) |

CI (GitHub Actions): backend lint/type/unit/integration (PostGIS service container), frontend lint/type/unit/build, E2E on demand.

---

## 11. Observability, Performance & Scalability
- Structured logs with `request_id`, `user_id`, `project_id`, `job_id`; job stages and durations stored in `jobs`.
- Performance budget (NFR-02/03) measured on the reference AOI in M8; query plans checked for spatial queries using `EXPLAIN ANALYZE`.
- Map: MVT for buildings, `minzoom` gating, feature-state for hover/selection, simplified cluster polygons, PNG rasters.
- Scale path (post-MVP, not built): multiple workers (already supported by SKIP LOCKED), S3-compatible storage behind `Storage`, tile caching.

---

## 12. Data Sources — Free Access Paths (verified status)

| Source | Access path | Licence | Status |
|---|---|---|---|
| Google Open Buildings v3 (+ Microsoft) | Google S2-tile downloads (`gs://open-buildings-data/v3/`, tiles index) or community cloud-native GeoParquet (Source Cooperative `vida/google-microsoft-open-buildings`) | CC BY 4.0 (Google); ODbL (Microsoft) | India coverage confirmed in docs; bbox query path to verify (Spike S1) |
| Copernicus GLO-30 DEM | `s3://copernicus-dem-30m/` public COGs (no sign request) | Copernicus DEM licence (free, attribution) | Confirmed public bucket |
| ESA WorldCover 10 m | `s3://esa-worldcover/` public COGs | CC BY 4.0 | Confirmed public bucket |
| HREA | University of Michigan HREA; COGs per country, **India split into state files `IND-XX`** | CC BY 4.0 (verify) | **India included (resolves C2)**; temporal range & download path to verify in S1 |
| VIIRS VNL annual | Colorado School of Mines EOG (free registration) | CC BY 4.0 | Fallback |
| OpenStreetMap | Overpass API (fair use) / Geofabrik extracts | ODbL | Confirmed |
| NASA POWER | Keyless REST | Public | Confirmed |
| Census 2011, LGD, SHRUG/DataMeet | Manual downloads → seed scripts | NDSAP / CC BY / SHRUG terms | Manual seed |
| Basemap (vector) | OpenFreeMap, keyless, no limits for reasonable use, attribution "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" | ODbL data | Confirmed |
| Basemap (satellite) | EOX Sentinel-2 cloudless: **2016 = CC BY 4.0**; 2018+ = CC BY-NC-SA 4.0 | as stated | Confirmed; choice = decision AD-06 |
| Bhuvan WMS | Optional overlay | Govt terms | Optional, not relied on |

---

## 13. Architecture Decisions Requiring Approval

| ID | Decision | Recommendation |
|---|---|---|
| **AD-01** | Replace Next.js (Prompt 0 suggestion) with **Vite + React SPA** | Approve: no SSR need, one fewer runtime |
| AD-02 | Postgres-backed job queue instead of Celery/Redis | Approve |
| AD-03 | ReportLab + Matplotlib for the PDF (Playwright HTML→PDF as fallback after Spike S3) | Approve |
| AD-04 | Cookie sessions + Argon2id + CSRF (no JWT, no third-party auth) | Approve |
| AD-05 | Local filesystem storage behind an interface | Approve |
| **AD-06** | Satellite basemap: EOX **2016 (CC BY)** by default, newer years (CC BY-NC-SA, non-commercial) selectable with licence notice | Approve (college, non-commercial) |
| **AD-07** | MVP evaluated **locally / via Docker Compose**; public free hosting deferred to P1 | Approve (Q2 default) |
| AD-08 | scikit-image `MCP_Geometric` for HT routing; SciPy MST for LT | Approve |
