"""The Missing Billions calculator (ticket T4).

Counterfactual: receipts if real per-visitor expenditure had held at its 2019 level,
computed in CONSTANT 2019 PRICES ONLY, deflated by the national CPI:

    per_visitor_nominal(year)     = receipts(year) / visitor_arrivals(year)      [RM]
    per_visitor_real(year)        = per_visitor_nominal(year) / (CPI(year)/CPI(2019))
    counterfactual_receipts(year) = visitor_arrivals(year) x per_visitor_real(2019)  [2019 prices]
    actual_receipts_real(year)    = receipts(year) / (CPI(year)/CPI(2019))           [2019 prices]
    gap(year)                     = counterfactual - actual                          [2019 prices]
                                    (positive = missing billions)

The naive nominal twin (same arithmetic without the CPI deflation) is emitted next to
the real gap and flagged INVALID: it compares ringgit of different years. Per the
data it shows a false "surplus" — nominal per-visitor expenditure rose from RM2,474
(2019) — and the fragment contract asserts that negative sign loudly so the real-terms
path cannot regress silently.

Basis note: the receipts series is the TSA inbound tourism consumption (tourist
basis, Jad 1A); the ticket's headline per-visitor figures pair it with visitor-basis
arrivals. The pairing is stated in the fragment, never silently mixed elsewhere.
"""
from __future__ import annotations

from .bundle import (
    CounterfactualYear,
    DeflatorMeta,
    HeadlineGap,
    MacroSeries,
    MissingBillionsFragment,
    Series,
    SupplementaryCumulative,
    VolumeTrap,
)

# The pre-registered headline window (fixed before the TSA 2025 release was
# examined — ticket #13). The model layer rejects any other headline window.
HEADLINE_WINDOW = "2020-2024"
HEADLINE_YEARS = range(2020, 2025)

LAND_MODE_SHARE_2024_PCT = 66.1
LAND_MODE_SOURCE = (
    "Tourism Malaysia Statistics in Brief 2024, mode of arrival "
    "(land 25,080,202 of 37,961,485 visitor arrivals, 2024)"
)


def _value(series: Series | MacroSeries, year: int) -> float:
    for obs in series.values:
        if obs.year == year and obs.value is not None:
            return obs.value
    raise ValueError(f"series {series.series_id!r}: missing value for year {year}")


def _per_visitor_nominal(receipts: Series, arrivals: Series, year: int) -> float:
    receipts_rm = _value(receipts, year) * 1_000_000.0  # rm_million -> rm
    return receipts_rm / _value(arrivals, year)


_REVISION_RANK = {"final": 0, "revised": 1, "preliminary": 2}


def _row_revision_status(year: int, *series: "Series | MacroSeries") -> str:
    """The counterfactual row inherits the most provisional status of the data
    behind it (ticket #13): a year whose receipts were revised by a later
    workbook is "revised"; a year the release marks preliminary is
    "preliminary" — never silently presented as final."""
    statuses = [
        obs.revision_status
        for s in series
        for obs in s.values
        if obs.year == year and obs.revision_status != "final"
    ]
    return max(statuses, key=lambda s: _REVISION_RANK[s], default="final")


def _year_row(
    year: int,
    receipts: Series,
    arrivals: Series,
    cpi: MacroSeries,
    anchor_year: int,
    per_visitor_real_anchor: float,
) -> CounterfactualYear:
    cpi_year = _value(cpi, year)
    cpi_anchor = _value(cpi, anchor_year)
    ratio = cpi_year / cpi_anchor
    nominal_pcv = _per_visitor_nominal(receipts, arrivals, year)
    real_pcv = nominal_pcv / ratio
    visitor_arrivals = _value(arrivals, year)
    counterfactual = visitor_arrivals * per_visitor_real_anchor / 1_000_000.0  # rm_million
    actual_real = _value(receipts, year) / ratio
    naive_nominal = visitor_arrivals * (per_visitor_real_anchor * 1.0) / 1_000_000.0 - _value(
        receipts, year
    )
    # the naive twin holds NOMINAL 2019 per-visitor expenditure (equal to its real value
    # in 2019 prices, since 2019 is the base) and compares against nominal receipts
    return CounterfactualYear(
        year=year,
        visitor_arrivals=visitor_arrivals,
        receipts_nominal_rm_million=_value(receipts, year),
        per_visitor_nominal_rm=nominal_pcv,
        cpi_index=cpi_year,
        cpi_ratio_to_anchor=ratio,
        per_visitor_real_2019_rm=real_pcv,
        actual_receipts_2019_prices_rm_million=actual_real,
        counterfactual_receipts_2019_prices_rm_million=counterfactual,
        gap_2019_prices_rm_million=counterfactual - actual_real,
        naive_nominal_gap_rm_million=naive_nominal,
        revision_status=_row_revision_status(year, receipts, arrivals, cpi),
    )


def compute_missing_billions(
    receipts: Series,
    arrivals: Series,
    cpi: MacroSeries,
    excursionist_arrivals: Series | None,
    land_mode_share_2024_pct: float | None,
    anchor_year: int = 2019,
    headline_basis_receipts: Series | None = None,
) -> MissingBillionsFragment:
    """Compute the constant-2019-prices counterfactual over the shared years of the
    three series (the anchor year through the latest arrivals year).

    Ticket #13: the emitted fragment always carries the PRE-REGISTERED headline
    (2020-2024, constant 2019 prices). By default the headline is the sum of the
    fragment's own 2020-2024 rows. When the receipts series carries a LATER
    workbook's revision of a headline year (the TSA 2025 workbook restates 2024),
    pass the ORIGINAL workbook's series as `headline_basis_receipts`: the
    headline is then computed from the figures it was pre-registered on and
    frozen, while the year rows above recompute from the latest official data.
    When the fragment extends beyond 2024, the cumulative through the latest
    year is also emitted as a clearly-labelled SUPPLEMENTARY figure — never the
    headline (the headline guard rejects any other headline window).
    """
    arrival_years = {o.year for o in arrivals.values}
    receipt_years = {o.year for o in receipts.values if o.value is not None}
    cpi_years = {o.year for o in cpi.values}
    missing_receipts = sorted(arrival_years - receipt_years)
    missing_cpi = sorted(arrival_years - cpi_years)
    if missing_receipts or missing_cpi:
        # never shrink the counterfactual window silently: a coverage gap is a loud error
        raise ValueError(
            f"series coverage gap: arrivals years missing from "
            f"receipts {missing_receipts} / CPI {missing_cpi}"
        )
    common_years = sorted(arrival_years)
    if not common_years:
        raise ValueError("no common years between receipts, arrivals and CPI series")
    if anchor_year not in common_years:
        raise ValueError(f"anchor year {anchor_year} missing from the series overlap")

    per_visitor_real_anchor = _per_visitor_nominal(receipts, arrivals, anchor_year)  # 2019 base
    years = [
        _year_row(y, receipts, arrivals, cpi, anchor_year, per_visitor_real_anchor)
        for y in common_years
    ]

    deflator = DeflatorMeta(
        series_id=cpi.series_id,
        description=(
            "Malaysia national CPI (all items), annual mean of the monthly index — "
            "the deflator for the constant-2019-prices counterfactual"
        ),
        anchor_year=anchor_year,
        anchor_index=_value(cpi, anchor_year),
        index_base=cpi.source.index_base,
        source=cpi.source,
    )

    volume_trap = _volume_trap(arrivals, excursionist_arrivals, land_mode_share_2024_pct)

    # ticket #13: the pre-registered headline. When a headline-basis receipts
    # series is given (the workbook the headline was pre-registered on), the
    # headline years are recomputed against THAT series and frozen; the year
    # rows above carry the latest official (possibly revised) figures.
    if headline_basis_receipts is not None:
        headline_rows = [
            _year_row(y, headline_basis_receipts, arrivals, cpi, anchor_year, per_visitor_real_anchor)
            for y in HEADLINE_YEARS
        ]
    else:
        headline_rows = [y for y in years if y.year in HEADLINE_YEARS]
    headline_gap = sum(r.gap_2019_prices_rm_million for r in headline_rows)
    headline = HeadlineGap(
        window=HEADLINE_WINDOW,
        prices="constant_2019_rm",
        cumulative_gap_rm_million=headline_gap,
        pre_registered=True,
        basis_note=(
            "Pre-registered headline: window fixed before the TSA 2025 release was "
            "examined (no result-shopping), constant 2019 prices. Computed from the "
            "TSA 2024 edition receipts the headline was registered on; the year rows "
            "above recompute from the latest official workbook."
        ),
    )

    # ticket #13: the cumulative through the latest (preliminary) year may appear
    # only as a clearly-labelled supplementary figure — never as the headline.
    latest = years[-1]
    supplementary = None
    if latest.year > 2024:
        supplementary = SupplementaryCumulative(
            window=f"2020-{latest.year}",
            label=(
                f"Supplementary only: cumulative real gap 2020-{latest.year} includes the "
                f"preliminary {latest.year} year — never quote it as the headline"
            ),
            cumulative_gap_rm_million=headline_gap + latest.gap_2019_prices_rm_million,
        )

    return MissingBillionsFragment(
        anchor_year=anchor_year,
        prices="constant_2019_rm",
        receipts_series_id=receipts.series_id,
        arrivals_series_id=arrivals.series_id,
        cpi_series_id=cpi.series_id,
        deflator=deflator,
        years=years,
        volume_trap=volume_trap,
        headline=headline,
        supplementary=supplementary,
    )


def _volume_trap(
    arrivals: Series,
    excursionist_arrivals: Series | None,
    land_mode_share_2024_pct: float | None,
) -> VolumeTrap:
    def share(year: int) -> tuple[float, float]:
        total = _value(arrivals, year)
        if excursionist_arrivals is None:
            raise ValueError(
                "Volume Trap indicators need the excursionist arrivals series "
                "(share drift is the measurement critique)"
            )
        return _value(excursionist_arrivals, year) / total * 100.0, total

    share_2019, _ = share(2019)
    share_2024, _ = share(2024)
    if land_mode_share_2024_pct is None:
        raise ValueError(
            "land-mode share (2024) is a required Volume Trap indicator; "
            "hand-extract it from the In Brief 2024 mode-of-arrival table"
        )
    return VolumeTrap(
        excursionist_share_2019_pct=round(share_2019, 1),
        excursionist_share_2024_pct=round(share_2024, 1),
        excursionist_share_change_pp=round(share_2024 - share_2019, 1),
        land_mode_share_2024_pct=land_mode_share_2024_pct,
        land_mode_share_source=LAND_MODE_SOURCE,
    )
