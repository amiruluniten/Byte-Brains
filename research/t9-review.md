# T9 final review — two-axis, whole uncommitted change set (vs spec, issue #1)

Date: 2026-09-13. Change set: everything uncommitted above initial commit
`df85d8e` (pipeline, dashboard, report pack, CONTEXT.md, docs/adr, research).
Test status at review time: pipeline 128 passed · dashboard 44 passed ·
report-pack 18 passed (incl. 4 new T9 tests).

## Standards

Findings from the standards axis (CONTEXT.md vocabulary, ADR-0001/0002, repo
conventions, Fowler smell baseline). Classified blocker / should-fix / note.
Status column shows what T9 did about it.

| # | class | finding | status |
|---|---|---|---|
| S1 | note | `4-findings-material.md` Vietnam bullet says "published revenue includes domestic tourism" — "revenue" is a receipts avoid-term, but here it names Vietnam's third-party metric, so defensible. Report writers may copy it; leave a wording caution for the parent. | left as-is (defensible) |
| S2 | should-fix | `test_national_series_numbers_match_bundle`: dead assertion (`assert ... if ... else True` — always passes) and no actual bundle-vs-pack comparison despite the name. | **fixed** — bundle value now asserted present in the pack; dead code removed |
| S3 | should-fix | `test_headline_counterfactual_numbers_match_bundle`: `startswith(needle) or needle in pack` was a no-op — the "nothing invented" guarantee checked presence only. | **fixed** — bundle value (incl. −RM/RM decorated variants) must appear in the pack at some quoted precision |
| S4 | should-fix | `test_pack_cites_bundle_version_and_checksum`: `or "bundle v1" in pack` fallback would let a stale citation pass after a version bump to v2. | **fixed** — exact `bundle v{version}` only |
| S5 | note | `pinned-bundle.md` (new T9 file) was not in `PACK_FILES`, so it escaped the pack-wide avoid-term/prose checks. | **fixed** — added to `PACK_FILES` (the check immediately caught a bare "excursionist" in the new changelog, which was rewritten) |
| S6 | note | Stale comment `# c20b2099...` vs actual `ad9523c8...`. | **fixed** |
| S7 | note | Failure message pointed at `scripts/sync-bundle.mjs` without the `dashboard/` prefix. | **fixed** |
| S8 | note | Simulator TS ↔ Python arithmetic duplication. | accepted — deliberate bit-for-bit contract per ADR-0002, validated by round-trip tests |
| S9 | note | Repo had no root `.gitignore`; `report-pack/tests/__pycache__/*.pyc` was untracked noise. | **fixed** — root `.gitignore` added (`__pycache__/`, `*.pyc`, `.pytest_cache/`, `.venv/`) |

No violations of CONTEXT.md avoid-terms, ADR-0001/0002, or repo conventions in
the pipeline or dashboard code.

## Spec

Per-story verdicts from the spec axis (all 25 stories):

```
1✓ 2✓ 3✓ 4✓ 5✓ 6✓ 7✓ 8✓ 9✓ 10✗ 11✗ 12✓ 13✓ 14✓ 15✓ 16✓ 17✓ 18✓ 19✓ 20✓ 21✓ 22✓ 23✓ 24✓ 25✓
```

10 and 11 are the two should-fix items below; 21 (deploy) and 22 (bundle
versioned + checksummed) are satisfied at the repo level — deployment is
explicitly the team-lead's action per the spec's Out of Scope, and the bundle is
versioned, checksummed, and now changelogged + pinned in the pack.

| # | class | finding | status |
|---|---|---|---|
| P1 | should-fix | Bundle changelog missing — spec: "versioned, checksummed, with a human-readable changelog". | **fixed** — human-readable changelog added to `report-pack/pinned-bundle.md` (v1 entry; future versions append) |
| P2 | should-fix | Rollback documentation missing (user story 21: "push-button command" + judging-day safety). | **fixed** — "Rollback" section added to `dashboard/README.md`; full plan + post-deploy checklist in `research/t9-evidence.md` |
| P3 | should-fix | **Simulator shows constant-price outcomes only** (user story 10: "both nominal and constant-price outcomes"). The pipeline already emits the naive nominal twin (flagged INVALID). **Not fixed in T9** — this is a dashboard UI feature (T7 scope) and it touches the honesty rule ("never quote nominal gaps" in the pack README): if the UI shows the nominal twin, it must be explicitly labelled as the misleading-comparison exhibit. Needs a parent decision. | listed for parent |
| P4 | should-fix | **Per-market prescriptions not on the dashboard** (user story 11: "which markets to grow, which to let coast"). The grow/coast table exists in `report-pack/4-findings-material.md` and segments/presets exist on the dashboard, but no explicit per-market grow/coast labels. **Not fixed in T9** — dashboard feature (T6/T7 scope). | listed for parent |
| P5 | note | 2024 national receipts RM106,783.11M "checked only implicitly" — actually asserted explicitly (`pipeline/tests/test_inbrief_parser.py:75`, `test_market_extraction.py:56`). Reviewer oversight; no action. | no action needed |
| P6 | note | `data/processed/yield_by_market_2024.csv` side artefact beyond the JSON bundle seam. | defensible debug/inspection output; note only |
| P7 | note | CPI fetched via `tools/dosm-cli` while the spec keeps dosm-cli off the critical path. The bundle reads a committed recorded CSV, so tests stay offline. | acceptable deviation; note only |

No spec items classified blocker. No scope creep beyond the three minor notes
above (naive nominal twin emission directly supports the real-terms-only
headline).

## Summary

- Blockers: **0** on both axes.
- Should-fix: Standards 3 (all fixed), Spec 4 (2 fixed, 2 listed for parent).
- Fixed in T9: test-strength grounding (S2–S4), pinned note under pack-wide
  checks (S5), changelog (P1), rollback docs (P2), hygiene (S9). All suites
  re-run green after every fix.
- For the parent to decide (dashboard features, post-deadline-safe):
  1. Simulator nominal-vs-constant toggle/row (story 10) — needs an honesty-rule
     framing decision before implementation.
  2. Per-market grow/coast labels on the dashboard (story 11).
  3. Optional wording caution on the "revenue" avoid-term in the Vietnam bullet
     (S1) before report writers copy it.
