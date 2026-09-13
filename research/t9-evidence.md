# T9 evidence — submission readiness (issue #10)

Date: 2026-09-13 (working session). All commands run from the repo root unless noted.

## 1. Screenshot set (dashboard routes, high resolution)

Captured from the committed static export `dashboard/out/` (the same artefact
`vercel --prod` serves), not from `npm run dev`:

- Server: `python -m http.server 8799` from `dashboard/out` (static export has no server).
- Browser: Playwright 1.62.0 + Chrome Headless Shell 151 (installed via
  `uv pip install --python <kernel-venv> playwright` and
  `python -m playwright install chromium`).
- Viewport 1440×900, deviceScaleFactor 2 (2880 px wide), `full_page: true`,
  `wait_until: "networkidle"` plus a 2.5 s settle so ECharts finishes animating.
- Output: `report-pack/screenshots/` — `landing.png`, `diagnosis-decomposition.png`,
  `diagnosis-source-markets.png`, `diagnosis-regional.png`, `simulator.png`, `method.png`.
- Each capture was visually verified: charts rendered, no error notice, bundle
  footer on `/method` shows bundle v1 / checksum `ad9523c8...`.
- Reference table added to `report-pack/4-findings-material.md` ("Dashboard figures
  (screenshots)") and the pack README files table.

## 2. Bundle pinning

- Bundle: v1, schema 1.0.0, generated 2026-09-13T07:27:42Z.
- Full sha256: `ad9523c82ebaf162f5c88dcf87c2e60102770342835d2376017cca183ca30bbe`
  (the pipeline's canonical-JSON digest — the same digest the dashboard validates
  at build time; the pack README already cited its first 8 chars).
- New note: `report-pack/pinned-bundle.md` (full checksum, generation date,
  re-verification instructions, hashed raw sources).
- New tests in `report-pack/tests/test_report_pack.py` (TDD: red → green):
  - `test_pinned_bundle_note_exists_and_pins_full_checksum` — pins version,
    schema, FULL sha256, generation date; any bundle re-run without refreshing
    the pin goes red.
  - `test_dashboard_bundle_matches_pinned_bundle` — `dashboard/data/bundle.json`
    and `data/processed/bundle.json` must have the same checksum + version.
  - `test_pinned_bundle_referenced_from_pack_entry_points`.
  - `test_screenshots_exist_and_are_referenced` — one screenshot per route,
    referenced from the findings material.

## 3. Deployment verification

```
$ vercel ls
Vercel CLI 59.16.0 (Node.js 26.8.1)
Fetching deployments in amirul-hakimi-s-projects
> No deployments found under amirul-hakimi-s-projects.
```

CLI authenticated as amiruluniten. **No deployment exists.**

**STATUS: PENDING-USER.** The remaining command is exactly:

```sh
cd dashboard && npm run deploy   # = vercel --prod
```

One-time setup if the CLI session has expired: `npm i -g vercel && vercel login`
(the CLI is already authenticated in the current environment). Framework
Next.js is auto-detected; accept defaults — all settings live in
`next.config.mjs` (`output: "export"`). First run asks for project scope/name;
every later run is push-button (user story 21).

**Rollback plan (execute after first deploy):**

1. Every deploy is immutable on Vercel: `vercel ls` lists prior deployments with
   their URLs; the previous production deployment stays live under its own URL.
2. To roll the production domain back: `vercel rollback <deployment-url>`
   (instant, no rebuild).
3. Data-level rollback: the bundle is committed at `dashboard/data/bundle.json`,
   so `git checkout <previous-sha> -- dashboard/data/bundle.json && npm run deploy`
   restores the previous numbers with the same build.
4. Uptime ownership is the team-lead's (spec: dashboard must stay reachable until
   judging completes). Post-deploy verification checklist: `vercel ls` shows
   READY; open `/`, `/diagnosis/decomposition`, `/diagnosis/source-markets`,
   `/diagnosis/regional`, `/simulator`, `/method`; confirm the `/method` footer
   checksum matches `report-pack/pinned-bundle.md`.

## 4. Test status at time of writing

- pipeline: `cd pipeline && .venv/bin/python -m pytest -q` → **128 passed**.
- dashboard: `cd dashboard && npm test` → **44 passed** (4 files).
- report pack: `cd pipeline && .venv/bin/python -m pytest ../report-pack/tests -q`
  → **18 passed** (incl. the 4 new T9 tests).
- Final two-axis review: `research/t9-review.md`.
