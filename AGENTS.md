# AGENTS.md

## Agent skills

### Issue tracker

Issues are tracked on GitHub via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role triage vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Project

DOSM Datathon 2026 entry (deadline 22 Sep 2026). Live: https://dashboard-ten-wine-40.vercel.app. Read `CONTEXT.md` for vocabulary and `docs/adr/` before working here.

- **Data pipeline** (`pipeline/`): one command rebuilds everything — `pipeline/.venv/bin/tsa-pipeline` — emitting the checksummed data bundle (`data/processed/bundle.json`). The dashboard and report pack read **only** that bundle. After any data change: re-run the pipeline, then `cd dashboard && npm run deploy`.
- **Dashboard** (`dashboard/`): Next.js static export on Vercel; no backend. Deploy command, data-sync, and rollback live in `dashboard/README.md`.
- **Report pack** (`report-pack/`): the team's human writers build the submission report from it. Its tests recompute every number from the bundle — never hand-edit its figures.
- **Honesty rule**: nominal (non-inflation-adjusted) gaps are never quoted anywhere; the Missing Billions counterfactual exists only in constant 2019 prices (ADR-0002, issue #10).
- **Research & evidence**: `research/` holds findings and per-ticket acceptance evidence; raw official sources live in `data/raw/` and `source/`.
