# Pinned data bundle (T9)

The report must cite exactly the data the dashboard displays. This note pins the
bundle the pack and the dashboard were built against.

| field | value |
|---|---|
| bundle version | **bundle v1** |
| schema version | 1.1.0 |
| generated | 2026-09-16T05:43:14Z |
| sha256 checksum | `338e1b3464f87b37507d8142263d3432395de2b943facb51928d24316bcfb20a` |

The dashboard's Method & sources page shows the same version + checksum in its
footer card. The pack's README and findings material cite `338e1b34` (the first
8 characters); this note carries the full digest for verification.

## How to re-verify

```sh
cd pipeline && .venv/bin/python -m pytest ../report-pack/tests -q
```

The test `test_pinned_bundle_note_exists_and_pins_full_checksum` compares this
note against `data/processed/bundle.json` and `dashboard/data/bundle.json`. If
the pipeline re-runs (e.g. 2025 receipts are published), the checksum changes
and this test goes red: re-run the pipeline, re-cite whatever version + checksum
the refreshed dashboard footer shows, and update this note plus every pack
citation in one pass.

## Raw sources hashed into this bundle

- `tourism_2023.xlsx` — DOSM Tourism Satellite Account 2023
- `tourism_2024.xlsx` — DOSM Tourism Satellite Account 2024
- `tourism_2025.xlsx` — DOSM Tourism Satellite Account 2025 (2025 preliminary, "2025p"; restates 2024 inbound consumption)
- `inbrief2024.txt` — Tourism Malaysia *Statistics in Brief 2024* (text extraction)
- `cpi_headline.csv` — DOSM national CPI (2010 = 100), via openDOSM
- `WEF_TTDI.csv` — World Economic Forum Travel & Tourism Development Index indicators

## Changelog (human-readable, per the bundle contract)

| bundle version | date | changes |
|---|---|---|
| v1 | 2026-09-13 | First released bundle: national series (tourist, visitor and same-day visitor arrivals 2015–2024, inbound consumption 2015–2024), per-market receipts + yields (In Brief 2024 top-20), macro CPI deflator, Missing Billions counterfactual + naive nominal twin (flagged INVALID), 4-segment source-market clustering + yield tiers, simulator coefficient export, THA/IDN/MYS regional benchmark. |
| v1 | 2026-09-16 | Schema 1.0.0 → 1.1.0 (additive), TSA 2025 edition adopted: 2025 enters as a preliminary year ("2025p") — visitor arrivals 42,196,892, inbound tourism consumption RM119,312.0 million; 2024 inbound consumption restated (RM102,815.3 → RM102,931.3 million) and the Missing Billions headline recomputed from the revised receipts (RM10,098.4m ≈ RM10.1 billion, window 2020–2024 unchanged; supplementary 2020–2025 cumulative RM6,832.7m, labelled, never the headline); 2025 CPI deflator added (134.625, ratio 1.108177); national arrival and consumption series extended to 2025 (preliminary); 2025 naive nominal twin emitted, flagged INVALID. |
