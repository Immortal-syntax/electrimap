# KNOWN_ISSUES.md — Open Issues, Caveats & Limitations

This file tracks active engineering bottlenecks, data caveats, performance limitations, and environment-specific considerations for ElectriMap DPR.

---

## 1. Environment & Runtime Limitations

### KI-01: Windows CLI Environment Missing Docker and Native PostgreSQL
- **Severity:** Medium
- **Status:** Open / Documented
- **Discovered:** 2026-11-06 (Environment Audit)
- **Impact:** `docker` and `psql` are not currently in the Windows system `PATH`.
- **Mitigation / Next Step:** Dual-mode SQLAlchemy spatial dialect (`SpatialGeometry`) allows seamless development/testing with SQLite/PostGIS, and docker-compose is prepared for containerized deployments.

### KI-02: `uv` Package Manager Not Pre-Installed Globally
- **Severity:** Low
- **Status:** Open / Handled
- **Discovered:** 2026-11-06 (Environment Audit)
- **Impact:** System defaults to standard `python` (3.13.3) and `pip`.
- **Mitigation:** Development runs via standard virtual environment `python -m venv .venv`.

### KI-06: Unanchored `lib/` in Root `.gitignore` Skipped `frontend/src/lib/apiClient.ts`
- **Severity:** High
- **Status:** Resolved (2026-11-06)
- **Impact:** GitHub Actions CI failed with `TS2307: Cannot find module '../lib/apiClient'` on clean checkout because Git ignored `frontend/src/lib/apiClient.ts`.
- **Resolution:** Anchored `.gitignore` Python build rules to `backend/build/` and `backend/lib/`, added `frontend/src/lib/apiClient.ts` to Git, and configured TypeScript global GeoJSON typings.

### KI-07: Dev-Time and Framework Advisories in npm Audit (`react-router` / `vitest`)
- **Severity:** Medium
- **Status:** Documented / Handled (2026-11-06)
- **Impact:** `npm audit` reports moderate advisories for `react-router` (open redirect via backslash, SSR hydration `deserializeErrors()`) and dev-test runner `vitest` (`tinypool` prototype pollution, dev-server UI RCE).
- **Mitigation:**
  - Upgraded `maplibre-gl` from `4.7.1` to `6.16.0` to eliminate the critical CVSS 10.0 XSS advisory (`GHSA-jrc7-96c5-q579`).
  - ElectriMap DPR is a pure client-side SPA with static route paths, avoiding SSR hydration vulnerabilities in `react-router`. Vitest is used strictly as a local/CI CLI test runner without public UI server exposure.

---

## 2. Geospatial & Data Limitations

### KI-03: Decennial Census Baseline (2011) Lag
- **Severity:** Medium
- **Status:** Ongoing Methodological Caveat
- **Impact:** Official Census of India village demographics are 15 years old.
- **Mitigation:** Compounded annual growth projections applied; satellite building footprint counts cross-calibrated against Census household numbers. Significant variations (>30%) are highlighted for field verification.

### KI-04: Coarse VIIRS Nighttime Radiance (~500m Pixel Resolution)
- **Severity:** Medium
- **Status:** Ongoing Methodological Caveat
- **Impact:** Single isolated dwellings with low-wattage LED lights may not register statistically above background noise at 1:30 AM overpass times.
- **Mitigation:** Radiance indicators applied only at the multi-household cluster level; isolated or inconclusive clusters strictly categorized as `UNKNOWN` rather than forced into unserved status.

### KI-05: Absence of Public Distribution Network GIS Data in OpenStreetMap
- **Severity:** High
- **Status:** Ongoing Methodological Caveat
- **Impact:** 11 kV feeders and 415V LT poles are rarely mapped in public OSM layers for rural India.
- **Mitigation:** The system never fabricates grid lines. If no user GIS layer is uploaded, the planner is prompted to interactively designate an `Assumed Tie-In Point`.
