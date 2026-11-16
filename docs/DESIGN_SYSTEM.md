# ElectriMap DPR — Design System & UI/UX Specification

> **Phase 1 Visual Foundation:** Deep Navy Command Chrome + Clean Neutral Survey Surfaces + Electric-Blue Engineering Accents.
> Every visual element in ElectriMap DPR encodes engineering precision, explicit physical units, and epistemic provenance.

---

## 1. Aesthetic Direction & Core Principles

1. **Geospatial Infrastructure Planning Identity:** ElectriMap DPR combines a high-contrast **Deep Navy (`#0B1426`)** command hierarchy with **Clean Neutral (`#F4F6F9` / `#FFFFFF`)** analytical sheets and **Electric-Blue (`#0284C7`)** interactive accents.
2. **Epistemic Encoding via Border & Badge Geometry:**
   - **Solid borders (`border-solid`)** denote field-verified or authoritative utility records (`VERIFIED`).
   - **Dashed borders (`border-dashed`)** denote deterministic engineering estimates (`ESTIMATED`), user planning assumptions (`ASSUMED`), or satellite/nighttime-light proxy classifications (`PROXY · UNVERIFIED`).
   - **Dotted borders (`border-dotted`)** denote `UNSET` parameters or insufficient proxy coverage (`UNKNOWN`).
3. **Tabular Precision & Explicit Units:** All engineering quantities, coordinates, distances, financial figures, and radiance metrics use `IBM Plex Mono` with `font-variant-numeric: tabular-nums` and explicit unit labels (`m`, `km`, `kVA`, `kWp`, `kWh`, `nW/cm²/sr`, `₹`).
4. **Zero Decorative Clutter:** No neon glassmorphism, decorative gradients, or ungrounded KPI widgets.

---

## 2. Colour System (`frontend/src/styles/tokens.css`)

### 2.1 Primary Deep Navy & Neutral Surfaces
| Token | CSS Variable | Hex | Usage |
| :--- | :--- | :--- | :--- |
| `navy-950` | `--navy-950` | `#0B1426` | Top command header, dark tooltips, modal backdrops |
| `navy-900` | `--navy-900` | `#0F1D36` | Primary dark structural headers, title block sheet badge |
| `navy-800` | `--navy-800` | `#162A4A` | Secondary dark panels, default stat tile top accent bar |
| `navy-700` | `--navy-700` | `#1E3A5F` | Deep navy borders and technical accents |
| `paper` / `canvas` | `--paper` / `--canvas` | `#F4F6F9` | Application background canvas |
| `sheet` / `surface` | `--sheet` / `--surface` | `#FFFFFF` | Cards, panels, tables, and form controls |
| `subtle` | `--subtle` | `#EEF2F6` | Table headers, panel headers, secondary wells |
| `surface-hover` | `--surface-hover` | `#F8FAFC` | Interactive table row and card hover state |

### 2.2 Text Hierarchy & Borders
| Token | CSS Variable | Hex | Contrast on `#FFFFFF` | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `ink` | `--ink` | `#0F172A` | 17.8:1 (AAA) | Primary headings, body copy, numerical values |
| `ink-2` | `--ink-2` | `#334155` | 9.3:1 (AAA) | Secondary labels, table headers, descriptions |
| `ink-3` / `muted` | `--ink-3` / `--muted` | `#475569` | 7.5:1 (AAA) | Metadata, citations, unit suffixes, hints |
| `rule` / `border` | `--rule` / `--border` | `#CBD5E1` | — | Standard 1px card, panel, and input border |
| `rule-subtle` | `--rule-subtle` | `#E2E8F0` | — | Internal table row dividers |
| `rule-strong` | `--rule-strong` | `#94A3B8` | — | Emphasized structural frames (`TitleBlock`) |

### 2.3 Electric-Blue Primary Accent & Focus
| Token | CSS Variable | Hex | Usage |
| :--- | :--- | :--- | :--- |
| `accent` / `primary` | `--accent` | `#0284C7` | Primary buttons, active tab indicators, selected states |
| `accent-hover` | `--accent-hover` | `#0369A1` | Primary button hover state |
| `accent-active` | `--accent-active` | `#075985` | Primary button active/pressed state |
| `accent-tint` | `--accent-tint` | `#E0F2FE` | Selected row/card background tint, active chips |
| `accent-border` | `--accent-border` | `#7DD3FC` | Accent badge and callout borders |
| `focus` | `--focus` | `#0284C7` | 2px keyboard focus ring (`focus-visible:ring-focus`) |

### 2.4 Semantic Feedback Colours
| Semantic State | Foreground | Background | Border | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Success (`ok`)** | `#15803D` | `#F0FDF4` | `#86EFAC` | CEA voltage compliance, verified data, passed pre-flight checks |
| **Warning (`warn`)** | `#B45309` | `#FFFBEB` | `#FCD34D` | Preliminary watermarks, proxy caveats, soft warnings |
| **Error (`error`)** | `#B91C1C` | `#FEF2F2` | `#FCA5A5` | Hard export blockers, `UNSET` rates, voltage drop violations |
| **Info (`info`)** | `#0369A1` | `#F0F9FF` | `#7DD3FC` | Engineering guidance, reference dataset notices |

### 2.5 Distinct GIS & SLD Symbology Palette (`frontend/src/components/map/symbology.ts`)
- **Substations:** 33/11 kV (`#7C2D12`), 11 kV (`#0F172A`)
- **11 kV HT Feeders:** Existing (`#B91C1C` solid) vs. Proposed (`#0284C7` dashed)
- **415 V LT Lines:** Existing (`#047857` solid) vs. Proposed (`#2563EB` dashed)
- **Distribution Transformers (DT):** Existing (`#D97706`) vs. Proposed (`#0284C7`)
- **User-Assumed Tie-In Point:** `#7C3AED`
- **Settlement Proxy Classifications:**
  - `FIELD_VERIFIED_ELECTRIFIED`: `#15803D`
  - `LIKELY_ELECTRIFIED`: `#0F766E` (`■`)
  - `POTENTIALLY_UNDERSERVED`: `#B45309` (`▨`)
  - `POTENTIALLY_UNSERVED`: `#B91C1C` (`▩`)
  - `UNKNOWN`: `#475569` (`[::]`)

---

## 3. Typography (`frontend/src/styles/globals.css`)

- **UI & Analytical Prose (`--font-sans`):** `IBM Plex Sans`
- **Engineering Quantities, Codes & Coordinates (`--font-mono`):** `IBM Plex Mono` (`font-variant-numeric: tabular-nums`)
- **Type Scale & Utility Classes:**
  - `.heading-xl`: `20px` (`1.25rem`), `font-semibold`, `-0.015em` tracking
  - `.heading-lg`: `16px` (`1rem`), `font-semibold`, `-0.01em` tracking
  - `.heading-md`: `14px` (`0.875rem`), `font-semibold`
  - `.small-caps-heading` / `.heading-overline`: `11px`, uppercase `IBM Plex Mono`, `0.07em` tracking
  - `.metric-value-lg`: `22px` (`1.375rem`), `IBM Plex Mono` `600` tabular
  - `.metric-value-md`: `16px` (`1rem`), `IBM Plex Mono` `600` tabular
  - `.field-label`, `.field-hint`, `.field-error`: Standardized form control typography

---

## 4. Spacing & Layout Foundations

- **4px Base Grid:** `--s-1` (`4px`), `--s-2` (`8px`), `--s-3` (`12px`), `--s-4` (`16px`), `--s-5` (`20px`), `--s-6` (`24px`), `--s-8` (`32px`), `--s-10` (`40px`), `--s-12` (`48px`).
- **Layout Dimensions:**
  - `--header-height`: `48px`
  - `--statusbar-height`: `28px`
  - `--max-content-width`: `1440px` (`.page-container`)

---

## 5. Reusable UI Component Catalog (`frontend/src/components/ui/`)

1. **`Icon.tsx`:** Standardized `lucide-react` wrapper (`xs` 12px, `sm` 14px, `md` 16px, `lg` 20px, `xl` 24px, `strokeWidth={1.75}`).
2. **`Button.tsx`:** `Button` (`primary`, `navy`, `secondary`, `ghost`, `danger`, `danger-outline`; sizes `xs`, `sm`, `md`, `lg`; `leftIcon`, `rightIcon`, `isLoading`) and `IconButton` (mandatory `aria-label`, `isActive`).
3. **`Input.tsx`:** `Input` (label, hint, error, physical `unit` suffix badge, `leftIcon`, `mono`), `Textarea`, and `Checkbox`.
4. **`Select.tsx`:** Accessible native `Select` with label, hint, error, `mono`, and chevron indicator.
5. **`Card.tsx`:** `Card` (`default`, `subtle`, `navy`, `interactive`, `selected`, `ok`, `warn`, `error`) and `KeyValueList`.
6. **`Panel.tsx`:** `Panel` (header with overline/title/subtitle/icon/badge/actions, body, footer) and `PageHeader`.
7. **`DataTable.tsx`:** Typed `DataTable<T>` + composable table primitives (`TableContainer`, `Table`, `TableHead`, `TableBody`, `TableFoot`, `TableRow`, `TableHeaderCell`, `TableCell`).
8. **`Badge.tsx`:** `Badge` (`neutral`, `primary`, `navy`, `ok`, `warn`, `error`, `info`), `LayerSourceBadge` (`PROJECT`, `REFERENCE_DEMO`, `SYNTHETIC_PLACEHOLDER`, `EXTERNAL_TILES`), and two-axis `ClassificationBadge`.
9. **`QualityTag.tsx`:** Epistemic quality badge (`VERIFIED`, `ESTIMATED`, `ASSUMED`, `PROXY`, `USER_ENTERED`, `UNSET`).
10. **`ProvenanceChip.tsx`:** Expandable dataset attribution, licence, spatial resolution, and vintage strip.
11. **`StatTile.tsx`:** Engineering KPI tile with top tone bar, `QualityTag`, optional `LayerSourceBadge`, and tabular monospace value.
12. **`TitleBlock.tsx`:** Drawing sheet header with mandatory `PRELIMINARY — NOT FIELD VERIFIED` stamp.
13. **`Tooltip.tsx`:** Keyboard- and hover-accessible tooltip (`role="tooltip"`, Escape dismissal).
14. **`Dialog.tsx`:** Modal `Dialog` and `ConfirmDialog` (`role="dialog"`, `aria-modal="true"`, Escape & backdrop dismissal).
15. **`Tabs.tsx`:** Accessible `Tabs` (`TabsList`, `TabsTrigger`, `TabsContent`) with `underline` and `segmented` variants and arrow-key navigation.
16. **`Skeleton.tsx`:** `Spinner`, `Skeleton`, `TableSkeleton`, and `LoadingState`.
17. **`EmptyState.tsx`:** Structured empty state with icon, overline, title, description, `epistemicNote`, and action slot.
18. **`ErrorState.tsx` & `Callout.tsx`:** Semantic callouts (`info`, `warn`, `error`, `ok`) and retryable `ErrorState`.
19. **`JobProgress.tsx`:** Background job progress bar with stage and error diagnostics.
