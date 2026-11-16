/**
 * Plain-language glossary & human-friendly label formatters for ElectriMap DPR.
 *
 * Designed for beginners with no prior knowledge of GIS, satellite imagery,
 * electrical distribution design, or government DPR workflows. Every entry
 * preserves engineering units, calculation rules, and epistemic caveats.
 */

export interface GlossaryEntry {
  id: string
  term: string
  plainTitle: string
  whatItMeans: string
  whyItMatters: string
  whatToDo: string
  technicalCode?: string
}

export const BEGINNER_GLOSSARY = {
  aoI: {
    id: 'aoI',
    term: 'AOI (Area of Interest)',
    plainTitle: 'Your Chosen Study Area',
    technicalCode: 'AOI',
    whatItMeans:
      'The exact village, gram panchayat, or drawn map boundary where you want to plan electricity access.',
    whyItMatters:
      'Every map layer, building count, and cost estimate stays strictly inside this boundary.',
    whatToDo:
      'Pick an official village, draw the boundary on the map, or upload a boundary file when creating a project.',
  },
  dpr: {
    id: 'dpr',
    term: 'DPR (Detailed Project Report)',
    plainTitle: 'Official 24-Section Planning Report',
    technicalCode: 'DPR',
    whatItMeans:
      'The formal engineering and financial document used by government utilities and DISCOMs to review and fund rural electrification projects.',
    whyItMatters:
      'Without a structured DPR covering population, load demand, routes, and itemized costs, a project cannot be formally sanctioned.',
    whatToDo:
      'Complete Steps 1 to 5 in order, resolve all missing checks in Step 6, then download the PDF report and Excel cost workbook.',
  },
  boq: {
    id: 'boq',
    term: 'BOQ (Bill of Quantities)',
    plainTitle: 'Itemized Equipment & Cost List',
    technicalCode: 'BOQ',
    whatItMeans:
      'A complete shopping list of every pole, cable meter, transformer, home kit, or solar battery unit needed, multiplied by unit prices.',
    whyItMatters:
      'Utilities require transparent, itemized material quantities and official unit rates before approving funding.',
    whatToDo:
      'Review the quantities in Step 5 and confirm or enter your local unit rates before exporting the final report.',
  },
  proxyClassification: {
    id: 'proxyClassification',
    term: 'Satellite Proxy Classification',
    plainTitle: 'Unverified Satellite Estimate (Needs Ground Check)',
    technicalCode: 'PROXY · UNVERIFIED',
    whatItMeans:
      'An early clue about where electricity might be missing, estimated from outdoor nighttime light and building clusters seen from space.',
    whyItMatters:
      'Satellites cannot see indoor house wires, prepaid meters, or daytime power cuts — a bright road can still hide unconnected homes.',
    whatToDo:
      'Treat all satellite tags as preliminary clues only. Confirm real home connections on the ground in Step 2 before finalizing.',
  },
  viirsNighttimeLight: {
    id: 'viirsNighttimeLight',
    term: 'VIIRS Nighttime Radiance',
    plainTitle: 'Nighttime Brightness From Satellite (nW/cm²/sr)',
    technicalCode: 'NASA VIIRS DNB',
    whatItMeans:
      'How bright the ground looks at night from NASA weather satellites, measured in nanowatts per square centimeter per steradian (nW/cm²/sr).',
    whyItMatters:
      'Very dark inhabited areas (under 0.5 nW/cm²/sr) often lack reliable streetlighting or grid power, helping prioritize field visits.',
    whatToDo:
      'Compare dark spots against building dots on the map, keeping in mind that moonlight, fires, or thick clouds can affect single-night readings.',
  },
  sentinel2Ndvi: {
    id: 'sentinel2Ndvi',
    term: 'Sentinel-2 & NDVI',
    plainTitle: 'Daytime Satellite Imagery & Tree Cover',
    technicalCode: 'Sentinel-2 / NDVI',
    whatItMeans:
      'Free European daytime satellite photos used to calculate NDVI — a greenness score from −1 to +1 showing crops, bare land, or dense forest.',
    whyItMatters:
      'Dense trees, forests, and rivers increase pole-stringing costs and show where off-grid solar or careful routing is needed.',
    whatToDo:
      'Check the Land Cover and Slope layers in Step 1 and the GIS Map to spot forest corridors or steep terrain before running routes.',
  },
  buildingFootprints: {
    id: 'buildingFootprints',
    term: 'Building Footprints & DBSCAN Clusters',
    plainTitle: 'Detected Houses & Hamlet Groupings',
    technicalCode: 'Footprints / DBSCAN',
    whatItMeans:
      'Roof outlines detected from satellite imagery, automatically grouped into distinct hamlets (clusters) when homes sit close together.',
    whyItMatters:
      'Utilities connect clusters of nearby homes using one transformer or solar microgrid rather than running separate long wires to each roof.',
    whatToDo:
      'Check if detected clusters match real hamlets in Step 2 and adjust grouping distance only if scattered farmsteads were missed.',
  },
  censusReconciliation: {
    id: 'censusReconciliation',
    term: 'Census Reconciliation',
    plainTitle: 'Comparing Satellite Roofs vs. Official Census Homes',
    technicalCode: '±30% Tolerance',
    whatItMeans:
      'Compares the number of houses detected from satellite roofs against official Census 2011 or survey household counts.',
    whyItMatters:
      'Satellite roofs can count barns/shops as homes or miss thatched huts under trees, skewing demand and kit counts if left unchecked.',
    whatToDo:
      'Enter your known official or village household count in Step 2; if the difference exceeds ±30%, upload corrected household counts.',
  },
  crsEpsgUtm: {
    id: 'crsEpsgUtm',
    term: 'CRS / EPSG / Local UTM',
    plainTitle: 'Map Coordinate System for Accurate Meters',
    technicalCode: 'WGS 84 + Local UTM',
    whatItMeans:
      'Locations are stored as global latitude/longitude (EPSG:4326) and automatically projected into a local flat grid (UTM) to measure real meters.',
    whyItMatters:
      'Standard latitude/longitude degrees distort distances across India; local UTM projection ensures wire lengths and areas stay meter-accurate.',
    whatToDo:
      'ElectriMap selects the right local UTM zone for your village automatically — only change it if your surveyor specifies another grid.',
  },
  tiedInPoint: {
    id: 'tiedInPoint',
    term: 'Existing Tie-In Point (Feeder / Substation)',
    plainTitle: 'Starting Point Where New Wires Connect',
    technicalCode: 'Tie-In Point',
    whatItMeans:
      'An existing 11 kV pole, feeder line, or transformer where your new distribution line begins.',
    whyItMatters:
      'Grid-extension length, voltage drop, and pole count depend directly on where power enters the village. ElectriMap never invents fake lines.',
    whatToDo:
      'Upload your utility GIS feeder file in Step 1, or click the map from Step 3/4 to mark an assumed connection pole for preliminary planning.',
  },
  existingLinesDt: {
    id: 'existingLinesDt',
    term: 'Existing 11 kV Lines & Distribution Transformers',
    plainTitle: 'Current Utility Grid Equipment Nearby',
    technicalCode: '11 kV HT / LT / DT',
    whatItMeans:
      'High-voltage (11 kV) lines bring bulk power from substations; distribution transformers (DTs) step it down to safe household voltage (230/415 V).',
    whyItMatters:
      'Knowing existing lines and transformers avoids designing duplicate poles and lets planners pick realistic branch points.',
    whatToDo:
      'Upload official utility line/DT GeoJSON or Shapefiles in Step 1 whenever available, or place an explicit assumed tie-in point.',
  },
  distributionModality: {
    id: 'distributionModality',
    term: 'Electrification Modality (Grid vs. Microgrid vs. SHS)',
    plainTitle: 'Best Technology Choice for Each Hamlet',
    technicalCode: 'Modality',
    whatItMeans:
      'Three ways to electrify a hamlet: connecting to the main power grid, building a shared solar microgrid, or installing standalone home solar kits.',
    whyItMatters:
      'Stretching miles of poles to 4 remote forest houses costs far more and suffers poorer voltage than standalone solar home systems.',
    whatToDo:
      'Review the automatic recommendation per hamlet in Step 4 and test Grid vs. Hybrid scenarios before selecting your preferred option.',
  },
  htAndLtLines: {
    id: 'htAndLtLines',
    term: '11 kV (HT) & LT Lines',
    plainTitle: 'Main Feeder Wires vs. Street-Level Wires',
    technicalCode: 'HT 11 kV / LT 0.415 kV',
    whatItMeans:
      '11 kV High Tension (HT) lines carry power efficiently over kilometers to village transformers; Low Tension (LT) lines deliver power along streets to homes.',
    whyItMatters:
      'Long LT wires drop voltage rapidly and dim appliances, whereas running 11 kV closer to homes keeps voltage healthy.',
    whatToDo:
      'Inspect the route breakdown in Step 4 and verify voltage regulation stays within CEA limits (≤ 6% LT, ≤ 5% HT).',
  },
  transformerKva: {
    id: 'transformerKva',
    term: 'Transformer Capacity (kVA)',
    plainTitle: 'Size of the Village Power Transformer',
    technicalCode: '16 / 25 / 63 kVA',
    whatItMeans:
      'The total electrical load a distribution transformer can safely serve at peak evening demand, rated in kilovolt-amperes (kVA).',
    whyItMatters:
      'Too small a transformer trips or burns out; oversized transformers waste capital and lose power idling.',
    whatToDo:
      'Step 3 and Step 4 pick standard Indian ratings (16, 25, 63, or 100 kVA) with a growth margin — verify peak hamlet demand first.',
  },
  loadFactorPowerFactor: {
    id: 'loadFactorPowerFactor',
    term: 'Diversity Factor, Power Factor & Technical Losses',
    plainTitle: 'Real-World Appliance Usage & Line Loss Rules',
    technicalCode: 'DF / cos φ / Losses',
    whatItMeans:
      'Accounts for households not switching on every appliance simultaneously (diversity factor), power efficiency (cos φ), and small heat losses in wires.',
    whyItMatters:
      'Multiplying connected wattage without diversity would massively oversize equipment; ignoring losses underestimates generator needs.',
    whatToDo:
      'Standard engineering defaults are pre-loaded; open Step 3 Advanced Details only if your utility mandates custom design factors.',
  },
  voltageRegulation: {
    id: 'voltageRegulation',
    term: 'Voltage Regulation & CEA Limits',
    plainTitle: 'Voltage Drop Check (Keeps Lights & Motors Safe)',
    technicalCode: 'CEA VR ≤ 5% HT / ≤ 6% LT',
    whatItMeans:
      'The percentage of voltage lost along wires from the transformer or substation to the farthest house at peak evening load.',
    whyItMatters:
      'Central Electricity Authority (CEA) rules allow at most 5% drop on 11 kV lines and 6% on street LT lines so fans, bulbs, and pumps work reliably.',
    whatToDo:
      'After running network design in Step 4, verify both HT and LT percentages stay below CEA limits — add a mid-village transformer or use solar if exceeded.',
  },
  terrainCostSurface: {
    id: 'terrainCostSurface',
    term: 'Least-Cost Terrain Routing',
    plainTitle: 'Smart Path Finding Around Hills, Forests & Rivers',
    technicalCode: 'MCP_Geometric',
    whatItMeans:
      'Instead of drawing straight lines through cliffs or forests, the router calculates easier paths along gentle slopes, roads, and open land.',
    whyItMatters:
      'Real pole crews follow accessible corridors rather than steep ravines or protected reserves, producing realistic line lengths.',
    whatToDo:
      'Inspect mapped routes against satellite imagery in the GIS Map and adjust routing penalty factors only if local terrain data differs.',
  },
  ghiSolarIrradiance: {
    id: 'ghiSolarIrradiance',
    term: 'GHI (Global Horizontal Irradiance)',
    plainTitle: 'Average Daily Sunlight Available for Solar',
    technicalCode: 'kWh/m²/day',
    whatItMeans:
      'Total solar energy hitting a flat square meter of ground per day, measured in kilowatt-hours per square meter per day (kWh/m²/day).',
    whyItMatters:
      'Determines how many solar panels and battery hours a hamlet microgrid or home kit needs to survive cloudy days.',
    whatToDo:
      'Review the solar resource reading in Step 3; typical Indian values range around 4.5–5.8 kWh/m²/day.',
  },
  planningHorizonDiscountRate: {
    id: 'planningHorizonDiscountRate',
    term: 'Planning Horizon & Discount Rate',
    plainTitle: 'Project Lifespan & Annual Financial Interest Rate',
    technicalCode: 'Horizon / r (%)',
    whatItMeans:
      'How many years equipment costs and energy delivery are evaluated over (e.g., 10 or 15 years) and the yearly financial discount rate (e.g., 8%).',
    whyItMatters:
      'Compares high upfront/low fuel options (solar) fairly against grid extensions over time using standard Indian public project norms.',
    whatToDo:
      'Leave the standard 10-year horizon and 8% discount rate unless your state utility specifies another rate in Project Settings.',
  },
  capexOpexNpvLcoe: {
    id: 'capexOpexNpvLcoe',
    term: 'CAPEX, Annual OPEX, NPC & LCOE',
    plainTitle: 'Upfront Build Cost, Yearly Upkeep & Per-Unit Cost',
    technicalCode: 'CAPEX / OPEX / NPC / LCOE',
    whatItMeans:
      'CAPEX is the total upfront build cost; OPEX is yearly maintenance; NPC (Net Present Cost) combines both over the project life; LCOE is the lifetime cost per unit of electricity (₹/kWh).',
    whyItMatters:
      'Helps planners compare options fairly: a cheap build with expensive diesel upkeep often costs more per unit than solar or grid power.',
    whatToDo:
      'Compare scenarios in Step 5 after confirming unit prices so NPC, LCOE, and total CAPEX are calculated on real rates.',
  },
  scheduleRatesProvenance: {
    id: 'scheduleRatesProvenance',
    term: 'Rate Provenance (Schedule of Rates vs. User Entered)',
    plainTitle: 'Where Each Material Price Came From',
    technicalCode: 'SOR / User / Unset',
    whatItMeans:
      'Shows whether a unit price comes from an editable public reference baseline, was entered directly by you, or has not been set yet.',
    whyItMatters:
      'Using unverified or missing prices in a DPR violates audit accountability — ElectriMap blocks final report export if any required rate is UNSET.',
    whatToDo:
      'Replace reference baseline rates with your latest state DISCOM Schedule of Rates (SoR) or enter verified quotes for any Unset items in Step 5.',
  },
  exportReadinessGate: {
    id: 'exportReadinessGate',
    term: 'DPR Export Readiness Gate',
    plainTitle: 'Mandatory Safety & Completeness Checklist Before Export',
    technicalCode: 'Pre-Flight Gate',
    whatItMeans:
      'An automated quality check ensuring your project has an AOI, settlements, computed routes, valid unit rates, and a selected scenario before exporting.',
    whyItMatters:
      'Prevents incomplete or empty numbers from accidentally entering an official PDF DPR or Excel BOQ.',
    whatToDo:
      'Click any red or amber check item in Step 6 to jump directly to the step where it can be completed.',
  },
  fourElectrificationDimensions: {
    id: 'fourElectrificationDimensions',
    term: 'Four Electrification Dimensions',
    plainTitle: 'Why "Village Electrified" Is Not Enough',
    technicalCode: 'Coverage / Hours / Quality / Infra',
    whatItMeans:
      'ElectriMap tracks four separate facts: (1) household connection coverage, (2) hours of supply per day, (3) stable voltage quality, and (4) pole/transformer capacity.',
    whyItMatters:
      'Even if one pole reaches a village center, outer hamlets may still lack meters, get 3 hours of power, or suffer severe brownouts.',
    whatToDo:
      'Record field observations across all four dimensions in Step 2 so your DPR explains the real gap accurately.',
  },
  serviceLoadTier: {
    id: 'serviceLoadTier',
    term: 'Household Load Tier (Basic vs. Standard vs. Productive)',
    plainTitle: 'How Much Electricity Each Household & Shop Needs',
    technicalCode: 'MTF Tier 2 / 3 / 4',
    whatItMeans:
      'Selects the appliance bundle per household: Basic lighting/charging (~0.25 kW), Standard fans/TV/appliances (~0.5 kW), or Productive/agricultural loads (~1.2 kW).',
    whyItMatters:
      'Sets the total kilowatt peak demand that sizes transformers, conductors, or solar arrays across the entire village.',
    whatToDo:
      'Choose Standard Household Service for general rural planning unless the village has rice mills, irrigation pumps, or only minimal off-grid needs.',
  },
  verificationStatus: {
    id: 'verificationStatus',
    term: 'Verification State (Unverified Proxy vs. Ground Checked)',
    plainTitle: 'Whether Field Survey Has Confirmed Satellite Clues',
    technicalCode: 'UNVERIFIED / FIELD VERIFIED',
    whatItMeans:
      'Marks whether a cluster rating is still an unconfirmed satellite estimate or has been checked against census records, utility feeders, or a site visit.',
    whyItMatters:
      'Separates preliminary desktop screening from field-confirmed evidence so engineers never mistake a satellite guess for a surveyed fact.',
    whatToDo:
      'Open Step 2, select each hamlet, and log who verified it and from what source (utility record, gram panchayat letter, or site visit).',
  },
  preliminaryDisclaimer: {
    id: 'preliminaryDisclaimer',
    term: 'Preliminary Pre-Feasibility Output',
    plainTitle: 'Screening Estimate — Not Final Construction Drawings',
    technicalCode: 'PRELIMINARY',
    whatItMeans:
      'All automated routes, pole counts, and cost workbooks are preliminary pre-feasibility estimates designed for DPR screening and budgeting.',
    whyItMatters:
      'Final line staking, Right-of-Way clearances, soil testing, and soil-pole earthing require a licensed field survey team.',
    whatToDo:
      'Use generated outputs to build and budget your DPR, then commission an on-site engineering survey prior to tendering.',
  },
  governmentScheme: {
    id: 'governmentScheme',
    term: 'Government Electrification Scheme Alignment',
    plainTitle: 'Funding Program Template Used for DPR Structure',
    technicalCode: 'DA-JGUA / RDSS / PM-JANMAN',
    whatItMeans:
      'Aligns the DPR report sections and target beneficiaries with Indian rural electrification programs such as DA-JGUA, RDSS, or PM-JANMAN.',
    whyItMatters:
      'Each program uses specific report headings, eligibility rules (such as PVTG tribal hamlets), and loss-reduction criteria.',
    whatToDo:
      'Pick the scheme matching your project funding source in New Project setup or Project Settings.',
  },
  dataSourceProvenance: {
    id: 'dataSourceProvenance',
    term: 'Dataset Provenance (Uploaded vs. Reference vs. Baseline)',
    plainTitle: 'Where Each Map Layer Came From',
    technicalCode: 'Data Provenance',
    whatItMeans:
      'Tracks whether a map layer was uploaded directly by you, fetched from an open satellite archive, or provided as an illustrative demo pack.',
    whyItMatters:
      'Ensures transparency during review — evaluators can immediately distinguish real utility files from open screening data.',
    whatToDo:
      'Check the Step 1 data checklist and upload local village boundaries, lines, or household lists whenever you have field files.',
  },
  demSlope: {
    id: 'demSlope',
    term: 'Copernicus GLO-30 DEM & Terrain Slope',
    plainTitle: 'Hill Elevation & Steepness Check',
    technicalCode: '30 m DEM / Slope (°)',
    whatItMeans:
      'Digital elevation model (30 m grid) measuring ground height and slope angle across the project boundary.',
    whyItMatters:
      'Steep slopes (> 20°) increase pole spacing difficulty, add rugged-terrain sag allowance (45 m span), and shift optimal line corridors.',
    whatToDo:
      'Review steep-slope alerts in Step 1 and verify flagged corridors on the GIS Map before finalizing pole routes.',
  },
  worldCover: {
    id: 'worldCover',
    term: 'ESA WorldCover Land Cover & Canopy',
    plainTitle: 'Forest, Crop & Waterbody Screening',
    technicalCode: '10 m Land Use / Canopy',
    whatItMeans:
      'Satellite land-cover map classifying dense tree cover, cropland, built-up roofs, and waterbodies across your study area.',
    whyItMatters:
      'Dense tree canopy and river crossings require clearance planning, insulated ABC cable or extra spans, and Forest Act screening.',
    whatToDo:
      'Inspect environmental clearance counts in Step 1 and Step 4 before ordering bare conductors through forest patches.',
  },
  dbscanClustering: {
    id: 'dbscanClustering',
    term: 'DBSCAN Settlement Clustering (ε, minPts)',
    plainTitle: 'Grouping Nearby Houses into Hamlets',
    technicalCode: 'DBSCAN (ε m, minPts)',
    whatItMeans:
      'Groups nearby building footprints into hamlets when at least minPts roofs lie within ε meters of each other (default 150 m, 5 buildings).',
    whyItMatters:
      'Decides which tight pockets share one distribution transformer versus isolated houses that fit standalone home solar kits better.',
    whatToDo:
      'Keep 150 m / 5 buildings unless small scattered tribal hamlets need lowering minPts (e.g., to 3) or widening ε in Step 2.',
  },
  householdMultiplier: {
    id: 'householdMultiplier',
    term: 'Building-to-Household Multiplier (α)',
    plainTitle: 'Converting Mapped Roofs to Estimated Homes',
    technicalCode: 'α × Roofs',
    whatItMeans:
      'Multiplier (default 0.90) converting raw satellite roof polygons into estimated inhabited households after discounting sheds and barns.',
    whyItMatters:
      'Prevents cattle sheds or granaries from inflating transformer sizing and household connection counts when field counts are absent.',
    whatToDo:
      'Override any cluster with an exact field-surveyed household count in Step 2 whenever ground enumeration exists.',
  },
  axis1Axis2: {
    id: 'axis1Axis2',
    term: 'Axis-1 Coverage vs. Axis-2 Reliability',
    plainTitle: 'Connection Count vs. Daily Power Quality',
    technicalCode: 'Axis 1 & Axis 2',
    whatItMeans:
      'Axis 1 measures whether households have a working meter connection; Axis 2 tracks daily supply hours, brownouts, and voltage stability.',
    whyItMatters:
      'Villages counted as "100% electrified" on paper often suffer 4-hour evening outages or low voltage that still require infrastructure upgrades.',
    whatToDo:
      'Record both coverage and daily supply hours/voltage observations per hamlet in Step 2 Verification.',
  },
  settlementBuffer: {
    id: 'settlementBuffer',
    term: 'Settlement Envelope & 50 m Safety Buffer',
    plainTitle: 'Hamlet Footprint & Pole Clearance Zone',
    technicalCode: 'Envelope + 50 m',
    whatItMeans:
      'Draws the boundary around grouped roofs plus a 50 m margin for local LT street wiring and service drops.',
    whyItMatters:
      'Marks where village LT lines end and inter-village 11 kV lines connect on the GIS Map and in DPR Plate 1.',
    whatToDo:
      'Inspect cluster polygons on the GIS Map to confirm hamlets aren’t accidentally overlapping across rivers or cliffs.',
  },
  sldDiagram: {
    id: 'sldDiagram',
    term: 'Single-Line Diagram (SLD) & Busbar Layout',
    plainTitle: 'Simplified Electrical Wiring Blueprint',
    technicalCode: '11 kV / 0.415 kV SLD',
    whatItMeans:
      'Engineering schematic showing power flowing from the 11 kV tie-in bus through transformers, breakers, and LT spurs (or solar microgrids) to clusters.',
    whyItMatters:
      'Standard format reviewers inspect to verify transformer capacities, circuit protection, and off-grid separation.',
    whatToDo:
      'Expand or review the SLD in Step 4 and verify Section 14 in your exported DPR PDF.',
  },
  verificationCoverage: {
    id: 'verificationCoverage',
    term: 'Ground Verification Coverage (%)',
    plainTitle: 'Share of Hamlets Checked Against Field Evidence',
    technicalCode: 'Verified %',
    whatItMeans:
      'Percentage of identified habitation clusters that have at least one non-reversed field survey, census, or utility verification record.',
    whyItMatters:
      'Pre-feasibility reports with 0% field verification carry higher survey uncertainty during appraisal and sanctioning.',
    whatToDo:
      'Log verification records in Step 2 (manual form or CSV upload) as ground checks arrive from field engineers.',
  },
  costPerHousehold: {
    id: 'costPerHousehold',
    term: 'Upfront Cost per Household',
    plainTitle: 'Initial Build Cost Divided by Homes Served',
    technicalCode: 'CAPEX / HH',
    whatItMeans:
      'Total estimated upfront construction cost (including taxes, contingency, and supervision charges) divided by the number of households served under the selected plan.',
    whyItMatters:
      'Helps planners quickly compare affordability against per-household scheme benchmarks without mixing in 20-year operating costs.',
    whatToDo:
      'Review alongside lifetime operating costs inside Financial details when comparing grid extension against microgrids.',
  },
  lcoeCost: {
    id: 'lcoeCost',
    term: 'Levelized Cost of Energy (LCOE)',
    plainTitle: 'Long-Term Cost per Unit of Electricity Delivered',
    technicalCode: 'LCOE (INR/kWh)',
    whatItMeans:
      'Discounted lifetime project cost (upfront CAPEX + battery replacements + 20-year O&M and power purchases) divided by discounted electricity units delivered over 20 years.',
    whyItMatters:
      'Even when upfront construction costs are similar, high diesel/battery replacement or power-purchase costs can raise lifetime ₹/kWh.',
    whatToDo:
      'Open Financial details or Compare 4 Plans to evaluate whether lower upfront cost still holds up over 20 years.',
  },
  subsidyAssumptions: {
    id: 'subsidyAssumptions',
    term: 'Grant / Subsidy Assumptions',
    plainTitle: 'Assumed Public Funding vs. Utility Balance',
    technicalCode: 'DA-JGUA / RDSS Share',
    whatItMeans:
      'An assumed percentage split between central/state capital grant funding and the remaining net balance to be borne by the distribution utility or implementing agency.',
    whyItMatters:
      'Grant ratios are project-level planning assumptions from Project Settings — they are not formal sanction orders.',
    whatToDo:
      'Verify applicable scheme grant caps in Project Settings and during DISCOM DPR appraisal.',
  },
  rateVerificationStatus: {
    id: 'rateVerificationStatus',
    term: 'Rate Verification & Estimate Status',
    plainTitle: 'Estimated Quantities vs. Reference Prices vs. Verified Rates',
    technicalCode: 'Estimate vs. Verified',
    whatItMeans:
      'Equipment quantities come from preliminary GIS network sizing (Estimated). Default unit prices come from public utility reference schedules (Reference-priced — not yet verified). Planner edits or CSV uploads reflect user entries. A rate is Field-verified or Approved only after official DISCOM/tender sign-off.',
    whyItMatters:
      'Public reference schedules are useful for pre-feasibility budgeting, but tender and site conditions can move actual contract prices.',
    whatToDo:
      'Replace public defaults with your state DISCOM Schedule of Rates or local vendor quotes in Tab 3 before final sanction submission.',
  },
} as const satisfies Record<string, GlossaryEntry>

export type GlossaryKey = keyof typeof BEGINNER_GLOSSARY

// ---------------------------------------------------------------------------
// Plain-language enum & badge label formatters (preserve backend enums safely)
// ---------------------------------------------------------------------------

export function formatSchemeLabel(code: string | null | undefined): string {
  switch (code) {
    case 'DA-JGUA / RDSS':
      return 'DA-JGUA & RDSS (Tribal & Grid Scheme)'
    case 'RDSS':
    case 'RDSS Feeder Separation':
      return 'RDSS (Grid & Feeder Strengthening)'
    case 'PM-JANMAN':
      return 'PM-JANMAN (PVTG Tribal Habitations)'
    case 'MNRE Off-Grid / Mini-Grid':
      return 'MNRE Off-Grid Solar & Mini-Grids'
    case 'State Tribal Sub-Plan (TSP)':
    case 'STATE_PLAN':
      return 'State Tribal Sub-Plan / Custom Plan'
    default:
      return code || 'Standard Rural Electrification'
  }
}

export function formatLoadTierLabel(tier: string | null | undefined): string {
  switch (tier) {
    case 'TIER_2':
    case 'TIER_2_BASIC':
    case 'TIER_2_SUBSISTENCE':
      return 'Basic (Lights, Mobile Charging & Fan — 0.25 kW/home)'
    case 'TIER_3':
    case 'TIER_3_STANDARD':
      return 'Standard (Lights, Fans, TV & Small Appliances — 0.50 kW/home)'
    case 'TIER_4':
    case 'TIER_4_PRODUCTIVE':
      return 'High / Productive (Homes + Small Shops & Pumps — 1.00 kW/home)'
    default:
      return tier || 'Standard Household Demand'
  }
}

export function formatLoadTierShortLabel(tier: string | null | undefined): string {
  switch (tier) {
    case 'TIER_2':
    case 'TIER_2_BASIC':
    case 'TIER_2_SUBSISTENCE':
      return 'Basic (0.25 kW/home)'
    case 'TIER_3':
    case 'TIER_3_STANDARD':
      return 'Standard (0.50 kW/home)'
    case 'TIER_4':
    case 'TIER_4_PRODUCTIVE':
      return 'Productive (1.00 kW/home)'
    default:
      return tier || 'Standard Home Service'
  }
}

export function formatScenarioLabel(scenario: string | null | undefined): string {
  switch (scenario) {
    case 'GRID_EXTENSION':
    case 'GRID_EXTENSION_ONLY':
      return 'Grid Extension (New 11 kV / LT Poles)'
    case 'SOLAR_MICROGRID':
    case 'MINIGRID_PRIORITY':
      return 'Solar Microgrid (Village Solar + Battery)'
    case 'STANDALONE_SHS':
    case 'SHS_DISPERSED':
      return 'Standalone Home Solar Kits'
    case 'HYBRID_OPTIMAL':
    case 'HYBRID':
      return 'Recommended Mix (Grid + Off-Grid Solar)'
    default:
      return scenario ? scenario.replace(/_/g, ' ') : 'Not Selected'
  }
}

export function formatModalityLabel(modality: string | null | undefined): string {
  switch (modality) {
    case 'GRID_EXTENSION':
    case 'GRID':
      return 'Grid Extension'
    case 'GRID_AUGMENTATION':
      return 'Grid Augmentation (Existing Feeder)'
    case 'SOLAR_MICROGRID':
    case 'SOLAR_MINIGRID':
    case 'MICROGRID':
      return 'Solar Microgrid'
    case 'STANDALONE_SHS':
    case 'SHS':
      return 'Home Solar Kit'
    case 'UNSET_INFRA_REQUIRED':
      return 'Needs 11 kV Tie-In Point'
    case 'MIXED':
      return 'Mixed Supply'
    default:
      return modality ? modality.replace(/_/g, ' ') : 'Unassigned'
  }
}

export function formatBoundarySourceLabel(source: string | null | undefined): string {
  switch (source) {
    case 'ADMIN_UNIT':
    case 'OFFICIAL_LGD':
    case 'HARMONISED':
    case 'LGD_SEARCH':
      return 'Official Village Record'
    case 'APPROXIMATE_BUFFER':
      return 'Approx. Village Circle (1.5 km)'
    case 'USER_DRAWN':
    case 'DRAWN_POLYGON':
      return 'Drawn on Map'
    case 'FILE_UPLOAD':
    case 'USER_UPLOAD':
    case 'UPLOADED_GEOJSON':
      return 'Uploaded Boundary File'
    case 'DEMO_SEED':
      return 'Pre-loaded Sample Area'
    default:
      return source ? source.replace(/_/g, ' ') : 'Custom Boundary'
  }
}

export function formatJobTypeLabel(jobType: string | null | undefined): string {
  switch (jobType) {
    case 'ACQUIRE_PROJECT_DATA':
    case 'SATELLITE_INGEST':
    case 'SATELLITE_FETCH':
      return 'Fetching Satellite Imagery & Data'
    case 'CLUSTERING':
    case 'SETTLEMENT_CLUSTERING':
      return 'Grouping Buildings into Hamlets'
    case 'NETWORK_DESIGN':
    case 'ROUTE_OPTIMIZATION':
      return 'Designing Power Lines & Transformers'
    case 'SCENARIO_GENERATION':
      return 'Generating Cost & Supply Scenarios'
    case 'EXPORT_DPR':
      return 'Generating PDF Project Report'
    case 'EXPORT_BOQ':
      return 'Generating Excel Cost Workbook'
    default:
      return jobType ? jobType.replace(/_/g, ' ') : 'Background Analysis'
  }
}

export function formatJobStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'PENDING':
    case 'QUEUED':
      return 'Queued'
    case 'RUNNING':
      return 'Running…'
    case 'SUCCEEDED':
    case 'COMPLETED':
      return 'Complete'
    case 'FAILED':
      return 'Needs Attention'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return status || 'Pending'
  }
}

export function formatRateProvenanceLabel(provenance: string | null | undefined): string {
  switch (provenance) {
    case 'REFERENCE_PUBLIC_DOCUMENT':
      return 'Reference-priced (Unverified)'
    case 'USER_TEMPLATE':
      return 'Uploaded CSV Rate (Unverified)'
    case 'USER_EDITED':
    case 'USER_ENTERED':
    case 'USER_OVERRIDE':
      return 'Planner-entered (Unverified)'
    case 'DISCOM_SOR':
      return 'Uploaded Utility SoR (Unverified)'
    case 'FIELD_VERIFIED':
      return 'Field-verified'
    case 'APPROVED':
      return 'Approved'
    case 'UNSET':
    case 'MISSING':
      return 'Missing Price (Unset)'
    default:
      return provenance ? provenance.replace(/_/g, ' ') : 'Reference-priced (Unverified)'
  }
}

export function formatBoqCategoryLabel(category: string | null | undefined): string {
  switch (category) {
    case 'HT_11KV':
      return '11 kV High-Tension Line'
    case 'DT_SUBSTATION':
      return 'Distribution Transformer Substation'
    case 'LT_415V':
      return 'Low-Tension Distribution Line'
    case 'SERVICE_CONNECTIONS':
      return 'Household Connections & Meters'
    case 'SOLAR_MINIGRID':
      return 'Solar Microgrid Generation & Storage'
    case 'STANDALONE_SHS':
      return 'Home Solar Systems'
    case 'CIVIL_EARTHING':
      return 'Civil Works, Earthing & Safety'
    default:
      return category ? category.replace(/_/g, ' ') : 'Other Equipment'
  }
}

export function formatEvidenceSourceLabel(source: string | null | undefined): string {
  switch (source) {
    case 'DISCOM_RECORD':
    case 'DISCOM_FEEDER_RECORD':
      return 'Local Utility (DISCOM) Record'
    case 'SITE_VISIT':
    case 'FIELD_SURVEY':
      return 'On-Site Field Visit'
    case 'GRAM_PANCHAYAT':
    case 'PANCHAYAT_LETTER':
      return 'Gram Panchayat Confirmation'
    case 'CENSUS_SURVEY':
    case 'CENSUS_2011':
      return 'Official Census / Household List'
    case 'HIGH_RES_IMAGERY':
      return 'Visual Satellite Inspection'
    default:
      return source ? source.replace(/_/g, ' ') : 'Field Evidence'
  }
}

export function formatVerificationStateLabel(state: string | null | undefined): string {
  switch (state) {
    case 'FIELD_VERIFIED':
      return 'Field Confirmed'
    case 'UTILITY_VERIFIED':
      return 'Utility Verified (DISCOM)'
    case 'CENSUS_CONFIRMED':
      return 'Census Confirmed'
    case 'USER_REVIEWED':
      return 'Planner Reviewed'
    case 'UNVERIFIED':
    default:
      return 'Unverified Satellite Estimate'
  }
}
