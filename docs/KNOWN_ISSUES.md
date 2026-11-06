# KNOWN_ISSUES.md — Open Issues, Caveats & Limitations

This file tracks active engineering bottlenecks, data caveats, performance limitations, and environment-specific considerations for ElectriMap DPR.

---

## 1. Environment & Runtime Limitations

### KI-01: Windows CLI Environment Missing Docker and Native PostgreSQL
- **Severity:** Medium
- **Status:** Open / Documented
- **Discovered:** 2026-11-06 (Environment Audit)
- **Impact:** `docker` and `psql` are not currently in the Windows system `PATH`.
- **Mitigation / Next Step:** For Phase 4 implementation (Milestone M0), development will either run via native Windows PostgreSQL/PostGIS installer or install/configure Docker Desktop. SQLite/SpatiaLite or DuckDB spatial may serve as an auxiliary fallback for offline standalone parsing.

### KI-02: `uv` Package Manager Not Pre-Installed Globally
- **Severity:** Low
- **Status:** Open / Handled
- **Discovered:** 2026-11-06 (Environment Audit)
- **Impact:** System defaults to standard `python` (3.13.3) and `pip`.
- **Mitigation:** Can install `uv` via `pip install uv` or standard virtual environment `python -m venv .venv` during development setup.

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
