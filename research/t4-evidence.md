# T4 evidence — Missing Billions calculator (real-terms counterfactual)

*Ticket: amiruluniten/Byte-Brains#5. Built on the T1 bundle (`pipeline/`). Date: 2026-09-13.*

## What was built

- `pipeline/src/bytebrains_pipeline/missing_billions.py` — the counterfactual calculator
  (constant 2019 prices only, national CPI deflator).
- `pipeline/src/bytebrains_pipeline/extractors/cpi.py` — CPI deflator extractor over a
  recorded OpenDOSM download (`data/raw/cpi_headline.csv`).
- `pipeline/src/bytebrains_pipeline/bundle/models.py` — new contract kinds:
  `macro_series` (`MacroSeries`/`MacroSeriesFragment`/`MacroSource`) and
  `missing_billions` (`MissingBillionsFragment`, `CounterfactualYear`, `DeflatorMeta`,
  `VolumeTrap`), both covered by the bundle checksum and validated on every reload.
- `pipeline/src/bytebrains_pipeline/validate.py` — ground truths for the CPI series, the
  counterfactual values, the loud naive-nominal assertion, and the Volume Trap indicators.
- `pipeline/src/bytebrains_pipeline/emit.py`, `cli.py` — wiring + the printed
  Missing Billions table.
- Tests: `tests/test_missing_billions_schema.py` (12), `tests/test_cpi_extractor.py` (4),
  `tests/test_missing_billions.py` (7), `tests/test_missing_billions_e2e.py` (6).
  Full suite: **83 passed, offline** (recorded fixtures, no network).

## Method (constant 2019 prices only)

    per_visitor_nominal(t)  = receipts(t) / visitor_arrivals(t)              [RM]
    cpi_ratio(t)            = CPI(t) / CPI(2019)
    per_visitor_real(t)     = per_visitor_nominal(t) / cpi_ratio(t)          [2019 RM]
    counterfactual(t)       = visitor_arrivals(t) x per_visitor_real(2019)   [2019 RM m]
    actual_real(t)          = receipts(t) / cpi_ratio(t)                     [2019 RM m]
    real gap(t)             = counterfactual(t) - actual_real(t)
                              (positive = missing billions)

## Deflator choice (documented in bundle metadata)

DOSM national CPI (all items), dataset `cpi_headline` on OpenDOSM
("Monthly CPI by Division (2-digit)", overall division), 2010=100, annual mean of the
monthly index. Chosen over World Bank WDI because it is the same publisher as the TSA
(DOSM), is available through the repo's own `tools/dosm-cli`, and is monthly (clean
annual means). The index base is irrelevant — only CPI(t)/CPI(2019) ratios enter.

- **Fetched: 2026-09-13** via `dosm download cpi_headline`
  (`https://storage.dosm.gov.my/cpi/cpi_2d.csv`); the unmodified download is recorded at
  `data/raw/cpi_headline.csv`, its sha256 in `bundle.sources`.
- CPI 2019 = 121.483333; CPI 2024 = 132.791667; ratio = 1.093085 (+9.3% prices, 2019→2024).
- The deflator provenance (dataset id, URL, fetch timestamp, base, anchor index) is
  emitted inside the bundle's `missing_billions.deflator`.

## Hand-computed validation cases (in tests)

1. **Synthetic world** (anchor 2019, CPI 100→110): 2019 = 1,000 visitors × RM1.0m;
   2024 = 2,000 visitors × RM2.4m. Expected: per-visitor nominal 2024 = RM1,200;
   real 2024 = RM1,090.9091; counterfactual = RM2.0m; actual real = RM2.1818m;
   real gap = −RM0.1818m; naive nominal gap = −RM0.4m. All asserted exactly.
2. **Anchor-year identity**: the 2019 row has ratio 1.0 and both gaps exactly 0.
3. **Real 2024** (Jad 1A receipts / visitor arrivals / DOSM CPI): per-visitor nominal
   2024 = 102,815.3M ÷ 37,961,485 = **RM2,708.41**; real (2019 prices) = 102,815.3 ÷
   1.093085 = RM94,059.71M → per-visitor real **RM2,477.77**; counterfactual =
   37,961,485 × RM2,474.10 = **RM93,920.64M**; real gap = **−RM139.07M**; naive nominal
   gap = **−RM8,894.66M**. Asserted to the cent in unit and end-to-end tests.
4. **Coverage-gap loudness**: an arrivals year missing from receipts fails the run
   (the counterfactual window never shrinks silently).

## The loud naive-nominal guard (acceptance criterion 2)

Per the data, nominal per-visitor expenditure ROSE (2019 RM2,474.10 → 2024 RM2,708.41 on
the Jad 1A basis; RM2,813 on the In Brief basis that ticket T3 reconciles). A naive
nominal counterfactual therefore shows a false RM8.9bn "surplus" instead of missing
billions. The fragment contract (`MissingBillionsFragment._check_naive_nominal_is_loudly_negative`)
and `validate.check_missing_billions` both **fail emission and reload** if the latest
year's naive nominal gap is ever >= 0, so the real-terms path cannot regress silently.
The naive twin is still emitted, field `naive_nominal_gap_rm_million`, explicitly an
invalid nominal-prices comparison.

## Result (real run, bundle checksum `0131f84d…561`)

| Year | Receipts nominal (RM m) | Per-visitor nominal (RM) | Per-visitor real 2019 (RM) | Actual 2019 prices (RM m) | Counterfactual 2019 prices (RM m) | Real gap (RM m) | Naive nominal gap (RM m, INVALID) |
|---|---|---|---|---|---|---|---|
| 2019 | 86,706.5 | 2,474.10 | 2,474.10 | 86,706.5 | 86,706.5 | +0.0 | +0.0 |
| 2020 | 13,157.3 | 2,156.45 | 2,181.29 | 13,308.8 | 15,095.4 | **+1,786.6** | +1,938.1 |
| 2021 | 389.8 | 974.83 | 962.22 | 384.8 | 989.3 | **+604.5** | +599.5 |
| 2022 | 32,473.3 | 2,276.05 | 2,173.19 | 31,005.7 | 35,299.1 | **+4,293.3** | +2,825.8 |
| 2023 | 72,992.8 | 2,520.09 | 2,347.77 | 68,001.6 | 71,660.7 | **+3,659.1** | −1,332.1 |
| 2024 | 102,815.3 | 2,708.41 | 2,477.77 | 94,059.7 | 93,920.6 | −139.1 | −8,894.7 |

Cumulative real gap 2020–2024: **+RM10,204.5M ≈ RM10.2 billion**.

### Honest reading (important for the report)

- In constant 2019 prices, real per-visitor expenditure was BELOW its 2019 level in every
  pandemic-recovery year 2020–2023, but by 2024 it had recovered to 2019's level
  (RM2,477.77 vs RM2,474.10, +0.15%) — the 2024 real gap is ≈ zero (−RM139M, well inside
  data revisions). The nominal 18.5% receipts jump 2019→2024 was almost entirely volume
  (+8.3% arrivals) plus inflation (+9.3% CPI): extensive growth, the project's thesis.
- The "−29% yield vs own 2019" figure in `research/regional-yield-benchmark-2024.md` is a
  USD balance-of-payments (2019 WDI) vs survey (2024) cross-basis comparison — supporting
  regional context with caveats (ticket T6), never this headline.
- The counterfactual pairs the TSA inbound tourism consumption (tourist basis, Jad 1A)
  with visitor-basis arrivals — the same pairing as the ticket's RM2,474 anchor. The
  pairing is stated in the fragment; when ticket T3's In Brief receipts series lands, the
  same calculator rewires to it via `receipts_series_id` (In Brief 2024 variant:
  real gap −RM3.7B — same conclusion: naive nominal negative, real 2024 yield ≈ 2019).

## Volume Trap indicators (acceptance criterion 3)

Emitted in `missing_billions.volume_trap`:

- Excursionist (same-day visitor) share 2019: 8,944,841 ÷ 35,045,625 = **25.5%**
- Excursionist share 2024: 12,944,787 ÷ 37,961,485 = **34.1%** (drift **+8.6 pp**)
- Land-mode share 2024: **66.1%** (25,080,202 of 37,961,485 arrivals; source:
  Tourism Malaysia *Statistics in Brief 2024*, mode-of-arrival table, verified against
  `data/raw/inbrief2024.txt`; exact ground truth in `validate.py`)

Both excursionist shares are computed from the national series, never hardcoded; the
land-mode share is hand-extracted from the PDF and pinned by ground truth.

## Determinism (acceptance criterion 4)

Pure arithmetic over recorded inputs — no randomness, no time in the checksum
(`generated_utc` is excluded). Three consecutive `tsa-pipeline` runs produced byte-identical
fragments and identical checksum `0131f84dd56024086075ab6b4844912319daf211f92dd3d39a85005c7020b561`;
`test_rerun_is_deterministic` pins this offline.

## Bundle validity

`data/processed/bundle.json` revalidates through `Bundle.model_validate_json` (schema +
checksum re-verified on load). Fragments: `national_series`, `source_market`, `macro_series`,
`missing_billions`. Sources checksummed: `tourism_2023.xlsx`, `tourism_2024.xlsx`,
`inbrief2024.txt`, `cpi_headline.csv`.

## How to run

    cd pipeline && .venv/bin/tsa-pipeline          # extract + validate + emit + print
    .venv/bin/python -m pytest                     # 83 tests, offline
