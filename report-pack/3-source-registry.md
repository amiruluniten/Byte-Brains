# 3 · Source registry

Every dataset and document the project used, with publisher, where to find it, the
date we accessed it, and what it was used for. Cite these in the References section.
Raw copies live in the repo (`data/raw/`, `source/dataset/`, `source/article/`) and
each file's SHA-256 fingerprint is recorded in the data bundle (bundle v1, schema
1.1.0, checksum `338e1b34`), so any reference can be pinned to exact bytes.

## 3.1 Primary statistical sources (every headline number)

| # | source | publisher | where / URL | accessed | used for |
|---|---|---|---|---|---|
| 1 | Tourism Satellite Account 2023 (xlsx) | Department of Statistics Malaysia (DOSM) | `https://storage.dosm.gov.my/tourism/tourism_2023.xlsx` (repo copy: `data/raw/tourism_2023.xlsx`) | 2026-09-13 | National tourist arrivals 2015–2023 (2019 = 26,100,784); inbound tourism consumption 2015–2023 (2019 = RM86,706.5 million). |
| 2 | Tourism Satellite Account 2024 (xlsx) | DOSM | `https://storage.dosm.gov.my/tourism/tourism_2024.xlsx` (repo copy: `data/raw/tourism_2024.xlsx`) | 2026-09-13 | Visitor, tourist, and same-day visitor (excursionist) arrivals 2019–2024 (2024 visitors = 37,961,485); inbound tourism consumption 2024 (RM102,815.3 million as first published — the TSA 2025 edition, row 9, restates it to RM102,931.3 million). |
| 3 | Malaysia Tourism Statistics in Brief 2024 (PDF) | Tourism Malaysia (Ministry of Tourism, Arts and Culture) — Strategic Planning Division | `https://data.tourism.gov.my/frontend/pdf/New_Final_Malaysia%20Tourism%20Statistics%20in%20Brief%202024.pdf` (repo copy: `data/raw/inbrief2024.pdf`; text extract `inbrief2024.txt`) | 2026-09-13 | Visitor receipts by country of nationality (top-20, 2024 & 2023; national RM106,783.11 million), visitor arrivals by source market (top-20), mode-of-arrival table (land = 66.1% of 2024 arrivals). The source of all per-market tourism yield figures. |
| 4 | CPI dataset `cpi_headline` — "Monthly CPI by Division (2-digit)", overall division, 2010=100 | DOSM (OpenDOSM) | `https://storage.dosm.gov.my/cpi/cpi_2d.csv` (repo copy: `data/raw/cpi_headline.csv`) | 2026-09-13 | The price deflator for the constant-2019-prices counterfactual (CPI 2019 = 121.483333; 2024 = 132.791667; ratio 1.093085). |
| 5 | WEF Travel & Tourism Development Index 2024 edition (TTDI) | World Economic Forum, distributed via World Bank Data360 | `https://data360api.data360api.org/datasets/WB.DATA360:DS_DATA360/download/csv` (WEF_TTDI database; repo copy: `source/dataset/WEF_TTDI.csv`) | 2026-09-12 | Five source-market traits used in the segmentation: purchasing power, length of stay, overall TTDI score, air connectivity, passport mobility. |
| 6 | World Development Indicators — International tourism, number of arrivals (`ST.INT.ARVL`) | World Bank | WDI API CSV download, indicator `ST.INT.ARVL` (repo copy: `source/dataset/API_ST.INT.ARVL_DS2_en_csv_v2_346201.csv`) | 2026-09-10 | Long-run cross-country arrivals context; regional benchmark panel (arrivals side). |
| 7 | World Development Indicators — International tourism, receipts (`ST.INT.RCPT.CD`) | World Bank | WDI API CSV download, indicator `ST.INT.RCPT.CD` (repo copy: `source/dataset/API_ST.INT.RCPT.CD_DS2_en_csv_v2_328565.csv`) | 2026-09-08 | 2019 cross-country receipts-per-visitor baseline for the regional comparison (Malaysia $851, Thailand $1,613, Indonesia $1,143 per visitor, 2019). WDI receipts stop at 2020 in the current build. |
| 8 | Tourist arrivals into Malaysia by quarter (regional) | Tourism Malaysia statistics portal (data.tourism.gov.my) | repo copy: `source/dataset/tourist-arrivals-into-malaysia-by-quarterly-regional.csv` | 2026-09-12 | Regional composition of arrivals over time (quarterly, by region) — supporting context for the diagnosis section. |
| 9 | Tourism Satellite Account 2025 (xlsx) | DOSM | `https://storage.dosm.gov.my/tourism/tourism_2025.xlsx` (repo copy: `data/raw/tourism_2025.xlsx`) | 2026-09-16 | 2025 preliminary ("2025p") visitor arrivals (42,196,892) and inbound tourism consumption (RM119,312.0 million); also restates 2024 inbound consumption (RM102,815.3 million → RM102,931.3 million) — the revision the headline recomputes from. |

## 3.2 Context datasets (background, not headline numbers)

| # | source | publisher | where | accessed | used for |
|---|---|---|---|---|---|
| 10 | Domestic Tourism Survey 2025 (`tourism_domestic_2025`) | DOSM (OpenDOSM) | repo copy: `source/dataset/tourism_domestic_2025.csv` (+ OCR of the release in `source/article/tourism_domestic_2025.md`) | 2026-09-12 | Domestic tourism context only — confirms the project scope is inbound; domestic analysis is out of scope. |
| 11 | Domestic Tourism Bulletin Q1 2026 (`tourism_domestic_2026-q1`) | DOSM (OpenDOSM) | repo copy: `source/dataset/tourism_domestic_2026-q1.csv` (+ OCR in `source/article/tourism_domestic_2026-q1_en.md`) | 2026-09-12 | Same — domestic context. |

## 3.3 Press and analysis articles (Literature Review support)

These carry the expert argument and the policy framing. They are cited as
literature, never as a source of headline statistics (all headline statistics come
from the primary statistical sources in §3.1).

| # | article | publisher / author | URL | accessed | used for |
|---|---|---|---|---|---|
| 12 | "Tourism recovery must be about spending, not just visitor numbers: Experts" (Faiz Ruzman, Ashwin Kumar) | The Sun Daily | `https://thesun.my/news/tourism-recovery-must-be-about-spending-not-just-visitor-numbers-experts/` | 2026-09-12 | The project's core expert argument: arrivals measure volume, not performance; yield (per-capita expenditure × length of stay) does. Anchors the Problem Statement. |
| 13 | "Tourism Satellite Account, 2024" (press release for the TSA 2024 edition) | DOSM | repo copy: `source/article/Tourism+Satellite+Account,+2024.md` | 2026-09-12 | Official framing numbers: tourism industry RM291.9 billion, 15.1% of the economy in 2024; inbound expenditure RM107.0 billion (+41.1%); tourists contribute 96.1% of inbound expenditure vs 3.9% from the same-day segment — a key Volume Trap statistic. |
| 14 | "Malaysia's Travel & Tourism Sector Projected to Exceed Previous Heights" | World Travel & Tourism Council (WTTC) | `https://wttc.org/news/malaysias-travel-and-tourism-sector-projected-to-exceed-previous-heights` | 2026-09-12 | Independent estimate that 2024 international visitor expenditure (RM93.7 billion projected) would still sit 6.2% below 2019 — external support for the value-not-recovered reading. |
| 15 | "Malaysia welcomes value over volume as tourist spending surges…" | The Edge Malaysia (citing BIMB Securities) | `https://theedgemalaysia.com/node/811461` | 2026-09-12 | Market commentary that spending quality matters more than arrival counts; declining Singapore-arrival share framed as diversification — pairs with our market mix prescription. |
| 16 | "Malaysian Economy — Exploring the Tourism Sector" | TA Research / TA Securities, via i3investor | `https://klse.i3investor.com/web/blog/detail/taresearch/2024-06-25-story-h-158747182-Malaysian_Economy_Exploring_the_Tourism_Sector` | 2026-09-12 | Documents the official 2024 KPI framing (27.3 million tourist-arrival target, RM102.7 billion receipts target) — evidence that national targets are set in arrival counts, the Volume Trap critique. |
| 17 | "Malaysia Tourism Statistics — How Many Tourists Visit? (2025)" | RoadGenius (statistics aggregator) | `https://roadgenius.com/statistics/tourism/malaysia/` | 2026-09-12 | Background orientation only; low authority — do not cite its numbers, use the primary sources above. |

## 3.4 Datathon materials (scope and rules, not data)

| # | document | publisher | where | accessed | used for |
|---|---|---|---|---|---|
| 18 | DOSM Datathon 2026 briefing slides + portal pages (rules, theme, judging) | DOSM | repo copies: `source/DOSM/` | 2026-09-12 | Deliverable formats, scoring emphasis (official Malaysian data; AI-Driven Innovation; Critical Thinking & Defence). |

## Notes for the References section

- Publisher names as above; DOSM items carry no single author — cite as
  "Department of Statistics Malaysia (year), *title*".
- Access dates above are the dates the raw copies in the repo were saved; if the
  pipeline is re-run after a source update, the bundle checksum changes and the
  report should be re-cited to the version the dashboard shows.
- The regional benchmark details (Thailand, Indonesia, Vietnam 2024 figures and
  their methodological caveats) are researched and fully sourced in
  `research/regional-yield-benchmark-2024.md`; cite those primary national sources
  through it rather than re-collecting them.
