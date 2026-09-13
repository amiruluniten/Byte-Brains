# Malaysia tourism expenditure / receipts by country of origin — open data findings

Task: find whether TOURISM RECEIPTS / EXPENDITURE BY COUNTRY OF ORIGIN exists as open
data from an authoritative source (the DOSM Tourism Satellite Account does not contain it).

**Answer: YES** — country-level visitor receipts exist openly as PDFs published by
Tourism Malaysia (MOTAC) on `data.tourism.gov.my`.

---

## 1. OpenDOSM S3 bucket (storage.dosm.gov.my) — NO country-level expenditure

Checked 2026-07 (full bucket listing, list-type=2, 6507 keys total).

- Prefix probes `expenditure`, `travel`, `arrivals`, `receipt`, `inbound`: **0 keys each**.
- Full-key grep: `receipt` → 0 keys; `inbound` → 0 keys; `expendit` → only household
  income/expenditure survey (HIES) files, unrelated to tourism.
- All tourism keys live under `tourism/` and `pub/released/tourism_YYYY.json`. Verified
  `tourism/tourism_2024.xlsx` (13 sheets: `Indicator Inbound`, `Indicator Domestik`,
  `Jad 1`–`Jad 7`) — this is the **Tourism Satellite Account** (meta/tourism.json title:
  "Tourism Satellite Account"). Aggregate inbound receipts only, no country-of-origin split.
  Years 2010–2024, xlsx + pdf, URL pattern
  `https://storage.dosm.gov.my/tourism/tourism_YYYY.pdf|xlsx`.
- Domestic tourism files (`tourism_domestic_*`) are domestic (state-level), not inbound markets.

Conclusion: OpenDOSM has no receipts/expenditure by country of origin.

## 2. data.tourism.gov.my (Tourism Malaysia statistics portal) — YES, the best source

Portal landing page exposes direct PDF downloads (no login needed, no JSON/CSV API).
Verified live 2026-07. Three relevant publications:

### 2a. Malaysia Tourism Statistics in Brief 2024  ← single best source
- Exact URL: `https://data.tourism.gov.my/frontend/pdf/New_Final_Malaysia%20Tourism%20Statistics%20in%20Brief%202024.pdf`
- PDF, 32 pages, ~9 MB. Source: Strategic Planning Division, Tourism Malaysia.
- Contains (verified by text extraction):
  - **VISITOR RECEIPTS (RM million) by COUNTRY OF NATIONALITY** — top 20 markets,
    2024 and 2023 values. Top 5 for 2024: Singapore 27,941.65; China 20,866.57;
    Indonesia 15,323.27; India 6,112.06; Thailand 3,993.81.
  - **Visitor arrivals by country of nationality** (top markets, 2024 vs 2023, % growth).
  - Glossary defines Average Per Capita Expenditure, Average Per Diem, Average Length of
    Stay (defined, and the survey methodology — exit survey, disproportionate sampling by
    nationality/transport, weighted — is documented), but the in-brief itself does NOT
    print per-capita-spend-by-country tables.
- Coverage: 2 years per edition (current + previous), 20 countries. Annual edition.
- Prior editions not on the current site; the 2024 edition is archived at
  `https://web.archive.org/web/20250521054932/https://data.tourism.gov.my/frontend/pdf/New_Final_Malaysia%20Tourism%20Statistics%20in%20Brief%202024.pdf`.

### 2b. Malaysia's Tourist Profile 2024 by Selected Markets  ← richest breakdowns
- Exact URL: `https://data.tourism.gov.my/frontend/pdf/Malaysia_Tourist_Profile_2024%20v2.pdf`
  (raw link on the page contains a space: `Malaysia_Tourist_Profile_2024 v2.pdf`).
- PDF, 77 pages, ~862 MB (huge image-heavy graphics file).
- Annual Tourism Malaysia survey report. Per selected market (Singapore, Thailand,
  Indonesia, Brunei, Philippines, Vietnam, China, Japan, South Korea, Taiwan, India,
  Pakistan, Saudi Arabia, UAE, Oman, Kuwait, …), verified per-market metrics:
  - Tourist arrivals
  - **Tourist receipts (RM million)**, current vs previous year
  - **Average per capita expenditure (RM)**, current vs previous year
  - **Average length of stay (nights)**
  - Main purpose of visit shares (Holiday / VFR / Shopping / Medical / Business …)
  - Travel arrangement, mode of transport, socio-demographics
- Coverage: ~2 years per edition (current + previous), per selected market. This is the
  deepest open country-level expenditure dataset (per-capita spend + LOS + purpose).
- 2023 edition archived on Wayback:
  - `https://web.archive.org/web/20241213192907/https://data.tourism.gov.my/frontend/pdf/Tourist%20Profile%202023.pdf`
  - `https://web.archive.org/web/20251207190514/https://data.tourism.gov.my/frontend/pdf/Tourist%20Profile%202023_New.pdf`

### 2c. Other files on the portal (checked, not relevant)
- `Malaysia Tourism Key Performance Indicators 2024`
  (`frontend/pdf/2024/publications/kpi/kpi_2024.pdf`, 92 pp): KPI targets/achievements;
  no receipts or expenditure tables.
- Paid Accommodation Survey infographics, Hotel Supply Statistics, Outbound & Domestic
  Travel Behavior: no country-of-origin expenditure.

## 3. MOTAC "Malaysia Tourism Statistics in Brief" / "Tourism Receipts" publications

- The In Brief IS the MOTAC-affiliated publication (published by Tourism Malaysia,
  Strategic Planning Division) — covered in 2a. No separate "Tourism Receipts" open PDF
  series was found on data.tourism.gov.my; the receipts-by-market table lives inside In Brief.
- No machine-readable (CSV/JSON/xlsx) country-level expenditure dataset found anywhere:
  neither OpenDOSM (checked), data.gov.my (CKAN API endpoints 404), nor
  data.tourism.gov.my (static PDFs only).

---

## Bottom line

| Question | Answer |
|---|---|
| Country-level expenditure open? | **YES** — PDF only, no machine-readable format |
| Best single source | `Malaysia Tourism Statistics in Brief 2024` PDF (receipts by country of nationality, top 20 markets, 2024+2023) |
| Deepest breakdowns | `Malaysia's Tourist Profile 2024 by Selected Markets` PDF (receipts + per-capita spend + length of stay + purpose of visit, per market) |
| Format | PDF (graphics-heavy; Tourist Profile is 862 MB, needs OCR/very careful extraction) |
| Countries | ~20 top markets per year |
| Years | Per edition: current + previous year; editions annual (2023/2024 confirmed, earlier editions via Wayback) |
| Data quality | Official Tourism Malaysia survey data (exit interviews, weighted sample; Immigration Dept for arrivals). Designated "In Brief" = summary-level, values rounded to 2 dp RM million. Survey-based receipts, so estimates, not administrative totals. |

Pipeline implication: any country-expenditure feature must scrape/parse these PDFs
(pdftotext works for In Brief; Tourist Profile is image-heavy and may need OCR), and
historical coverage beyond 2 years requires Wayback harvesting.


---

## 4. Yield by source market — computed (parent, 2026-09-13)

From the two In Brief 2024 tables (arrivals + receipts by nationality), per-visitor receipts
for 2024 (top/bottom of the ranking; full CSV at `data/processed/yield_by_market_2024.csv`):

| Market | Visitors 2024 | Receipts 2024 (RM mil) | RM / visitor | Receipt share | Visitor share |
|---|---|---|---|---|---|
| United Kingdom | 390,035 | 2,450 | **6,283** | 2.5% | 1.1% |
| China | 3,725,894 | 20,867 | **5,600** | 21.2% | 10.2% |
| Australia | 447,785 | 2,488 | 5,557 | 2.5% | 1.2% |
| India | 1,365,387 | 6,112 | 4,476 | 6.2% | 3.8% |
| Indonesia | 4,145,127 | 15,323 | 3,697 | 15.6% | 11.4% |
| Brunei | 1,732,119 | 3,235 | 1,868 | 3.3% | 4.8% |
| Thailand | 2,268,182 | 3,994 | 1,761 | 4.1% | 6.2% |
| **Singapore** | **18,855,680** | **27,942** | **1,482** | **28.4%** | **51.8%** |

National average 2024: RM2,813 per visitor (RM106.78B / 37.96M).

The Volume Trap, quantified: Singapore alone is >half of arrivals and nearly 30% of
receipts, at the lowest per-visitor yield. Long-haul markets yield ~4x.
(Caveats: arrivals are Immigration Dept counts; receipts are exit-survey estimates;
markets differ between the two tables — Bangladesh/Myanmar have arrivals but no receipt
row; Canada/Netherlands have receipt rows but no arrivals row.)

2025 arrivals (42.19M, +11.2%) and 2025 receipts are not yet in a confirmed edition;
the 2025 In Brief should be checked at https://data.tourism.gov.my/ when planning the headline.
