# PROJECT_CONTEXT.md — ElectriMap DPR

> **Status:** Approved & Implemented (v1.0 — Prompts 0–5 & Milestones M0–M8 Complete)
> **Foundation:** Approved Prompt 0–2 specifications and full implementation across Milestones M0–M8 (2026-11-05 to 2026-11-07).

---

## 1. Project Identity

| Item | Value |
|---|---|
| Working name | **ElectriMap DPR** |
| Full title | GIS and Satellite-Based Assessment for Rural Electrification in India — Detailed Project Report (DPR) Platform for Electrification of Underserved Villages and Tribal Communities |
| One-line description | A web-based GIS workbench that turns open satellite-derived, census and terrain data into a transparent, preliminary electrification plan and a downloadable DPR for rural and tribal habitations in India. |
| Project type | College-level project built to professional engineering-documentation standards |
| Primary geography | India (rural and tribal habitations); architecture extensible to other regions |
| Reference geography (seeded demo data) | **Koraput district, Odisha** — specific block selected in Milestone 1 based on data completeness |
| Cost constraint | **Free resources only** — zero paid APIs, imagery, tiles, geocoding, compute or hosting |

## 2. The Problem

1. India's earlier village-electrification programmes counted a *revenue village* as electrified once basic infrastructure reached it and a minimum share of households/public places were connected. Outlying hamlets (tola / para / majra / habitation), forest-fringe settlements and Particularly Vulnerable Tribal Group (PVTG) habitations can remain unconnected or poorly served even inside an "electrified" village.
2. Last-mile electrification of these habitations is currently funded through on-grid works under the Ministry of Power's **Revamped Distribution Sector Scheme (RDSS)** and through the tribal-development frameworks **PM-JANMAN** and **DAJGUA**, with off-grid solar delivered through MNRE where grid extension is not feasible *(source: PIB / Ministry of Power / Ministry of Tribal Affairs releases, located during Prompt 0 research)*.
3. Preparing a DPR for these works requires locating habitations, estimating households and demand, choosing grid vs. off-grid, sizing equipment and estimating cost. Pre-survey desk work is typically fragmented across old census tables, manual map tracing and spreadsheets *(working assumption — not based on user research)*.

**ElectriMap DPR is a pre-feasibility and preliminary-engineering workbench.** It shortens and standardises desk planning and tells field teams where to verify. It does **not** replace field survey, utility records or professional engineering sign-off.

## 3. What the Product Is / Is Not

| The product IS | The product IS NOT |
|---|---|
| A tool for finding *potentially* unserved/underserved habitations using open proxies | A source of confirmed household electrification status |
| A transparent, editable demand, sizing and cost estimator | A load-flow, protection-coordination or structural design tool |
| A generator of *preliminary* network layouts and DPR drafts | A producer of construction-ready ("Good for Construction") drawings |
| A system that records field verification and preserves the evidence | A replacement for DISCOM consumer databases |
| An open-data, zero-cost platform | A consumer of paid satellite imagery or commercial APIs |

## 4. Non-Negotiable Product Principles

1. **Epistemic honesty.** Every important value carries a data-quality tag: `VERIFIED`, `ESTIMATED`, `ASSUMED`, `PROXY` or `USER_ENTERED`. These tags are visible in the UI and in the DPR.
2. **A building is not a household.** Detected buildings, estimated residential buildings, estimated households, verified households and confirmed unserved households are separate quantities.
3. **Satellites cannot see electricity connections.** Electrification status from open data is always probabilistic and assessed at cluster level.
4. **Four separate electrification dimensions:** (a) household connection coverage, (b) supply availability and reliability, (c) supply quality (voltage), (d) adequacy of distribution infrastructure. They are never merged into one "electrified" flag.
5. **No invented infrastructure.** Existing 11 kV/LT lines and distribution transformers come only from uploads, manual digitising or open datasets, each with explicit provenance. Proxy tie-in points are labelled as such.
6. **Preliminary engineering only.** Every layout and calculation is watermarked as preliminary and requires field and utility validation.
7. **Traceability.** Every number in the DPR can be traced to an input, an assumption or a formula.
8. **Free and open data only.** Licences and attributions are honoured and printed.

## 5. Target Users (hypothetical personas — not validated by user research)

| Persona | Role | Primary need |
|---|---|---|
| **P1 – Planning Engineer** | Junior/Assistant Engineer at a DISCOM, State Nodal Agency or consultancy | Fast desk pre-feasibility, BOQ and DPR draft before field survey |
| **P2 – Tribal/Block Development Officer** | Block/district planning or tribal-welfare official | Find left-out habitations, compare options, prioritise budgets |
| **P3 – NGO / RESCO Analyst** | Clean-energy NGO or mini-grid developer | Off-grid sizing, transparent assumptions, open-data export |
| **P4 – Field Verifier** | Surveyor / line staff / NGO field worker | Record ground truth for habitations and buildings |
| **P5 – Academic Evaluator** | Faculty / examiner / researcher | Checks the methodology is credible, transparent and reproducible |

## 6. Core Domain Vocabulary

| Term | Definition in this product |
|---|---|
| AOI | Area of Interest: the project boundary polygon |
| Detected building | Footprint polygon from an open building-footprint dataset above a confidence threshold |
| Estimated residential building | Detected building that passes the residential area filter (default 12–250 m²) |
| Habitation / cluster | Group of buildings produced by density-based clustering (DBSCAN) |
| Estimated households | Residential buildings × calibration factor, reconciled with projected census households |
| Verified household | Household confirmed by field survey or utility record |
| Tie-in point | Point where a proposed network connects to the existing grid (verified, user-assumed, or proxy) |
| Proxy classification | Electrification class inferred from open proxies (night lights, distance, density) |
| Verification state | Whether a classification is backed by field or utility evidence |
| DPR | Detailed Project Report: the 24-section report defined in Prompt 0 Deliverable F |

## 7. Electrification Classification Model (proposed refinement — awaiting approval, see PRODUCT_VALIDATION.md §3, C1)

The model uses two separate axes so that a proxy guess can never be shown as "verified":

- **Axis 1 – Proxy assessment (computed):** `LIKELY_ELECTRIFIED` · `POTENTIALLY_UNDERSERVED` · `POTENTIALLY_UNSERVED` · `UNKNOWN`
- **Axis 2 – Verification (evidence):** `UNVERIFIED` · `FIELD_VERIFIED` · `UTILITY_VERIFIED`
- **Verified outcome (only when Axis 2 ≠ UNVERIFIED):** `VERIFIED_ELECTRIFIED` · `VERIFIED_UNDERSERVED` · `VERIFIED_UNSERVED`

## 8. Free Data Foundation (from approved Prompt 0)

Census of India 2011 (PCA and Village Directory) · Local Government Directory (LGD) · SHRUG / DataMeet village polygons · Google Open Buildings and Microsoft building footprints · VIIRS night-time lights (and HREA, *India coverage to be verified*) · Copernicus GLO-30 DEM · OpenStreetMap (roads, water, mapped power assets) · ESA WorldCover / Sentinel-2 · NASA POWER (solar resource) · ISRO Bhuvan WMS (optional overlay) · CEA / REC / MNRE / BIS publications (engineering rules and reference costs).

## 9. Current Phase & Decisions

| Item | State |
|---|---|
| Prompt 0 — Project definition and research | **Approved & Complete** (2026-11-05) |
| Prompt 1 — Product discovery and PRD | **Approved & Complete** (2026-11-05) |
| Prompt 2 — Architecture, design system, roadmap | **Approved & Complete** (2026-11-06) |
| Prompt 3 — Environment and repository setup | **Approved & Complete** (2026-11-06) |
| Prompt 4 — Full implementation (Milestones M0–M8) | **Approved & Complete** (2026-11-07) |
| Prompt 5 — Code review, production readiness & handover | **Complete** (2026-11-07) |

## 10. Permanent Documentation Map

`AGENTS.md` (shared agent rules) · `CLAUDE.md` (Claude entry point) · `docs/PROJECT_CONTEXT.md` (this file) · `docs/PRD.md` · `docs/ARCHITECTURE.md` · `docs/DESIGN_SYSTEM.md` · `docs/USER_MANUAL.md` · `docs/PRODUCTION_READINESS_AUDIT.md` · `TASKS.md` · `PROJECT_STATUS.md` · `CHANGELOG.md` · `docs/KNOWN_ISSUES.md` · `docs/DECISIONS.md`
