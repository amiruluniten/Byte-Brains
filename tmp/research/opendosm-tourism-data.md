# OpenDOSM Tourism Data — S3 Bucket Findings

*Researched: 2026-09-13*

## Method note (important for reuse)

The public listing endpoint `https://storage.dosm.gov.my/` (virtual-hosted, fronted by
CloudFront) **silently ignores query parameters** — `marker`, `prefix`, `continuation-token`
all return the same first 1000 keys. Use the **path-style S3 endpoint** instead, which
honors standard V2 listing:

```
https://s3.ap-southeast-1.amazonaws.com/storage.dosm.gov.my?list-type=2&prefix=tourism/
```

Full enumeration: 6,507 keys across 62 top-level prefixes, in 7 pages
(0.3 s pause between pages). Files are also directly fetchable at
`https://storage.dosm.gov.my/<key>`.

---

## 1. Tourism files in the S3 bucket

Everything tourism-related lives under the `tourism/` prefix: **124 files,
~464 MB total**. Formats are **xlsx + pdf only** (publication documents) —
there are no CSV or Parquet tourism files anywhere in the bucket. Two small JSON metadata
families (`meta/tourism*`, `pub/released/tourism*`) describe the releases.

### 1a. Tourism Satellite Account (TSA) — annual, national

The flagship product. Confirmed content (from `tourism_2024.xlsx`): sheets
`Indicator Inbound`, `Indicator Domestik`, `Jad 1`–`Jad 7`, including
**visitor arrivals by country of origin**, tourist arrivals, day-tripper arrivals,
tourism receipts and expenditure tables.

| Last-modified | Size | Format | Key (base: https://storage.dosm.gov.my/) |
|---|---|---|---|
| 2023-12-16 | 2.1 MB | pdf | `tourism/tourism_2010.pdf` |
| 2023-12-16 | 72.0 KB | xlsx | `tourism/tourism_2010.xlsx` |
| 2023-12-16 | 4.1 MB | pdf | `tourism/tourism_2011.pdf` |
| 2023-12-16 | 68.5 KB | xlsx | `tourism/tourism_2011.xlsx` |
| 2023-12-16 | 3.1 MB | pdf | `tourism/tourism_2012.pdf` |
| 2023-12-16 | 95.9 KB | xlsx | `tourism/tourism_2012.xlsx` |
| 2023-12-16 | 2.9 MB | pdf | `tourism/tourism_2013.pdf` |
| 2023-12-16 | 102.5 KB | xlsx | `tourism/tourism_2013.xlsx` |
| 2023-12-16 | 1.3 MB | pdf | `tourism/tourism_2014.pdf` |
| 2023-12-16 | 91.5 KB | xlsx | `tourism/tourism_2014.xlsx` |
| 2023-12-16 | 1.5 MB | pdf | `tourism/tourism_2015.pdf` |
| 2023-12-16 | 754.3 KB | xlsx | `tourism/tourism_2015.xlsx` |
| 2023-12-16 | 2.9 MB | pdf | `tourism/tourism_2016.pdf` |
| 2023-12-16 | 753.5 KB | xlsx | `tourism/tourism_2016.xlsx` |
| 2023-12-16 | 4.7 MB | pdf | `tourism/tourism_2017.pdf` |
| 2023-12-16 | 366.9 KB | xlsx | `tourism/tourism_2017.xlsx` |
| 2023-12-16 | 4.6 MB | pdf | `tourism/tourism_2018.pdf` |
| 2023-12-16 | 245.8 KB | xlsx | `tourism/tourism_2018.xlsx` |
| 2023-12-16 | 5.5 MB | pdf | `tourism/tourism_2019.pdf` |
| 2023-12-16 | 263.3 KB | xlsx | `tourism/tourism_2019.xlsx` |
| 2023-12-16 | 7.6 MB | pdf | `tourism/tourism_2020.pdf` |
| 2023-12-16 | 354.5 KB | xlsx | `tourism/tourism_2020.xlsx` |
| 2023-12-16 | 2.1 MB | pdf | `tourism/tourism_2021.pdf` |
| 2023-12-16 | 356.8 KB | xlsx | `tourism/tourism_2021.xlsx` |
| 2023-12-16 | 2.5 MB | pdf | `tourism/tourism_2022.pdf` |
| 2023-12-16 | 441.1 KB | xlsx | `tourism/tourism_2022.xlsx` |
| 2024-09-12 | 14.0 MB | pdf | `tourism/tourism_2023.pdf` |
| 2024-09-12 | 520.7 KB | xlsx | `tourism/tourism_2023.xlsx` |
| 2025-09-12 | 3.5 MB | pdf | `tourism/tourism_2024.pdf` |
| 2025-09-12 | 638.6 KB | xlsx | `tourism/tourism_2024.xlsx` |

### 1b. Tourist statistics — Sabah (incl. an arrivals table)

| Last-modified | Size | Format | Key (base: https://storage.dosm.gov.my/) |
|---|---|---|---|
| 2024-12-18 | 6.4 MB | pdf | `tourism/tourism_2023_sabah.pdf` |
| 2024-12-18 | 163.3 KB | xlsx | `tourism/tourism_2023_sabah.xlsx` |
| 2024-12-18 | 16.7 KB | xlsx | `tourism/tourism_2023_sabah_arrivals.xlsx` |
| 2024-09-21 | 6.7 MB | pdf | `tourism/tourism_domestic_2022_sabah.pdf` |
| 2024-09-21 | 498.1 KB | xlsx | `tourism/tourism_domestic_2022_sabah.xlsx` |
| 2024-09-21 | 8.2 MB | pdf | `tourism/tourism_domestic_2023_sabah.pdf` |
| 2024-09-21 | 372.0 KB | xlsx | `tourism/tourism_domestic_2023_sabah.xlsx` |

Note: `tourism/tourism_2023_sabah_arrivals.xlsx` is the only file in the entire bucket
with "arrivals" in the name — a per-year arrivals breakdown.

### 1c. Domestic Tourism — annual, national

| Last-modified | Size | Format | Key (base: https://storage.dosm.gov.my/) |
|---|---|---|---|
| 2024-06-12 | 6.3 MB | pdf | `tourism/tourism_domestic_2023.pdf` |
| 2024-06-12 | 52.2 KB | xlsx | `tourism/tourism_domestic_2023.xlsx` |
| 2025-06-19 | 24.4 MB | pdf | `tourism/tourism_domestic_2024.pdf` |
| 2025-06-19 | 81.3 KB | xlsx | `tourism/tourism_domestic_2024.xlsx` |
| 2026-06-16 | 8.7 MB | pdf | `tourism/tourism_domestic_2025.pdf` |
| 2026-06-16 | 55.8 KB | xlsx | `tourism/tourism_domestic_2025.xlsx` |

### 1d. Domestic Tourism — quarterly releases

| Last-modified | Size | Format | Key (base: https://storage.dosm.gov.my/) |
|---|---|---|---|
| 2024-03-26 | 635.1 KB | pdf | `tourism/tourism_domestic_2023-q4_bm.pdf` |
| 2024-03-26 | 636.6 KB | pdf | `tourism/tourism_domestic_2023-q4_en.pdf` |
| 2024-06-12 | 1016.6 KB | pdf | `tourism/tourism_domestic_2024-q1_bm.pdf` |
| 2024-06-12 | 1.5 MB | pdf | `tourism/tourism_domestic_2024-q1_en.pdf` |
| 2024-09-21 | 31.0 KB | pdf | `tourism/tourism_domestic_2024-q2_bm.pdf` |
| 2024-09-21 | 31.0 KB | pdf | `tourism/tourism_domestic_2024-q2_en.pdf` |
| 2024-12-19 | 981.1 KB | pdf | `tourism/tourism_domestic_2024-q3_bm.pdf` |
| 2024-12-19 | 1.5 MB | pdf | `tourism/tourism_domestic_2024-q3_en.pdf` |
| 2025-03-24 | 66.4 KB | xlsx | `tourism/tourism_domestic_2024-q4.xlsx` |
| 2025-03-24 | 1011.6 KB | pdf | `tourism/tourism_domestic_2024-q4_bm.pdf` |
| 2025-03-24 | 1.4 MB | pdf | `tourism/tourism_domestic_2024-q4_en.pdf` |
| 2025-06-19 | 66.4 KB | xlsx | `tourism/tourism_domestic_2025-q1.xlsx` |
| 2025-06-19 | 1.3 MB | pdf | `tourism/tourism_domestic_2025-q1_bm.pdf` |
| 2025-06-19 | 1.3 MB | pdf | `tourism/tourism_domestic_2025-q1_en.pdf` |
| 2025-09-18 | 66.4 KB | xlsx | `tourism/tourism_domestic_2025-q2.xlsx` |
| 2025-09-18 | 1.1 MB | pdf | `tourism/tourism_domestic_2025-q2_bm.pdf` |
| 2025-09-18 | 1.3 MB | pdf | `tourism/tourism_domestic_2025-q2_en.pdf` |
| 2026-03-17 | 442.0 KB | xlsx | `tourism/tourism_domestic_2025-q4.xlsx` |
| 2026-03-17 | 1.1 MB | pdf | `tourism/tourism_domestic_2025-q4_bm.pdf` |
| 2026-03-17 | 1.2 MB | pdf | `tourism/tourism_domestic_2025-q4_en.pdf` |
| 2026-06-24 | 442.3 KB | xlsx | `tourism/tourism_domestic_2026-q1.xlsx` |
| 2026-06-24 | 359.0 KB | pdf | `tourism/tourism_domestic_2026-q1_bm.pdf` |
| 2026-06-24 | 393.2 KB | pdf | `tourism/tourism_domestic_2026-q1_en.pdf` |

### 1e. Domestic Tourism by State — per-state annual reports (16 states/territories)

| Last-modified | Size | Format | Key (base: https://storage.dosm.gov.my/) |
|---|---|---|---|
| 2024-09-21 | 376.6 KB | xlsx | `tourism/tourism_domestic_2022_johor.xlsx` |
| 2024-09-21 | 377.0 KB | xlsx | `tourism/tourism_domestic_2022_kedah.xlsx` |
| 2024-09-21 | 377.1 KB | xlsx | `tourism/tourism_domestic_2022_kelantan.xlsx` |
| 2024-09-21 | 376.7 KB | xlsx | `tourism/tourism_domestic_2022_melaka.xlsx` |
| 2024-09-21 | 372.7 KB | xlsx | `tourism/tourism_domestic_2022_negerisembilan.xlsx` |
| 2024-09-21 | 372.7 KB | xlsx | `tourism/tourism_domestic_2022_pahang.xlsx` |
| 2024-09-21 | 498.1 KB | xlsx | `tourism/tourism_domestic_2022_perak.xlsx` |
| 2024-09-21 | 498.0 KB | xlsx | `tourism/tourism_domestic_2022_perlis.xlsx` |
| 2024-09-21 | 498.4 KB | xlsx | `tourism/tourism_domestic_2022_pulaupinang.xlsx` |
| 2024-09-21 | 498.1 KB | xlsx | `tourism/tourism_domestic_2022_sabah.xlsx` |
| 2024-09-21 | 498.1 KB | xlsx | `tourism/tourism_domestic_2022_sarawak.xlsx` |
| 2024-09-21 | 498.1 KB | xlsx | `tourism/tourism_domestic_2022_terengganu.xlsx` |
| 2024-09-21 | 498.2 KB | xlsx | `tourism/tourism_domestic_2022_wpkualalumpur.xlsx` |
| 2024-09-21 | 497.9 KB | xlsx | `tourism/tourism_domestic_2022_wplabuan.xlsx` |
| 2024-09-21 | 498.1 KB | xlsx | `tourism/tourism_domestic_2022_wpputrajaya.xlsx` |
| 2024-09-21 | 372.0 KB | xlsx | `tourism/tourism_domestic_2023_johor.xlsx` |
| 2024-09-21 | 372.0 KB | xlsx | `tourism/tourism_domestic_2023_kedah.xlsx` |
| 2024-09-21 | 371.9 KB | xlsx | `tourism/tourism_domestic_2023_kelantan.xlsx` |
| 2024-09-21 | 371.9 KB | xlsx | `tourism/tourism_domestic_2023_melaka.xlsx` |
| 2024-09-21 | 371.9 KB | xlsx | `tourism/tourism_domestic_2023_negerisembilan.xlsx` |
| 2024-09-21 | 371.8 KB | xlsx | `tourism/tourism_domestic_2023_pahang.xlsx` |
| 2024-09-21 | 373.3 KB | xlsx | `tourism/tourism_domestic_2023_perak.xlsx` |
| 2024-09-21 | 372.1 KB | xlsx | `tourism/tourism_domestic_2023_perlis.xlsx` |
| 2024-09-21 | 372.0 KB | xlsx | `tourism/tourism_domestic_2023_pulaupinang.xlsx` |
| 2024-09-21 | 372.0 KB | xlsx | `tourism/tourism_domestic_2023_sabah.xlsx` |
| 2024-09-21 | 371.9 KB | xlsx | `tourism/tourism_domestic_2023_sarawak.xlsx` |
| 2024-09-21 | 372.0 KB | xlsx | `tourism/tourism_domestic_2023_selangor.xlsx` |
| 2024-09-21 | 372.0 KB | xlsx | `tourism/tourism_domestic_2023_terengganu.xlsx` |
| 2024-09-21 | 371.9 KB | xlsx | `tourism/tourism_domestic_2023_wpkualalumpur.xlsx` |
| 2024-09-21 | 372.0 KB | xlsx | `tourism/tourism_domestic_2023_wplabuan.xlsx` |
| 2024-09-21 | 371.8 KB | xlsx | `tourism/tourism_domestic_2023_wpputrajaya.xlsx` |
*Each xlsx has a paired ~7–20 MB pdf report with identical name; omitted here for brevity
(same keys, `.pdf` extension).*

### 1f. Machine-readable metadata (tiny JSON descriptors)

| Last-modified | Size | Format | Key (base: https://storage.dosm.gov.my/) |
|---|---|---|---|
| 2024-09-12 | 1.7 KB | json | `meta/tourism.json` |
| 2025-03-24 | 2.0 KB | json | `meta/tourism_domestic.json` |
| 2024-06-12 | 1.7 KB | json | `meta/tourism_domestic_annual.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2010.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2011.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2012.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2013.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2014.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2015.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2016.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2017.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2018.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2019.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2020.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2021.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2022.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2023.json` |
| 2025-12-31 | 1.5 KB | json | `pub/released/tourism_2023_sabah.json` |
| 2025-12-31 | 1.0 KB | json | `pub/released/tourism_2024.json` |
| 2025-12-31 | 766 B | json | `pub/released/tourism_domestic_2023-q4.json` |
| 2025-12-31 | 766 B | json | `pub/released/tourism_domestic_2024-q1.json` |
| 2025-12-31 | 766 B | json | `pub/released/tourism_domestic_2024-q2.json` |
| 2025-12-31 | 768 B | json | `pub/released/tourism_domestic_2024-q3.json` |
| 2025-12-31 | 1.1 KB | json | `pub/released/tourism_domestic_2024-q4.json` |
| 2025-12-31 | 1.1 KB | json | `pub/released/tourism_domestic_2025-q1.json` |
| 2025-12-31 | 1.1 KB | json | `pub/released/tourism_domestic_2025-q2.json` |
| 2025-12-31 | 1.1 KB | json | `pub/released/tourism_domestic_annual_2023.json` |
| 2025-12-31 | 1.1 KB | json | `pub/released/tourism_domestic_annual_2024.json` |
| 2025-12-31 | 12.6 KB | json | `pub/released/tourism_domestic_state_2022.json` |
| 2025-12-31 | 12.6 KB | json | `pub/released/tourism_domestic_state_2023.json` |

`meta/tourism.json` declares: publication `tourism`, title **"Tourism Satellite Account"**,
frequency YEARLY, geography STATE/NATIONAL. `meta/tourism_domestic.json`: **"Domestic
Tourism"**, QUARTERLY. `meta/tourism_domestic_annual.json`: annual variant.

### 1g. Often-confused: ICT Satellite Account (NOT tourism)

`gdp/ictsa_YYYY.(xlsx|pdf)` 2013–2024 matched the "tsa" keyword, but `ictsa` =
**Information & Communication Technology Satellite Account** (income, access, use of ICT).
Relevant only as a satellite-account methodology sibling; 24 files, 2013–2024.

---

## 2. Canonical OpenDOSM tourism datasets and their storage keys

*Web search (websearch skill) was unavailable in this session — no Serper API key is
configured. Canonical names below were instead verified from OpenDOSM's own machine-readable
metadata (`meta/*.json`, `pub/released/*.json`) and the bucket listing, which is the source
of truth the OpenDOSM portal renders from. The portal pages are:
`https://open.dosm.gov.my/publications/tourism`, `.../tourism-domestic`, etc.*

| Canonical name (EN) | Frequency | Coverage | Storage key pattern |
|---|---|---|---|
| **Tourism Satellite Account** (Akaun Satelit Pelancongan) | Yearly | 2010–2024 | `tourism/tourism_YYYY.xlsx` / `.pdf` |
| **Domestic Tourism** (Pelancongan Domestik), quarterly | Quarterly | 2023-Q4 → 2026-Q1 | `tourism/tourism_domestic_YYYY-qN(.xlsx / _en.pdf / _bm.pdf)` |
| **Domestic Tourism**, annual | Yearly | 2023–2025 | `tourism/tourism_domestic_YYYY.xlsx` / `.pdf` |
| **Domestic Tourism by State** | Yearly | 2022, 2023 | `tourism/tourism_domestic_YYYY_<state>.xlsx` / `.pdf` |
| Sabah tourism (state-level TSA variant) | Yearly | 2023 | `tourism/tourism_2023_sabah*` |

Key TSA data series inside the xlsx (verified by inspection of `tourism_2024.xlsx`):

- `Indicator Inbound` — visitor arrivals by country (e.g. 2019: 35.0 m total; Singapore,
  Indonesia, China, Thailand, Brunei top-5), tourist arrivals vs excursionists/day-visitors.
- `Indicator Domestik` — domestic visits, expenditure indicators.
- `Jad 1`–`Jad 7` (Malay "Table 1–7") — TSA tables: production accounts of tourism
  industries, tourism consumption, tourism gross value added, employment.

Direct URL pattern: `https://storage.dosm.gov.my/tourism/tourism_YYYY.xlsx`.

---

## 3. Gaps — tourism data that exists but is NOT openly downloadable here

1. **No machine-readable open-data tourism dataset in the OpenDOSM catalog.** The
   data-catalog index (`catalogue/index_en.json`, categories: Demography, Households,
   National Accounts, Education, Public Safety, Labour Markets, Prices, Economic Sectors,
   Environment, Statistical Indicators…) contains **zero** tourism datasets. The catalog
   only offers CSV/Parquet downloads for non-tourism series. All tourism data must be
   scraped from the xlsx publications above.
2. **No Tourist Expenditure Survey microdata / detailed expenditure tables as open data.**
   The TSA xlsx contains summary expenditure aggregates only; the underlying
   *Tourist Expenditure Survey* (DOSM/Motac) questionnaire data is not published.
3. **No hotel statistics.** DOSM's *Survey of Hotels / Hotel statistics* (e.g. hotel
   supply, roomnights, occupancy — historically in DOSM's "Services" publications) is not
   in the bucket. MOTAC separately publishes hotel-guest statistics via its own site
   (data.gov.my has some), not on OpenDOSM storage.
4. **No MICE (Meetings, Incentives, Conventions, Exhibitions) data.** Gained via MyCEB /
   MOTAC, not present in the bucket or catalog.
5. **No homestay data.** Homestay programme statistics (MOTAC/Rural Development) are absent.
6. **No travel-behaviour / passenger-movement microdata.** Border arrival/departure
   microdata (Immigration) is not open; only the TSA's aggregate arrivals tables.
7. **Domestic Tourism by State stops at 2023** in the bucket (2022 & 2023 only), and the
   quarterly series starts at 2023-Q4 — earlier quarterly state detail is missing.
8. **No monthly tourism series.** Everything is quarterly or annual.
9. **Historical TSA years 2010–2014 exist only as publication documents**; the xlsx for
   early years are small (~70–105 KB) and likely re-typed summary tables, not full TSA
   tables.
