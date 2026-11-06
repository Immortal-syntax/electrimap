"""Normative Indian rural electrification engineering constants (REC / IS / CEA / MNRE).

Domain purity rule: This module contains ONLY pure data structures and helper lookups.
It must NEVER import database models, file storage, or network HTTP clients.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class EngineeringConstantSpec:
    """Verified reference engineering constant specification with standard citation."""

    key: str
    value: float
    unit: str
    description: str
    citation: str
    status: str = "SOURCE_VERIFIED"


@dataclass(frozen=True)
class TransformerRatingSpec:
    """IS 1180 (Part 1) Level-2 11/0.433 kV 3-phase Distribution Transformer specification."""

    rating_kva: float
    no_load_loss_w: float
    full_load_loss_w: float
    impedance_pct: float
    citation: str


STANDARD_DT_SPECS: tuple[TransformerRatingSpec, ...] = (
    TransformerRatingSpec(
        rating_kva=16.0,
        no_load_loss_w=65.0,
        full_load_loss_w=440.0,
        impedance_pct=4.5,
        citation="IS 1180 (Part 1):2014 Outdoor 3-Phase 11/0.433 kV 16 kVA Level-2",
    ),
    TransformerRatingSpec(
        rating_kva=25.0,
        no_load_loss_w=85.0,
        full_load_loss_w=635.0,
        impedance_pct=4.5,
        citation="IS 1180 (Part 1):2014 Outdoor 3-Phase 11/0.433 kV 25 kVA Level-2",
    ),
    TransformerRatingSpec(
        rating_kva=63.0,
        no_load_loss_w=160.0,
        full_load_loss_w=1150.0,
        impedance_pct=4.5,
        citation="IS 1180 (Part 1):2014 Outdoor 3-Phase 11/0.433 kV 63 kVA Level-2",
    ),
    TransformerRatingSpec(
        rating_kva=100.0,
        no_load_loss_w=230.0,
        full_load_loss_w=1650.0,
        impedance_pct=4.5,
        citation="IS 1180 (Part 1):2014 Outdoor 3-Phase 11/0.433 kV 100 kVA Level-2",
    ),
    TransformerRatingSpec(
        rating_kva=200.0,
        no_load_loss_w=410.0,
        full_load_loss_w=2600.0,
        impedance_pct=4.75,
        citation="IS 1180 (Part 1):2014 Outdoor 3-Phase 11/0.433 kV 200 kVA Level-2",
    ),
)

STANDARD_ENGINEERING_CONSTANTS: tuple[EngineeringConstantSpec, ...] = (
    EngineeringConstantSpec(
        key="ht_11kv_r_ohm_per_km",
        value=0.5426,
        unit="ohm/km",
        description="11 kV 3-phase overhead ACSR Rabbit (50 mm² Al Eq.) AC resistance at 20°C",
        citation="IS 398 (Part 2):1996 / REC Construction Standard F-1 (ACSR Rabbit 6/1/3.35 mm)",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="ht_11kv_x_ohm_per_km",
        value=0.355,
        unit="ohm/km",
        description=(
            "11 kV 3-phase overhead ACSR Rabbit inductive reactance at 50 Hz (1070 mm spacing)"
        ),
        citation="REC Construction Standard F-1 / CEA Distribution System Planning Manual",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="lt_415v_3ph_r_ohm_per_km",
        value=0.641,
        unit="ohm/km",
        description=(
            "415 V 3-phase LT XLPE Aerial Bunched (AB) Cable (3x50+1x16+1x35 mm²) resistance"
        ),
        citation="IS 14255:1995 / REC Specification for 1.1 kV LT XLPE AB Cables",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="lt_415v_3ph_x_ohm_per_km",
        value=0.085,
        unit="ohm/km",
        description="415 V 3-phase LT XLPE Aerial Bunched (AB) Cable (3x50 mm²) reactance at 50 Hz",
        citation="IS 14255:1995 / REC Specification for 1.1 kV LT XLPE AB Cables",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="lt_240v_1ph_r_ohm_per_km",
        value=1.20,
        unit="ohm/km",
        description=(
            "240 V 1-phase LT XLPE Aerial Bunched (AB) Cable (1x25+1x16+1x25 mm²) resistance"
        ),
        citation="IS 14255:1995 / REC Rural Electrification Standard for Single-Phase Laterals",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="lt_240v_1ph_x_ohm_per_km",
        value=0.092,
        unit="ohm/km",
        description="240 V 1-phase LT XLPE Aerial Bunched (AB) Cable (1x25 mm²) reactance at 50 Hz",
        citation="IS 14255:1995 / REC Rural Electrification Standard for Single-Phase Laterals",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="ht_max_vdrop_pct",
        value=5.0,
        unit="%",
        description="Maximum permissible voltage regulation on 11 kV rural distribution feeders",
        citation=(
            "CEA (Technical Standards for Construction of Electrical Plants and Lines) Reg. 2022"
        ),
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="lt_max_vdrop_pct",
        value=6.0,
        unit="%",
        description=(
            "Maximum permissible voltage drop on 415 V LT distribution mains to tail-end consumer"
        ),
        citation="CEA Distribution Planning Guidelines / REC DDUGJY & RDSS Technical Manual",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="ht_standard_span_m",
        value=65.0,
        unit="m",
        description=(
            "Standard 11 kV overhead line pole span using 9 m PSC / joist poles in normal terrain"
        ),
        citation="REC Construction Standard A-3 (11 kV Lines on 9 m PSC Poles)",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="ht_steep_span_m",
        value=45.0,
        unit="m",
        description=(
            "Reduced 11 kV overhead line pole span on steep slopes (>15°) or water crossings"
        ),
        citation="REC Construction Standard A-3 / Hilly & Forest Terrain Addendum",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="lt_standard_span_m",
        value=45.0,
        unit="m",
        description="Standard 415 V LT AB cable pole span using 8 m PSC poles",
        citation="REC Construction Standard B-1 (LT Lines with Aerial Bunched Cables)",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="dt_max_loading_ratio",
        value=0.80,
        unit="ratio",
        description=(
            "Maximum permissible horizon peak kVA loading ratio on Distribution Transformers"
        ),
        citation="Ministry of Power RDSS & REC Distribution Transformer Sizing Guidelines",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="lt_max_radial_reach_m",
        value=800.0,
        unit="m",
        description=(
            "Maximum 415 V LT radial feeder reach from a single DT before sub-zone splitting"
        ),
        citation="CEA Rural Distribution Planning Norms (LT-less / Short-LT Principle)",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="solar_pr_ratio",
        value=0.75,
        unit="ratio",
        description="Design Performance Ratio (PR) for crystalline-Si rural solar PV mini-grid",
        citation="MNRE Off-Grid & Decentralized Solar PV Programme Benchmark / IEC 61724",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="bess_autonomy_days",
        value=1.5,
        unit="days",
        description="Battery Energy Storage System (LiFePO4) monsoon autonomy reserve days",
        citation="MNRE / REC Decentralized Renewable Energy (DRE) Mini-Grid Guidelines",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="bess_dod_ratio",
        value=0.80,
        unit="ratio",
        description="Maximum usable Depth of Discharge (DoD) for LiFePO4 battery bank",
        citation="IS 16270 / MNRE LiFePO4 Battery Storage Specification for Rural Microgrids",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="bess_roundtrip_eff",
        value=0.90,
        unit="ratio",
        description="Round-trip DC-AC-DC efficiency of LiFePO4 battery bank and bidirectional PCU",
        citation="MNRE / IEC 62619 Rural Mini-Grid Power Conditioning Unit Benchmark",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="shs_kit_pv_wp",
        value=200.0,
        unit="Wp/HH",
        description="Standalone Solar Home System (SHS) PV module wattage per remote household",
        citation="Ministry of Power New Solar Power Scheme (for PVTG Habitations under DA-JGUA)",
        status="SOURCE_VERIFIED",
    ),
    EngineeringConstantSpec(
        key="shs_kit_bess_wh",
        value=800.0,
        unit="Wh/HH",
        description="Standalone Solar Home System (SHS) LiFePO4 battery capacity per household",
        citation="Ministry of Power New Solar Power Scheme (for PVTG Habitations under DA-JGUA)",
        status="SOURCE_VERIFIED",
    ),
)


def get_default_constants_map() -> dict[str, float]:
    """Return a dictionary of key -> value for all standard engineering constants."""
    return {spec.key: spec.value for spec in STANDARD_ENGINEERING_CONSTANTS}


def select_standard_dt_spec(
    required_peak_kva: float,
    max_loading_ratio: float = 0.80,
) -> TransformerRatingSpec:
    """Select smallest standard IS 1180 DT rating where peak_kva <= max_loading_ratio * rating."""
    safe_ratio = max(0.4, min(1.0, max_loading_ratio))
    for spec in STANDARD_DT_SPECS:
        if required_peak_kva <= spec.rating_kva * safe_ratio:
            return spec
    return STANDARD_DT_SPECS[-1]
