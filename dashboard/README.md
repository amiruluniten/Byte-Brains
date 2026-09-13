# Byte-Brains dashboard

Static Next.js + TypeScript + ECharts site that renders the national
extensive-vs-intensive chart **from the data bundle only**
(`data/bundle.json`, synced from `../data/processed/bundle.json` at build
time). No backend, no database, no runtime data fetching — the bundle is read
from disk during `next build` and the whole site is exported to `out/`
(ADR-0001, ADR-0002).

## Run locally

```sh
npm install
npm run dev        # http://localhost:3000
```

The pipeline output is copied in by the prebuild hook
(`scripts/sync-bundle.mjs`): if `../data/processed/bundle.json` exists it wins,
otherwise the committed copy in `data/bundle.json` is used.

## Tests (offline)

```sh
npm test
```

Vitest, no network. Covers: bundle schema validation (mirrors
`pipeline/src/bytebrains_pipeline/bundle/models.py`), checksum verification
over the same canonical JSON the Python emitter hashes (byte-compatible,
including Python's float formatting), counting-basis labelling of chart
traces, and ground-truth values (2024 visitors 37,961,485; 2019 tourist
arrivals 26,100,784; 2019 inbound consumption RM 86,706.5M).

## Production build (static export)

```sh
npm run build      # emits ./out
```

If the bundle is missing or fails validation (checksum mismatch, bad schema),
the build still succeeds but the page renders a clear
"Dashboard cannot show data" notice with the exact reason — never a blank
screen.

## One-command Vercel deploy (team-lead)

```sh
npm run deploy     # = vercel --prod, from this directory
```

One-time setup: `npm i -g vercel`, then `vercel login` with the team Vercel
account. First run asks a few questions (framework: **Next.js** is
auto-detected; root directory: accept the defaults — all settings live in
`next.config.mjs` with `output: "export"`). Every later run is push-button.

Notes:

- The bundle is committed at `data/bundle.json`, so Vercel builds need nothing
  outside this folder. After a pipeline re-run, `git add data/bundle.json`
  (or just `npm run deploy`, which syncs it first) to ship updated data.
- Vercel serves the `out/` static export on the free tier; no functions, no
  environment variables.

## Rollback

- Every deploy is immutable: `vercel ls` lists prior deployments with their URLs.
  `vercel rollback <deployment-url>` repoints the production domain at the
  previous deployment instantly (no rebuild).
- Data-level rollback: the bundle is committed at `data/bundle.json`, so
  `git checkout <previous-sha> -- data/bundle.json && npm run deploy` restores
  the previous numbers with the same build.
- Report writers must re-cite whatever bundle version the `/method` footer
  shows after any rollback (see `../report-pack/pinned-bundle.md`).

## Layout

```
src/lib/bundle.ts          # bundle loader + validator + checksum (the seam)
src/lib/chart-data.ts      # bundle -> basis-labelled chart specs
src/lib/diagnosis.ts       # ticket T6: decomposition, regional comparison, map join, method index
src/lib/server-bundle.tsx  # build-time bundle loader + error notice (diagnosis/method pages)
src/app/page.tsx           # landing page (build-time bundle read; error notice)
src/app/diagnosis/decomposition/  # ticket T6: extensive-vs-intensive, real vs nominal, Volume Trap
src/app/diagnosis/source-markets/ # ticket T6: yield map (choropleth) + segment overlay
src/app/diagnosis/regional/       # ticket T6: THA/IDN vs MYS benchmark with basis caveats
src/app/method/                   # ticket T6: method & sources, bundle version + checksum
src/app/simulator/                # ticket T7: market-mix simulator
src/components/NationalCharts.tsx  # client-side ECharts renderer
src/components/DiagnosisCharts.tsx # ticket T6: line/bar renderers + YieldMap (ECharts choropleth)
public/geo/world.json      # Natural Earth-derived world geometry (public domain) for the yield map
data/bundle.json           # committed bundle, synced from the pipeline
tests/                     # vitest, offline
```
