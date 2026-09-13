"""Tourism Malaysia "Statistics in Brief 2024" extractor (ticket T3).

The proven extraction path is `pdftotext -layout` over the raw PDF (see
tests/fixtures/make_pdf_fixture.py for provenance). This module parses that text:
the visitor-arrivals top-20 table, the visitor-receipts top-20 table, and the
national totals (mode-of-transport TOTAL row; receipts infographic).

Counting basis: In Brief counts foreign **visitors** (same pair of tables per
market), so receipts and arrivals per market pair up — the spec requires In Brief
receipts to pair with In Brief arrivals, never across bases.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

_TABLE_END = re.compile(r"^\s*Source:")
_MARKET_NAME = r"[A-Z][A-Z .&'\-]*"
_ARRIVALS_ROW = re.compile(
    rf"^\s*(\d{{1,2}})\s+({_MARKET_NAME}?)\s{{2,}}([\d,]+)\s+([\d,]+)\s+(-?[\d.]+)\s*$"
)
_RECEIPTS_ROW = re.compile(
    rf"^\s*(\d{{1,2}})\s+({_MARKET_NAME}?)\s{{2,}}([\d,]+\.\d{{2}})\s+([\d,]+\.\d{{2}})\s*$"
)


@dataclass(frozen=True)
class TableRow:
    rank: int
    market: str
    value_2024: float
    value_2023: float
    growth: float | None  # arrivals table only


@dataclass(frozen=True)
class NationalTotals:
    arrivals_2024: int
    arrivals_2023: int
    receipts_2024: float
    receipts_2023: float


def _title(market: str) -> str:
    return market.strip().title()


def _table_lines(text: str, header_marker: str) -> list[str]:
    """Lines between the given table header and the next `Source:` footer."""
    lines = text.splitlines()
    start = next(
        (i for i, line in enumerate(lines) if header_marker in line),
        None,
    )
    if start is None:
        raise ValueError(f"table header {header_marker!r} not found in extract")
    out = []
    for line in lines[start + 1:]:
        if _TABLE_END.match(line):
            break
        out.append(line)
    return out


def _parse_table(text: str, header_marker: str, pattern: re.Pattern, with_growth: bool) -> list[TableRow]:
    rows = []
    for line in _table_lines(text, header_marker):
        m = pattern.match(line)
        if m is None:
            continue
        groups = m.groups()
        growth = float(groups[4]) if with_growth else None
        rank, market, v24, v23 = groups[:4]
        rows.append(
            TableRow(
                rank=int(rank),
                market=_title(market),
                value_2024=float(v24.replace(",", "")),
                value_2023=float(v23.replace(",", "")),
                growth=growth,
            )
        )
    if len(rows) != 20:
        raise ValueError(f"expected 20 rows under {header_marker!r}, parsed {len(rows)}")
    return rows


def parse_arrivals_table(text: str) -> list[TableRow]:
    """Visitor arrivals by country of nationality, top 20 (2024, 2023)."""
    return _parse_table(text, "COUNTRY OF NATIONALITY", _ARRIVALS_ROW, with_growth=True)


def parse_receipts_table(text: str) -> list[TableRow]:
    """Visitor receipts (RM million) by country of nationality, top 20 (2024, 2023)."""
    return _parse_table(text, "VISITOR RECEIPTS (RM MILLION)", _RECEIPTS_ROW, with_growth=False)


_INT = r"\d{1,3}(?:,\d{3})+"
_TOTAL_ROW = re.compile(rf"^\s*TOTAL\s+({_INT})\s+({_INT})\b")
_RECEIPTS_TOTALS_LINE = re.compile(rf"^\s*({_INT}\.\d{{2}})\s+({_INT}\.\d{{2}})\s*$")


def parse_national_totals(text: str) -> NationalTotals:
    """National totals: arrivals from the mode-of-transport TOTAL row, receipts from
    the visitor-receipts infographic ("106,783.11 ... 74,291.56" under the Growth header)."""
    arrivals = None
    for line in text.splitlines():
        m = _TOTAL_ROW.match(line)
        if m:
            arrivals = (int(m.group(1).replace(",", "")), int(m.group(2).replace(",", "")))
            break
    if arrivals is None:
        raise ValueError("mode-of-transport TOTAL row not found in extract")

    receipts = None
    lines = text.splitlines()
    for i, line in enumerate(lines):
        m = _RECEIPTS_TOTALS_LINE.match(line)
        if m and any("Growth" in prev for prev in lines[max(0, i - 4):i]):
            receipts = (float(m.group(1).replace(",", "")), float(m.group(2).replace(",", "")))
            break
    if receipts is None:
        raise ValueError("visitor receipts infographic totals not found in extract")

    return NationalTotals(
        arrivals_2024=arrivals[0],
        arrivals_2023=arrivals[1],
        receipts_2024=receipts[0],
        receipts_2023=receipts[1],
    )


def build_source_market_fragment(text: str, source_file: str = "inbrief2024.txt"):
    """Assemble the SourceMarketFragment: union of the two top-20 tables with explicit
    coverage, derived per-market yield, and the national totals for reconciliation."""
    from ..bundle import MarketObservation, SourceMarketFragment, SourceMarketRow, TextSourceRef

    receipts_by_market = {r.market: r for r in parse_receipts_table(text)}
    arrivals_by_market = {r.market: r for r in parse_arrivals_table(text)}
    totals = parse_national_totals(text)

    def observations(market: str, coverage: str) -> list[MarketObservation]:
        obs = []
        for year, receipts_attr, arrivals_attr in ((2024, "value_2024", "value_2024"), (2023, "value_2023", "value_2023")):
            rec = receipts_by_market[market].__getattribute__(receipts_attr) if market in receipts_by_market else None
            arr = arrivals_by_market[market].__getattribute__(arrivals_attr) if market in arrivals_by_market else None
            yield_rm = (
                round(rec * 1_000_000 / arr, 2)
                if (coverage == "both" and rec is not None and arr is not None)
                else None
            )
            obs.append(
                MarketObservation(
                    year=year,
                    receipts_rm_million=rec,
                    arrivals_persons=int(arr) if arr is not None else None,
                    receipts_rank=receipts_by_market[market].rank if market in receipts_by_market else None,
                    arrivals_rank=arrivals_by_market[market].rank if market in arrivals_by_market else None,
                    yield_rm_per_visitor=yield_rm,
                )
            )
        return obs

    markets = []
    for market in sorted(
        set(receipts_by_market) | set(arrivals_by_market),
        key=lambda m: (
            receipts_by_market[m].rank if m in receipts_by_market else 99,
            arrivals_by_market[m].rank if m in arrivals_by_market else 99,
        ),
    ):
        coverage = (
            "both"
            if market in receipts_by_market and market in arrivals_by_market
            else "receipts_only" if market in receipts_by_market
            else "arrivals_only"
        )
        markets.append(
            SourceMarketRow(market=market, coverage=coverage, observations=observations(market, coverage))
        )

    national_totals = [
        MarketObservation(
            year=2024,
            receipts_rm_million=totals.receipts_2024,
            arrivals_persons=totals.arrivals_2024,
        ),
        MarketObservation(
            year=2023,
            receipts_rm_million=totals.receipts_2023,
            arrivals_persons=totals.arrivals_2023,
        ),
    ]

    return SourceMarketFragment(
        source_receipts=TextSourceRef(
            file=source_file, table="VISITOR RECEIPTS (RM MILLION)", page=14
        ),
        source_arrivals=TextSourceRef(
            file=source_file, table="COUNTRY OF NATIONALITY (visitor arrivals)", page=11
        ),
        national_totals=national_totals,
        markets=markets,
    )
