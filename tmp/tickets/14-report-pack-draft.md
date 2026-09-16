# Issue #14 draft — report pack catches up to the 2025 bundle

Draft only. Nothing here is applied yet; no tracked file was touched. Land this
AFTER issue #13 emits the new bundle, in this order:

1. Re-run the pipeline (`pipeline/.venv/bin/tsa-pipeline`) so the new bundle exists.
2. Apply the edit blocks below (each `old_str` must match exactly once — verified
   against the files as of 2026-09-16).
3. Run the report-pack tests. They recompute every number from the bundle: where a
   test disagrees with a figure below, the bundle wins — paste the bundle's figure.
4. Do NOT touch `pinned-bundle.md` here; it needs the final checksum from #13
   (same for every "bundle v1 … checksum `ad9523c8`" citation across the pack —
   see "Must be re-verified against the new bundle" at the bottom).

Headline rule unchanged: **RM10.2 billion (2020–2024, constant 2019 prices)** — no
nominal gap is ever quoted, and all 2025 figures stay marked preliminary.

---

## 1. `report-pack/2-method-notes.md`

### 2.2 table — add 2025p row

**old_str:**

```
| 2024 | 102,815.3 | 37,961,485 | 2,477.77 | 94,059.7 | 93,920.6 | **-139.1** |
```

**new_str:**

```
| 2024 | 102,815.3 | 37,961,485 | 2,477.77 | 94,059.7 | 93,920.6 | **-139.1** |
| 2025p | 119,312.0 | 42,196,892 | 2,551.49 | 107,666.0 | 104,400.0 | **-3,265.7** |
```

---
### 2.2 stagnation line — restatement note + 2025 ending paragraph

**old_str:**

```
**The stagnation line:** by 2024, real per-visitor expenditure was RM2,477.77 against
the 2019 anchor RM2,474.10 — a difference of +0.15%, i.e. the 2024 real gap is
-RM139.07 million, essentially zero at this data's precision. Each 2024 visitor was
worth exactly what a 2019 visitor was worth. The recovery added **visitors** (+8.3%)
and **prices** (+9.3%) — which together explain the nominal receipts jump to
RM102,815.3 million (+18.6% on the TSA basis) — but added **no value per visitor**.
```

**new_str:**

```
**The stagnation line:** by 2024, real per-visitor expenditure was RM2,477.77 against
the 2019 anchor RM2,474.10 — a difference of +0.15%, i.e. the 2024 real gap is
-RM139.07 million, essentially zero at this data's precision. Each 2024 visitor was
worth exactly what a 2019 visitor was worth. The recovery added **visitors** (+8.3%)
and **prices** (+9.3%) — which together explain the nominal receipts jump to
RM102,815.3 million (+18.6% on the TSA basis; the TSA 2025 edition restates 2024
inbound consumption as RM102,931.3 million, +18.7%) — but added **no value per
visitor**.

**The ending of the line (2025, preliminary).** The TSA 2025 edition labels 2025
"2025p" — preliminary — and it is the year the stagnation line ends: 2025 real
per-visitor tourism yield was RM2,551.49 against the 2019 anchor RM2,474.10 (+3.1%,
constant 2019 prices). Real per-visitor tourism yield recovered above the 2019
anchor only in 2025 — five years on. Every 2025 figure is preliminary and stays
marked "p"; the Missing Billions headline remains a 2020–2024 figure in constant
2019 prices.
```

---
### 2.2 receipts basis — 2024 restatement note

**old_str:**

```
**Receipts basis used.** The headline pairs the TSA inbound tourism consumption
(Jad 1A, RM102,815.3 million in 2024) with visitor-basis arrivals — the same pairing
the official 2019 anchor uses.
```

**new_str:**

```
**Receipts basis used.** The headline pairs the TSA inbound tourism consumption
(Jad 1A, RM102,815.3 million in 2024; restated to RM102,931.3 million by the TSA
2025 edition) with visitor-basis arrivals — the same pairing the official 2019
anchor uses.
```

---
### 2.7 window line

**old_str:**

```
- **Window**: 2019–2024. 2019 is the anchor year: the official pre-crisis baseline.
  It is a measuring stick for the stagnation line, not a target to revert to.
```

**new_str:**

```
- **Window**: 2019–2025 (2025 preliminary, "2025p" in the TSA). 2019 is the anchor
  year: the official pre-crisis baseline. It is a measuring stick for the stagnation
  line, not a target to revert to.
```

---
## 2. `report-pack/3-source-registry.md`

### 3.1 table — insert TSA 2025 as row 9

**old_str:**

```
| 8 | Tourist arrivals into Malaysia by quarter (regional) | Tourism Malaysia statistics portal (data.tourism.gov.my) | repo copy: `source/dataset/tourist-arrivals-into-malaysia-by-quarterly-regional.csv` | 2026-09-12 | Regional composition of arrivals over time (quarterly, by region) — supporting context for the diagnosis section. |
```

**new_str:**

```
| 8 | Tourist arrivals into Malaysia by quarter (regional) | Tourism Malaysia statistics portal (data.tourism.gov.my) | repo copy: `source/dataset/tourist-arrivals-into-malaysia-by-quarterly-regional.csv` | 2026-09-12 | Regional composition of arrivals over time (quarterly, by region) — supporting context for the diagnosis section. |
| 9 | Tourism Satellite Account 2025 (xlsx) | DOSM | `https://storage.dosm.gov.my/tourism/tourism_2025.xlsx` (repo copy: `data/raw/tourism_2025.xlsx`) | 2026-09-16 | 2025 preliminary ("2025p") visitor arrivals (42,196,892) and inbound tourism consumption (RM119,312.0 million); also restates 2024 inbound consumption (RM102,815.3 million → RM102,931.3 million). |
```

---
### 3.2 table — renumber 9 → 10

**old_str:**

```
| 9 | Domestic Tourism Survey 2025 (`tourism_domestic_2025`) |
```

**new_str:**

```
| 10 | Domestic Tourism Survey 2025 (`tourism_domestic_2025`) |
```

---
### 3.2 table — renumber 10 → 11

**old_str:**

```
| 10 | Domestic Tourism Bulletin Q1 2026 (`tourism_domestic_2026-q1`) |
```

**new_str:**

```
| 11 | Domestic Tourism Bulletin Q1 2026 (`tourism_domestic_2026-q1`) |
```

---
### 3.3 pointer — "rows 1–5 above" → "§3.1"

**old_str:**

```
never as a source of headline statistics (all headline statistics come
from rows 1–5 above).
```

**new_str:**

```
never as a source of headline statistics (all headline statistics come
from the primary statistical sources in §3.1).
```

---
### renumber row 16 → 17

**old_str:**

```
| 16 | 
```

**new_str:**

```
| 17 | 
```

---
### renumber row 15 → 16

**old_str:**

```
| 15 | 
```

**new_str:**

```
| 16 | 
```

---
### renumber row 14 → 15

**old_str:**

```
| 14 | 
```

**new_str:**

```
| 15 | 
```

---
### renumber row 13 → 14

**old_str:**

```
| 13 | 
```

**new_str:**

```
| 14 | 
```

---
### renumber row 12 → 13

**old_str:**

```
| 12 | 
```

**new_str:**

```
| 13 | 
```

---
### renumber row 11 → 12

**old_str:**

```
| 11 | 
```

**new_str:**

```
| 12 | 
```

---
## 3. `report-pack/4-findings-material.md`

### F1 stagnation line — add 2025 preliminary point

**old_str:**

```
- **The stagnation line:** 2024 real per-visitor expenditure RM2,477.77 vs 2019's
  RM2,474.10 — +0.15%. Each 2024 visitor was worth exactly what a 2019 visitor was
  worth.
```

**new_str:**

```
- **The stagnation line:** 2024 real per-visitor expenditure RM2,477.77 vs 2019's
  RM2,474.10 — +0.15%. Each 2024 visitor was worth exactly what a 2019 visitor was
  worth.
- **2025 (preliminary) — the line breaks:** 2025p real per-visitor tourism yield
  RM2,551.49 vs 2019's RM2,474.10 — +3.1%, constant 2019 prices. Real per-visitor
  tourism yield recovered above the 2019 anchor only in 2025, five years on. All
  2025 figures are preliminary.
```

---
## 4. `report-pack/7-q-and-a-defence.md` (OPTIONAL extra — beyond the four requested items)

The limits answer still says "2019–2024 window" and points at §2.4 for the limits
list, but the limits live in §2.7. Both become stale the moment the §2.7 window
edit above lands. Included so #14 lands complete; drop if out of scope.

### Limits answer — window and § pointer (OPTIONAL)

**old_str:**

```
See `2-method-notes.md` §2.4: inbound visitors only; 2019–2024 window; top-20 source
markets (four excluded with stated reasons); constant 2019 prices only; a single
national CPI deflator; and the blended yield/mix limitation above. Every limit is
declared, none discovered by a judge.
```

**new_str:**

```
See `2-method-notes.md` §2.7: inbound visitors only; 2019–2025 window (2025
preliminary); top-20 source markets (four excluded with stated reasons); constant
2019 prices only; a single national CPI deflator; and the blended yield/mix
limitation above. Every limit is declared, none discovered by a judge.
```

---

## Must be re-verified against the new bundle (issue #13 output)

The figures below are derived from the TSA 2025 workbook at draft time (CPI ratio
2019→2024 = 1.093085). The pipeline output is authoritative — the report-pack tests
recompute them, so paste whatever the new bundle emits:

- 2024 row (restated consumption RM102,931.3 million): nominal per-visitor
  ≈ RM2,711.47; real per-visitor ≈ RM2,480.6; actual (2019 prices) ≈ RM94,166.0;
  real gap ≈ **-245** (counterfactual unchanged at RM93,920.6 million).
  The §2.2 worked example's "RM2,708.41 → RM2,477.77" pair moves the same way.
- 2025p derived cells: actual (2019 prices) ≈ RM107,664.9–107,666.0 million;
  counterfactual ≈ RM104,399.5–104,400.0 million; real gap ≈ **-3,265.5 to -3,265.7**
  (rounding-sensitive). Table style is one decimal place, matching the existing rows.
- **CONFLICT TO RESOLVE:** if the 2024 real gap moves from -139.1 to ≈ -245, the
  cumulative 2020–2024 headline becomes ≈ **RM10,096 million ≈ RM10.1 billion**,
  which contradicts the brief that the headline stays RM10.2 billion. Confirm with
  #13's bundle: either the restated series shifts other years too, or the headline
  wording must change. Do not quote any nominal gap either way.
- Every "bundle v1, schema 1.0.0, checksum `ad9523c8`" citation (README, method
  notes header, registry preamble, findings header) must be re-cited to the new
  bundle version + checksum when it lands — same rule `pinned-bundle.md` follows.
- The 2024 revision also touches the TSA 2024 press-release numbers quoted in the
  registry (row 12: inbound expenditure RM107.0 billion) and the findings intro —
  the press release is a historical document, so decide whether to keep its figures
  as quoted or annotate the restatement there too.

## Ambiguities found in the current text

- Registry numbering runs sequentially across sections (1–8 primary, 9–10 context,
  11–16 press, 17 datathon). Inserting TSA 2025 as row 9 in §3.1 forces the
  renumbering chain above (9→10, 10→11, 11→18). Applied to all of them; §3.3's
  "rows 1–5 above" pointer is rewritten to "§3.1" so it survives future inserts.
- `7-q-and-a-defence.md` cites `2-method-notes.md` §2.4 twice where §2.7 (Scope &
  limits) is meant; only the limits-answer occurrence is drafted above (it also
  carries the stale window). The other occurrence ("This is stated in the Scope &
  limits section (… §2.4)") still needs the same §2.4→§2.7 fix if you want it.
- The stagnation-line prose in the registry's row 3 and the findings "Problem
  Statement" ("by 2024 exactly the same") remain true as written and were left
  untouched; the 2025 break is framed as the line's ending, not a contradiction.
- The 2025p table row's "actual"/"counterfactual" cells are given to one decimal
  for style, but the source values arrived rounded (~107,666 / ~104,400); treat
  the bundle's emitted values as final.
