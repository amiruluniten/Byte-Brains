# T2 evidence — Dashboard skeleton rendering the bundle (ticket #3)

Date: 2026-09-13 · Agent build · No git commits made (per ticket instruction).

## What was built

`dashboard/` — minimal Next.js 15 + TypeScript + ECharts static site.

- **Bundle is the only data source.** `src/app/page.tsx` reads
  `dashboard/data/bundle.json` from disk **at build time** (static export,
  ADR-0002). No runtime fetch, no backend, no database, no auth.
- `scripts/sync-bundle.mjs` (prebuild/predev hook) copies
  `../data/processed/bundle.json` into `dashboard/data/bundle.json` when the
  pipeline output exists; otherwise the committed copy is used. A build with
  neither fails loudly.
- **Checksum verification in TypeScript.** `src/lib/bundle.ts` re-verifies the
  bundle's sha256 on every load, byte-compatible with the Python emitter's
  `json.dumps(sort_keys=True, separators=(",",":"), ensure_ascii=False)` —
  including Python's float formatting (`25721251.0` vs JS `25721251`), handled
  by a tagged JSON parser that preserves int-vs-float token types. A corrupt
  bundle fails loudly.
- **Landing page** shows arrivals and receipts side by side (two ECharts bar
  charts): "Extensive side: visitor arrivals" (tourist basis 2015–2023,
  tourist basis 2019–2024, visitor basis 2019–2024, same-day visitor
  (excursionist) basis 2019–2024) and "Intensive side: tourism receipts"
  (tourist basis 2015–2024, RM million). Every trace carries an explicit basis
  label with its window and TSA source file; bases are never merged.
- **Bundle failure ⇒ clear error, never blank.** `page.tsx` catches load and
  validation failures and renders a "Dashboard cannot show data" page with the
  exact reason and fix instructions. Verified for three failure modes below.
- `dashboard/README.md` documents the one-command Vercel deploy
  (`npm run deploy` → `vercel --prod`) for the team-lead, who owns the actual
  deployment.

## TDD (red → green)

1. **Red:** `tests/bundle.test.ts` written first — failed with
   `Cannot find module '../src/lib/bundle'`.
2. **Green:** implemented `src/lib/bundle.ts`; 6 tests pass. One defect found
   and fixed during the slice: the canonical JSON int/float mismatch
   (checksum computed over `0af2477a…` instead of `faa94655…`) — fixed by the
   tagged parser, byte-identical to Python's canonical form.
3. **Red:** `tests/chart-data.test.ts` — failed
   (`Cannot find module '../src/lib/chart-data'`).
4. **Green:** implemented `src/lib/chart-data.ts`; one red-stage catch: the
   receipts trace was labelled "Tourist arrivals (2015-2024)" — renamed to
   "Tourist inbound consumption (2015-2024)" and pinned by a test.
5. Final: `npx tsc --noEmit` clean; **14/14 tests pass**, offline, no network.

## Verification log

- `npm run build` (static export): ✓ `Exporting (2/2)`, route `/` 338 kB,
  prerendered static. Output in `out/` (index.html, 404.html, _next/).
- Rendered `out/index.html` contains: "The Missing Billions",
  "Extensive side: visitor arrivals", "Intensive side: tourism receipts",
  basis labels e.g. "tourist basis (2015-2023), source: DOSM TSA
  tourism_2023.xlsx", "same-day visitor (excursionist) basis (2019-2024)",
  ground-truth data points (2024 visitors 37,961,485; 2019 consumption
  86,706.5).
- **Corrupt bundle** (bad checksum in `data/processed/bundle.json`) → build
  succeeds, page shows "Dashboard cannot show data" +
  "checksum mismatch: recorded 000…0, computed …". Not blank. ✓
- **Missing bundle** → page shows "Data bundle not found" + fix hint
  (`tsa-pipeline`). Not blank. ✓ (Pipeline output restored afterwards.)
- **Production smoke test:** `python3 -m http.server` over `out/` →
  `HTTP 200`, page contains "The Missing Billions". ✓

## Acceptance criteria

- [x] Landing page shows arrivals and receipts side by side from the bundle, with tourist/visitor basis clearly labelled.
- [x] Static export builds; no backend, database, or runtime data fetching.
- [x] One-command Vercel deploy documented for the team-lead (`dashboard/README.md`: `npm run deploy`).
- [x] Bundle load failure shows a clear error, never a blank screen (corrupt, invalid, and missing bundle all verified).

## Not done here (by design)

- Actual Vercel deployment — team-lead runs `cd dashboard && npm run deploy`.
- No git commits made.
