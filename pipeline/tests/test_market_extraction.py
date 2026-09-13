"""Slice 3 (red): In Brief source-market extraction into the bundle fragment,
with ground-truth spot checks and the national reconciliation (ticket T3).
"""
from pathlib import Path

import pytest

from bytebrains_pipeline.bundle import Bundle
from bytebrains_pipeline.extractors import inbrief_markets
from bytebrains_pipeline.validate import check_market_ground_truths


@pytest.fixture(scope="module")
def fixture_text():
    return (Path(__file__).parent / "fixtures" / "inbrief2024.fixture.txt").read_text()


@pytest.fixture(scope="module")
def fragment(fixture_text):
    return inbrief_markets.build_source_market_fragment(fixture_text)


class TestFragment:
    def test_markets_are_the_union_of_both_top20_tables(self, fragment):
        both = [m for m in fragment.markets if m.coverage == "both"]
        arrivals_only = [m for m in fragment.markets if m.coverage == "arrivals_only"]
        receipts_only = [m for m in fragment.markets if m.coverage == "receipts_only"]
        # union of two top-20 tables: 18 markets in both, 2+2 single-table only
        assert len(both) + len(arrivals_only) + len(receipts_only) == 22
        assert len(both) == 18
        assert {m.market for m in arrivals_only} == {"Bangladesh", "Myanmar"}
        assert {m.market for m in receipts_only} == {"Canada", "Netherlands"}

    def test_ground_truth_singapore_receipts_arrivals_yield(self, fragment):
        sg = next(m for m in fragment.markets if m.market == "Singapore")
        obs24 = sg.observations[0]
        assert obs24.year == 2024
        assert obs24.receipts_rm_million == 27_941.65
        assert obs24.arrivals_persons == 18_855_680
        assert abs(obs24.yield_rm_per_visitor - 1481.87) <= 0.01
        assert sg.observations[1].year == 2023

    def test_ground_truth_china_receipts(self, fragment):
        cn = next(m for m in fragment.markets if m.market == "China")
        assert cn.observations[0].receipts_rm_million == 20_866.57
        assert cn.observations[0].arrivals_persons == 3_725_894

    def test_arrivals_only_markets_carry_no_receipts_no_zero(self, fragment):
        for row in fragment.markets:
            if row.coverage == "arrivals_only":
                assert all(o.receipts_rm_million is None for o in row.observations)
                assert all(o.arrivals_persons is not None for o in row.observations)

    def test_national_totals_emitted(self, fragment):
        obs24 = next(o for o in fragment.national_totals if o.year == 2024)
        assert obs24.receipts_rm_million == 106_783.11
        assert obs24.arrivals_persons == 37_961_485

    def test_sources_are_stated(self, fragment):
        assert fragment.source_receipts.file == "inbrief2024.txt"
        assert fragment.source_receipts.table == "VISITOR RECEIPTS (RM MILLION)"
        assert fragment.source_arrivals.table.startswith("COUNTRY OF NATIONALITY")


class TestMarketGroundTruths:
    def make_bundle(self, fragment, national_2024=37_961_485):
        from bytebrains_pipeline.bundle import (
            NationalSeriesFragment,
            Observation,
            Series,
            SourceRef,
        )

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
                    values=[Observation(year=2024, value=national_2024)],
                )
            ]
        )
        return Bundle(
            sources={"inbrief2024.txt": "deadbeef"},
            fragments={"national_series": national, "source_market": fragment},
        )

    def test_ground_truths_pass(self, fragment):
        report = check_market_ground_truths(self.make_bundle(fragment))
        assert any("Singapore" in line for line in report)
        assert any("2,813" in line or "2813" in line for line in report)

    def test_national_reconciliation_uses_tsa_arrivals(self, fragment):
        # In Brief national arrivals must equal the TSA national series (consistency)
        with pytest.raises(SystemExit, match="consistency"):
            check_market_ground_truths(self.make_bundle(fragment, national_2024=37_000_000))

    def test_corrupted_receipt_is_loud(self, fragment):
        fragment.markets[0].observations[0].receipts_rm_million = 99_999.99
        with pytest.raises(SystemExit, match="ground-truth"):
            check_market_ground_truths(self.make_bundle(fragment))
