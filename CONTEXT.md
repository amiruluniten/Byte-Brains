# Byte-Brains — DOSM Datathon 2026 Entry

Malaysia's tourism recovery measures visitors, not value. This repo holds the team's
DOSM Datathon 2026 entry: a data + ML project on tourism yield and the project
report. The video deliverable is out of scope here.

## Language

### Problem framing

**Extensive growth**:
Tourism growth that comes from more visitors, not more value per visitor.
_Avoid_: volume growth, numbers game

**Intensive growth**:
Tourism growth that comes from more value per visitor — higher spending or longer stays.
_Avoid_: quality growth

**Tourism yield**:
The economic value generated per visitor (per-capita expenditure × length of stay).
The article's experts argue yield, not arrivals, reflects the sector's true performance.
_Avoid_: tourism value, receipts per head (ambiguous)

**Tourism receipts**:
Total tourism spending in the economy over a period; the headline monetary measure.
_Avoid_: tourism income, revenue (too broad)

### Visitors (IRTS 2008 / DOSM definitions)

**Visitor**:
Anyone travelling outside their usual environment for under 12 months, for any non-labour-migration purpose. Split into overnight and same-day.
_Avoid_: traveller, tourist (ambiguous)

**Tourist (overnight visitor)**:
A visitor who stays at least one night in the place visited.
_Avoid_: overnight visitor (prefer "tourist" in this project)

**Same-day visitor (excursionist)**:
A visitor who makes a trip of under 24 hours, e.g. a Singaporean day-tripper via the Johor land crossing. Counted in arrivals but generates low yield.
_Avoid_: day tripper, excursionist (prefer "same-day visitor")

**Domestic visitor**:
A Malaysian resident travelling within Malaysia (outside their usual environment, ≥50 km or with tourism-facility use).
_Avoid_: local tourist

### Project framing

**Missing Billions**:
Our headline counterfactual — the RM10.2 billion cumulative gap (2020–2024, constant 2019
prices) between actual receipts and receipts at 2019's real per-visitor yield. Paired with the
stagnation line: by 2024 each visitor was worth exactly what a 2019 visitor was worth. The
regional (Thailand) yield gap is supporting context, never the headline. _Avoid_: revenue gap, shortfall

**Volume Trap**:
The measurement critique: arrival-count KPIs reward low-yield same-day traffic, so policy
optimises for heads instead of value. _Avoid_: numbers game

### Data & scope

**Tourism Satellite Account (TSA)**:
DOSM's annual flagship publication (2010–2024) with inbound indicators, arrivals by country, tourist/excursionist split, and receipts tables. Our primary data source. _Avoid_: TSA report, tourism xlsx

**Source market**:
A country of origin whose visitors we count and value. The unit of our yield segmentation. _Avoid_: country, nationality (fine in tables, not in prose)

**Market mix**:
The share distribution of visitors (or effort) across source markets. Our prescription variable — the model says which mix raises yield. _Avoid_: portfolio, strategy

**Tourism GVA**:
Gross value added attributable to tourism in the economy, from the TSA. The "GDP-side" number behind the yield story. _Avoid_: tourism GDP (loose), TSA contribution
