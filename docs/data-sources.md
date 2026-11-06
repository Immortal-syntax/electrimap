# Data Sources & Provenance Registry (`docs/data-sources.md`)

This document catalogs every geospatial, demographic, radiometric, and solar resource dataset integrated into **ElectriMap DPR**, along with its verified free access path, spatial/temporal resolution, license, and mandatory attribution text.

---

## 1. Selected Reference Geography (Seeded Offline Demonstration Block)
- **State:** Odisha (`LGD State Code: 21`)
- **District:** Koraput (`LGD District Code: 356`)
- **Sub-District / Block:** **Nandapur Block**
- **Primary Reference Village:** **Bheja** (`LGD Village Code: 398712` · `Census 2011 Code: 428914`)
- **Bounding Box (`EPSG:4326`):** `[82.68°E, 18.52°N, 82.78°E, 18.61°N]`
- **Metric Computation CRS:** **WGS 84 / UTM Zone 44N (`EPSG:32644`)**
- **Selection Rationale:** Nandapur Block in Koraput sits in the Eastern Ghats tribal belt (elevation 850–1,180 m) with a high Scheduled Tribe (ST) and PVTG population share, river/ridge obstacles, an electrified main village core, an intermediate underserved tola (*Podapadar*), an unserved remote hamlet (*Maliaguda*), and scattered forest-fringe homesteads.

---

## 2. Authoritative Free Data Source Registry

| Dataset Key | Name & Provider | Official URL / Access Path | Spatial & Temporal Resolution | License | Mandatory Attribution |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `lgd_admin_directory` | **Local Government Directory (LGD)** — Ministry of Panchayati Raj, Govt. of India | `https://lgdirectory.gov.in` | Village / GP / Block / District / State hierarchy (continuous updates) | NDSAP / Open Govt. Data License India | `Administrative hierarchy from Local Government Directory (LGD), Ministry of Panchayati Raj, Govt. of India.` |
| `census_2011_pca_vd` | **Census of India 2011 (PCA & Village Directory)** — Office of the Registrar General & Census Commissioner | `https://censusindia.gov.in` / Harmonized via SHRUG v2.1 (`https://www.devdatalab.org/shrug`) | Revenue Village level (2011 decennial baseline, projected to base year) | NDSAP / CC BY 4.0 (SHRUG / DataMeet polygons) | `Demographic baseline from Census of India 2011; harmonized village boundaries via SHRUG / DataMeet (CC BY 4.0).` |
| `google_open_buildings_v3` | **Google Open Buildings v3** (supplemented by Microsoft Global ML Building Footprints) | `https://sites.research.google/open-buildings/` · `gs://open-buildings-data/v3/` · Source Cooperative GeoParquet | ~0.5m imagery-derived vector footprints (2023 release) | CC BY 4.0 (Google) / ODbL (Microsoft) | `Building footprints from Google Open Buildings v3 (CC BY 4.0) and Microsoft Building Footprints (ODbL).` |
| `copernicus_glo30_dem` | **Copernicus DEM GLO-30** — European Space Agency (ESA) | `s3://copernicus-dem-30m/` (`https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com`) | 1 arc-second (~30 m) bare-earth/surface elevation | Copernicus DEM License (Free & Open) | `© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA.` |
| `esa_worldcover_10m` | **ESA WorldCover 10m v200** — European Space Agency | `s3://esa-worldcover/` (`https://esa-worldcover.s3.eu-central-1.amazonaws.com`) | 10 m 11-class land cover (2021 composite) | CC BY 4.0 | `© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium (CC BY 4.0).` |
| `hrea_viirs_nightlights` | **High Resolution Electricity Access (HREA) & VIIRS DNB** — Univ. of Michigan / World Bank / NOAA-NASA EOG | `https://hrea.isr.umich.edu` (`IND-OR` state COGs) & `https://eogdata.mines.edu/products/vnl/` | ~450–500 m (15 arc-second) settlement night-time radiance & Lightscore | CC BY 4.0 | `Night-time light electricity access proxies from HREA (University of Michigan / World Bank) and NOAA/NASA VIIRS DNB (CC BY 4.0).` |
| `osm_overpass` | **OpenStreetMap (OSM)** — OpenStreetMap Contributors | `https://overpass-api.de/api/interpreter` & Geofabrik India Extracts | Vector roads, waterways, HV/MV lines, schools, PHCs | ODbL 1.0 | `© OpenStreetMap contributors (ODbL).` |
| `nasa_power_solar` | **NASA POWER Agroclimatology / Renewable Energy API** — NASA LaRC | `https://power.larc.nasa.gov/api/temporal/climatology/point` | 0.5° × 0.5° long-term monthly GHI (`ALLSKY_SFC_SW_DWN`) & Temperature (`T2M`) | Public Domain (US Govt.) | `Solar irradiance and ambient temperature data obtained from the NASA Langley Research Center (LaRC) POWER Project.` |
| `openfreemap_vector` | **OpenFreeMap Vector Tiles** | `https://tiles.openfreemap.org/styles/liberty` | Global vector street/topographic basemap (keyless) | ODbL / BSD | `OpenFreeMap © OpenMapTiles Data from OpenStreetMap.` |
| `eox_s2_cloudless_2016` | **EOX Sentinel-2 Cloudless (2016 Default)** | `https://tiles.maps.eox.at/wms` | 10 m cloud-free optical satellite mosaic | CC BY 4.0 (2016); CC BY-NC-SA 4.0 (2018+) | `EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 & 2017, CC BY 4.0).` |

