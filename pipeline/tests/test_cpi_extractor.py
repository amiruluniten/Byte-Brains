"""T4 slice 2 (red): the CPI deflator extractor.

The deflator is sourced from DOSM's OpenDOSM CPI (dataset cpi_headline, overall
division), downloaded with tools/dosm-cli and recorded as a raw CSV — no network in
tests, recorded-fixture pattern like every other extractor.
"""
from pathlib import Path

import pytest

from bytebrains_pipeline.extractors import cpi

FIXTURE = Path(__file__).parent / "fixtures" / "cpi_headline.fixture.csv"


def test_extracts_annual_means_from_monthly_index():
    series = cpi.extract_cpi(FIXTURE)
    assert series.series_id == "cpi_national_overall_2015_2024"
    assert series.measure == "cpi"
    assert series.unit == "index"
    assert series.window == "2015-2024"
    assert [o.year for o in series.values] == list(range(2015, 2025))


def test_hand_computed_annual_means():
    # 2019 monthly overall index from the recorded fixture sums to 1457.8;
    # 12-month mean = 121.483333 (DOSM CPI, 2010=100).
    series = cpi.extract_cpi(FIXTURE)
    by_year = {o.year: o.value for o in series.values}
    assert by_year[2019] == pytest.approx(121.483333, abs=1e-5)
    # 2024 monthly index sums to 1593.5 -> mean 132.791667
    assert by_year[2024] == pytest.approx(132.791667, abs=1e-5)
    # 2015 monthly index sums to 1353.7 -> mean 112.808333
    assert by_year[2015] == pytest.approx(112.808333, abs=1e-5)


def test_source_documents_dataset_and_fetch_date():
    series = cpi.extract_cpi(FIXTURE)
    src = series.source
    assert src.dataset_id == "cpi_headline"
    assert src.title and "CPI" in src.title
    assert src.url == "https://storage.dosm.gov.my/cpi/cpi_2d.csv"
    assert src.fetched_utc[:4] == "2026"
    assert src.index_base == "2010=100"


def test_extended_2025_window_is_additive():
    # ticket #13: window_end=2025 emits the additive extended series; the
    # default call still reproduces the 2015-2024 series exactly.
    extended = cpi.extract_cpi(FIXTURE, window_end=2025)
    assert extended.series_id == "cpi_national_overall_2015_2025"
    assert extended.window == "2015-2025"
    assert [o.year for o in extended.values] == list(range(2015, 2026))
    by_year = {o.year: o.value for o in extended.values}
    assert by_year[2025] == pytest.approx(134.625, abs=1e-5)  # annual mean, 12 months
    # the pre-2025 years are unchanged by the extension
    base = cpi.extract_cpi(FIXTURE)
    assert extended.values[:-1] == base.values


def test_extended_window_fails_loudly_when_2025_missing(tmp_path):
    partial = tmp_path / "cpi.csv"
    lines = FIXTURE.read_text().splitlines()
    partial.write_text("\n".join(l for l in lines if not l.startswith("2025")) + "\n")
    with pytest.raises(ValueError, match="2025"):
        cpi.extract_cpi(partial, window_end=2025)


def test_non_overall_divisions_are_ignored():
    series = cpi.extract_cpi(FIXTURE)
    assert all(o.value is not None for o in series.values)
