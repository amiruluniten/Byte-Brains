# Byte-Brains dashboard

Data-only web dashboard for the Missing Billions. Every displayed figure is
computed at render time from the checksummed data bundle (`data/bundle.json`,
copied from `../data/processed/bundle.json` by the prebuild/predev hook in
`scripts/sync-bundle.mjs`). No backend, no database, no API keys, no
environment variables.

## Commands

```sh
npm install
npm run dev      # syncs the bundle, then next dev
npm run build    # syncs the bundle, then static export to out/
npm test         # vitest over the ported logic modules + the round-trip fixture
```

## Structure

- `src/lib/bundle.ts` — bundle loader/validator (schema 1.1.0). Verifies the
  sha256 checksum over the canonical JSON the Python emitter hashes; fails
  loudly on corruption.
- `src/lib/server-bundle.tsx` — build-time loader + error notice.
- `src/lib/simulator.ts` — the market-mix arithmetic mirrored 1:1 from
  `pipeline/src/bytebrains_pipeline/simulator.py::simulate_mix`.
- `src/lib/chart-data.ts`, `src/lib/diagnosis.ts`, `src/lib/prescriptions.ts` —
  chart builders, diagnosis builders (decomposition / regional / map / method),
  per-market prescriptions.
- `tests/` — vitest suite; `tests/fixtures/simulator-fixture.json` is generated
  by the pipeline (`pipeline/tests/fixtures/make_simulator_fixture.py`) and
  committed; Python wrote the expected values.
- App shell (sidebar/header, theming, `src/components/ui` kit) from the
  `next-shadcn-admin-dashboard` template; all demo screens, auth pages and
  placeholder data removed.

## Honesty rules (ADR-0002)

- Gaps are quoted ONLY in constant 2019 prices; the naive nominal gap is
  INVALID and never shown as a comparison.
- The headline is the pre-registered window 2020–2024 (RM10,098.4 million,
  constant 2019 prices) — guarded by the bundle parser; a longer window
  (2020–2025 incl. preliminary 2025, RM6,832.7m) is supplementary only.
- Preliminary years are labelled "2025p" everywhere.
