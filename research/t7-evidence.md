# T7 evidence — live market-mix simulator (prescription)

*Ticket: amiruluniten/Byte-Brains#8. Built on the T3/T4 fragments. Date: 2026-09-13.*

## What was built

**Pipeline side (additive — no existing model changed, SCHEMA_VERSION stays 1.0.0):**

- `pipeline/src/bytebrains_pipeline/simulator.py` — the coefficient exporter.
  `build_simulator_fragment(source_market, missing_billions)` exports per-source-market
  yields from the `source_market` fragment (never re-extracts anything), deflated to
  CONSTANT 2019 PRICES with the `missing_billions` national-CPI deflator, plus the
  arrivals/share volume data the mix arithmetic needs (2024 coefficients, 2023 shares
  for the earliest-observed preset).
- `simulate_mix()` — the arithmetic contract, defined once and mirrored 1:1 in
  `dashboard/src/lib/simulator.ts`:

      yield_per_visitor_real = Σ share_i · yield_real_i            [2019 RM]
      receipts_real          = visitors · yield_per_visitor_real   [2019 RM m]
      counterfactual         = visitors · anchor_per_visitor_real  [2019 RM m]
      gap                    = counterfactual − receipts_real      (positive = missing billions)

- `check_simulator_reconciliation()` — emission-time ground truth, wired additively in
  `emit.py` (plus the `"simulator"` fragment in the bundle union via
  `bundle/models.py`; exports in `bundle/__init__.py`).
- Tests: `tests/test_simulator_fragment.py` (14). Full suite: **114 passed, offline**.

**The residual bucket (reconciliation mechanism):** the fragment's 19 market rows
partition the national totals the Missing Billions calculator uses (TSA Jad 1A
receipts ÷ visitor-basis arrivals). The 18 full-coverage top-20 markets carry their
own (nominal yield, real yield, arrivals, shares); one explicit
**"Other markets (residual)"** row absorbs (a) non-top-20 visitors, (b) the four
partial-coverage top-20 markets (Bangladesh, Myanmar = arrivals-only; Canada,
Netherlands = receipts-only — never zeroed), and (c) the In Brief vs Jad 1A receipts
basis difference. The fragment validator fails loudly on a non-positive residual
(basis drift), so the bucket can never become a silent fudge.

**Dashboard side (Next.js, static export, no network at runtime):**

- `dashboard/src/lib/simulator.ts` — `simulateMix()`: the exact TypeScript mirror of
  the Python arithmetic (same operations, same left-to-right float summation order),
  plus the preset builders and share normalisation.
- `dashboard/src/lib/bundle.ts` — additive validation of the `simulator` fragment
  (mirrors the pydantic invariants: one residual, exact arrivals partition, shares
  sum to 1, real = nominal ÷ CPI-ratio).
- `dashboard/src/app/simulator/page.tsx` + `dashboard/src/components/SimulatorPanel.tsx`
  — build-time bundle read (same error-notice contract as the landing page), client
  component with one slider per market (raw weights, re-normalised live), preset
  buttons, output cards (receipts, yield per visitor, counterfactual, gap), per-market
  contribution bars, and a loud **"CONSTANT 2019 PRICES"** label on the arithmetic.
- `dashboard/tests/simulator.test.ts` (12) + the committed round-trip fixture
  `dashboard/tests/fixtures/simulator-fixture.json`. Full suite: **26 passed, offline**.

## Presets (and the one deliberate deviation)

1. **2024 actual mix** — the fragment's own shares. Reconciles EXACTLY with the
   `missing_billions` fragment (below).
2. **2023 mix (earliest observed)** — replaces the ticket's "2019 mix" preset.
   **Deviation, documented:** the bundle's only per-market source (Tourism Malaysia
   *Statistics in Brief 2024*) prints top-20 tables for 2024 + 2023 only — no 2019
   per-market receipts or arrivals exist in any pipeline input (`inbrief2024.txt`
   contains no "2019" at all; the TSA has no per-country tables), and Wayback
   harvesting of older In Brief editions is parked by the parent spec. A "2019 mix"
   preset would therefore be fabricated, not data-grounded. The honest 2019 anchor
   IS in the simulator: the counterfactual holds per-visitor real yield at its 2019
   level (RM 2,474.10), the same anchor as the headline.
3. **Policy scenario: shift Singapore to top-yield markets** — moves half of
   Singapore's 2024 share to the three highest real-yield markets (pro-rata),
   2024 volumes held constant. Deterministic rule, mirrored in Python and TS.

## Acceptance criteria

1. **Client-side arithmetic exactly mirrors Python; round-trip test.**
   `make_simulator_fixture.py` (pipeline) computed expected results for three named
   mix cases with `simulate_mix` and wrote `simulator-fixture.json`; the vitest suite
   reproduces every number from `inputs` alone (`toBeCloseTo` at 1e-9/1e-6). Python
   side re-checks the fixture in `test_python_reproduces_every_expected_case`.
2. **Sliders adjust shares; totals and yield update live, no network call.** The
   panel is a pure client component over exported coefficients; verified in the
   static export (`out/simulator.html` prerenders the full panel).
3. **Presets** — see above (2024 actual, 2023 earliest-observed, one policy scenario).
4. **Reconciliation at the 2024 actual mix** — exact (float tolerance 1e-6 RM m):

   | Quantity | Simulator at 2024 mix | missing_billions fragment 2024 |
   |---|---|---|
   | Actual receipts, 2019 prices | RM 94,059.707281 m | RM 94,059.707281 m |
   | Counterfactual, 2019 prices | RM 93,920.639143 m | RM 93,920.639143 m |
   | Real gap | −RM 139.068139 m | −RM 139.068139 m |
   | Yield per visitor (2019 RM) | RM 2,477.766802 | RM 2,477.766802 |

   Checked in `check_simulator_reconciliation` (every emission), the pipeline tests,
   and the dashboard tests against the committed, checksummed bundle.

## Policy scenario result (demo storyline)

Shifting half of Singapore's share (49.67% of 2024 arrivals — the same-day-heavy
Volume Trap market, real yield RM 1,356 per visitor) into the top-yield markets
(United Kingdom RM 5,748; China RM 5,123; Australia RM 5,083 — real 2019 RM) lifts the mix yield
from RM 2,477.77 to **RM 3,425.79 per visitor**: the same 37.96 m visitors would
have spent ~RM 130 bn (2019 prices) instead of RM 94.1 bn. That is the prescription
in one slider move: value per visitor is a mix decision, not an arrival count.

## Bundle

Re-emitted via `tsa-pipeline`; fragments now `national_series`, `source_market`,
`macro_series`, `missing_billions`, `simulator` (+ `source_segmentation` from T5);
re-checksummed and re-validated on reload; the committed dashboard copy
`dashboard/data/bundle.json` is synced and checksum-verified by the dashboard tests.

## How to run

    cd pipeline && .venv/bin/tsa-pipeline && .venv/bin/python -m pytest   # 114 tests
    cd dashboard && npm test                                              # 26 tests
    cd dashboard && npm run build                                         # /simulator exported
