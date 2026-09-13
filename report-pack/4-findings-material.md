# 4 · Findings material (structured against the official report template)

Everything below is ready to adapt. Numbers are from bundle v1 (schema 1.0.0,
checksum `ad9523c8`, generated 2026-09-13). Interpretation drafts are marked
**[interpretation]** — adapt freely, keep the numbers exact. Method detail lives in
`2-method-notes.md`; sources in `3-source-registry.md`; the exact bundle version
and checksum to cite is in `pinned-bundle.md`; ready-to-paste dashboard figures
are in `screenshots/`.

---

## Introduction

**Context to establish (one paragraph):** tourism is a major Malaysian sector — the
TSA 2024 release values the tourism industry at RM291.9 billion, 15.1% of the
economy, with inbound tourism expenditure of RM107.0 billion in 2024 (+41.1%). The
national recovery story is usually told with arrival counts: 37,961,485 visitors in
2024, more than the 35,045,625 of 2019 (+8.3%).

**[interpretation]** Open by distinguishing two kinds of growth. *Extensive growth*
means more visitors; *intensive growth* means more value per visitor. The report's
question is which one Malaysia's post-pandemic recovery actually delivered — and the
data says: extensive only.

**Artefact to reference:** the interactive dashboard (deployed link) renders all
findings from the same versioned data bundle the report cites.

---

## Problem Statement

**The measurement problem.** Arrival-count KPIs reward low-yield traffic — the
**Volume Trap**. Three grounded facts make the mechanism concrete:

- Same-day visitor (excursionist) share of arrivals rose from **25.5%** (2019) to
  **34.1%** (2024) — a drift of **+8.6 percentage points**. Same-day visitors cross
  the Johor land crossing (land was the arrival mode for **66.1%** of 2024
  visitors), spend little, and leave.
- The TSA 2024 release states tourists contribute **96.1%** of inbound expenditure
  against **3.9%** from the same-day segment — the fastest-growing arrival group is
  the least valuable per head.
- National targets are set in arrival counts: the 2024 target was 27.3 million
  tourist arrivals (TA Research). A target like that optimises the extensive side
  by construction.

**The value problem.** In constant 2019 prices, each visitor in every recovery year
was worth less than a 2019 visitor, and by 2024 exactly the same (stagnation line,
below). The recovery recreated 2019's *volume* but not 2019's *value per visitor*.

**[interpretation]** Frame the problem as a measurement-and-incentive problem, not a
demand problem: Malaysia is succeeding at the metric it reports and under-performing
on the metric that matters.

---

## Objectives

Ready to adapt, in the order the report delivers them:

1. Measure Malaysia's inbound tourism recovery on both sides — arrivals (extensive)
   and value per visitor (intensive) — 2015–2024, from official DOSM/Tourism
   Malaysia data.
2. Quantify the intensive gap in Ringgit: the **Missing Billions**
   counterfactual, in constant 2019 prices.
3. Diagnose where the value gap lives: segment the top source markets by tourism
   yield and name the segments.
4. Prescribe: a transparent market-mix simulator that shows what shifting the mix
   toward high-yield source markets does to receipts.

*(In the report prefer the project term — the Missing Billions — for the
counterfactual itself.)*

---

## Literature Review

Ready-to-adapt threads, each backed by a registry source (numbers in §3.3):

1. **Expert critique of arrival-first recovery.** Malaysian experts warn the
   recovery is measured by volume when performance is per-capita expenditure and
   length of stay (The Sun Daily, Prof. Mohd Hafiz Hanafiah, UiTM). This is the
   project's thesis stated independently before our analysis — cite it early.
2. **Official statistics acknowledge the composition.** The TSA 2024 release itself
   splits tourists (96.1% of inbound expenditure) from the same-day segment (3.9%),
   and reports a Tourism GVA of RM291.9 billion (15.1% of the economy) — the
   statistical system already measures value; policy KPIs do not use it.
3. **Independent estimates agree value lagged.** WTTC's 2024 research projected
   international visitor spending of RM93.7 billion — still 6.2% below 2019 — even
   as arrivals set records. External corroboration of the intensive gap.
4. **Market commentary moves our way.** BIMB Securities (The Edge Malaysia) argues
   for focusing on where spending flows rather than arrival counts, and reads a
   declining Singapore-arrival share as healthy diversification — consistent with
   our market-mix prescription.
5. **The KPI framing is documented.** TA Research records the 2024 targets in
   arrival counts and receipts totals — evidence that the reported metric family is
   extensive.
6. **Method anchors.** The Tourism Satellite Account concept (DOSM) for supply-side
   measurement; IRTS 2008 visitor definitions (tourist vs same-day visitor) as used
   in the project glossary; WEF TTDI as the standard source-market development
   lens.

**[interpretation]** Close the review with the gap: nobody has quantified the
intensive gap in Ringgit for Malaysia, and nobody has turned source-market yield
into a named, actionable market mix. That is this project's contribution.

---

## Methodology

**One honest paragraph, no code:**

> Official publications (DOSM Tourism Satellite Account workbooks; Tourism Malaysia
> *Statistics in Brief 2024*; the DOSM CPI; the WEF TTDI 2024 edition) were parsed
> into a versioned, checksum-validated data bundle. Tourism yield per source market
> was computed from a single publication's receipts and arrivals (visitor basis).
> The counterfactual — receipts had every visitor been worth a 2019 visitor, in
> constant 2019 prices — was computed with the national CPI as deflator. Top source
> markets were clustered (k-means, k=4, eight standardised traits) into named
> segments, and a transparent mix-shift simulator was built from the same per-market
> yields. Every figure is validated against pinned official ground-truth values.

Full detail (each transformation, each caveat): `1-data-cleaning-log.md` and
`2-method-notes.md`. State the counting bases explicitly (tourist vs visitor vs
same-day visitor; TSA consumption vs Tourism Malaysia survey receipts) — this is
what the Critical Thinking & Defence score rewards.

---

## Findings

### F1. The Missing Billions — the headline

> **RM10.2 billion** (RM10,204.5 million, constant 2019 prices): the cumulative
> 2020–2024 gap between what inbound tourism actually earned and what it would have
> earned if each visitor had been worth a 2019 visitor.

- Year by year (RM million, 2019 prices): 2020 +1,786.6; 2021 +604.5; 2022 +4,293.3;
  2023 +3,659.1; 2024 -139.1 (≈ zero).
- **The stagnation line:** 2024 real per-visitor expenditure RM2,477.77 vs 2019's
  RM2,474.10 — +0.15%. Each 2024 visitor was worth exactly what a 2019 visitor was
  worth.
- Never quote nominal gaps: on nominal prices the same arithmetic "shows" a false
  +RM8,894.66 million surplus in 2024, because inflation (+9.3%) and volume (+8.3%)
  mask the flat real yield.

**[interpretation]** "The recovery made the counter bigger, not the visitor more
valuable. Five years of recovery, zero value growth per visitor — that is the RM10.2
billion story."

### F2. The Volume Trap — where the growth went

- Same-day visitor (excursionist) share: 25.5% (2019) → 34.1% (2024), +8.6 pp;
  land was the arrival mode for 66.1% of 2024 visitors.
- Singapore, the largest source market (18,855,680 arrivals, 49.7% of all 2024
  arrivals), yields RM1,481.87 per visitor against the RM2,813 national average.
  It contributes RM27,941.65 million — 26.2% of receipts — on half the visitors.

**[interpretation]** The arrival KPI is saturated with short-stay regional traffic:
counting heads counts the least valuable visitors most. The mechanism is visible in
one chart: arrivals up, receipts per visitor flat.

### F3. Named market segments (the ML result)

k-means clustering of the top source markets on eight traits (yield, volume,
growth, plus five WEF TTDI traits), k=4, deterministic:

| segment | markets | mean yield | what to do with it (draft prescription) |
|---|---|---|---|
| **High-Yield Long-Haul** (9) | South Korea, Australia, United Kingdom, Chinese Taipei, Japan, United States, France, Germany, Russia | RM5,371 | grow: each additional visitor is worth ~3.2× a Volume Trap visitor |
| **High-Growth Emerging** (3) | China, Indonesia, India | RM4,591 | grow fast: +75.6% mean arrivals growth at a solid mid yield; China already sits in the top yield quartile (RM5,600.42) |
| **Low-Yield Steady** (4) | Thailand, Philippines, Vietnam, Pakistan | RM3,406 | hold / develop: below-median yield, flat growth |
| **Volume Traps** (2) | Singapore, Brunei | RM1,675 | let coast: the arrivals KPI over-rewards exactly this traffic |

Yield quartile boundaries (2024): RM3,597.70 / RM5,085.92 / RM5,393.03.

**[interpretation]** The market mix, not the arrival total, is the lever: shifting
arrival share from the Volume Traps segment toward High-Yield Long-Haul raises
receipts with zero additional visitors. The simulator (below) makes that arithmetic
visible.

### F4. Regional context (supporting, with caveats — never the headline)

- 2024 receipts per visitor: Malaysia ≈ US$600; Thailand ≈ US$1,363 (2.3×);
  Indonesia ≈ US$1,202 (2.0×) — Malaysia earns roughly half its neighbours per
  visitor (full sourcing and basis caveats in `research/regional-yield-benchmark-2024.md`;
  the same comparison, with its basis caveats attached, ships inside the data bundle
  as the regional benchmark fragment).
- Against its own 2019 level, Malaysia's per-visitor receipts fell ~29% (a
  cross-basis comparison: 2019 World Bank balance-of-payments vs 2024 survey) —
  directionally consistent with the constant-price stagnation in F1, but a different
  measure; cite F1 for the headline, F4 only as regional shape.
- Vietnam has no defensible per-visitor receipts figure (published revenue includes
  domestic tourism) — exclude it from yield comparisons and say so.

---

## Output

What the project delivers, for the report's Output section:

1. **The data bundle** — versioned, checksum-validated (bundle v1, schema 1.0.0,
   checksum `ad9523c8`), one file that both the dashboard and this report cite.
2. **The dashboard** (Next.js, static, no backend — survives judging-day traffic;
   see ADR-0001/0002): headline landing page (arrivals and receipts side by side,
   basis-labelled); diagnosis view (extensive-vs-intensive decomposition, segment
   map with yield shading, regional context with caveats, method page); and the
   **market-mix simulator** — sliders over source-market shares that recompute
   receipts and the Missing Billions live, with 2019-mix, 2024-mix, and policy
   presets (finishing under ticket #8 — verify presets against the live link
   before submission).
3. **Reproducibility:** one command rebuilds every number from the raw official
   files; raw inputs are fingerprinted inside the bundle.
4. **Screenshots:** capture high-resolution dashboard screenshots for the report so
   the submission matches the live link (see ticket #10).

---

## Conclusion

**[interpretation, ready to adapt]**

> Malaysia's inbound tourism recovery has been extensive, not intensive. Between
> 2020 and 2024 the sector fell RM10.2 billion short (constant 2019 prices) of the
> receipts that 2019's value per visitor would have produced, and by 2024 each
> visitor was worth exactly what a 2019 visitor was worth. The growth came from
> more visitors — increasingly the lowest-yield kind, as the same-day share rose
> from 25.5% to 34.1% and land crossings carried two-thirds of arrivals. Arrival
> targets reward precisely this traffic. The fix is a market-mix objective: grow the
> High-Yield Long-Haul and High-Growth Emerging segments (each visitor worth up to
> 3.2× a same-day regional visitor), let the Volume Trap markets coast, and measure
> success in yield per visitor alongside arrivals. Every figure above is
> reproducible from official DOSM and Tourism Malaysia publications through one
> versioned data bundle, and every prescription can be explored live on the
> accompanying dashboard.

---

## Dashboard figures (screenshots)

Every dashboard page is captured at high resolution (2880 px wide, 2× scale,
full page) from the same static export the deployed site serves. Use these as
the report's figures so the report matches the live dashboard exactly:

| screenshot | dashboard page | use for |
|---|---|---|
| `landing.png` | `/` — Missing Billions headline + national charts | Findings opener, Output |
| `diagnosis-decomposition.png` | `/diagnosis/decomposition` — extensive vs intensive, real vs nominal | Findings: measurement problem |
| `diagnosis-source-markets.png` | `/diagnosis/source-markets` — yield map + segment table | Findings: segmentation |
| `diagnosis-regional.png` | `/diagnosis/regional` — THA/IDN/MYS benchmark with basis caveats | Findings: regional context |
| `simulator.png` | `/simulator` — market-mix simulator (2024 actual mix) | Output: prescription |
| `method.png` | `/method` — method & sources, bundle version + checksum | Methodology |

If the pipeline is re-run before submission, re-capture after redeploying so
figures stay consistent with the live site (the bundle version is visible on
the `/method` screenshot — check it matches `pinned-bundle.md`).
