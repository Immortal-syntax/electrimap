# TASKS.md — Project Roadmap & Task Execution Tracker

> **Tracking Convention:** `[ ] TODO` · `[-] IN_PROGRESS` · `[x] DONE` · `[!] BLOCKED`  
> **Source of Truth:** Derived directly from approved `docs/ROADMAP.md`.

---

## Preparation & Planning (Prompts 0–3)
- [x] **PROMPT-0:** Comprehensive Project Definition, Research & Feasibility Evaluation *(Approved 2026-11-05)*
- [x] **PROMPT-1:** Product Discovery, Requirements Validation & PRD *(Approved 2026-11-05)*
- [x] **PROMPT-2:** Technical Architecture, UI/UX Design System & Roadmap *(Approved 2026-11-06)*
- [x] **PROMPT-3:** Environment Inspection, Git/GitHub Setup & Permanent Instructions *(Approved 2026-11-06)*
- [x] **PROMPT-4:** Milestone Implementation & Continuous Verification *(Completed — Milestones M0–M8 Verified)*
- [x] **PROMPT-5:** Production Readiness, Debugging & Handover *(Completed 2026-11-07)*

---

## Milestone M0: Tooling, Database Setup & Spikes
- [x] **M0-1:** Establish Monorepo directory structure, editorconfig, and tooling configs
- [x] **M0-2:** Backend environment setup (Python 3.12/3.13, FastAPI base, linting, test runner)
- [x] **M0-3:** PostGIS database connectivity, SQLAlchemy models, and Alembic migrations
- [x] **M0-4:** Frontend scaffolding (Vite + React + TypeScript + Tailwind + MapLibre setup)
- [x] **M0-5:** GitHub Actions CI pipeline configuration
- [x] **S1 (Spike):** Koraput reference data acquisition & verification test
- [x] **S2 (Spike):** DEM slope cost-surface raster routing feasibility check
- [x] **S3 (Spike):** ReportLab PDF cartographic rendering test with north arrow & scale bar
- [x] **S4 (Spike):** MapLibre MVT performance test with 50k building footprints
- [x] **M0-6:** Milestone M0 Review & Checkpoint verification

---

## Milestone M1: Core Authentication, Project & AOI Module
- [x] **M1-1:** User auth, session store, CSRF, and security dependencies
- [x] **M1-2:** Project CRUD API with optimistic concurrency locking
- [x] **M1-3:** Administrative unit and Census database lookup seeding
- [x] **M1-4:** GIS CRS reprojection and boundary geometry validation service
- [x] **M1-5:** Boundary file upload handler (Shapefile zip, GeoJSON, KML)
- [x] **M1-6:** Frontend application shell, layout, and session state
- [x] **M1-7:** Interactive MapCanvas with MapLibre GL JS and basemap switching
- [x] **M1-8:** AOI selection wizard (administrative cascade, drawing, and upload)

---

## Milestone M2: Geospatial Ingestion, Provenance & Reference Pack
- [x] **M2-1:** Transactional background job queue and worker process
- [x] **M2-2:** Dataset provenance registry and metadata schema
- [x] **M2-3:** Spatial data ingestion pipelines (buildings, DEM, landcover, nightlights, OSM, solar)
- [x] **M2-4:** Background AOI data clipping and processing coordinator
- [x] **M2-5:** Koraput offline demonstration dataset packaging
- [x] **M2-6:** PostGIS vector tile (`ST_AsMVT`) and raster preview endpoints
- [x] **M2-7:** Workspace Data Management panel with provenance cards

---

## Milestone M3: Settlement Identification & Verification Ledger
- [x] **M3-1:** Building footprint filtering and DBSCAN habitation clustering
- [x] **M3-2:** Zonal statistics extraction and 4-tier proxy classification engine
- [x] **M3-3:** Cluster persistence API and Census household reconciliation
- [x] **M3-4:** Immutable verification audit ledger and CSV import processor
- [x] **M3-5:** Interactive Settlement Assessment UI with synchronized map inspector
- [x] **M3-6:** Verification Audit Log and field correction dashboard
- [x] **M3-7:** Preliminary DPR PDF skeleton generation with dynamic maps

---

## Milestone M4: Infrastructure Gap Analysis & Demand Engine
- [x] **M4-1:** Existing electrical infrastructure management and interactive tie-in placement
- [x] **M4-2:** Terrain-weighted distance and obstacle gap analysis matrix
- [x] **M4-3:** Project-level assumptions register with parameter edit tracking
- [x] **M4-4:** 7-category parametric electricity demand estimation engine
- [x] **M4-5:** Interactive Infrastructure and Demand Workspace panels
- [x] **M4-6:** DPR engineering demand and gap analysis section export

---

## Milestone M5: Network Layout Routing & Engineering Engine
- [x] **M5-1:** Engineering constants table verification against REC/IS standards
- [x] **M5-2:** Distribution transformer placement and radial distance constraints
- [x] **M5-3:** 11 kV HT feeder least-cost path routing algorithm
- [x] **M5-4:** 415V LT radial network Minimum Spanning Tree and pole allocation
- [x] **M5-5:** Deterministic engineering calculations (voltage drop, technical losses, solar/BESS sizing)
- [x] **M5-6:** Synchronous scenario planning and recalculation engine
- [x] **M5-7:** Planning and Network Layout interactive editing UI
- [x] **M5-8:** DPR engineering calculations and Single-Line Diagram export

---

## Repository Audit: Error Remediation, GitHub Community Standards & Apache 2.0 Compliance
- [x] **AUDIT-1:** Audit entire codebase and resolve test harness typing and scenario isolation issues
- [x] **AUDIT-2:** Implement full GitHub Community Standards (`README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, Issue & PR templates)
- [x] **AUDIT-3:** Verify Apache 2.0 compliance (unmodified `LICENSE`, `NOTICE` file with 6 dataset attributions, standard license headers on source files)
- [x] **AUDIT-4:** Verify all quality gates (`ruff`, `mypy`, `pytest`, `eslint`, `tsc`, `vitest`, `build`) and push to GitHub

---

## Milestone M6: Traceable Cost Estimation & Scenarios
- [x] **M6-1:** Schedule of Rates (SoR) management and custom CSV import
- [x] **M6-2:** Automated Bill of Quantities (BOQ) generator and financial metrics
- [x] **M6-3:** Scenario comparison engine (Grid vs. Mini-Grid vs. SHS vs. Hybrid)
- [x] **M6-4:** Interactive Cost BOQ spreadsheet and Scenario Comparison UI
- [x] **M6-5:** DPR financial statements and cost abstract export

---

## Milestone M7: Complete 24-Section DPR, Excel & GIS Exports
- [x] **M7-1:** Comprehensive 24-section PDF DPR compilation engine
- [x] **M7-2:** Pre-flight engineering and data integrity audit validation
- [x] **M7-3:** Formula-driven multi-sheet Excel BOQ workbook generator
- [x] **M7-4:** Cleaned GIS vector package export (GeoJSON/Shapefile/CSV)
- [x] **M7-5:** Export job logging and cryptographic document hashing
- [x] **M7-6:** DPR preview, map framing, and export download center

---

## Milestone M8: System Hardening, Benchmarking & Production Audit
- [x] **M8-1:** Geospatial spatial query and map rendering performance optimization
- [x] **M8-2:** Comprehensive accessibility audit and keyboard navigation review
- [x] **M8-3:** End-to-end automated integration tests for complete user journeys
- [x] **M8-4:** Security penetration review, input fuzzing, and dependency audit
- [x] **M8-5:** Docker container configuration and offline evaluation readiness
- [x] **M8-6:** Comprehensive technical documentation and user manual finalization

---

## UI / UX Redesign & Vision Reset
- [x] **VISION-RESET-1:** Softened cartographic design system tokens, elevation, shell navigation, and shared UI primitives *(Completed 2026-11-15)*
- [x] **VISION-RESET-2:** Live interactive MapLibre hero composition on `/`, foregrounded portfolio register on `/projects`, and integrated GIS overview workspace on `/projects/:id/workspace` *(Completed 2026-11-15)*
- [x] **VISION-RESET-3:** Specialised GIS workstation HUD/legend/inspector polish, desktop Cost BOQ column alignment, mobile `390x844` responsive verification, and zero-regression test suite pass *(Completed 2026-11-15)*

## Full-Stack Product Audit & Master Remediation (`AUD-01`–`AUD-29`)
- [x] **REMEDIATION-PHASE-1:** Epistemic honesty, strict demo/non-demo GIS isolation, zero-cluster export gates, `UNSET` total withholding, verified-cluster confirmation, and transactional wizard validation (`AUD-01`, `AUD-03`–`AUD-05`, `AUD-07`, `AUD-09`–`AUD-11`, `AUD-18`, `AUD-19`, `AUD-23`) *(Completed 2026-11-15)*
- [x] **REMEDIATION-PHASE-2:** Engineering cascade sync (`load_tier`, Stage 3→4→5 consistency), SLD/PDF completeness, real terrain routing disclosure, auth redirect hardening, and error visibility (`AUD-02`, `AUD-06`, `AUD-08`, `AUD-12`–`AUD-17`, `AUD-20`) *(Completed 2026-11-15)*
- [x] **REMEDIATION-PHASE-3:** Multi-viewport responsive polish (`768px` header/panel stacking, `390px` basemap wrapping & bounded `GisFeatureInspectorDrawer`), `QualityTag` Lucide icons, modal scroll/focus traps, MVT wiring, `ref-buildings-fill` inspector dispatch, and live Edge CDP verification (`AUD-21`, `AUD-22`, `AUD-24`–`AUD-29`) *(Completed 2026-11-15)*

---

## Full Data Integrity, Contextual Help & End-to-End DPR PDF Audit Remediation
- [x] **AUDIT-PDF-TIER-1:** Real VIIRS/DEM/WorldCover raster sampling (`UNKNOWN` proxy when VIIRS unavailable), distinct Grid vs. Mini-Grid vs. SHS comparison economics, `1280 Wh` SHS BESS, `200 kVA` DT split limit, 1-phase impedance weighting, terrain-conditioned equipment supply, unified synthetic predicate (`CRIT-01`–`CRIT-05`, `HIGH-02`, `MED-03`) *(Completed 2026-11-16)*
- [x] **AUDIT-PDF-TIER-2:** SQLite `PRAGMA foreign_keys=ON`, deterministic cascading invalidation/resync (`backend/app/services/invalidation.py`), UTM cluster-building lookup, CSV NUL/header hardening, Excel growth/coincident demand totals & empty guards (`CRIT-06`, `HIGH-03`, `HIGH-04`) *(Completed 2026-11-16)*
- [x] **AUDIT-PDF-TIER-3:** 24-section DPR PDF layout & cartography overhaul (Plate 1 de-conflicted labels, Plate 2 network map, multi-row wrapped SLD, full table `Paragraph` wrapping, dynamic coincidence & `1.03x` sag, `O&M` fix) & frontend enum sync + blank wizard defaults (`HIGH-01`, `HIGH-05`) *(Completed 2026-11-16)*
- [x] **AUDIT-PDF-TIER-4:** Full technical glossary expansion (+8 terms, `NPV` -> `NPC`), constant alignment (`<12 m²`, `150 m` / `5` buildings), null guards, inline range labels, WCAG `24×24px` tooltip targets, `aria-pressed` & Escape handlers, live E2E + visual 12-page PDF + Edge CDP verification (`MED-01`, `MED-02`, `LOW-01`, `LOW-02`) *(Completed 2026-11-16)*
- [x] **UX-IA-STEP1-SIMPLIFICATION:** Task-focused Step 1 redesign (`Get your map ready`, `Fetch map data`), honest `Ready`/`Partially available`/`Action needed` status classification (`mapDataReadiness.ts`), collapsed `Data sources & technical information` drawer, consolidated single-icon tooltips, visible data-quality warnings, explicit `Next: Villages & Habitations` transition, and generalized overview provenance simplification *(Completed 2026-11-16)*
- [x] **UX-IA-STEP5-SIMPLIFICATION:** Simplified Step 5 (`CostAndScenarioComparisonPanel.tsx`, `beginnerGlossary.ts`) foregrounding Estimated project cost, Upfront cost per household, and Recommended electrification plan; moved NPC/LCOE/OPEX/subsidy metrics into collapsed `Financial details`; consolidated citations into collapsed `Rate sources & assumptions`; replaced repeated `ESTIMATED`/`Unit Prices Set` tags with honest rate-status breakdown (`Field-verified / Approved: 0`); simplified BOQ to 4 columns with expandable item details & inline rate controls and translated category labels *(Completed 2026-11-16)*
- [x] **AUTH-INDIVIDUAL-ACCOUNTS:** Implemented individual accounts for Swayam Kumar (`swayamkr26@gmail.com`) and Sumit Kushwaha (`sumitp@gmail.com`) with Argon2id backend hashes (`seed_service.py`), removed hardcoded frontend credentials/autofill (`LoginPage.tsx`), updated `AppShell` header to show only the authenticated user's full name (`Swayam Kumar` / `Sumit Kushwaha`), preserved shared Sample Study (`DEMO_PROJECT_ID`) access alongside private project isolation (`project_service.py`), and verified refresh persistence, sign-out invalidation, and browser-back protection *(Completed 2026-11-16)*
- [x] **MAIN-MERGE-PUSH-CLEANUP:** Merged `experiment` branch into `main` favoring `experiment` (`-X theirs`), pushed both `main` and `experiment` to GitHub (`origin`), reviewed and confirmed all 5 Dependabot branches as obsolete/irrelevant, deleted them from GitHub, and pruned stale remote refs *(Completed 2026-11-16)*


