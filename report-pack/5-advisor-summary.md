# 5 · Advisor summary (one page)

**Project:** The Missing Billions — Making Every Visit Count
**Team:** Byte-Brains · **Entry:** DOSM Datathon 2026 · **Data:** bundle v1 (schema 1.1.0, checksum `338e1b34`, generated 2026-09-16)

**The question.** Malaysia's inbound tourism recovered record arrival counts after
the pandemic. Did it recover *value*? We measure the recovery on both sides — more
visitors (extensive growth) versus more value per visitor (intensive growth) — using
only official statistics: the DOSM Tourism Satellite Account (2015–2024), Tourism
Malaysia's *Statistics in Brief 2024*, the DOSM CPI, and the WEF Travel & Tourism
Development Index.

**What we found.**

- **The Missing Billions: RM10.1 billion** (constant 2019 prices; RM10,098.4
  million, recomputed from the TSA 2025 revised receipts). Cumulative 2020–2024 gap
  between actual inbound receipts and what Malaysia would have earned if each visitor
  had been worth a 2019 visitor. In 2020–2023 the real per-visitor gap was positive
  every year; by 2024 real per-visitor expenditure was RM2,480.56 against the 2019
  anchor of RM2,474.10 — a difference of +0.26%. Each 2024 visitor was worth what a
  2019 visitor was worth. **Five years of recovery, zero value growth per visitor.**
  The nominal receipts jump (+18.7% on the TSA basis) is fully explained by more
  visitors (+8.3%) and inflation (+9.3%).
- **The line breaks in 2025 (preliminary).** The TSA 2025 edition marks 2025
  "2025p": real per-visitor tourism yield reached RM2,551.49 — clearly above the
  2019 anchor for the first time, five years on. Every 2025 figure is preliminary;
  the 2020–2025 cumulative gap (RM6,832.7 million) is a supplementary figure only,
  never the headline.
- **The Volume Trap.** Same-day visitors — who cross the land border, spend little,
  and leave — grew from 25.5% to 34.1% of all arrivals (2019→2024); land was the
  arrival mode for 66.1% of 2024 visitors. Singapore alone is 49.7% of arrivals at
  RM1,481.87 of receipts per visitor, versus a RM2,813 national average. Arrival
  targets reward exactly this traffic.
- **Where the value lives (machine-learned segments).** Clustering the top source
  markets on eight traits (yield, volume, growth, five WEF development traits)
  gives four named segments: **High-Yield Long-Haul** (9 markets, mean yield
  RM5,371), **High-Growth Emerging** (China, Indonesia, India; +75.6% arrivals
  growth at mean yield RM4,591), **Low-Yield Steady** (4 markets, RM3,406), and
  **Volume Traps** (Singapore, Brunei; RM1,675). A High-Yield Long-Haul visitor is
  worth ~3.2× a Volume Trap visitor.
- **The prescription.** Shift the market mix, not the arrival total: grow the
  high-yield and emerging segments, let the Volume Trap markets coast. A live
  simulator on our dashboard lets anyone move market shares and watch receipts and
  the Missing Billions respond, in both nominal and constant-2019-prices terms.

**Regional shape (context, with caveats).** Thailand and Indonesia each earn roughly
2.0–2.3× Malaysia's receipts per visitor in 2024 — Malaysia's yield problem is real
and regional, not a statistical artefact.

**How it is built (one line).** Official publications are parsed into a versioned,
checksum-validated data bundle; every number is validated against pinned official
ground truths; the dashboard reads only that bundle; one command reproduces
everything.

**Deliverables.** Interactive dashboard (public link, no backend, survives judging
day), the reproducible data pipeline behind it, and the report you are advising on —
all grounded in the same cited bundle version.

**Where to poke at it.** The 2024 real gap is ≈ zero (-RM245.19 million, revised
receipts), which we report as the *stagnation line* rather than a rounding footnote:
the honest finding is that the recovery closed the volume gap and stopped there. The counterfactual
uses the TSA receipts basis (tourist basis) with visitor arrivals, as the official
2019 anchor does; a Tourism Malaysia receipts variant reaches the same conclusion.
Regional comparisons mix survey and balance-of-payments bases — we carry that
caveat on every slide it appears in.
