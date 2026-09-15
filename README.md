# The Missing Billions — Making Every Visit Count

Byte-Brains' entry for **DOSM Datathon 2026**. Malaysia's tourism recovery measures
visitors, not value: by 2024 each visitor to Malaysia was worth exactly what a 2019
visitor was worth, in real terms. We call the cost of that extensive growth the
**Missing Billions**.

## Problem

Arrival-count KPIs reward low-yield same-day traffic (the **Volume Trap**): the
same-day segment made up 25.5% of arrivals in 2019 and 34.1% by 2024, and land-mode
arrivals reached 66.1% in 2024 — while tourists (overnight visitors) contribute 96.1%
of inbound expenditure. Policy optimises for heads instead of value.

## Data (official sources only)

All raw copies are committed under `data/raw/` and `source/`, with publisher, URL,
access date, and use documented in
[`report-pack/3-source-registry.md`](report-pack/3-source-registry.md).

| source | used for |
|---|---|
| DOSM Tourism Satellite Account 2010–2024 (OpenDOSM) | arrivals, tourist/excursionist split, inbound consumption (Jad 1A) |
| Tourism Malaysia, Statistics in Brief 2024 | receipts + arrivals by source market (top-20, 2023–2024) |
| DOSM CPI headline (OpenDOSM) | deflating receipts to constant 2019 prices |
| WEF Travel & Tourism Development Index 2024 (via World Bank Data360) | source-market traits for segmentation |

## Method

One command — `pipeline/.venv/bin/tsa-pipeline` — rebuilds the checksummed,
schema-validated data bundle (`data/processed/bundle.json`, schema 1.0.0). Every
number the report and dashboard show is recomputed from that bundle by tests
(`report-pack/tests`, `pipeline/tests`). Segmentation of the top-20 source markets is
unsupervised (yield clusters + quartile tiers), grounded in five WEF TTDI indicators.

## Key findings

- **RM10.2 billion** cumulative gap (2020–2024, **constant 2019 prices**) between
  actual receipts and receipts at 2019's real per-visitor yield.
- **Stagnation line**: 2024 real per-visitor yield = 2019. Growth was extensive, not intensive.
- Regional benchmark (Thailand's receipts-per-visitor) frames the yield gap —
  supporting context, never the headline.

## Output

- **Dashboard** — fully interactive, reads the bundle. _Link: TODO before submission._
- **Report** — `submission/report/`, built from `report-pack/` on the official DOSM template.
- Screenshots: `report-pack/screenshots/`.

## Impact

The yield lens is directly usable by Tourism Malaysia and state tourism boards:
shift the market mix (which markets to invest in) rather than chase arrival counts.
The segmentation and simulator generalise to any source-market panel.

## Repository map

| path | what it is |
|---|---|
| `pipeline/` | data pipeline → checksummed bundle (methodology evidence) |
| `data/` | raw + processed data |
| `source/` | provenance copies of every official source |
| `report-pack/` | material the report writers consume; tests recompute every figure |
| `research/` | methodology reference docs cited by the pipeline |
| `tools/dosm-cli/` | CLI for the DOSM open-data API (data acquisition) |
| `submission/` | final deliverables |
| `tmp/` | internal working docs — deleted before submission |

**Honesty rule**: nominal (non-inflation-adjusted) gaps are never quoted anywhere;
the Missing Billions counterfactual exists only in constant 2019 prices.
