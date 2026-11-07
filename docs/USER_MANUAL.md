# ElectriMap DPR — Planner & Evaluator User Manual

> **Version:** 0.1.0 (Milestone M8 Production Release)  
> **Reference Geography:** Nandapur & Pottangi Blocks, Koraput District, Odisha (`EPSG:4326` ↔ `EPSG:32644` UTM Zone 44N)  
> **Compliance:** REC Rural Electrification Standards · IS 5613 / IS 3043 / IS 1180 · CEA Voltage Regulation (`<= 5%` HT, `<= 6%` LT) · MNRE Off-Grid/DDG Guidelines

---

## 1. Purpose & Non-Negotiable Epistemic Principles

**ElectriMap DPR** is a web-based pre-feasibility GIS engineering workbench for assessing rural and tribal electrification in India (under **DA-JGUA**, **PM-JANMAN**, and **RDSS**) and compiling complete **24-section Preliminary Detailed Project Reports (DPRs)**, formula-driven **Excel Bills of Quantities (`.xlsx`)**, and cleaned **GIS Vector Packages (`.zip`)**.

Every planner and evaluator using ElectriMap DPR must understand its five core engineering rules:
1. **Epistemic Honesty (Axis 1 vs. Axis 2):** Satellite building footprints and VIIRS night-time light radiance (`463 m`) cannot see household electricity meters or internal wiring. Axis-1 proxy classes (`LIKELY_ELECTRIFIED`, `POTENTIALLY_UNDERSERVED`, `POTENTIALLY_UNSERVED`, `UNKNOWN`) are **never** labeled or presented as `"Verified"` unless backed by an immutable Axis-2 field or utility verification record (`FIELD_VERIFIED` or `UTILITY_VERIFIED`).
2. **Four Distinct Electrification Dimensions:** The workbench separates (a) household connection coverage, (b) electricity supply availability, (c) voltage regulation/supply quality, and (d) distribution transformer/feeder adequacy.
3. **Zero Fabricated Infrastructure or Rates:** Existing 11 kV/LT lines and Distribution Transformers come strictly from uploaded utility GIS files or explicit `USER_ASSUMED` tie-in points placed by the planner. Missing Schedule of Rates (SoR) unit prices remain `UNSET` and **block DPR and Excel BOQ export** (`HTTP 422`) rather than inventing unit costs.
4. **Mandatory Preliminary Engineering Watermarks:** Whenever Axis-2 field verification coverage is below `100%`, every page of the exported 24-section PDF DPR carries the diagonal watermark `PRELIMINARY ENGINEERING — NOT FIELD VERIFIED`.
5. **100% Free & Offline-Capable:** Zero commercial map keys or paid APIs are required. The bundled Koraput Reference Pack runs completely offline (`OFFLINE_MODE=true`).

---

## 2. Quick-Start: Launching the Offline Demo Workbench

### Option A: One-Command Docker Compose Stack
```bash
docker compose up --build
```
- **Web Workbench UI:** `http://localhost:5173`
- **FastAPI OpenAPI Docs:** `http://localhost:8000/api/docs`
- **Health & Benchmark Telemetry:** `http://localhost:8000/api/v1/system/benchmark`

### Option B: Local Developer Environment
1. **Backend (`http://localhost:8000`):**
   ```powershell
   .\backend\.venv\Scripts\uvicorn.exe app.main:app --app-dir backend --reload --port 8000
   ```
2. **Frontend (`http://localhost:5173`):**
   ```powershell
   cd frontend
   npm run dev
   ```
3. **Default Planner Credentials:**
   - **Email:** `planner@electrimap.in`
   - **Password:** `ElectriMap#2026`

---

## 3. The 7-Step Engineering Workbench Workflow

### Step 1: Data & AOI Selection (`/projects/new` & Step 1 Panel)
- **Administrative Cascade:** Select `Odisha -> Koraput -> Nandapur / Pottangi -> Gram Panchayat -> Village` (e.g., `Bheja`, LGD `398712`, Census 2011 `428914`). If cadastral village boundaries are unavailable, the workbench generates a `1.5 km` metric circular buffer in `EPSG:32644` and displays an explicit `APPROXIMATE_BUFFER` warning banner.
- **Interactive Polygon Drawing / Upload:** Draw a custom polygon on the map or upload `.geojson`, `.kml`, or `.zip` Shapefile archives (with mandatory `.prj` CRS verification and OGC `make_valid` self-intersection auto-repair).
- **Provenance Registry:** Inspect the 6 open geospatial layers (`buildings`, `dem`, `landcover`, `nightlights`, `osm_features`, `solar_resource`) with vintage, resolution, licence, and raster overlay opacity controls.

### Step 2: Habitation Clustering, Two-Axis Classification & Verification Ledger
- **Metric DBSCAN Clustering:** Footprints are reprojected to `EPSG:32644` (meters), filtered by roof area (`< 8 m²` noise excluded; `15–250 m²` residential), and grouped into habitation clusters (`eps_m = 150 m`, `min_samples = 5`, `household_alpha = 0.9`).
- **Census 2011 Reconciliation:** Compares satellite-estimated households against Census 2011 baseline and flags divergences exceeding `±30%`.
- **Immutable Axis-2 Verification Ledger:** Submit field survey or DISCOM feeder records (`GRAM_SABHA_RESOLUTION`, `DISCOM_FEEDER_LEDGER`, `FIELD_GPS_PHOTO`) or batch-upload via CSV. Existing verification records are append-only and can only be superseded via an explicit reversal record.

### Step 3: Existing Infrastructure, Terrain Gap Analysis & 7-Category Demand
- **Interactive Tie-In Placement:** Click **"+ Place Assumed 11 kV Tie-In on Map"** and click a tapping location on the map to create an explicit `USER_ASSUMED` 11 kV tie-in point, or upload utility GIS lines.
- **Terrain-Weighted Distance Matrix:** Computes straight-line distance ($d_{\text{straight}}$), slope/canopy terrain penalty multiplier, terrain-weighted distance ($d_{\text{terrain}}$), and waterway crossings in `EPSG:32644`.
- **7-Category Parametric Demand Engine:** Computes Base-Year and 10-Year Horizon connected load ($\text{kW}$), coincident peak demand ($\text{kW}$ / $\text{kVA}$ at `0.65` coincidence factor), and daily/annual energy ($\text{kWh/day}$, $\text{MWh/yr}$) across `DOMESTIC_BPL`, `DOMESTIC_APL`, `INSTITUTIONAL`, `STREET_LIGHTING`, `WATER_PUMPING`, `AGRICULTURAL_IRRIGATION`, and `MICRO_ENTERPRISE`.

### Steps 4 & 5: Network Layout Routing, Voltage Drop, Losses & Off-Grid Sizing
- **Distribution Transformer Sizing:** Selects standard IS 1180 Level-2 DTs (`16, 25, 63, 100, 200 kVA`) at $\le 80\%$ horizon loading and splits clusters when LT radial reach exceeds `500 m`.
- **11 kV HT Least-Cost Routing & 415 V LT MST:** Routes 11 kV feeders over the 30 m DEM slope + ESA WorldCover cost surface via `MCP_Geometric` (`65 m` span, `1.08x` sag) and constructs 415 V LT Minimum Spanning Trees (`40 m` span).
- **CEA Voltage Regulation & Off-Grid Sizing:** Computes 11 kV HT ($\le 5.0\%$) and 415 V LT ($\le 6.0\%$) voltage drops, annual $I^2R$ + DT core/copper losses, and NASA POWER worst-month monsoon GHI Solar PV ($\text{kWp}$) + LiFePO4 BESS ($\text{kWh}$, `1.5 days` autonomy, `80%` DoD) + Standalone SHS kits.

### Step 6: Schedule of Rates (SoR), Itemized BOQ & 4-Scenario Comparison
- **18-Item Odisha SoR Catalog:** Edit unit prices inline, import/export custom state SoR CSVs, or reset to the reference catalog (`ODISHA_OPTCL_TPSODL_REC_2025`). Setting any required rate to `UNSET` immediately raises a hard blocker preventing DPR export.
- **4-Scenario Life-Cycle Economics (`10-Yr NPC` & `LCOE`):** Compares `HYBRID_OPTIMAL`, `GRID_EXTENSION_ONLY`, `MINIGRID_PRIORITY`, and `SHS_DISPERSED` on identical household and energy demand inputs, including Year-7 LiFePO4 battery replacement present value, wholesale grid energy cost, scheme capital grant (`90%` Tribal/PVTG), and avoided $\text{CO}_2$ emissions.

### Step 7: Pre-Flight Integrity Audit & 24-Section DPR / Excel BOQ / GIS Exports
- **Pre-Flight Audit Checklist:** Evaluates Hard Blockers (`CLUSTERS_IDENTIFIED`, `NO_UNSET_BOQ_RATES`, `GRID_TIE_IN_PRESENT`) and Soft Warnings (`CEA_VOLTAGE_REGULATION`, `AXIS_2_FIELD_VERIFICATION`, `AOI_BOUNDARY_PROVENANCE`, `CENSUS_RECONCILIATION_DELTA`).
- **One-Click Exports with Cryptographic SHA-256 Logging:**
  1. **24-Section Preliminary DPR (`.pdf`):** Complete 24-section report with UTM Cartographic Map Plate, Single-Line Diagram, BOQ, 4-Scenario Comparison, Implementation Phasing, O&M, Environmental Screening, Risk Register, and Pre-Flight Integrity Certificate.
  2. **Formula-Driven 5-Sheet BOQ Workbook (`.xlsx`):** Live Excel formulas (`=ROUND(D*F,2)`, `=ROUND(SUM(...),2)`) across `Summary`, `Settlements & Demand`, `Engineering & Sizing`, `BOQ & Rates`, and `Scenario Comparison`.
  3. **Cleaned GIS Vector Package (`.zip`):** `aoi_boundary.geojson`, `habitation_clusters.geojson`, `infrastructure_assets.geojson`, `preliminary_network_layout.geojson`, `settlement_and_engineering_schedule.csv`, and `provenance_manifest.json`.

---

## 4. Accessibility (WCAG 2.1 AA) & Keyboard Navigation

- **Skip Link:** Press `Tab` on any page to reveal the **"Skip to main content"** link and jump directly to `<main id="main-content">`.
- **Keyboard Step Rail:** Use `Tab` and `Enter`/`Space` on the left **Workflow Steps** rail to jump directly to any of the 7 engineering panels (`aria-current="step"`).
- **Color-Blind-Safe Palette & Double Encoding:** All habitation cluster proxy classes use the **Okabe-Ito** palette (`#0072B2` Blue, `#E69F00` Amber, `#D55E00` Vermilion, `#6C757D` Slate) paired with explicit text badges and dashed vs. solid outline stroke patterns so color is never the sole carrier of meaning.

