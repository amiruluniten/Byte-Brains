# AGENTS.md

your name is prime
## Agent skills

### Issue tracker

Issues are tracked on GitHub via the `gh` CLI. See `tmp/agents/issue-tracker.md`.

### Triage labels

Default five-role triage vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `tmp/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the repo root + `tmp/adr/` for decisions. See `tmp/agents/domain.md`.

## Project

DOSM Datathon 2026 entry (deadline 22 Sep 2026). Read `CONTEXT.md` for vocabulary and `tmp/adr/` before working here. Internal/team-only docs live under `tmp/` and are deleted before submission.

- **Data pipeline** (`pipeline/`): one command rebuilds everything — `pipeline/.venv/bin/tsa-pipeline` — emitting the checksummed data bundle (`data/processed/bundle.json`). The report pack reads **only** that bundle. After any data change: re-run the pipeline.
- **Report pack** (`report-pack/`): the team's human writers build the submission report from it. Its tests recompute every number from the bundle — never hand-edit its figures.
- **Honesty rule**: nominal (non-inflation-adjusted) gaps are never quoted anywhere; the Missing Billions counterfactual exists only in constant 2019 prices (ADR-0002, issue #10).
- **Research & evidence**: `research/` holds methodology reference docs (`tsa-xlsx-map.md`, `regional-yield-benchmark-2024.md`) cited by the pipeline; raw official sources live in `data/raw/` and `source/`. Per-ticket acceptance evidence is in `tmp/research/`.
