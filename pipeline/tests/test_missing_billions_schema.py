"""T4 slice 1 (red): bundle contract for the Missing Billions counterfactual.

Adds two fragment kinds to the seam:
- macro_series: national macro indicators (the CPI deflator series), source = an
  OpenDOSM API download, not an xlsx row, so it carries its own source shape.
- missing_billions: the constant-2019-prices counterfactual, its naive nominal
  invalid twin, and the Volume Trap indicators.
"""
import pytest
from pydantic import ValidationError

from bytebrains_pipeline.bundle import (
    Bundle,
    MacroSeries,
    Series,
    MacroSeriesFragment,
    MacroSource,
    MissingBillionsFragment,
    NationalSeriesFragment,
    Observation,
    SourceRef,
    VolumeTrap,
    CounterfactualYear,
    DeflatorMeta,
)


def make_macro_source(**overrides):
    defaults = dict(
        dataset_id="cpi_headline",
        title="Monthly CPI by Division (2-digit), overall",
        url="https://storage.dosm.gov.my/cpi/cpi_2d.csv",
        fetched_utc="2026-09-13T00:00:00Z",
        index_base="2010=100",
    )
    defaults.update(overrides)
    return MacroSource(**defaults)


def make_macro_series(**overrides):
    defaults = dict(
        series_id="cpi_national_overall_2015_2024",
        measure="cpi",
        unit="index",
        window="2015-2024",
        source=make_macro_source(),
        values=[Observation(year=y, value=100.0 + y) for y in range(2015, 2025)],
    )
    defaults.update(overrides)
    return MacroSeries(**defaults)


def make_deflator(**overrides):
    defaults = dict(
        series_id="cpi_national_overall_2015_2024",
        description="Malaysia national CPI, all items, annual mean of monthly index",
        anchor_year=2019,
        anchor_index=121.483333,
        index_base="2010=100",
        source=make_macro_source(),
    )
    defaults.update(overrides)
    return DeflatorMeta(**defaults)


def make_counterfactual_year(**overrides):
    defaults = dict(
        year=2024,
        visitor_arrivals=37_961_485.0,
        receipts_nominal_rm_million=102_815.3,
        per_visitor_nominal_rm=2708.410906,
        cpi_index=132.791667,
        cpi_ratio_to_anchor=1.093085,
        per_visitor_real_2019_rm=2477.766815,
        actual_receipts_2019_prices_rm_million=94059.707775,
        counterfactual_receipts_2019_prices_rm_million=93920.639143,
        gap_2019_prices_rm_million=-139.068632,
        naive_nominal_gap_rm_million=-8894.660857,
    )
    defaults.update(overrides)
    return CounterfactualYear(**defaults)


def make_volume_trap(**overrides):
    defaults = dict(
        excursionist_share_2019_pct=25.5,
        excursionist_share_2024_pct=34.1,
        excursionist_share_change_pp=8.6,
        land_mode_share_2024_pct=66.1,
        land_mode_share_source="Tourism Malaysia Statistics in Brief 2024, mode of arrival (land 25,080,202 of 37,961,485)",
    )
    defaults.update(overrides)
    return VolumeTrap(**defaults)


def make_missing_billions(**overrides):
    defaults = dict(
        anchor_year=2019,
        prices="constant_2019_rm",
        receipts_series_id="inbound_consumption_tourist_2015_2024",
        arrivals_series_id="arrivals_visitor_2019_2024",
        cpi_series_id="cpi_national_overall_2015_2024",
        deflator=make_deflator(),
        years=[make_counterfactual_year()],
        volume_trap=make_volume_trap(),
    )
    defaults.update(overrides)
    return MissingBillionsFragment(**defaults)


class TestMacroSeriesContract:
    def test_cpi_series_is_its_own_fragment_kind(self):
        frag = MacroSeriesFragment(series=[make_macro_series()])
        assert frag.series[0].measure == "cpi"
        assert frag.series[0].unit == "index"

    def test_macro_series_has_no_counting_basis(self):
        # CPI has no visitor/tourist/excursionist basis; the field must not exist.
        assert "basis" not in MacroSeries.model_fields

    def test_macro_series_years_strictly_ascending(self):
        with pytest.raises(ValidationError):
            make_macro_series(values=[Observation(year=2020, value=1), Observation(year=2019, value=2)])

    def test_macro_series_source_records_fetch_not_xlsx_row(self):
        s = make_macro_series()
        assert s.source.url.startswith("https://")
        assert s.source.fetched_utc
        assert not hasattr(s.source, "row")


class TestMissingBillionsContract:
    def test_prices_are_constant_2019_only(self):
        frag = make_missing_billions()
        assert frag.prices == "constant_2019_rm"
        assert frag.anchor_year == 2019
        with pytest.raises(ValidationError):
            make_missing_billions(prices="nominal_rm")

    def test_naive_nominal_headline_year_must_be_negative(self):
        # Per the data, the naive nominal counterfactual FAILS: nominal per-visitor
        # expenditure rose (RM2,474 -> RM2,708), so the naive gap is negative. A
        # regression that flips this sign must fail loudly at emission AND reload.
        with pytest.raises(ValidationError, match="naive nominal"):
            make_missing_billions(
                years=[make_counterfactual_year(naive_nominal_gap_rm_million=+1.0)]
            )

    def test_counterfactual_year_keeps_real_and_naive_nominal_apart(self):
        y = make_counterfactual_year()
        assert y.gap_2019_prices_rm_million != y.naive_nominal_gap_rm_million
        assert y.per_visitor_real_2019_rm < y.per_visitor_nominal_rm  # deflation bites

    def test_volume_trap_indicators(self):
        vt = make_volume_trap()
        assert vt.excursionist_share_2019_pct == 25.5
        assert vt.excursionist_share_2024_pct == 34.1
        assert vt.excursionist_share_change_pp == pytest.approx(8.6, abs=0.05)
        assert vt.land_mode_share_2024_pct == 66.1
        assert "in Brief 2024" in vt.land_mode_share_source

    def test_fragment_references_its_input_series(self):
        frag = make_missing_billions()
        assert frag.receipts_series_id and frag.arrivals_series_id and frag.cpi_series_id


def _any_series():
    return Series(
        series_id="arrivals_visitor_2019_2024",
        measure="arrivals",
        basis="visitor",
        unit="persons",
        window="2019-2024",
        source=SourceRef(file="tourism_2024.xlsx", sheet="Indicator Inbound", row_label="A1", row=7),
        values=[Observation(year=2024, value=37_961_485)],
    )


class TestBundleUnion:
    def bundle(self, fragments):
        return Bundle(
            schema_version="1.0.0",
            sources={"tourism_2024.xlsx": "deadbeef"},
            fragments=fragments,
        )

    def test_bundle_accepts_new_fragment_kinds(self):
        b = self.bundle(
            {
                "national_series": NationalSeriesFragment(series=[_any_series()]),
                "macro_series": MacroSeriesFragment(series=[make_macro_series()]),
                "missing_billions": make_missing_billions(),
            }
        )
        assert "missing_billions" in b.fragments

    def test_bundle_rejects_arbitrary_fragment_types(self):
        with pytest.raises(ValidationError):
            self.bundle({"national_series": "nope"})

    def test_new_fragments_are_checksummed(self):
        b1 = self.bundle({"missing_billions": make_missing_billions()})
        b2 = self.bundle(
            {
                "missing_billions": make_missing_billions(
                    years=[make_counterfactual_year(gap_2019_prices_rm_million=-139.5)]
                )
            }
        )
        assert b1.checksum != b2.checksum
