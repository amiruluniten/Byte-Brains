# Byte-Brains report pack — "The Missing Billions: Making Every Visit Count"

This pack is for the three teammates writing the ≤25-page official report. You do
not need access to the code or the build process: everything you need to write
truthful Methodology, Findings, and References sections is here.

## What this pack is grounded in

Every number in this pack comes from the **data bundle** — the single data file the
whole project runs on (the dashboard reads the same file). This pack was built
against:

- **bundle v1 (schema 1.0.0), checksum `ad9523c8`** (full checksum
  `ad9523c82ebaf162f5c88dcf87c2e60102770342835d2376017cca183ca30bbe`), generated
  2026-09-13 from the DOSM Tourism Satellite Account workbooks, Tourism Malaysia
  *Statistics in Brief 2024*, the DOSM CPI series, and the WEF TTDI indicator set.

If the pipeline is re-run before submission (for example when 2025 receipts are
published), the bundle checksum changes. Re-cite whatever bundle version the
dashboard footer shows — the report must cite the same data the dashboard shows.

## Files

| file | what it gives you |
|---|---|
| `1-data-cleaning-log.md` | every transformation applied to the raw data, in plain language: what changed, why, and what could go wrong. Feed your Methodology section from this. |
| `2-method-notes.md` | how the yield, the Missing Billions counterfactual, the market segmentation, and the simulator arithmetic work — no code. |
| `3-source-registry.md` | every dataset and PDF used: publisher, URL, access date, what it was used for. Feed your References section from this. |
| `4-findings-material.md` | key numbers and ready-to-adapt interpretations, structured against the official report template (Introduction → Conclusion). |
| `5-advisor-summary.md` | one page for the academic advisor, no jargon, no code. |
| `pinned-bundle.md` | the exact bundle version + sha256 checksum the dashboard displays — cite this in the report so the numbers match the live site. |
| `screenshots/` | high-resolution captures of every dashboard page (from the static export) for the report's figures. |

## Language rules (keep the report consistent with the dashboard)

- Use **tourism yield** for value per visitor (spending per visitor × length of
  stay); not "tourism value" and not "receipts per head".
- Use **extensive growth** (more visitors) vs **intensive growth** (more value per
  visitor) — this is the report's spine.
- Use **tourist** for visitors who stay at least one night; use "same-day visitor (excursionist)" on first mention, then "same-day visitor".
- The headline counterfactual is the **Missing Billions** (RM10.2 billion, 2020–2024,
  constant 2019 prices). Regional comparisons (Thailand, Indonesia) are supporting
  context with caveats — never the headline.
- The measurement critique is the **Volume Trap**: arrival-count KPIs reward
  low-yield same-day traffic.
- Say **source market** (not "country") and **market mix** (not "portfolio") in prose.
- Say **Tourism GVA** when you mean the GDP-side number from the TSA; not "tourism
  GDP" (too loose).

## Honesty rules (these protect you in Q&A)

- The Missing Billions is a **real-terms (constant 2019 prices)** number only. A
  nominal comparison shows a false surplus — never quote nominal gaps.
- Two "receipts" numbers exist and they are **not the same basis**: the TSA inbound
  tourism consumption (RM102,815.3 million in 2024, from DOSM's national accounts
  tables) and Tourism Malaysia visitor receipts (RM106,783.11 million in 2024, from
  the expenditure survey). Each calculation names which one it uses. Do not mix them
  in one paragraph without saying so.
- Arrival series also have bases: **tourist basis** (excludes same-day visitors) vs
  **visitor basis** (includes them). Every series in the pack states its basis and
  window. Never compare across bases without a caveat.
