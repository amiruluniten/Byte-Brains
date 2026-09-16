# 2 · Method notes (plain language, no code)

These are the four calculations behind the report. Every number quoted here is
bundle v1 (schema 1.0.0, checksum `ad9523c8`), generated 2026-09-13.

---

## 2.1 Tourism yield (per-visitor value)

**The idea.** Tourism yield is the economic value each visitor brings: what they spend
(per-capita expenditure) over how long they stay. We measure it directly and
defensibly as:

> **yield of a source market = visitor receipts from that market ÷ visitor arrivals
> from that market** (same publication, same year, visitor basis).

For 2024 both sides come from Tourism Malaysia's *Statistics in Brief 2024*
(receipts table p. 14, arrivals table p. 11), so numerator and denominator share one
methodology. Worked example: Singapore brought RM27,941.65 million on 18,855,680
arrivals → **RM1,481.87 per visitor**. The national 2024 figure reconciles to
**RM2,813 per visitor** (RM106,783.11 million ÷ 37,961,485).

**How to read it.** Yield is a *quality of demand* measure. Singapore's low yield is
not a failure of Singaporean visitors — it reflects the mix of same-day visitor (excursionist) traffic that crosses the Johor land crossing, buys lunch, and goes home. That is why the national average (RM2,813) sits far above Singapore's figure
while Singapore is still the largest single receipts pool (RM27,941.65 million,
26.2% of all receipts).

**What could mislead.** Yield computed on a tourist-only receipts basis against
all-visitor arrivals would understate it; the project never mixes bases. Cross-country
yields (section 2.6 of the findings material) mix survey and balance-of-payments
bases — always carry the caveat.

---

## 2.2 The Missing Billions counterfactual (constant 2019 prices)

**The question.** What would 2020–2024 receipts have been if each visitor had been
worth what a 2019 visitor was worth, in real terms?

**The arithmetic, in words:**

1. Per-visitor nominal expenditure each year = receipts ÷ visitor arrivals.
   2019: RM86,706.5 million ÷ 35,045,625 = **RM2,474.10** per visitor.
2. Deflate to 2019 purchasing power: divide by the CPI ratio CPI(t) ÷ CPI(2019).
   Prices rose 9.3% from 2019 to 2024 (CPI 121.483333 → 132.791667, ratio 1.093085),
   so nominal 2024 per-visitor spending of RM2,708.41 is only **RM2,477.77** in 2019
   money.
3. Counterfactual receipts = actual arrivals × the 2019 real per-visitor yield.
4. Real gap = counterfactual - actual, everything in 2019 prices.

**Result (RM million, 2019 prices):**

| year | receipts (nominal) | arrivals | per-visitor real (2019 RM) | actual (2019 prices) | counterfactual | **real gap** |
|---|---|---|---|---|---|---|
| 2019 | 86,706.5 | 35,045,625 | 2,474.10 | 86,706.5 | 86,706.5 | 0 |
| 2020 | 13,157.3 | 6,101,378 | 2,181.29 | 13,308.8 | 15,095.4 | **+1,786.6** |
| 2021 | 389.8 | 399,865 | 962.22 | 384.8 | 989.3 | **+604.5** |
| 2022 | 32,473.3 | 14,267,416 | 2,173.19 | 31,005.7 | 35,299.1 | **+4,293.3** |
| 2023 | 72,992.8 | 28,964,308 | 2,347.77 | 68,001.6 | 71,660.7 | **+3,659.1** |
| 2024 | 102,815.3 | 37,961,485 | 2,477.77 | 94,059.7 | 93,920.6 | **-139.1** |

**The headline:** the cumulative real gap 2020–2024 is **RM10,204.5 million ≈
RM10.2 billion** — the Missing Billions.

**The stagnation line:** by 2024, real per-visitor expenditure was RM2,477.77 against
the 2019 anchor RM2,474.10 — a difference of +0.15%, i.e. the 2024 real gap is
-RM139.07 million, essentially zero at this data's precision. Each 2024 visitor was
worth exactly what a 2019 visitor was worth. The recovery added **visitors** (+8.3%)
and **prices** (+9.3%) — which together explain the nominal receipts jump to
RM102,815.3 million (+18.6% on the TSA basis) — but added **no value per visitor**.

**Why only constant-2019-prices is valid.** Nominal per-visitor expenditure *rose*
(RM2,474.10 → RM2,708.41), so a naive nominal counterfactual shows a false surplus of
RM8,894.66 million in 2024 — the bundle emits that invalid nominal gap as
**-RM8,894.66 million**, flagged invalid, precisely so nobody quotes it. Any nominal
gap in the report is a mistake.

**Receipts basis used.** The headline pairs the TSA inbound tourism consumption
(Jad 1A, RM102,815.3 million in 2024) with visitor-basis arrivals — the same pairing
the official 2019 anchor uses. As a robustness check, re-running the same arithmetic
on Tourism Malaysia's In Brief receipts basis (RM106,783.11 million) gives the same
conclusion: a real 2024 gap of about -RM3.7 billion — small against RM100+ billion
of receipts, still ≈ zero per visitor, and still no missing billions in nominal terms.
The story is not sensitive to the receipts basis; it is sensitive to *inflation
adjustment*, which is the point.

---

## 2.3 Market segmentation (k-means, named segments)

**The question.** Which source markets carry value, which carry volume, and which
carry growth — so the market mix can be prescribed rather than assumed?

**Features (per source market, anchored on 2024).** Eight traits: the 2024 tourism
yield itself; visitor volume on a log scale (so China and Singapore do not dominate
the distance calculations purely by size); arrivals growth 2024 vs 2023; and five
WEF Travel & Tourism Development Index traits of the source market — visitor
purchasing power, average length of stay, overall development score, air
connectivity (log-scaled), and passport mobility. Receipts are deliberately **not**
a feature: receipts equal yield × arrivals, so including them would double-count the
same information.

**The method, in words.** Every feature is standardised (so all traits are
comparable); markets are grouped into **four clusters** by k-means; the algorithm is
run twelve times with fixed seeds 42–53 and the best result is kept — re-running the
pipeline gives byte-identical groups. Clusters are renamed by descending mean yield,
and each cluster gets a **rule-based name** from fixed profiles, with the profile
numbers attached:

| segment | source markets (2024) | mean yield | profile |
|---|---|---|---|
| **High-Yield Long-Haul** | South Korea, Australia, United Kingdom, Chinese Taipei, Japan, United States, France, Germany, Russia | RM5,371 | the highest mean yield with lower volume: high-wallet, high-development markets, mostly long-haul |
| **High-Growth Emerging** | China, Indonesia, India | RM4,591 | the strongest arrivals growth (+75.6% mean) at a solid mid yield — scaling in volume and value |
| **Low-Yield Steady** | Thailand, Philippines, Vietnam, Pakistan | RM3,406 | below-median yield, flat growth (+4.0% mean): no standout trait yet |
| **Volume Traps** | Singapore, Brunei | RM1,675 | the lowest mean yield **and** the highest volume: short-stay regional traffic the arrivals KPI over-rewards |

Four markets are excluded with stated reasons (no 2024 yield: Bangladesh, Myanmar —
arrivals-only; Canada, Netherlands — receipts-only).

**Yield tiers (for the map and tables).** Every market with a 2024 yield also gets a
quartile tier on the same yield figures: the quartile boundaries are RM3,597.70
(25th), RM5,085.92 (50th), RM5,393.03 (75th). China (RM5,600.42) reaches the top
tier despite being an emerging market; Singapore (RM1,481.87) sits in the bottom
tier with the largest arrival count in the country — the clearest single picture of
the Volume Trap.

**How to defend it.** The segment names come from the data (rules on mean yield,
volume, growth), not from judgment; the rationale and profile numbers for each name
are stored in the bundle and shown on the dashboard's segment view.

---

## 2.4 The market-mix simulator (the prescription)

**The idea.** The segmentation diagnoses; the simulator prescribes. It lets a reader
move the **market mix** — the share of arrivals from each source market — and see
instantly what that mix does to receipts and to the Missing Billions.

**The arithmetic, in words (all pre-computed values shipped in the bundle):**

1. Each market carries its 2024 nominal yield deflated to 2019 prices by the same
   1.093085 CPI ratio (e.g. Singapore RM1,481.87 → RM1,355.68 real).
2. The reader sets a share of total 2024 arrivals (37,961,485) for each market.
3. Real receipts = Σ (market share × total arrivals × market real yield), across all
   markets including a residual "Other markets" entry (real yield RM2,704.23) that
   covers arrivals beyond the listed markets.
4. Nominal receipts = real receipts × the CPI ratio; real per-visitor yield and the
   Missing Billions against the 2019 anchor (RM2,474.10) update from the same totals.
5. Presets: the 2019 mix, the 2024 actual mix, and at least one policy scenario that
   shifts share from the Volume Traps segment toward high-yield markets. At the 2024
   actual mix the simulator reconciles with the headline counterfactual.

The browser does only this transparent arithmetic — it never runs the machine
learning; the segmentation is done once in the pipeline and shipped as named
segments. *(The simulator dashboard page is being finished under ticket #8; verify
the presets against the live dashboard before submission. The bundle fragment the
simulator reads is already in the bundle cited above.)*

---

## 2.5 Data integration — which datasets produced which insight

**Dataset types combined (structured, semi-structured, and series data):**

| type | datasets |
|---|---|
| structured (official spreadsheets & API series) | DOSM Tourism Satellite Account workbooks (xlsx), DOSM CPI csv, WEF TTDI panel via World Bank Data360, World Bank WDI arrivals & receipts |
| semi-structured / unstructured (published documents) | Tourism Malaysia *Statistics in Brief 2024* (PDF, parsed via text extraction), DOSM Domestic Tourism bulletins (OCR'd) |
| derived (computed from the above) | per-market tourism yield, the constant-2019-prices counterfactual, quartile tiers |

**Which integration produced which insight:**

| datasets combined | insight produced |
|---|---|
| TSA inbound consumption × CPI series × visitor arrivals | the **Missing Billions** counterfactual and the stagnation line (§2.2) |
| Tourism Malaysia receipts & arrivals by source market × WEF TTDI source-market traits | the **market segmentation** — which source markets carry value, which carry volume (§2.3) |
| TSA yield × regional (Thailand, Indonesia) official statements | the **regional yield benchmark** — supporting context for the yield gap (never the headline) |

## 2.6 One-line method summary (for the report's Methodology section)

> Official DOSM and Tourism Malaysia publications were parsed into a versioned,
> checksum-validated data bundle; tourism yield was computed per source market from
> a single publication's receipts and arrivals; a constant-2019-prices counterfactual
> (national CPI deflator) measured the value not created per visitor; k-means
> clustering on eight standardised market traits named four actionable segments; and
> a transparent mix-shift simulator turns the segments into prescriptions.

---

## 2.7 Scope & limits

- **Population**: inbound international visitors to Malaysia only. Domestic visitors
  are out of scope — the TSA inbound tables and the source-market receipts tables do
  not cover them.
- **Window**: 2019–2024. 2019 is the anchor year: the official pre-crisis baseline.
  It is a measuring stick for the stagnation line, not a target to revert to.
- **Source markets**: the top-20 markets in Tourism Malaysia's *Statistics in Brief
  2024*. Four of the twenty are excluded from the segmentation with stated reasons
  (no 2024 yield: Bangladesh, Myanmar; no receipts: Canada, Netherlands).
- **Prices**: the Missing Billions exists only in constant 2019 prices; the bundle
  emits the nominal gap flagged invalid (see §2.2).
- **Deflation**: a single national CPI deflator is applied to all receipts; no
  market-level price indices exist in the official series.
- **Known limitation**: the counterfactual uses the national average per-visitor
  yield, so it combines the change in each source market's yield with the change in
  the market mix; separating the two effects is future work.
