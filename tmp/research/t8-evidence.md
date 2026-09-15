# T8 evidence — Report pack for teammates

*Ticket: amiruluniten/Byte-Brains#9 · Spec: #1 · Blocked-by: #6, #5 (both closed) ·
Built TDD (tests red first, then pack content green). No git commits made (per
ticket instructions). Concurrency: ticket #8 (T7, simulator) was in flight during
this build; no simulator code or fragment was touched.*

## What was built

`report-pack/` — the pack that lets the three teammates write the ≤25-page report
without access to our process:

| file | content |
|---|---|
| `README.md` | how to use the pack; the exact bundle citation (bundle v1, schema 1.0.0, checksum `ad9523c8…`, generated 2026-09-13); language rules mirroring `CONTEXT.md` (glossary alignment); honesty rules (real-terms-only headline; the two receipts bases named). |
| `1-data-cleaning-log.md` | every transformation in the pipeline, per source, in plain language — what changed, why, what could go wrong (TSA bilingual merged labels/row-3 headers/multi-block sheets/`2023p` flags/footnote artefacts; In Brief `pdftotext -layout` parsing, explicit nulls for partial-coverage markets, RM2,813 national reconciliation; CPI monthly→annual mean, ratio-only deflator; WEF TTDI SDMX filtering + explicit missing + median imputation; counterfactual pairing + loud naive-nominal guard; segmentation determinism; simulator inputs incl. residual market). |
| `2-method-notes.md` | the four methods with no code: tourism yield (receipts ÷ arrivals, same publication), the constant-2019-prices counterfactual (full 6-row table; cumulative 2020–2024 gap **RM10,204.5M ≈ RM10.2 billion**; 2024 real gap **-RM139.07M ≈ 0** = the stagnation line, per-visitor real RM2,477.77 vs 2019 RM2,474.10; naive nominal twin invalid at **-RM8,894.66M**; In Brief receipts robustness variant), k-means segmentation (8 features, k=4, seeds 42–53, four named segments with mean yields RM5,371 / RM4,591 / RM3,406 / RM1,675 and the naming rules; quartile boundaries 3,597.70 / 5,085.92 / 5,393.03), and the simulator arithmetic (per-market real yields via the 1.093085 CPI ratio, share-driven receipts, presets, reconciliation at the 2024 mix). |
| `3-source-registry.md` | every dataset/PDF with publisher, URL/where, access date, and use: TSA 2023+2024 xlsx (storage.dosm.gov.my, 2026-09-13), In Brief 2024 PDF (data.tourism.gov.my, 2026-09-13), CPI `cpi_headline` (cpi_2d.csv, 2026-09-13), WEF TTDI 2024 (Data360, 2026-09-12), WDI `ST.INT.ARVL` (2026-09-10) + `ST.INT.RCPT.CD` (2026-09-08), quarterly regional arrivals, domestic 2025 + 2026-Q1, six articles with roles, Datathon materials. Notes on citing and on re-runs. |
| `4-findings-material.md` | key numbers + ready-to-adapt interpretations structured against the official template sections (Introduction, Problem Statement, Objectives, Literature Review, Methodology, Findings, Output, Conclusion); F1 headline, F2 Volume Trap, F3 named segments table, F4 regional context with basis caveats. |
| `5-advisor-summary.md` | one page, no code, for the academic advisor. |

## TDD (red → green)

New offline test file `report-pack/tests/test_report_pack.py` — **14 tests**, run
with the pipeline venv (pytest is already a project dev dependency; no new install):

```sh
cd pipeline && .venv/bin/python -m pytest ../report-pack/tests -q
```

1. **Red:** all 14 failed on an empty `report-pack/`.
2. **Green:** 14 passed after the pack was written. Tests pin:
   - all six pack files exist;
   - every headline number in the pack is grounded in the live bundle (computed,
     not hardcoded): cumulative gap, 2024 real/naive gaps, per-visitor real/nominal
     2019+2024, Volume Trap shares (25.5 / 34.1 / 8.6 / 66.1), national series
     (35,045,625 / 37,961,485 / 26,100,784 / 8,944,841 / 12,944,787 / 86,706.5 /
     102,815.3), source market totals (RM106,783.11M; RM2,813; Singapore
     RM1,481.87), segmentation (k=4, four segment names, quartile boundaries, each
     cluster's mean yield recomputed from member markets), CPI values (121.483333 /
     132.791667 / 1.093085);
   - the pack cites bundle v1, schema 1.0.0, and the checksum prefix
     (`ad9523c8` — re-read live from the bundle, so a pipeline re-run that changes
     the data makes the citation check fail loudly);
   - CONTEXT.md avoid-terms never appear in prose (with explicit "not X" guidance
     exempted), and "excursionist" appears only as "(excursionist)" after
     "same-day visitor" or inside inline code/field names;
   - the source registry covers every required source + access dates;
   - findings material covers all eight official template sections;
   - the simulator section degrades gracefully (content stands whether or not the
     `simulator` fragment is in the bundle).

One defect caught by the self-review/test loop during green: the draft said a
High-Yield Long-Haul visitor is worth "~3.6×" a Volume Trap segment visitor — the
segment-mean ratio is RM5,371 ÷ RM1,675 = **3.2×** (3.6× is vs Singapore's
individual RM1,481.87). Fixed in all three occurrences.

## Concurrency handling

- While building, the bundle changed under this task (T7/T6 work): checksum moved
  `c20b2099…` → `ad9523c8…` and a new `regional_benchmark` fragment landed. The pack
  and its tests were updated to the current bundle; no simulator or regional code
  was touched. All grounded numbers were unchanged by the re-emission.
- The pack text and tests are bundle-anchored, so any later re-run that changes
  values or the checksum fails the pack tests until the citation is refreshed —
  intentional drift protection, not flakiness.

## Verification

- `cd pipeline && .venv/bin/python -m pytest ../report-pack/tests -q` → **14 passed**.
- `cd pipeline && .venv/bin/python -m pytest -q` → **128 passed** (full project suite
  incl. T7's in-flight simulator tests; nothing in pipeline/ or dashboard/ modified
  by this ticket).
- Every number in the pack traces to the bundle (`data/processed/bundle.json`,
  checksum `ad9523c8…`) or to `research/regional-yield-benchmark-2024.md` /
  `source/article/` (regional and literature figures, caveats attached).
- No git commits made; CONTEXT.md and the ADRs untouched.
