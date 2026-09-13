"""Slice 2 (red): the source_market fragment contract.

Every market states its coverage explicitly ("both" / "arrivals_only" /
"receipts_only"); a market missing from one table is null, never silently zeroed.
Derived yield is receipts (RM million x 1e6) / arrivals, only where both exist.
"""
import pytest
from pydantic import ValidationError

from bytebrains_pipeline.bundle import (
    MarketObservation,
    SourceMarketFragment,
    SourceMarketRow,
    SourceRef,
)


def make_row(**overrides):
    defaults = dict(
        market="Singapore",
        coverage="both",
        observations=[
            MarketObservation(
                year=2024,
                receipts_rank=1,
                arrivals_rank=1,
                receipts_rm_million=27_941.65,
                arrivals_persons=18_855_680,
                yield_rm_per_visitor=1481.87,
            ),
            MarketObservation(
                year=2023,
                receipts_rank=1,
                arrivals_rank=1,
                receipts_rm_million=21_575.31,
                arrivals_persons=14_828_553,
                yield_rm_per_visitor=1454.98,
            ),
        ],
    )
    defaults.update(overrides)
    return SourceMarketRow(**defaults)


def make_fragment(markets=None, **overrides):
    defaults = dict(
        source_receipts={"file": "inbrief2024.txt", "table": "VISITOR RECEIPTS (RM MILLION)", "page": 14},
        source_arrivals={"file": "inbrief2024.txt", "table": "COUNTRY OF NATIONALITY (visitor arrivals)", "page": 11},
        national_totals=[
            MarketObservation(year=2024, receipts_rm_million=106_783.11, arrivals_persons=37_961_485),
            MarketObservation(year=2023, receipts_rm_million=74_291.56, arrivals_persons=28_964_308),
        ],
        markets=markets if markets is not None else [make_row()],
    )
    defaults.update(overrides)
    return SourceMarketFragment(**defaults)


class TestSourceMarketRow:
    def test_coverage_is_a_closed_vocabulary(self):
        with pytest.raises(ValidationError):
            make_row(coverage="missing")

    def test_arrivals_only_market_has_null_receipts_and_yield(self):
        row = make_row(
            market="Bangladesh",
            coverage="arrivals_only",
            observations=[
                MarketObservation(year=2024, arrivals_rank=17, arrivals_persons=154_596),
                MarketObservation(year=2023, arrivals_rank=17, arrivals_persons=153_093),
            ],
        )
        assert all(o.receipts_rm_million is None and o.yield_rm_per_visitor is None for o in row.observations)

    def test_silent_zeroing_is_forbidden(self):
        # a market absent from the receipts table must be None, not 0.0
        with pytest.raises(ValidationError):
            make_row(
                market="Bangladesh",
                coverage="arrivals_only",
                observations=[
                    MarketObservation(year=2024, arrivals_rank=17, arrivals_persons=154_596, receipts_rm_million=0.0),
                ],
            )

    def test_receipts_only_market_has_null_arrivals(self):
        row = make_row(
            market="Canada",
            coverage="receipts_only",
            observations=[
                MarketObservation(year=2024, receipts_rank=19, receipts_rm_million=525.27),
            ],
        )
        assert row.observations[0].arrivals_persons is None

    def test_coverage_must_match_values(self):
        with pytest.raises(ValidationError):
            make_row(coverage="arrivals_only")  # but the observations carry receipts


class TestSourceMarketFragment:
    def test_years_are_2023_and_2024_only(self):
        with pytest.raises(ValidationError):
            make_fragment(
                markets=[
                    make_row(observations=[MarketObservation(year=2021, receipts_rm_million=1.0, arrivals_persons=1)]),
                    make_row(market="China"),
                ]
            )

    def test_markets_unique(self):
        with pytest.raises(ValidationError):
            make_fragment(markets=[make_row(), make_row()])

    def test_yield_must_match_receipts_over_arrivals(self):
        with pytest.raises(ValidationError):
            make_fragment(
                markets=[
                    make_row(
                        observations=[
                            MarketObservation(
                                year=2024,
                                receipts_rank=1,
                                arrivals_rank=1,
                                receipts_rm_million=27_941.65,
                                arrivals_persons=18_855_680,
                                yield_rm_per_visitor=9999.0,
                            )
                        ]
                    )
                ]
            )

    def test_valid_fragment_round_trips_through_json(self):
        frag = make_fragment()
        assert SourceMarketFragment.model_validate_json(frag.model_dump_json()) == frag

    def test_bundle_accepts_both_fragment_kinds(self):
        from bytebrains_pipeline.bundle import Bundle, NationalSeriesFragment, Observation, Series

        national = NationalSeriesFragment(
            series=[
                Series(
                    series_id="arrivals_visitor_2019_2024",
                    measure="arrivals",
                    basis="visitor",
                    unit="persons",
                    window="2019-2024",
                    source=SourceRef(
                        file="tourism_2024.xlsx",
                        sheet="Indicator Inbound",
                        row_label="A1. Visitor arrivals to Malaysia",
                        row=7,
                    ),
                    values=[Observation(year=2024, value=37_961_485)],
                )
            ]
        )
        bundle = Bundle(
            sources={"inbrief2024.txt": "deadbeef"},
            fragments={"national_series": national, "source_market": make_fragment()},
        )
        reloaded = Bundle.model_validate_json(bundle.to_json())
        assert "source_market" in reloaded.fragments
