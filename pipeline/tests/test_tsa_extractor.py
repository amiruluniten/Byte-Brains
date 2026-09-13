"""Slice 2 (red): the TSA national-series extractor, run offline against fixtures.

Fixtures are miniature versions of the real workbooks (see
tests/fixtures/make_fixtures.py and research/tsa-xlsx-map.md). Ground-truth values
are the ticket's acceptance numbers.
"""
from openpyxl import load_workbook

from bytebrains_pipeline.extractors import tsa_national


def load(fixtures_dir, name):
    return load_workbook(fixtures_dir / name, data_only=True)


class TestIndicatorInbound2024:
    """Visitor basis (2019-2024): A1 visitors, A2 tourists, A3 excursionists."""

    def test_visitor_arrivals_total(self, fixtures_dir):
        wb = load(fixtures_dir, "tourism_2024.fixture.xlsx")
        s = tsa_national.extract_visitor_arrivals(wb)
        assert s.basis == "visitor"
        assert s.unit == "persons"
        assert s.window == "2019-2024"
        assert [(o.year, o.value) for o in s.values] == [
            (2019, 35045625),
            (2020, 6101378),
            (2021, 399865),
            (2022, 14267416),
            (2023, 28964308),
            (2024, 37961485),
        ]

    def test_tourist_arrivals_total(self, fixtures_dir):
        wb = load(fixtures_dir, "tourism_2024.fixture.xlsx")
        s = tsa_national.extract_tourist_arrivals_2024(wb)
        assert s.basis == "tourist"
        assert s.window == "2019-2024"
        assert s.values[0].value == 26100784  # 2019 ground truth

    def test_excursionist_arrivals_total(self, fixtures_dir):
        wb = load(fixtures_dir, "tourism_2024.fixture.xlsx")
        s = tsa_national.extract_excursionist_arrivals(wb)
        assert s.basis == "excursionist"
        assert s.window == "2019-2024"
        assert s.values[0].value == 8944841


class TestIndicatorInbound2023:
    """Tourist basis (2015-2023): A1 tourist arrivals total."""

    def test_tourist_arrivals_total(self, fixtures_dir):
        wb = load(fixtures_dir, "tourism_2023.fixture.xlsx")
        s = tsa_national.extract_tourist_arrivals_2023(wb)
        assert s.basis == "tourist"
        assert s.window == "2015-2023"
        assert [(o.year, o.value) for o in s.values] == [
            (2015, 25721251),
            (2016, 26757392),
            (2017, 25948459),
            (2018, 25832354),
            (2019, 26100784),
            (2020, 4332722),
            (2021, 134728),
            (2022, 10070964),
            (2023, 20141846),
        ]


class TestJad1A:
    """Inbound tourism consumption (tourists) by product, RM million."""

    def test_totals_2015_2024(self, fixtures_dir):
        wb = load(fixtures_dir, "tourism_2024.fixture.xlsx")
        s = tsa_national.extract_inbound_consumption(wb)
        assert s.basis == "tourist"
        assert s.unit == "rm_million"
        assert s.window == "2015-2024"
        assert [(o.year, o.value) for o in s.values] == [
            (2015, 72592.5),
            (2016, 79325.9),
            (2017, 82921.5),
            (2018, 84929.9),
            (2019, 86706.5),
            (2020, 13157.3),
            (2021, 389.8),
            (2022, 32473.3),
            (2023, 72992.8),
            (2024, 102815.3),
        ]

    def test_reads_values_block_not_share_block(self, fixtures_dir):
        # Multi-block sheet: the second "Jumlah/Total" row (row 26, share block) is 100s.
        wb = load(fixtures_dir, "tourism_2024.fixture.xlsx")
        s = tsa_national.extract_inbound_consumption(wb)
        assert all(o.value != 100 for o in s.values)

    def test_revision_flag_parsed_from_year_header(self, fixtures_dir):
        # 2023 file marks the last year "2023p" (preliminary).
        wb = load(fixtures_dir, "tourism_2023.fixture.xlsx")
        s = tsa_national.extract_inbound_consumption(wb)
        assert s.values[-1].year == 2023
        assert s.values[-1].revision_flag == "p"
        assert s.values[-1].value == 72992.8
        assert all(o.revision_flag is None for o in s.values[:-1])


class TestGotchaHelpers:
    def test_footnote_strings_become_null(self, fixtures_dir):
        wb = load(fixtures_dir, "tourism_2024.fixture.xlsx")
        ws = wb["Indicator Inbound"]
        assert tsa_national.to_number(ws["D42"].value) == 4.1  # "4.1*" keeps the number
        assert tsa_national.to_number(ws["E42"].value) is None  # "n.a"

    def test_phantom_columns_truncated(self, fixtures_dir):
        # Real 2024 file reports max_col=16384; extractor must ignore it.
        wb = load(fixtures_dir, "tourism_2024.fixture.xlsx")
        s = tsa_national.extract_visitor_arrivals(wb)
        assert len(s.values) == 6
