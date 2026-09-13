# T10 evidence — Per-market prescriptions (grow / coast / reduce reliance)

Ticket: [#11](https://github.com/amiruluniten/Byte-Brains/issues/11) (parent spec, user story 11).
Date: 2026 build session. No git commits made (per ticket constraints).

## Placement decision: panel on the source-markets page (no new route)

- The prescriptions derive **only** from the `source_segmentation` fragment, which the
  source-markets page already renders (segment map, tiers table, cluster naming). Putting the
  verdict next to its evidence keeps the trace visible in one scroll.
- It avoids new nav plumbing (the dashboard uses breadcrumb-style prev/next links) and keeps
  the static export surface unchanged in size and structure.
- The policymaker flow stays: diagnosis page → "so what do we do" panel → method page rule.

## What was built

- `dashboard/src/lib/prescriptions.ts` — `buildPrescriptions(segmentation)`:
  - `grow` — segment `High-Yield Long-Haul` or `High-Growth Emerging`.
  - `coast` — segment `Low-Yield Steady`.
  - `reduce_reliance` — segment `Volume Traps`. Label and rationale follow CONTEXT.md:
    "Reduce reliance on low-yield same-day traffic"; the rationale states it is a
    **measurement critique of the arrivals KPI, not a judgement of the market**.
  - Unclustered markets get **no** verdict (the page lists them with the fragment's
    `excluded_reason`); a segment name no rule covers is surfaced as `unrulySegments`
    instead of being guessed; a missing `source_segmentation` fragment disables the panel
    (`available: false`) — same graceful-degradation contract as T6.
- `dashboard/src/app/diagnosis/source-markets/page.tsx` — additive panel "What to do with
  each market — per-market prescriptions": verdict badge, rationale, segment + yield tier,
  and the numbers behind the verdict (2024 yield RM/visitor, arrivals, arrivals growth
  vs 2023) — all read live from the bundle, nothing hardcoded.
- `dashboard/src/lib/diagnosis.ts` — `buildMethodIndex` gained a `per_market_prescriptions`
  entry (ticket T10) stating the exact derivation rule, rendered on `/method` (additive edit;
  the existing source_segmentation entry is untouched).

## Derivation rule (as documented on /method)

> Derived, not modelled: every clustered source market gets exactly one verdict from its
> segment membership — grow (High-Yield Long-Haul or High-Growth Emerging: each extra visitor
> adds disproportionate value), coast (Low-Yield Steady: arrivals without matching value, so
> effort stays flat), reduce reliance on low-yield same-day traffic (Volume Traps).
> Volume Traps is a measurement critique of the arrivals KPI, not a judgement of the market.
> Unclustered markets get no verdict; a segment no rule covers is flagged, never guessed.

## TDD

- Red first: `dashboard/tests/prescriptions.test.ts` written before the implementation;
  vitest failed with "Cannot find module '../src/lib/prescriptions'".
- Green: implementation added; **9 new tests** cover:
  1. one prescription per clustered market, from the bundle alone;
  2. Singapore/Brunei → `reduce_reliance` (Volume Traps);
  3. Australia/UK/China/India → `grow` (both grow segments);
  4. Thailand/Vietnam/Pakistan/Philippines → `coast`;
  5. verdicts carry yield, arrivals, growth, segment, tier from the fragment;
  6. Volume Traps wording stays neutral (no vilification language; rationale names the
     measurement critique);
  7. unclustered markets held out, with reasons;
  8. a segment name no rule covers is flagged, not guessed;
  9. missing segmentation fragment degrades gracefully.

## Verification

- `npm test` (vitest): **5 files, 53 tests, all pass** (44 pre-existing + 9 new).
- `npm run build`: compiled + type-checked clean; static export 9 pages, all `○ (Static)`,
  export step completed (2/2). No network at build or runtime; the panel reads only
  `data/bundle.json`.
- Rendered-output spot check (`out/diagnosis/source-markets.html`): panel present; e.g.
  Brunei and Singapore show "Reduce reliance on low-yield same-day traffic", segment
  "Volume Traps", bottom-quartile tier, RM 1,867.71 / 1,732,119 / +55.2% (Brunei).
- `/method` renders the `per_market_prescriptions` rule (grep-verified in `out/method.html`).

## Constraints respected

- Only `dashboard/` files touched (plus this evidence file and the issue comment).
- `CONTEXT.md`, ADRs and pipeline files untouched; no commits made.
