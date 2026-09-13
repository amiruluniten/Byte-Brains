# T3 acceptance evidence — In Brief extractor: source-market panel

Ticket: amiruluniten/Byte-Brains#4 · Spec: #1 · Blocked-by: #2 (T1) · Built TDD
(three red-green slices). No git commits made (per ticket instructions).

## Environment

- Python venv: `pipeline/.venv` (uv-managed, CPython 3.11), same as T1.
- PDF extraction path: `pdftotext -layout data/raw/inbrief2024.pdf` (poppler 26.08.0).
  The pipeline generates this extract on the fly if `inbrief2024.txt` is absent.

## 1. Committed fixture extract of the PDF text

- `pipeline/tests/fixtures/inbrief2024.fixture.txt` — the exact pdftotext -layout
  output sliced to the 5 pages the extractor needs (foreword totals, mode-of-transport
  TOTAL row, arrivals top-20 table, receipts infographic totals, receipts top-20
  table). 9,080 bytes vs 47 KB full extract.
- Generator committed: `pipeline/tests/fixtures/make_pdf_fixture.py` (page markers,
  fails loudly if the extract layout changes). Same offline-fixture philosophy as
  T1's `make_fixtures.py`: no network, no PDF parsing at test time.

## 2. Tests (offline)

```sh
cd pipeline && .venv/bin/python -m pytest tests/test_inbrief_parser.py \
    tests/test_market_fragment.py tests/test_market_extraction.py tests/test_cli.py -v
```

37 passed in my slices (plus T1's 24 and a concurrent sibling ticket's tests — full
suite green at time of writing). Coverage by slice:

- `tests/test_inbrief_parser.py` (10): raw-table parsing against the fixture — 20
  rows per table, Singapore arrivals 18,855,680 / 2023 14,828,553, Singapore
  receipts 27,941.65 / 2023 21,575.31, China 20,866.57, growth column not swallowed
  into values, Bangladesh/Myanmar present in arrivals, Canada/Netherlands present in
  receipts, national totals (37,961,485 / 28,964,308 arrivals; 106,783.11 /
  74,291.56 RM m receipts).
- `tests/test_market_fragment.py` (10): bundle contract — closed coverage vocabulary
  (`both` / `arrivals_only` / `receipts_only`), silent zeroing rejected (a market
  absent from the receipts table must be null, not 0.0), coverage must match values,
  yield must equal receipts x 1e6 / arrivals (±0.01), years exactly 2023+2024,
  unique markets, JSON round-trip, Bundle accepts both fragment kinds.
- `tests/test_market_extraction.py` (9): fragment assembly (22 markets = 18 both +
  2 arrivals-only + 2 receipts-only), source refs stated, ground truths, national
  reconciliation, In Brief arrivals vs TSA consistency is loud on mismatch.
- `tests/test_cli.py` (2, extended): one-command end-to-end now includes the
  source-market fragment and its table; corrupted input still fails loudly.

## 3. One command: extract + validate end to end (real data)

```sh
cd pipeline && .venv/bin/tsa-pipeline
```

New validation output (after T1's five national checks):

```
OK  Singapore receipts RM m (In Brief 2024): 27,941.65
OK  China receipts RM m (In Brief 2024): 20,866.57
OK  Singapore visitor arrivals (In Brief 2024): 18,855,680
OK  partial-coverage markets explicit: ['Bangladesh', 'Canada', 'Myanmar', 'Netherlands']
OK  national reconciliation: RM2,813 per visitor (2024)
OK  In Brief national arrivals == TSA visitor arrivals 2024: 37,961,485
bundle v1 (schema 1.0.0) checksum 2d773319a2b7f14916efe02155c2765f62705040125e197a13a4a04b1e50c44a -> data/processed/bundle.json
```

Source-market table (top of it):

```
Source market    | Receipts 2024 (RM m)  | Arrivals 2024  | Yield 2024 (RM/visitor) | Coverage
-----------------+-----------------------+----------------+-------------------------+----------
Singapore        | 27,941.65             | 18,855,680     | 1,481.87                | both
China            | 20,866.57             | 3,725,894      | 5,600.42                | both
Indonesia        | 15,323.27             | 4,145,127      | 3,696.69                | both
...
Canada           | 525.27                | -              | n/a                     | receipts_only
Netherlands      | 494.52                | -              | n/a                     | receipts_only
Bangladesh       | -                     | 154,596        | n/a                     | arrivals_only
Myanmar          | -                     | 147,133        | n/a                     | arrivals_only
```

Emitted bundle verified: fragments `national_series` + `source_market`; sources now
include `inbrief2024.txt` (sha256 of the extract); reload passes the content checksum
(`Bundle.model_validate_json` on the written file).

## 4. Acceptance criteria → evidence

| Criterion | Evidence |
|---|---|
| Ground truth: Singapore receipts RM27,941.65M (2024), China RM20,866.57M, Singapore arrivals 18,855,680 | `MARKET_GROUND_TRUTHS` in `pipeline/src/bytebrains_pipeline/validate.py`; all OK in the real run above; pinned in `test_market_extraction.py::TestFragment` |
| Partial markets handled explicitly, never silently zeroed | `MarketObservation` null fields + `SourceMarketRow.coverage` contract; validator rejects 0.0 placeholders and coverage/value mismatches; `test_market_fragment.py::test_silent_zeroing_is_forbidden`; reconcile check pins exactly {Bangladesh, Myanmar: arrivals_only; Canada, Netherlands: receipts_only} |
| Per-market yield emitted with national RM2,813 reconciling check | `yield_rm_per_visitor` per market-year (Singapore 1,481.87; contract enforces receipts x 1e6 / arrivals ±0.01); `check_market_ground_truths` verifies 106,783.11 RM m / 37,961,485 = RM2,813 (±1) |
| Offline tests against committed fixture extract of the PDF text | `inbrief2024.fixture.txt` + generator committed; all tests offline |

## 5. Design notes

- **Counting basis**: In Brief receipts pair with In Brief arrivals per market
  (visitor basis, same publication, same methodology) — per spec's basis discipline.
  The fragment is separate from `national_series` (TSA tourist-basis); the only
  cross-fragment touchpoint is the arrivals-total consistency check.
- **Singapore's low yield (RM1,482) vs national RM2,813** is the Volume Trap story:
  same-day visitors dominate arrivals but not receipts. Dashboard-facing, not hidden.
- **New contract types** in `pipeline/src/bytebrains_pipeline/bundle/models.py`:
  `TextSourceRef`, `MarketObservation`, `SourceMarketRow`, `SourceMarketFragment`;
  `Bundle.fragments` widened to accept both fragment kinds (checksum covers both).
- Nothing in T1's area changed: existing national-series extractor, models, and
  tests untouched (only additive edits to shared files: models union type, emit,
  cli, validate additions).
