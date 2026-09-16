# Byte-Brains pipeline

Builds the versioned, schema-validated **data bundle (JSON)** — the project's single
seam: the pipeline writes it, the dashboard reads it, nothing else crosses.

Current fragments:

- `national_series` (ticket T1) — visitor, tourist, and same-day visitor
  (excursionist) arrivals plus inbound tourism consumption (Jad 1A totals),
  2015–2024, extracted from the DOSM Tourism Satellite Account workbooks.
  Ticket #13 adds the TSA 2025 edition ADDITIVELY (schema 1.0.0 → 1.1.0):
  arrivals 2019–2025 and consumption 2015–2025 as new labelled series from
  `tourism_2025.xlsx`, with the workbook's revised 2024 consumption
  (RM102,931.3m, `revision_status: "revised"`) and its preliminary 2025 column
  (`revision_status: "preliminary"`, the workbook's own "2025p" marker).
  Existing series identifiers and windows are unchanged.
- `source_market` (ticket T3) — visitor receipts and visitor arrivals by source
  market (top-20 tables, 2024 and 2023) with derived per-market yield, from the
  Tourism Malaysia *Statistics in Brief 2024* PDF. Extraction path:
  `pdftotext -layout data/raw/inbrief2024.pdf` (generated on the fly if absent);
  committed test fixture: `tests/fixtures/inbrief2024.fixture.txt`. Markets present
  in only one table (Bangladesh, Myanmar = arrivals-only; Canada, Netherlands =
  receipts-only) carry explicit `coverage` and null values — never silently zeroed.
  Validation includes the national reconciliation: receipts ÷ arrivals = RM2,813
  per visitor (2024).
- `macro_series` (ticket T4) — the national CPI deflator (DOSM OpenDOSM dataset
  `cpi_headline`, overall division, 2010=100, annual mean of the monthly index),
  downloaded with `tools/dosm-cli` and recorded as `data/raw/cpi_headline.csv`
  (committed test fixture: `tests/fixtures/cpi_headline.fixture.csv`). Ticket #13
  adds the additive extended window `cpi_national_overall_2015_2025` when the
  2025 workbook is in scope (the 2015–2024 series stays unchanged).
- `missing_billions` (ticket T4) — the headline counterfactual: actual receipts vs
  receipts at 2019's real per-visitor expenditure, in CONSTANT 2019 PRICES ONLY,
  deflated by the national CPI. Also emits the naive nominal twin, flagged invalid
  and asserted negative at the latest year (per the data it shows a false "surplus":
  nominal per-visitor expenditure rose), plus the Volume Trap indicators
  (excursionist share 25.5% 2019 → 34.1% 2024, land-mode share 66.1% in 2024).
  Ticket #13: with the 2025 workbook in scope the fragment recomputes from the
  latest official data (revised 2024, preliminary 2025 — real gap −RM3,265.7m, a
  surplus) and carries the PRE-REGISTERED headline, guarded to the 2020–2024
  window (the model rejects any other headline window). Per the revision policy
  (later official workbook wins) the headline VALUE recomputes with the table:
  RM10,098.4m from the revised receipts. The 2020–2025 cumulative (RM6,832.7m)
  is emitted only as a clearly-labelled supplementary figure, never the
  headline.

- `source_segmentation` (ticket T5) — unsupervised segmentation of the top-20
  source markets, emitted as named clusters plus yield quartile tiers. Built by
  `src/bytebrains_pipeline/segmentation.py` from the `source_market` fragment
  plus five WEF TTDI indicators (see below). Every yield figure in the fragment
  is copied from `source_market` (never recomputed), so clusters and tiers
  reconcile against the same numbers — checked in `validate.py` and in the
  fragment's own model validator.

### Segmentation method and feature subset (ticket T5)

**Features** (per market, anchored on 2024; the subset is a documented contract,
not a guess):

| feature | source | why |
|---|---|---|
| `yield_rm_per_visitor` | `source_market` fragment (In Brief 2024) | the segmenting quantity |
| `log10_arrivals` | `source_market` fragment | volume, log-scaled so China/Singapore do not dominate distance |
| `arrivals_growth_pct` | rederived from the same fragment's 2024/2023 arrivals | momentum |
| `wef_ppp` | WEF TTDI `WEF_TTDI_PPP` | visitor wallet (purchasing power) |
| `wef_length_stay_days` | WEF TTDI `WEF_TTDI_LENGTHSTAY` | stay length drives yield |
| `wef_ttdi_score` | WEF TTDI `WEF_TTDI_TTDI` | source market development level |
| `wef_air_connectivity_log10` | WEF TTDI `WEF_TTDI_IATACONNECTIDX` | reach (log-scaled) |
| `wef_passport_mobility` | WEF TTDI `WEF_TTDI_PASSPORTMOBHPI` | travel facilitation |

`receipts` is deliberately NOT a feature: it is exactly `yield x arrivals`
(perfectly collinear — double counting, no extra signal). WEF values are the
raw `WEF_TTDI_VAL` breakdown, `TIME_PERIOD` 2024 (latest available year kept
per indicator and recorded on each market as `wef_ref_years`).

**Missing data** is explicit, never zeroed: markets absent from the WEF TTDI
2024 edition (Brunei, Chinese Taipei, Russia, Myanmar) keep `None` values plus a
`wef_missing` attribution list, and enter clustering via median imputation over
the covered markets. Markets without a 2024 yield or arrivals (Bangladesh,
Myanmar, Canada, Netherlands) are excluded from clustering with a stated
`excluded_reason`.

**Clustering**: k-means, k=4, on z-scored features, k-means++ initialisation,
best of 12 consecutive fixed-seed restarts (seeds 42–53, lowest inertia kept).
Markets are processed in sorted order and every arithmetic path is
order-stable, so re-runs are byte-identical (asserted in tests). Clusters are
re-labelled by descending mean yield so ids are stable and meaningful.

**Segment names** are rule-based from cluster profiles (never machine ids),
drawn from a closed vocabulary:

- lowest mean yield AND highest volume -> **Volume Traps** (the arrivals KPI
  over-rewards exactly this short-stay regional traffic — the Volume Trap
  critique in `CONTEXT.md`; on 2024 data this lands on Singapore + Brunei,
  the same-day/excursionist-heavy markets);
- highest mean yield -> **High-Yield Long-Haul**;
- strongest growth among the rest -> **High-Growth Emerging**;
- leftovers -> **Mid-Yield Steady** / **Low-Yield Steady** by mean yield vs the
  panel median.

Each cluster carries its `naming_rationale` (profile numbers + the rule that
fired) in the fragment, so the dashboard can show why a segment is named that.

**Tiers**: quartiles of the SAME emitted 2024 yields
(`statistics.quantiles`, inclusive method; boundaries stored as
`yield_quartile_boundaries` and re-checked on every load). Labels:
`top_quartile` … `bottom_quartile` with judge-readable `tier_label` strings.

## Environment

Project venv managed with uv (Python ≥3.11):

```sh
cd pipeline
uv venv .venv
uv pip install --python .venv/bin/python -e ".[dev]"
```

## One command (extract + validate + print)

```sh
.venv/bin/tsa-pipeline
```

Runs extraction from `../data/raw/tourism_2023.xlsx` and `../data/raw/tourism_2024.xlsx`,
validates the bundle end to end (schema + ground-truth values + cross-file consistency),
writes `../data/processed/bundle.json`, and prints the national series table.
Flags: `--data-dir DIR`, `--out FILE`.

## Tests (offline, committed fixtures)

```sh
.venv/bin/python -m pytest
```

Fixtures are miniature copies of the real workbooks, generated by
`tests/fixtures/make_fixtures.py` (same pattern as `tools/dosm-cli`'s recorded
fixtures: no network, raw bytes committed under `tests/fixtures/`). They reproduce
every parsing gotcha in `research/tsa-xlsx-map.md`: bilingual merged A:B labels,
year header in row 3, multi-block sheets, `"2023p"` revision flags, `"n.a"` / `"4.1*"`
footnotes, and phantom-column artifacts.

## Bundle contract

pydantic models in `src/bytebrains_pipeline/bundle/models.py` (rationale in the module
docstring). Key rules:

- `bundle_version` + `schema_version`; sha256 `checksum` over the fragments (re-verified
  on every load — a corrupted bundle fails loudly).
- Each series states its **counting basis** (`visitor` / `tourist` / `excursionist`),
  its **window** (e.g. tourist-basis 2015–2023, visitor-basis 2019–2024), its unit, and
  its exact source (file, sheet, row). The window is embedded in `series_id`, so a
  mixed-basis series cannot be constructed silently.
- `Observation.revision_flag` carries DOSM's preliminary/estimate flags (`"2023p"`).

## Layout

```
src/bytebrains_pipeline/
  bundle/models.py     # contract (pydantic v2)
  workbook.py          # openpyxl gotchas: bilingual labels, revision flags, footnotes
  extractors/tsa_national.py
  extractors/cpi.py    # CPI deflator (recorded OpenDOSM download)
  missing_billions.py  # constant-2019-prices counterfactual (ticket T4)
  validate.py          # ground truths + cross-file consistency
  emit.py              # bundle assembly
  cli.py               # tsa-pipeline entrypoint
tests/                 # pytest, offline fixtures
```
