# T6 evidence — Diagnosis section (decomposition, map, regional context, method page)

Ticket: amiruluniten/Byte-Brains#7 · Parent spec: #1 · Date: 2026-09-13

## What was built

Four diagnosis pages, all rendered **only** from the data bundle
(`dashboard/data/bundle.json`, synced from `data/processed/bundle.json`):

| page | route | bundle fragments used |
|---|---|---|
| Extensive-vs-intensive decomposition | `/diagnosis/decomposition` | `missing_billions`, (via it: `national_series` series ids, CPI deflator) |
| Source-market yield map + segments | `/diagnosis/source-markets` | `source_market`, `source_segmentation` (optional — degrades) |
| Regional comparison | `/diagnosis/regional` | `regional_benchmark` (NEW, additive) |
| Method & sources | `/method` | every fragment + bundle version/checksum |

Landing page headline block updated to the user-settled framing: the
stagnation line + the cumulative real gap + the Volume Trap as mechanism.
The regional gap appears ONLY on its own page as supporting context, never
on the landing page.

## New additive pipeline fragment: `regional_benchmark`

- Module: `pipeline/src/bytebrains_pipeline/regional_benchmark.py`
  (`build_regional_benchmark_fragment()`), wired into `emit.py`; ground-truth
  check `validate.py::check_regional_benchmark` runs at every emission.
- Model: `RegionalBenchmarkFragment` in `pipeline/.../bundle/models.py` —
  additive (new class + Bundle union member); **schema_version stays 1.0.0**.
- Content: 2024 receipts-per-visitor for **Malaysia $600 (RM2,813)**,
  **Thailand $1,363**, **Indonesia $1,202**, vs 2019 WDI baselines
  ($851 / $1,613 / $1,143) → **−29% / −16% / +5%**, multiples
  **2.3× / 2.0× Malaysia**. All figures from the officially published
  releases documented in `research/regional-yield-benchmark-2024.md`
  (per-country source URLs carried in the fragment).
- Basis caveats travel with every row: Malaysia/Thailand = survey,
  Indonesia = balance-of-payments (administrative). Caveat list states the
  survey vs BOP distinction, the WDI-2019 baseline rationale, Thailand's
  1.67T-vs-1.61T restatement, and the USD conversion bases.
- **Vietnam excluded, documented**: its published revenue includes domestic
  tourism, so no defensible 2024 international receipts-per-visitor exists
  (the naive ~$1,889 is flagged invalid in the exclusion reason).
- Model validators reconcile each row: yield = receipts/arrivals (≤1%),
  change-vs-2019 vs yields (≤1pp), exactly one baseline, Vietnam present in
  `excluded_markets`. The dashboard parser mirrors the yield reconciliation.

## No hardcoded figures

Every page number is computed from the bundle at build time: the RM10.2B
cumulative gap is `sum(gap_2019_prices_rm_million, 2020..2024)` from the
`missing_billions` fragment (= 10,204.5 RM million in the current bundle);
the stagnation pair (RM2,478 vs RM2,474 real 2019) comes from the same
fragment's per-visitor fields; map shading joins `source_market` yields with
`source_segmentation` segments; the regional table reads the new fragment.
When a fragment is absent (e.g. `source_segmentation` without the WEF file,
or the simulator fragment on a stale bundle) the pages degrade to a stated
notice — never blank, never guessed numbers.

## The yield map

Client-side ECharts choropleth over a committed Natural Earth-derived world
geometry (`dashboard/public/geo/world.json`, 110m + a small stylised
Singapore polygon; public domain). Toggle shades by **yield per visitor
(RM)** or **named segment** (Volume Traps, High-Yield Long-Haul,
High-Growth Emerging, Low-Yield Steady). Tooltips carry market, yield,
arrivals, segment/tier and exclusion reasons. No map tiles, no network.

## Verification (all offline)

- Pipeline: `cd pipeline && .venv/bin/python -m pytest` → **128 passed**
  (14 new in `tests/test_regional_benchmark.py`, written test-first).
- Dashboard: `npm test` → **44 passed** (18 new in `tests/diagnosis.test.ts`:
  decomposition indexes to 2019=100, real-vs-nominal distinction, cumulative
  gap = fragment sum in (9,500, 11,000); regional rows/caveats/exclusions;
  map join covers every market against the committed geometry; graceful
  degradation without segmentation; method index documents every fragment
  with official URLs).
- `npx tsc --noEmit` clean; `npm run build` static export clean
  (9/9 pages), geo file present in `out/`.
- Visual smoke: headless-Chrome screenshots of all four pages (served from
  `out/`): decomposition headline shows "RM 10.2 billion", charts label
  bases and windows; map shades correctly and the segment table lists
  Volume Traps (Singapore, Brunei) with naming rationales; regional page
  shows −29% outlier position, basis column and Vietnam exclusion;
  method page lists bundle v1, checksum, and per-fragment official sources.

## Concurrency note

Ticket T7 (simulator) landed in parallel: its fragment, page and tests were
untouched here; `simulator.test.ts` (12 tests) passes alongside the new
work. No CONTEXT.md/ADR edits, no git commits.
