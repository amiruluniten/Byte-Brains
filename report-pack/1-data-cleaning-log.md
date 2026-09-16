# 1 · Data-cleaning log (plain language)

Every dataset below went through the project's data pipeline, which produces one
versioned output file — the **data bundle** (bundle v1, schema 1.1.0, checksum
`338e1b34`). Everything the dashboard shows and everything in this pack comes from
that bundle, so the report can cite one version for all numbers.

This log describes, for each source, what was changed on the way in, why, and what
could go wrong. The originals in `data/raw/` and `source/` were never modified; the
pipeline records a fingerprint (SHA-256) of every raw file inside the bundle, so the
exact input bytes are traceable.

---

## A. DOSM Tourism Satellite Account workbooks (2015–2025 national series)

**Raw files:** `data/raw/tourism_2023.xlsx`, `data/raw/tourism_2024.xlsx`,
`data/raw/tourism_2025.xlsx` (downloaded from
`https://storage.dosm.gov.my/tourism/tourism_2023.xlsx`, `.../tourism_2024.xlsx`
and `.../tourism_2025.xlsx`; accessed 2026-09-13 and 2026-09-16).

The TSA is the national flagship publication. Its workbook is a print-layout sheet,
not a clean table, so several things had to be handled on the way in:

| transformation | why | what could go wrong (and what protects us) |
|---|---|---|
| Row labels matched on the English half of bilingual Malay+English merged cells (e.g. "A1. Ketibaan pelancong ke Malaysia … Tourist arrivals to Malaysia"). | DOSM publishes bilingual labels in merged cells; matching on one language is stable. | A label rename in a future edition would break the match. Ground-truth checks (2019 inbound consumption RM86,706.5 million; 2019 tourist arrivals 26,100,784) fail the run loudly if the parse drifts. |
| Years read from the header row (row 3), not assumed positional. | The sheets are laid out for printing. | A layout change would silently shift columns onto wrong years; the ground truths catch this. |
| Each sheet contains side-by-side blocks: absolute values **and** percentage-share blocks. Only the values block is read. | The share block would give numbers ~100× too small. | Reading the wrong block is a classic silent error; the ground-truth checks make it loud. |
| DOSM revision flags ("2025p" = preliminary) are **kept** on each observation, never stripped. | The report should be able to say a figure was preliminary at time of access. | Later revisions change values; the bundle records the source file and flag so the vintage is traceable. |
| The TSA 2025 workbook's blank spacer rows and its `2025p` year-header marker are handled by the same anchor-row and year-header lookups; later official editions **win** on overlapping years, so the 2024 restatement is adopted. | The 2025 export's layout differs slightly; the revision policy (later official workbook wins) must be explicit. | A silent layout shift would misplace years; the ground-truth checks (2019 values, the documented 2024 restatement RM102,815.3 → RM102,931.3 million) fail the run loudly if parsing drifts. |
| Footnote artefacts ("n.a", "4.1*") are treated as missing or footnotes — never as the number 4.1. | An asterisk is a footnote marker, not a decimal. | Parsing the marker would corrupt the series; ground truths catch it. |
| Empty "phantom" formatting columns ignored. | The sheet has decorative empty columns. | Without care they would offset the column mapping. |
| Each arrival series is split by **counting basis** — tourist (stays ≥1 night), visitor (all visitors), same-day visitor (excursionist) — and the year window is embedded in the series name. Bases are never merged into one series. | Tourist-basis series exclude same-day visitors; visitor-basis series include them. Mixing them silently changes the denominator and invents fake growth. | Cross-basis comparisons misstate recovery. The bundle refuses a mixed-basis series by construction. |

**What comes out:** the `national_series` fragment — visitor arrivals 2019–2024
and 2019–2025 (37,961,485 in 2024; 42,196,892 preliminary in 2025), tourist
arrivals 2015–2023, 2019–2024 and 2019–2025 (26,100,784 in 2019; 26,613,597
preliminary in 2025), same-day visitor (excursionist) arrivals 2019–2024 and
2019–2025 (8,944,841 in 2019; 12,944,787 in 2024; 15,583,295 preliminary in 2025),
and inbound tourism consumption 2015–2024 and 2015–2025 (RM86,706.5 million in
2019; RM102,815.3 million in 2024 as first published, restated to RM102,931.3
million by the TSA 2025 edition; RM119,312.0 million preliminary in 2025).

---

## B. Tourism Malaysia *Statistics in Brief 2024* PDF (source markets)

**Raw file:** `data/raw/inbrief2024.pdf`, accessed 2026-09-13 from
`https://data.tourism.gov.my/frontend/pdf/New_Final_Malaysia%20Tourism%20Statistics%20in%20Brief%202024.pdf`.
A text layer was extracted once with `pdftotext -layout` into `data/raw/inbrief2024.txt`
and the pipeline reads that text (regenerating it from the PDF if it is absent).

| transformation | why | what could go wrong |
|---|---|---|
| Layout-preserving text extraction, then fixed-width column parsing of two top-20 tables: visitor receipts by country of nationality (RM million, p. 14) and visitor arrivals by country of nationality (p. 11). | The PDF has no machine-readable table. | If a future edition changes fonts or spacing, columns shift. A committed copy of the exact extracted text (test fixture) plus row counts and national totals make any drift loud. |
| The "% growth" column is separated from the level values. | The arrivals table prints 2024 value, 2023 value, and growth side by side. | Swallowing the growth number into the value column would double-count. Tests pin Singapore 18,855,680 arrivals and the growth column separately. |
| Receipts and arrivals for each market are paired **within the same publication** (both In Brief 2024, visitor basis). | Yield = receipts ÷ arrivals must divide like with like. Mixing the TSA receipts basis with In Brief arrivals would misstate yield. | Cross-publication mixing is a basis error; the pipeline keeps the fragments separate and states each basis. |
| Markets present in only one table keep their missing side **null, never zero**: Bangladesh and Myanmar are arrivals-only; Canada and the Netherlands are receipts-only. Each carries an explicit coverage label. | Zeroing a receipts cell would understate total receipts and drag mean yield down — a fabricated number either way. | Silent zeros are the most common spreadsheet sin; the bundle's validator rejects a zero where a null is required. |
| National reconciliation check: In Brief national receipts RM106,783.11 million ÷ 37,961,485 visitor arrivals = **RM2,813 per visitor (2024)**; and the In Brief arrivals total must equal the TSA visitor-arrivals figure exactly. | Two independent sources agreeing is the cheapest strong validation available. | A misread table fails this check loudly. |

**What comes out:** the `source_market` fragment — 22 source markets (18 with both
receipts and arrivals, 4 partial), 2024 and 2023, with per-market **tourism yield**
(receipts ÷ arrivals). Example: Singapore RM1,481.87 per visitor in 2024 — far below
the RM2,813 national average, which is the Volume Trap story in one number.

---

## C. DOSM CPI (the price deflator)

**Raw file:** `data/raw/cpi_headline.csv` — OpenDOSM dataset `cpi_headline` ("Monthly
CPI by Division (2-digit)", overall division, 2010=100), downloaded via the repo's
`tools/dosm-cli` from `https://storage.dosm.gov.my/cpi/cpi_2d.csv`, accessed 2026-09-13.

| transformation | why | what could go wrong |
|---|---|---|
| The monthly index is averaged into an annual mean per year. | The counterfactual works in years; averaging removes month-to-month noise. | Using a single month (e.g. December) would inject seasonality into a deflator that has no business having any. |
| Only **ratios** CPI(t) ÷ CPI(2019) are used, so the 2010=100 base never appears in any output. | Ratios make the index base irrelevant. | Quoting an "index value" without its base would be meaningless; nothing in the bundle does. |
| The national **overall** CPI is chosen (not a division-specific index). | Same publisher as the TSA, covers all visitor spending categories, available as one clean series. | A division-specific deflator (e.g. food only) would misstate economy-wide price movement. |

**What comes out:** the `macro_series` fragment. Anchor values: CPI 2019 =
121.483333; CPI 2024 = 132.791667; ratio 1.093085 — prices rose 9.3% from 2019 to
2024. CPI 2025 = 134.625, ratio 1.108177 (the preliminary year deflates by the same
overall-series annual mean). Every real-terms number in this pack removes exactly
these effects.

---

## D. WEF Travel & Tourism Development Index (source-market traits)

**Raw file:** `source/dataset/WEF_TTDI.csv` — the WEF TTDI 2024 edition as distributed
by the World Bank Data360 platform
(`https://data360api.data360api.org/datasets/WB.DATA360:DS_DATA360/download/csv`,
accessed 2026-09-12).

| transformation | why | what could go wrong |
|---|---|---|
| The SDMX long-format file is filtered to plain values (breakdown `WEF_TTDI_VAL`), dropping score/rank variants of the same indicator. | Scores and ranks are transformations of the same underlying number; keeping all three would triple-count. | Mixing a rank with a value would put a 1–180 number next to a 1–7 score; the filter prevents it. |
| For each source market and indicator, the latest available year ≤ 2024 is kept (recorded per market as reference years). | Not every market has 2024 for every indicator; "latest available, stated" beats "latest only". | Silently mixing reference years without saying so would be misleading; the bundle records them. |
| Five indicators are selected per market: visitor purchasing power, average length of stay, overall TTDI score, air connectivity (log-scaled), passport mobility. | A documented feature contract for the segmentation (see method notes), not a data dump. | Arbitrary indicator choice; the subset is written into the bundle so the report can defend it. |
| Markets absent from the TTDI 2024 edition (Brunei, Chinese Taipei, Russia) keep missing values **explicitly**, with a per-market attribution list; for clustering only, they receive the median of the covered markets. | Explicit missing data is honest; median imputation is a stated, mild choice confined to the clustering step. | Zeroing absent WEF values would fabricate "worst-in-class" traits; the validator forbids it. |

---

## E. The Missing Billions counterfactual (computed, not extracted)

**Output:** the `missing_billions` fragment. Nothing is downloaded here; this is
arithmetic over fragments A and C (method in `2-method-notes.md`).

- The TSA inbound tourism consumption series (tourist basis, Jad 1A) is paired with
  **visitor-basis** arrivals, exactly as published; the pairing is stated inside the
  bundle rather than hidden. **What could go wrong:** the two bases differ (the
  receipts series counts tourism consumption; arrivals include same-day visitors).
  This is the pairing the official 2019 anchor uses — including for the preliminary
  2025 row — and a Tourism Malaysia receipts variant gives the same conclusion (see
  method notes).
- A **naive nominal** twin of the counterfactual is emitted too, explicitly flagged
  invalid (including for the preliminary 2025 row) — and the validator asserts it
  shows the false "surplus" the data actually produces, so any future regression to a
  nominal headline fails the build.
- Volume Trap indicators are computed from the national series (same-day visitor (excursionist) shares) plus one hand-extracted figure: land is the arrival mode for
  66.1% of 2024 visitors (25,080,202 of 37,961,485; Tourism Malaysia In Brief 2024,
  mode-of-arrival table), pinned by a ground-truth check.

---

## F. Source-market segmentation (computed)

**Output:** the `source_segmentation` fragment (method in `2-method-notes.md`).

- Every yield figure is **copied** from the `source_market` fragment, never
  recomputed — a reconciliation check makes drift between the two fragments
  impossible.
- Markets are processed in sorted order and the clustering is seeded and
  deterministic, so re-running the pipeline produces byte-identical output.
- Markets without a 2024 yield (Bangladesh, Myanmar, Canada, Netherlands) are
  excluded from clustering **with a stated reason**, not silently dropped.

---

## G. Market-mix simulator inputs (computed)

**Output:** the `simulator` fragment — per-market nominal yields deflated to 2019
prices with the same CPI ratio, 2024 and 2023 arrival shares, and a residual
"Other markets" entry covering arrivals beyond the listed markets. *(Ticket #8 is
finishing the dashboard page that uses this fragment; the fragment itself is already
in the bundle cited above. If it is absent from a later bundle, the pack stands
without it — the simulator is the prescription layer, not the evidence.)*

---

## Cross-cutting choices

- **No number is invented anywhere.** If the pipeline cannot verify a value against a
  pinned ground truth, it refuses to emit the bundle.
- **Missing is missing.** Absent values stay null with an explanation; zeros are
  reserved for measured zeros.
- **Determinism.** No timestamp or randomness enters the checksum; two runs on the
  same raw data produce the identical bundle, so the report's citation stays valid.
