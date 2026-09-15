# Submission checklist — DOSM Datathon 2026

Development window: **8–22 Sep 2026** (online submission). Late = not evaluated.
Naming: report `TeamName_Datathon2026_Report.pdf`, video `TeamName_Datathon2026_Video.mp4` (official briefing copies: `source/DOSM/`).

## Before you submit, delete `tmp/` from the repo.

## 1. Dashboard — MANDATORY (C3, 20%)
- [ ] **The dashboard was deleted from the repo and Vercel — it must be rebuilt/restored first.**
      Until it is back, two pre-existing test failures remain (pipeline `test_simulator_fragment`
      and report-pack `test_dashboard_bundle_matches_pinned_bundle` — both expect `dashboard/`).
- [ ] Submit a working link OR source file (`.pbix`, `.xlsm`, `.twbx`, or organiser-approved online link).
- [ ] Judges must be able to explore it: every filter and interactive link works, zero technical errors.
- [ ] No external dependency judges cannot access; stays online until judging ends.
- [ ] Footer shows the bundle version + checksum matching the report (see `report-pack/pinned-bundle.md`).

## 2. Report — MANDATORY (C1, C2, C4)
- [ ] Use the official template (link in the briefing slides, `source/DOSM/`).
- [ ] Times New Roman 12, 1.5 spacing, justified; **max 25 pages** including front page, TOC, references.
- [ ] Sections in official order: Front Page · Table of Contents · Introduction (Background, Problem
      Statement, Objectives) · Literature Review · Methodology · Findings · Output (Dashboard) ·
      Conclusion · References.
- [ ] Export as PDF, named `TeamName_Datathon2026_Report.pdf` → `submission/report/`.
- [ ] Every number traced to the bundle (build from `report-pack/`); every external source cited
      (`report-pack/3-source-registry.md`); screenshots high-res (`report-pack/screenshots/`).
- [ ] Honesty rule held: counterfactual only in constant 2019 prices; no nominal gap quotes.

## 3. Infographic poster — preliminary round (C5, creativity)
- [ ] Rubric scores "poster infografik" in the preliminary round → `submission/poster/`.

## 4. Video — later rounds
- [ ] ≤ 10 minutes, MP4, `TeamName_Datathon2026_Video.mp4` → `submission/video/`.
- [ ] Flow: team intro (≤1 min) → problem & objectives → data & methodology → key findings →
      live dashboard demo → conclusion, impact, scalability.

## Rubric (preliminary, online)
| criterion | weight | strongest evidence in repo |
|---|---|---|
| C1 Methodology | 15% | `pipeline/`, `report-pack/2-method-notes.md` |
| C2 Data quality & analysis | 25% | `data/`, `source/`, `report-pack/1-data-cleaning-log.md`, `3-source-registry.md` |
| C3 Dashboard | 20% | `submission/dashboard/` (to be restored) |
| C4 Impact & commercial | 25% | `report-pack/4-findings-material.md` (impact section), `README.md` |
| C5 Creativity | 15% | poster, segmentation + simulator, `tools/dosm-cli` |
