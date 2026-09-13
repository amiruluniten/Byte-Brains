"""Slice 1 (red): raw-table parsing of the In Brief 2024 PDF text extract.

pdftotext -layout is the proven extraction path (ticket T3). The committed fixture
tests/fixtures/inbrief2024.fixture.txt is the exact pdftotext output sliced to the
relevant pages (generator: tests/fixtures/make_pdf_fixture.py). Ground-truth values
are the ticket's acceptance numbers.
"""
from pathlib import Path

import pytest

from bytebrains_pipeline.extractors import inbrief_markets


@pytest.fixture(scope="module")
def fixture_text():
    return (Path(__file__).parent / "fixtures" / "inbrief2024.fixture.txt").read_text()


class TestArrivalsTable:
    def test_exactly_twenty_rows(self, fixture_text):
        rows = inbrief_markets.parse_arrivals_table(fixture_text)
        assert len(rows) == 20

    def test_ground_truth_singapore(self, fixture_text):
        rows = inbrief_markets.parse_arrivals_table(fixture_text)
        top = rows[0]
        assert top.rank == 1
        assert top.market == "Singapore"
        assert top.value_2024 == 18_855_680
        assert top.value_2023 == 14_828_553

    def test_markets_in_arrivals_but_not_receipts_are_present(self, fixture_text):
        rows = {r.market for r in inbrief_markets.parse_arrivals_table(fixture_text)}
        assert {"Bangladesh", "Myanmar"} <= rows

    def test_growth_column_is_not_swallowed_into_values(self, fixture_text):
        # "-1.4" (Thailand) and "130.9" (China) live in the growth column
        rows = inbrief_markets.parse_arrivals_table(fixture_text)
        by_market = {r.market: r for r in rows}
        assert by_market["China"].value_2024 == 3_725_894
        assert by_market["Pakistan"].value_2024 == 106_388


class TestReceiptsTable:
    def test_exactly_twenty_rows(self, fixture_text):
        rows = inbrief_markets.parse_receipts_table(fixture_text)
        assert len(rows) == 20

    def test_ground_truth_singapore_and_china(self, fixture_text):
        rows = inbrief_markets.parse_receipts_table(fixture_text)
        by_market = {r.market: r for r in rows}
        assert by_market["Singapore"].value_2024 == 27_941.65
        assert by_market["Singapore"].value_2023 == 21_575.31
        assert by_market["China"].value_2024 == 20_866.57
        assert by_market["China"].value_2023 == 8_881.23

    def test_markets_in_receipts_but_not_arrivals_are_present(self, fixture_text):
        rows = {r.market for r in inbrief_markets.parse_receipts_table(fixture_text)}
        assert {"Canada", "Netherlands"} <= rows

    def test_no_growth_column_in_receipts_table(self, fixture_text):
        rows = inbrief_markets.parse_receipts_table(fixture_text)
        assert all(r.growth is None for r in rows)


class TestNationalTotals:
    def test_national_arrivals_2024_and_2023(self, fixture_text):
        totals = inbrief_markets.parse_national_totals(fixture_text)
        assert totals.arrivals_2024 == 37_961_485
        assert totals.arrivals_2023 == 28_964_308

    def test_national_receipts_2024_and_2023(self, fixture_text):
        totals = inbrief_markets.parse_national_totals(fixture_text)
        assert totals.receipts_2024 == 106_783.11
        assert totals.receipts_2023 == 74_291.56
