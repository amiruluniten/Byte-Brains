"""Ticket T6: the regional yield benchmark fragment.

Encodes the officially published 2024 figures researched (and fully sourced)
in research/regional-yield-benchmark-2024.md into the bundle as an additive
`regional_benchmark` fragment. The pipeline cannot re-scrape foreign
statistical offices offline, so the researched constants ARE the derivation —
with receipts basis, conversion note, source URLs and caveats carried in the
fragment, and model-level reconciliation (yield vs receipts/arrivals, pct vs
yields) checked on every emission and reload.

Framing contract (CONTEXT.md): the regional gap is SUPPORTING context for the
Missing Billions headline, never the headline. Malaysia is the baseline row;
Vietnam is explicitly excluded (its published revenue includes domestic
tourism, so no defensible 2024 receipts-per-visitor exists).
"""
from __future__ import annotations

from .bundle import (
    ExcludedMarket,
    RegionalBenchmarkFragment,
    RegionalCountry,
    RegionalReceipts,
)

RESEARCH_DOC = "research/regional-yield-benchmark-2024.md"

CAVEATS = [
    (
        "Basis mix: Malaysia and Thailand receipts are visitor-expenditure SURVEY estimates "
        "(Tourism Malaysia; Thailand MOTS departure-point survey); Indonesia's are Bank "
        "Indonesia balance-of-payments travel credit (administrative). Cross-country yield "
        "gaps of 10-20% can be methodological, not real."
    ),
    (
        "The 2019 baseline for every country is the World Bank WDI receipts-per-visitor "
        "(ST.INT.RCPT.CD / arrivals); the current WDI build stops at 2020 for these "
        "countries, so 2019 is the latest WDI-comparable yield. The Indonesia 2024-vs-2019 "
        "pair is the cleanest (same BI BOP basis); Malaysia's 2024 survey figure vs its 2019 "
        "WDI BOP figure is the least clean (survey vs BOP)."
    ),
    (
        "Thailand's headline 2024 revenue (THB 1.67T) was later restated to ~THB 1.61T in "
        "MOTS's own year-end summary; the headline figure is cited and the restatement flagged."
    ),
    (
        "USD conversions use 2024 average rates (THB ~34.5, MYR ~4.68) or authority-stated "
        "conversions where published; per-visitor yields are therefore approximate."
    ),
    (
        "Framing: this regional comparison is supporting context for the Missing Billions "
        "(the real-terms 2019-anchor counterfactual), never the headline."
    ),
]

VIETNAM_EXCLUSION = ExcludedMarket(
    country="Vietnam",
    reason=(
        "Not comparable: Vietnam publishes only TOTAL tourism revenue (international + "
        "domestic, ~840T VND in 2024, an administrative aggregate of provincial estimates). "
        "No international-only receipts figure exists, so a defensible 2024 "
        "receipts-per-visitor yield cannot be computed; the naive 840T VND / 17.5M "
        "arrivals (~US$1,889) overstates the international yield because domestic revenue "
        "is in the numerator."
    ),
)


def build_regional_benchmark_fragment() -> RegionalBenchmarkFragment:
    """The researched 2024 regional benchmark (Thailand, Indonesia vs Malaysia)."""
    return RegionalBenchmarkFragment(
        anchor_year=2024,
        baseline_year=2019,
        currency="usd",
        baseline_market="Malaysia",
        countries=[
            RegionalCountry(
                country="Malaysia",
                role="baseline",
                receipts_basis="survey",
                receipts_basis_note=(
                    "Tourism Malaysia tourist expenditure survey (Statistics in Brief 2024; "
                    "consistent with the DOSM TSA inbound consumption aggregate)."
                ),
                arrivals_2024=37_961_485,
                receipts_2024=RegionalReceipts(
                    local_amount_billion=106.78,
                    local_currency="MYR",
                    usd_billion=22.8,
                    usd_note="RM 106.78bn at 2024 average ~4.68 MYR/USD",
                ),
                yield_2024_usd_per_visitor=600,
                yield_2019_usd_per_visitor=851,
                yield_change_2024_vs_2019_pct=-29,
                yield_multiple_of_malaysia_2024=None,
                source_urls=[
                    "https://data.tourism.gov.my/",
                    "https://www.worldbank.org/en/programs/wdi",
                ],
            ),
            RegionalCountry(
                country="Thailand",
                role="comparator",
                receipts_basis="survey",
                receipts_basis_note=(
                    "MOTS (Ministry of Tourism and Sports) continuous foreign-tourist "
                    "expenditure survey (departure-point sampling); survey estimates, not "
                    "balance-of-payments. 2024 headline later restated to ~THB 1.61T by MOTS."
                ),
                arrivals_2024=35_546_072,
                receipts_2024=RegionalReceipts(
                    local_amount_billion=1670,
                    local_currency="THB",
                    usd_billion=48.45,
                    usd_note="MOTS-stated conversion at ~34.5 THB/USD",
                ),
                yield_2024_usd_per_visitor=1363,
                yield_2019_usd_per_visitor=1613,
                yield_change_2024_vs_2019_pct=-16,
                yield_multiple_of_malaysia_2024=2.3,
                source_urls=[
                    "https://english.news.cn/20250107/557d03a80370448b895fbad449e33203/c.html",
                    "https://tpnnational.com/2025/02/01/thailands-foreign-arrivals-surge-26-27-percent-in-2024-generating-1-67-trillion-baht/",
                    "https://www.mots.go.th/",
                ],
            ),
            RegionalCountry(
                country="Indonesia",
                role="comparator",
                receipts_basis="balance_of_payments",
                receipts_basis_note=(
                    "Bank Indonesia tourism foreign exchange (devisa pariwisata), processed "
                    "by Kemenpar — administrative balance-of-payments, not a visitor survey. "
                    "No official rupiah figure published."
                ),
                arrivals_2024=13_902_420,
                receipts_2024=RegionalReceipts(
                    local_amount_billion=None,
                    local_currency=None,
                    usd_billion=16.71,
                    usd_note="published in USD (angka sementara); ~Rp265T at ~15,869 IDR/USD is a conversion, not official",
                ),
                yield_2024_usd_per_visitor=1202,
                yield_2019_usd_per_visitor=1143,
                yield_change_2024_vs_2019_pct=5,
                yield_multiple_of_malaysia_2024=2.0,
                source_urls=[
                    "https://www.bps.go.id/id/pressrelease",
                    "https://api.kemenpar.go.id/storage/app/uploads/public/67f/e1c/6e4/67fe1c6e4d1b9146250039.pdf",
                ],
            ),
        ],
        excluded_markets=[VIETNAM_EXCLUSION],
        caveats=CAVEATS,
        research_doc=RESEARCH_DOC,
    )
