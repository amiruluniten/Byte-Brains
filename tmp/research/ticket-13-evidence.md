# Ticket #13 acceptance evidence — TSA 2025 workbook -> schema 1.1.0 bundle

Verified 2026-09-16 against `data/raw/tourism_2025.xlsx` (TSA 2025, "2025p"
preliminary release) and `data/raw/cpi_headline.csv` (overall division,
2025 annual mean 134.625, 12 months).

## Extractor vs the real 2025 workbook (pipeline run output)

```
OK  2024 inbound consumption REVISED (TSA 2025 workbook): 102,931.3
OK  2025 inbound consumption (Jad 1A total, 2025p): 119,312.0
OK  2025 visitor arrivals (preliminary): 42,196,892.0
OK  2025 tourist arrivals (preliminary): 26,613,597.0
OK  2025 same-day visitor arrivals (preliminary): 15,583,295.0
OK  2025-edition consistency: overlapping years match the TSA 2024 edition; the
    documented 2024 consumption revision is the only difference
    (102,815.3 -> 102,931.3 RM m)
```

Workbook layout notes (see `research/tsa-xlsx-map.md`, section "TSA 2025
edition"): anchors unchanged (Indicator Inbound A1/A2/A3 at rows 7/26/27, Jad 1A
`Jumlah` at row 14, year header row 3), blank spacer rows between sections, and
the Jad tables' own `2025p` year-header marker. The `Indicator Inbound` 2025
header prints plain `2025` (no suffix) — the release-level preliminary marker is
applied from the Jad tables and recorded as `revision_status: "preliminary"`.

## Counterfactual fragment (bundle values, 2025 row)

| quantity | value |
|---|---|
| 2025 visitor arrivals | 42,196,892 (preliminary) |
| 2025 receipts (Jad 1A) | RM119,312.0m (preliminary) |
| 2025 CPI (overall annual mean, 2010=100) | 134.625 |
| 2025 CPI ratio to 2019 (121.483333) | 1.108177 |
| 2025 per-visitor nominal | RM2,827.51 |
| 2025 per-visitor real (2019 prices) | RM2,551.49 (+3.1% vs the RM2,474.10 anchor) |
| 2025 counterfactual (2019 prices) | RM104,399.5m |
| 2025 actual (2019 prices) | RM107,665.1m |
| 2025 real gap (counterfactual − actual) | **−RM3,265.7m** (negative = surplus) |
| 2025 naive nominal gap | −RM14,912.5m (emitted, flagged INVALID) |
| 2024 row (revised receipts RM102,931.3m) | real gap −RM245.2m, naive −RM9,010.7m |

## Guarded headline

- Headline (pre-registered WINDOW): **2020–2024, constant 2019 prices** — the
  window was pre-registered before the TSA 2025 release was examined and
  `HeadlineGap` rejects any other headline window at emission AND reload.
- Headline VALUE (revision policy, later official workbook wins): recomputed
  from the TSA 2025 revised receipts, **RM10,098.4m** — exactly the sum of the
  fragment's own 2020–2024 rows (reconciliation checked at emission, so the
  headline can never drift from its table).
- Supplementary (clearly labelled, never the headline): 2020–2025 cumulative =
  RM6,832.7m (headline + the 2025 preliminary gap).
- Honesty rules (ADR-0002) hold: the nominal twin is emitted per year and
  flagged invalid; only constant-2019-prices gaps are quotable.

## Determinism + tests

- Real pipeline run twice: fragments and checksum identical (only
  `generated_utc` differs). Bundle checksum (amended: recomputed headline):
  `338e1b3464f87b37507d8142263d3432395de2b943facb51928d24316bcfb20a`
  (schema 1.1.0, `tourism_2025.xlsx` sha256 recorded in `sources`).
- Full pipeline suite: 168 passed, 2 errors — the two pre-existing
  dashboard-blocked failures (`tests/test_simulator_fragment.py`
  `TestRoundTripFixture`, waiting on the dashboard restoration ticket), same
  modes as before this ticket.
- Offline fixture path proven too: `tests/fixtures/tourism_2025.fixture.xlsx`
  (miniature 2025 layout incl. blank spacer rows) + 2025 rows appended to the
  CPI fixture; e2e class `TestTsa2025EndToEnd` covers the whole acceptance list
  without network.
