# DOSM Tourism Satellite Account (TSA) XLSX — Content Map

Files inspected (downloaded to `data/raw/`):

| File | Size | Sheets |
|---|---|---|
| `data/raw/tourism_2023.xlsx` | 521 KB | 13 sheets: `Indicator Inbound`, `Indicator Domestik`, `table 1` … `table 7` |
| `data/raw/tourism_2024.xlsx` | 638 KB | 13 sheets: `Indicator Inbound`, `Indicator Domestik`, `Jad 1` … `Jad 7` |

Note: the 2024 file renamed `table N` to `Jad N`. Sheet contents are identical in structure
(2023 column values in the 2024 file match the 2023 file exactly for overlapping years).

## Sheet-by-sheet

### Indicator sheets (the only country-level detail)

#### `Indicator Inbound` (both files)
- **Dimensions**: ~50 rows x 11–27 used columns (2024 file reports max_col=16384 — phantom formatting artifact; real data ends at col K).
- **Layout**: bilingual (BM / English) row labels in col A (+ merged continuation in col B). Header row is row 3 (`Tahun / Year`), years start row 3/4 depending on file; data blocks below.
- **2023 file version** (years 2015–2023):
  - `A1. Ketibaan pelancong / Tourist arrivals` — **tourist arrivals by country**, grouped by continent sub-headers (Asia, North America, Australia, Europe), 15 named countries + "Other countries" row. Unit: number of persons.
  - `A2. Taburan mod pengangkutan` — mode of transport distribution (air/land/sea/rail, %).
  - `B. Penginapan` — accommodation: hotels, rooms, guests (domestic vs international), **average length of stay (ALOS)**, occupancy rate. `2020` ALOS is `4.1*` (asterisk footnote, no footnote text in sheet), `2021` is `n.a`.
- **2024 file version** (years 2019–2024): restructured.
  - `A1. Ketibaan pelawat / Visitor arrivals` — **visitor arrivals by country** (tourists + excursionists combined), flat list of top 15 countries + "Other countries", no continent grouping.
  - `A2. Ketibaan pelancong / Tourist arrivals` — **total tourists only** (one number per year, no country breakdown).
  - `A3. Ketibaan pelawat harian / Day-tripper (excursionist) arrivals` — total only.
  - A4 transport mode; B accommodation (same as 2023).
- **Country coverage**: Singapore, Indonesia, China, Thailand, Brunei, India, Philippines, South Korea, Australia, Chinese Taipei, UK, Japan, Vietnam, US, France (+ Canada, Germany, Netherlands, NZ, Saudi Arabia in 2023 file) + aggregate "Other countries".

#### `Indicator Domestik` (both files, 2015–2024)
- Domestic visitors by **state** (16 states/territories), visitors vs tourists vs day-trippers counts, domestic trips, domestic ALOS, transport mode, accommodation type. No expenditure data.

### Jad/table sheets (supply-side TSA, years 2015–2024)
All are product x year matrices in RM million, bilingual labels, no per-country dimension.
Structure per sheet: year header in row 3; rows 6–14 values; row 15 annual % change; rows 17/18–26 percent contribution. In 2024 `Jad 5`/`Jad 6` the last two year headers are `2023e` (estimate) and `2024p` (preliminary); the 2023 file marks `2023P`.

| Sheet | Content | Total 2024 (RM m) |
|---|---|---|
| `Jad 1` / `table 1` | **Inbound tourism consumption** (total) by product | 107,028.5 |
| `Jad 1A` / `table 1A` | Inbound — **tourists (overnight)** by product | 102,815.3 |
| `Jad 1B` / `table 1B` | Inbound — **excursionists (day-trippers)** by product (no accommodation row) | 4,213.2 |
| `Jad 2` / `table 2` | **Domestic tourism consumption** (total) by product | 98,446.2 |
| `Jad 2A` / `table 2A` | Domestic — tourists by product | 56,870.0 |
| `Jad 2B` / `table 2B` | Domestic — excursionists by product | 41,576.2 |
| `Jad 3` / `table 3` | **Outbound tourism consumption** (Malaysians abroad) by product | 41,763.7 |
| `Jad 4` / `table 4` | **Internal tourism consumption** (Jad 1 + Jad 2) by product | 205,474.8 |
| `Jad 5` / `table 5` | Tourism **gross value added by industry**, tourism GVA % of GDP | 291,921.4 GVA |
| `Jad 6` / `table 6` | Supply by industry + **tourism consumption ratio** + direct tourism GDP | 114,361.7 |
| `Jad 7` / `table 7` | **Employment** by tourism industry (thousand persons) | 3,537.8k |

## What matters for yield-per-visitor analysis

| Field | Available? | Where |
|---|---|---|
| Arrivals by country | **Yes** | `Indicator Inbound` A1: 2023 file = **tourist** arrivals by country, 2015–2023 (continent-grouped); 2024 file = **visitor** arrivals by country, 2019–2024 (flat top-15). ⚠️ The two files use different units — series must not be mixed without care. |
| Tourist vs excursionist split | **Partially** | 2024 `Indicator Inbound` rows 26–27: national totals only (A2 tourists, A3 excursionists), 2019–2024. Product-level split via `Jad 1A` vs `Jad 1B` (inbound) and `2A` vs `2B` (domestic). **No country-level split.** |
| Per-capita expenditure | **Not present** | Must be derived: `Jad 1A` total ÷ tourist arrivals (`Indicator Inbound` A2). |
| Expenditure / receipts by market | **Not present** | Only national inbound receipts by product (`Jad 1/1A/1B`). Country-level expenditure lives in the separate DOSM "Malaysia Tourism Statistics / tourist expenditure" release, not in the TSA files. |
| Length of stay | **Yes (national only)** | `Indicator Inbound` accommodation block (`Average length of stay`); domestic ALOS in `Indicator Domestik`. No ALOS by country. |

## Data quality notes

- **Bilingual merged label cells**: row labels span 2 merged columns (`A:B`) in indicator sheets; tables merge section headers (`B5:L5` etc.). Unmerge or read the anchor cell.
- **Header quirk**: year header is row 3 in `Jad`/`table` sheets, but in the 2024 file col B carries stray English label fragments (`Ac`, `Products`) inside data rows — parse values from col C onward for tables, or strip col B.
- **Phantom dimensions**: 2024 file reports `max_col=16384` on `Indicator Inbound`, `Jad 1B`, `Jad 2B` and 24 cols on `Indicator Domestik`; actual used columns are ≤ 11. Truncate to used range.
- **Multi-block sheets**: each table sheet has 2–3 stacked blocks (values, annual % change, percent contribution) separated by sub-header rows (`Peratus sumbangan (%)`). Filter by section.
- **Footnotes**: `..` (not applicable, first year of % change), `n.a` (2021 ALOS), `4.1*` (asterisked 2020 ALOS, footnote text not embedded in the sheet). `2023P`/`2023e`/`2024p` revision flags embedded in the year header strings.
- **No footnotes at sheet bottoms**; last rows are empty padding.
- **No quarter/month data anywhere** — all series are annual.

## Parsing difficulty: 2/5
Fixed, repeating layout; modest merges; main work is section detection within sheets, bilingual label stripping, and handling the 2023-vs-2024 sheet renames and indicator restructure.

## Summary answers

1. **Best sheet for arrivals-by-country time series**: `Indicator Inbound` — 2023 file for tourist arrivals by country 2015–2023 (richest, continent-grouped), 2024 file for visitor arrivals by country 2019–2024.
2. **Expenditure/receipts by country**: does **not** exist in these files; only national inbound consumption by product (`Jad 1/1A/1B`). Per-capita yield must be derived (Jad 1A ÷ tourist arrivals) or sourced from a separate DOSM expenditure release.
3. **Tourist vs excursionist split**: national totals in 2024 `Indicator Inbound` (rows 26–27, 2019–2024) and product-level via Jad 1A/1B; no country-level split.
4. **Parsing difficulty**: 2/5.
