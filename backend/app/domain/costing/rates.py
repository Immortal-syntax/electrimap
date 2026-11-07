# Copyright 2026 Swayam Kumar
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Schedule of Rates (SoR) reference definitions, CSV validation, and provenance rules (Task M6-1).

Adheres strictly to AGENTS.md:
- Domain Purity: No DB or network imports.
- Explicit Units in Identifiers (`rate_inr`, `source_year`).
- Core Principle #4 (No Fabricated Rates): Missing unit rates remain `None` (`UNSET`)
  and block DPR export; they are never invented.
"""

import csv
import io
from dataclasses import dataclass

VALID_SOR_CATEGORIES: frozenset[str] = frozenset(
    {
        "HT_11KV",
        "DT_SUBSTATION",
        "LT_415V",
        "SERVICE_CONNECTIONS",
        "SOLAR_MINIGRID",
        "STANDALONE_SHS",
        "CIVIL_EARTHING",
    }
)

VALID_RATE_SOURCE_TYPES: frozenset[str] = frozenset(
    {
        "REFERENCE_PUBLIC_DOCUMENT",
        "USER_TEMPLATE",
        "USER_EDITED",
        "UNSET",
    }
)

DEFAULT_SOR_TEMPLATE_KEY = "ODISHA_OPTCL_TPSODL_REC_2025"
DEFAULT_SOR_TEMPLATE_NAME = "Odisha OPTCL / TPSODL & MNRE Reference Schedule of Rates (FY 2024-25)"


@dataclass(frozen=True)
class RateItemSpec:
    """Immutable specification of a single Schedule of Rates (SoR) unit cost item."""

    item_code: str
    description: str
    category: str
    unit: str
    rate_inr: float | None  # None => UNSET (blocks DPR export per Core Principle #4)
    source_type: str  # REFERENCE_PUBLIC_DOCUMENT, USER_TEMPLATE, USER_EDITED, UNSET
    citation: str
    source_year: int


@dataclass(frozen=True)
class CsvRowValidationError:
    """Row-level validation error reported when importing a custom Schedule of Rates CSV."""

    row_number: int
    item_code: str
    field: str
    message: str


@dataclass(frozen=True)
class SorCsvParseResult:
    """Result of parsing and validating an uploaded Schedule of Rates CSV."""

    is_valid: bool
    items: list[RateItemSpec]
    errors: list[CsvRowValidationError]
    unset_item_codes: list[str]


STANDARD_SOR_ITEMS: tuple[RateItemSpec, ...] = (
    # 1. 11 kV HT Overhead Feeder Works
    RateItemSpec(
        item_code="HT-COND-ACSR-50",
        description=(
            "11 kV 3-Phase Overhead Line with ACSR Rabbit (50 mm2, 6/1x3.35 mm) Conductor "
            "(3-wire stringing, hardware, tensioning & sagging)"
        ),
        category="HT_11KV",
        unit="km",
        rate_inr=185000.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation=(
            "OPTCL / Odisha DISCOM Unified Schedule of Rates & REC RDSS Cost Norms (11 kV Line)"
        ),
        source_year=2025,
    ),
    RateItemSpec(
        item_code="HT-POLE-PSC-9M",
        description=(
            "9.0 m 300 kg Prestressed Concrete (PSC) Pole for 11 kV Feeder with V-Cross Arm, "
            "Top Cleat, 11 kV Polymer Pin/Disc Insulators & Stay Assembly"
        ),
        category="HT_11KV",
        unit="No.",
        rate_inr=14500.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="REC Standard 11 kV Construction Drawing A-1/A-2 & Odisha DISCOM SoR",
        source_year=2025,
    ),
    # 2. 11/0.433 kV Distribution Transformer Substations (IS 1180 Part-1 Level-2)
    RateItemSpec(
        item_code="DT-11-04-16KVA",
        description=(
            "16 kVA, 11/0.433 kV, 3-Phase, 50 Hz, ONAN Outdoor Pole-Mounted Distribution "
            "Transformer (IS 1180 Part-1 Energy Efficiency Level-2)"
        ),
        category="DT_SUBSTATION",
        unit="No.",
        rate_inr=78000.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="IS 1180 (Part 1):2014 & REC RDSS Standard Cost Data Book",
        source_year=2025,
    ),
    RateItemSpec(
        item_code="DT-11-04-25KVA",
        description=(
            "25 kVA, 11/0.433 kV, 3-Phase, 50 Hz, ONAN Outdoor Pole-Mounted Distribution "
            "Transformer (IS 1180 Part-1 Energy Efficiency Level-2)"
        ),
        category="DT_SUBSTATION",
        unit="No.",
        rate_inr=96000.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="IS 1180 (Part 1):2014 & REC RDSS Standard Cost Data Book",
        source_year=2025,
    ),
    RateItemSpec(
        item_code="DT-11-04-63KVA",
        description=(
            "63 kVA, 11/0.433 kV, 3-Phase, 50 Hz, ONAN Outdoor Double-Pole Structure "
            "Distribution Transformer (IS 1180 Part-1 Energy Efficiency Level-2)"
        ),
        category="DT_SUBSTATION",
        unit="No.",
        rate_inr=162000.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="IS 1180 (Part 1):2014 & REC RDSS Standard Cost Data Book",
        source_year=2025,
    ),
    RateItemSpec(
        item_code="DT-11-04-100KVA",
        description=(
            "100 kVA, 11/0.433 kV, 3-Phase, 50 Hz, ONAN Outdoor Double-Pole/Plinth "
            "Distribution Transformer (IS 1180 Part-1 Energy Efficiency Level-2)"
        ),
        category="DT_SUBSTATION",
        unit="No.",
        rate_inr=225000.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="IS 1180 (Part 1):2014 & REC RDSS Standard Cost Data Book",
        source_year=2025,
    ),
    RateItemSpec(
        item_code="DT-11-04-200KVA",
        description=(
            "200 kVA, 11/0.433 kV, 3-Phase, 50 Hz, ONAN Outdoor Plinth-Mounted "
            "Distribution Transformer (IS 1180 Part-1 Energy Efficiency Level-2)"
        ),
        category="DT_SUBSTATION",
        unit="No.",
        rate_inr=365000.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="IS 1180 (Part 1):2014 & REC RDSS Standard Cost Data Book",
        source_year=2025,
    ),
    RateItemSpec(
        item_code="DT-PROT-HG-AB",
        description=(
            "11 kV 200 A Gang-Operated AB Switch, Horn-Gap (HG) Fuse Unit, 9 kV 10 kA "
            "Metal-Oxide Lightning Arresters (3 Nos.) & LT MCCB Distribution Box"
        ),
        category="DT_SUBSTATION",
        unit="Set",
        rate_inr=34000.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="REC Standard 11/0.4 kV Substation Protection Schedule & TPSODL SoR",
        source_year=2025,
    ),
    # 3. 415 V / 240 V LT Aerial Bunched (AB) Cable Radial Distribution Network
    RateItemSpec(
        item_code="LT-COND-AB-3PH",
        description=(
            "415 V 3-Phase Aerial Bunched (AB) XLPE Insulated Cable "
            "(3x50 + 1x16 + 1x35 mm2 Messenger) Supply & Stringing"
        ),
        category="LT_415V",
        unit="km",
        rate_inr=210000.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="IS 14255 & REC Tribal/Forest Habitation AB-Cable Distribution Norms",
        source_year=2025,
    ),
    RateItemSpec(
        item_code="LT-COND-AB-1PH",
        description=(
            "240 V 1-Phase Aerial Bunched (AB) XLPE Insulated Cable "
            "(1x35 + 1x25 mm2 Messenger) Lateral Supply & Stringing"
        ),
        category="LT_415V",
        unit="km",
        rate_inr=128000.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="IS 14255 & REC Tribal/Forest Habitation AB-Cable Distribution Norms",
        source_year=2025,
    ),
    RateItemSpec(
        item_code="LT-POLE-PSC-8M",
        description=(
            "8.0 m 200 kg Prestressed Concrete (PSC) Pole for 415 V LT Distribution "
            "with Suspension/Dead-End Clamps, Eye Hooks & Stay Set"
        ),
        category="LT_415V",
        unit="No.",
        rate_inr=9800.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="REC Standard 8.0 m 200 kg PSC Support Specification & Odisha SoR",
        source_year=2025,
    ),
    # 4. Last-Mile Household & Public Institution Service Connections
    RateItemSpec(
        item_code="SVC-CONN-BPL-1PH",
        description=(
            "Last-Mile Household Service Connection Kit (2-Core 6 mm2 Weatherproof PVC Service "
            "Cable, GI Pipe Bracket, 1-Phase Static Energy Meter, MCB & Consumer Board)"
        ),
        category="SERVICE_CONNECTIONS",
        unit="Household",
        rate_inr=3850.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="MoP RDSS / Saubhagya Last-Mile Household Service Connection Norm",
        source_year=2025,
    ),
    # 5. Decentralized Solar PV + LiFePO4 BESS Mini-Grid Generation Assets
    RateItemSpec(
        item_code="MG-SOLAR-PV-KW",
        description=(
            "Decentralized Solar PV Array (Mono-PERC Crystalline Modules >= 540 Wp, Hot-Dip "
            "Galvanized Fixed-Tilt MMS, AJBs & DC Cabling)"
        ),
        category="SOLAR_MINIGRID",
        unit="kWp",
        rate_inr=42000.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="MNRE Off-Grid & Decentralized Solar PV Benchmark Cost Norms (Tribal/Hilly)",
        source_year=2025,
    ),
    RateItemSpec(
        item_code="MG-BESS-LFP-KWH",
        description=(
            "Lithium Iron Phosphate (LiFePO4) Battery Energy Storage System (BESS) with "
            "Active BMS, Racks & Thermal Protection (>= 4,000 Cycles @ 85% DoD)"
        ),
        category="SOLAR_MINIGRID",
        unit="kWh",
        rate_inr=16500.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="MNRE / NITI Aayog Rural Solar-Plus-Storage Mini-Grid Cost Benchmark",
        source_year=2025,
    ),
    RateItemSpec(
        item_code="MG-PCU-INV-KVA",
        description=(
            "Bi-Directional Hybrid Solar Power Conditioning Unit (PCU) / Grid-Forming "
            "Inverter with MPPT Charge Controller, ACDB & Remote RMS Telemetry"
        ),
        category="SOLAR_MINIGRID",
        unit="kVA",
        rate_inr=11500.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="MNRE Technical Specification for Off-Grid Solar Mini-Grid PCU",
        source_year=2025,
    ),
    RateItemSpec(
        item_code="MG-CIV-CTRL-ROOM",
        description=(
            "Mini-Grid Control Room Civil Works, Chain-Link Array Fencing, Water Borewell "
            "for Module Washing & ESE Lightning Arrester"
        ),
        category="SOLAR_MINIGRID",
        unit="Cluster",
        rate_inr=185000.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="MNRE / OREDA Remote Tribal Mini-Grid Civil & Balance of Plant Norm",
        source_year=2025,
    ),
    # 6. Standalone Solar Home Systems (SHS) for Dispersed Homesteads
    RateItemSpec(
        item_code="SHS-KIT-200WP",
        description=(
            "Standalone Solar Home System (200 Wp PV Module + 12.8 V 100 Ah LiFePO4 Battery + "
            "Charge Controller + 3x7 W LED Lamps + 1x20 W BLDC Fan + Mobile Port, 5-Yr AMC)"
        ),
        category="STANDALONE_SHS",
        unit="Kit",
        rate_inr=24500.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="MNRE PM-JANMAN / DA-JGUA Off-Grid Solar Home System (SHS) Sanction Norm",
        source_year=2025,
    ),
    # 7. Earthing & Civil Foundation Works
    RateItemSpec(
        item_code="CIV-EARTH-PIPE",
        description=(
            "40 mm Dia 3.0 m Long Perforated GI Pipe Earthing Electrode with Bentonite/Charcoal "
            "& Salt Pit for DT Neutral/Body and Every 3rd HT/LT Pole (IS 3043)"
        ),
        category="CIVIL_EARTHING",
        unit="Set",
        rate_inr=4200.0,
        source_type="REFERENCE_PUBLIC_DOCUMENT",
        citation="IS 3043 Code of Practice for Earthing & Odisha DISCOM SoR",
        source_year=2025,
    ),
)


def get_default_sor_items_map() -> dict[str, RateItemSpec]:
    """Return a dictionary of default Schedule of Rates items keyed by `item_code`."""
    return {item.item_code: item for item in STANDARD_SOR_ITEMS}


def parse_and_validate_sor_csv(csv_content: str) -> SorCsvParseResult:
    """Parse and validate a Schedule of Rates CSV string with row-level error reporting.

    Expected CSV columns:
    `item_code,description,category,unit,rate_inr,source_type,citation,source_year`

    Rules:
    - `rate_inr` may be a positive float/number, OR blank / `"UNSET"` (which preserves
      `rate_inr=None, source_type="UNSET"` per Core Principle #4).
    - Negative rates, non-numeric strings (other than `"UNSET"`), unknown categories,
      or missing `item_code` / `description` / `unit` are reported as row-level errors.
    """
    errors: list[CsvRowValidationError] = []
    parsed_items: list[RateItemSpec] = []
    unset_codes: list[str] = []

    stream = io.StringIO(csv_content.strip())
    reader = csv.DictReader(stream)

    required_cols = {"item_code", "description", "category", "unit", "rate_inr"}
    if not reader.fieldnames:
        return SorCsvParseResult(
            is_valid=False,
            items=[],
            errors=[
                CsvRowValidationError(
                    row_number=1,
                    item_code="HEADER",
                    field="header",
                    message="CSV file is empty or missing header row.",
                )
            ],
            unset_item_codes=[],
        )

    normalized_headers = {h.strip() for h in reader.fieldnames if h}
    missing_cols = sorted(required_cols - normalized_headers)
    if missing_cols:
        return SorCsvParseResult(
            is_valid=False,
            items=[],
            errors=[
                CsvRowValidationError(
                    row_number=1,
                    item_code="HEADER",
                    field="header",
                    message=f"Missing required CSV columns: {', '.join(missing_cols)}",
                )
            ],
            unset_item_codes=[],
        )

    seen_codes: set[str] = set()
    for idx, raw_row in enumerate(reader, start=2):
        row = {
            (k.strip() if k else ""): (v.strip() if isinstance(v, str) else "")
            for k, v in raw_row.items()
        }
        item_code = row.get("item_code", "").upper()
        description = row.get("description", "")
        category = row.get("category", "").upper()
        unit = row.get("unit", "")
        raw_rate = row.get("rate_inr", "")
        source_type = row.get("source_type", "USER_TEMPLATE").upper() or "USER_TEMPLATE"
        citation = row.get("citation", "") or "Custom Uploaded Schedule of Rates CSV"
        raw_year = row.get("source_year", "2025") or "2025"

        if not item_code:
            errors.append(
                CsvRowValidationError(
                    row_number=idx,
                    item_code="(empty)",
                    field="item_code",
                    message="item_code cannot be empty.",
                )
            )
            continue

        if item_code in seen_codes:
            errors.append(
                CsvRowValidationError(
                    row_number=idx,
                    item_code=item_code,
                    field="item_code",
                    message=f"Duplicate item_code '{item_code}' in CSV.",
                )
            )
            continue
        seen_codes.add(item_code)

        if not description:
            errors.append(
                CsvRowValidationError(
                    row_number=idx,
                    item_code=item_code,
                    field="description",
                    message="description cannot be empty.",
                )
            )

        if category not in VALID_SOR_CATEGORIES:
            errors.append(
                CsvRowValidationError(
                    row_number=idx,
                    item_code=item_code,
                    field="category",
                    message=(
                        f"Invalid category '{category}'. Must be one of: "
                        f"{', '.join(sorted(VALID_SOR_CATEGORIES))}."
                    ),
                )
            )

        if not unit:
            errors.append(
                CsvRowValidationError(
                    row_number=idx,
                    item_code=item_code,
                    field="unit",
                    message="unit cannot be empty.",
                )
            )

        rate_inr: float | None = None
        if raw_rate == "" or raw_rate.upper() == "UNSET":
            rate_inr = None
            source_type = "UNSET"
            unset_codes.append(item_code)
        else:
            try:
                val = float(raw_rate)
                if val <= 0.0:
                    errors.append(
                        CsvRowValidationError(
                            row_number=idx,
                            item_code=item_code,
                            field="rate_inr",
                            message=(
                                f"rate_inr ({raw_rate}) must be strictly positive (> 0), "
                                "or 'UNSET' if unknown."
                            ),
                        )
                    )
                else:
                    rate_inr = round(val, 2)
            except ValueError:
                errors.append(
                    CsvRowValidationError(
                        row_number=idx,
                        item_code=item_code,
                        field="rate_inr",
                        message=(
                            f"rate_inr '{raw_rate}' is not a valid number or 'UNSET'."
                        ),
                    )
                )

        if rate_inr is not None and source_type == "UNSET":
            source_type = "USER_TEMPLATE"
        if source_type not in VALID_RATE_SOURCE_TYPES:
            errors.append(
                CsvRowValidationError(
                    row_number=idx,
                    item_code=item_code,
                    field="source_type",
                    message=(
                        f"Invalid source_type '{source_type}'. Must be one of: "
                        f"{', '.join(sorted(VALID_RATE_SOURCE_TYPES))}."
                    ),
                )
            )

        try:
            source_year = int(raw_year)
            if not (1990 <= source_year <= 2050):
                raise ValueError("Out of range")
        except ValueError:
            errors.append(
                CsvRowValidationError(
                    row_number=idx,
                    item_code=item_code,
                    field="source_year",
                    message=(
                        f"source_year '{raw_year}' must be a 4-digit year between 1990 and 2050."
                    ),
                )
            )
            source_year = 2025

        parsed_items.append(
            RateItemSpec(
                item_code=item_code,
                description=description,
                category=category,
                unit=unit,
                rate_inr=rate_inr,
                source_type=source_type,
                citation=citation,
                source_year=source_year,
            )
        )

    return SorCsvParseResult(
        is_valid=len(errors) == 0 and len(parsed_items) > 0,
        items=parsed_items,
        errors=errors,
        unset_item_codes=unset_codes,
    )


def export_sor_to_csv(items: list[RateItemSpec]) -> str:
    """Serialize a list of `RateItemSpec` rows to a canonical Schedule of Rates CSV string."""
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(
        [
            "item_code",
            "description",
            "category",
            "unit",
            "rate_inr",
            "source_type",
            "citation",
            "source_year",
        ]
    )
    for item in items:
        writer.writerow(
            [
                item.item_code,
                item.description,
                item.category,
                item.unit,
                "UNSET" if item.rate_inr is None else f"{item.rate_inr:.2f}",
                item.source_type,
                item.citation,
                item.source_year,
            ]
        )
    return output.getvalue()
