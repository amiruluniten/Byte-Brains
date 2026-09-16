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

**Scope**: this repo does **not** produce the submission report (PDF) or the video — those are built outside the repo by teammates. This repo ends at the report pack: keep `report-pack/` accurate and passing, since the report writer consumes it directly.

- **Data pipeline** (`pipeline/`): one command rebuilds everything — `pipeline/.venv/bin/tsa-pipeline` — emitting the checksummed data bundle (`data/processed/bundle.json`). The report pack reads **only** that bundle. After any data change: re-run the pipeline.
- **Report pack** (`report-pack/`): the hand-off material the teammate writing the report consumes. Keep it current and its tests green — its tests recompute every number from the bundle, so never hand-edit its figures.
- **Honesty rule**: nominal (non-inflation-adjusted) gaps are never quoted anywhere; the Missing Billions counterfactual exists only in constant 2019 prices (ADR-0002, issue #10).
- **Research & evidence**: `research/` holds methodology reference docs (`tsa-xlsx-map.md`, `regional-yield-benchmark-2024.md`) cited by the pipeline; raw official sources live in `data/raw/` and `source/`. Per-ticket acceptance evidence is in `tmp/research/`.

### Repository map (plain)

What each folder is, in one line — keep this shared understanding current:

- **`data/`** — the data. `data/raw/` is untouched downloads; `data/processed/bundle.json` is the rebuilt bundle every number comes from.
- **`pipeline/`** — the code that rebuilds the bundle from `data/raw/`. One command: `pipeline/.venv/bin/tsa-pipeline`.
- **`report-pack/`** — all hand-off documents for **Wafa**, who writes the report from this pack; it includes the source registry, and the raw sources themselves live in `source/` and `data/raw/`.
- **`research/`** — methodology reference docs the pipeline cites (how the source workbooks were read; the regional yield benchmark).
- **`source/`** — copies of the official source documents (PDFs, briefing slides), duplicated here for provenance.
- **`submission/`** — the deliverables handed to judges **separately from this repo** (dashboard link, report PDF, poster); nothing here is final until it is copied/built into this folder.
- **`tmp/`** — internal team documents; **deleted before the judges see the repo**.
- **`tools/`** — helper tools the team built (`dosm-cli`, a CLI for the DOSM open-data API).
