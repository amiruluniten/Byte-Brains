"""Ticket #13 slice A (red): bundle schema 1.0.0 -> 1.1.0, additive only.

New in 1.1.0:
- Observation.revision_status vocabulary (final / preliminary / revised) — the
  honest flags for the revised-2024 and preliminary-2025 observations;
- MissingBillionsFragment.headline — the pre-registered headline, guarded to the
  2020-2024 window (a fragment claiming any other headline window fails);
- MissingBillionsFragment.supplementary — the clearly-labelled 2020-2025
  cumulative that may never pose as the headline.

Additive only: a schema-1.0.0-era bundle (no new fields set) still validates, and
existing series identifiers and windows are untouched.
"""
import pytest
from pydantic import ValidationError

from bytebrains_pipeline.bundle import (
    SCHEMA_VERSION,
    Bundle,
    CounterfactualYear,
    HeadlineGap,
    MissingBillionsFragment,
    NationalSeriesFragment,
    Observation,
    SourceRef,
    SupplementaryCumulative,
    Series,
    VolumeTrap,
    DeflatorMeta,
)


def make_series(**overrides):
    defaults = dict(
        series_id="arrivals_visitor_2019_2024",
        measure="arrivals",
        basis="visitor",
        unit="persons",
        window="2019-2024",
        source=SourceRef(file="tourism_2024.xlsx", sheet="Indicator Inbound", row_label="A1", row=7),
        values=[Observation(year=y, value=v) for y, v in [(2019, 35_045_625), (2024, 37_961_485)]],
    )
    defaults.update(overrides)
    return Series(**defaults)


def make_headline(**overrides):
    defaults = dict(
        window="2020-2024",
        prices="constant_2019_rm",
        cumulative_gap_rm_million=10_098.4,
        pre_registered=True,
        basis_note="Pre-registered before the TSA 2025 release was examined.",
    )
    defaults.update(overrides)
    return HeadlineGap(**defaults)


def make_counterfactual_year(**overrides):
    defaults = dict(
        year=2025,
        visitor_arrivals=42_196_892.0,
        receipts_nominal_rm_million=119_312.0,
        per_visitor_nominal_rm=2827.506822,
        cpi_index=134.625,
        cpi_ratio_to_anchor=1.1081767076640876,
        per_visitor_real_2019_rm=2551.494543,
        actual_receipts_2019_prices_rm_million=107_665.139661,
        counterfactual_receipts_2019_prices_rm_million=104_399.474006,
        gap_2019_prices_rm_million=-3265.665656,
        naive_nominal_gap_rm_million=-14912.525994,
        revision_status="preliminary",
    )
    defaults.update(overrides)
    return CounterfactualYear(**defaults)


def make_deflator():
    return DeflatorMeta(
        series_id="cpi_national_overall_2015_2025",
        description="Malaysia national CPI (all items), annual mean",
        anchor_year=2019,
        anchor_index=121.483333,
        index_base="2010=100",
        source={
            "dataset_id": "cpi_headline",
            "title": "Monthly CPI by Division (2-digit), overall",
            "url": "https://storage.dosm.gov.my/cpi/cpi_2d.csv",
            "fetched_utc": "2026-09-13T00:00:00Z",
            "index_base": "2010=100",
        },
    )


def make_volume_trap():
    return VolumeTrap(
        excursionist_share_2019_pct=25.5,
        excursionist_share_2024_pct=34.1,
        excursionist_share_change_pp=8.6,
        land_mode_share_2024_pct=66.1,
        land_mode_share_source="Tourism Malaysia Statistics in Brief 2024",
    )


def make_missing_billions(**overrides):
    defaults = dict(
        anchor_year=2019,
        prices="constant_2019_rm",
        receipts_series_id="inbound_consumption_tourist_2015_2025",
        arrivals_series_id="arrivals_visitor_2019_2025",
        cpi_series_id="cpi_national_overall_2015_2025",
        deflator=make_deflator(),
        years=[make_counterfactual_year()],
        volume_trap=make_volume_trap(),
        headline=make_headline(),
    )
    defaults.update(overrides)
    return MissingBillionsFragment(**defaults)


class TestSchemaVersionBump:
    def test_bundle_defaults_to_schema_1_1_0(self):
        b = Bundle(sources={"f": "x"}, fragments={"national_series": NationalSeriesFragment(series=[make_series()])})
        assert b.schema_version == "1.1.0"
        assert SCHEMA_VERSION == "1.1.0"

    def test_old_1_0_0_bundles_still_validate(self):
        # additive only: a consumer holding a 1.0.0 payload keeps loading it
        b = Bundle(
            schema_version="1.0.0",
            sources={"f": "x"},
            fragments={"national_series": NationalSeriesFragment(series=[make_series()])},
        )
        assert b.schema_version == "1.0.0"


class TestRevisionStatus:
    def test_observation_defaults_to_final(self):
        obs = Observation(year=2024, value=102_815.3)
        assert obs.revision_status == "final"
        assert obs.revision_flag is None

    def test_preliminary_and_revised_are_in_the_vocabulary(self):
        assert Observation(year=2025, value=42_196_892, revision_status="preliminary").revision_status == "preliminary"
        assert Observation(year=2024, value=102_931.3, revision_status="revised").revision_status == "revised"

    def test_unknown_revision_status_rejected(self):
        with pytest.raises(ValidationError):
            Observation(year=2025, value=1, revision_status="guess")


class TestHeadlineGuard:
    def test_headline_window_is_2020_2024(self):
        assert make_headline().window == "2020-2024"

    def test_fragment_claiming_a_different_headline_window_fails(self):
        with pytest.raises(ValidationError, match="2020-2024"):
            make_missing_billions(headline=make_headline(window="2020-2025"))
        with pytest.raises(ValidationError, match="2020-2024"):
            make_missing_billions(headline=make_headline(window="2019-2024"))

    def test_headline_must_be_marked_pre_registered(self):
        with pytest.raises(ValidationError):
            make_headline(pre_registered=False)

    def test_headline_is_constant_2019_prices_only(self):
        with pytest.raises(ValidationError):
            make_headline(prices="nominal_rm")


class TestSupplementaryGuard:
    def test_supplementary_must_be_clearly_labelled(self):
        sup = SupplementaryCumulative(
            window="2020-2025",
            label="Supplementary only: includes the preliminary 2025 year — never the headline",
            cumulative_gap_rm_million=6832.691999,
        )
        assert "supplementary" in sup.label.lower()

    def test_unlabelled_supplementary_fails(self):
        with pytest.raises(ValidationError, match="supplementary"):
            SupplementaryCumulative(
                window="2020-2025",
                label="cumulative gap",
                cumulative_gap_rm_million=6832.691999,
            )

    def test_supplementary_window_must_differ_from_the_headline(self):
        with pytest.raises(ValidationError, match="headline"):
            make_missing_billions(
                supplementary=SupplementaryCumulative(
                    window="2020-2024",
                    label="supplementary",
                    cumulative_gap_rm_million=10_098.4,
                )
            )

    def test_supplementary_window_must_end_at_the_latest_fragment_year(self):
        with pytest.raises(ValidationError, match="latest"):
            make_missing_billions(
                supplementary=SupplementaryCumulative(
                    window="2020-2026",
                    label="supplementary, includes preliminary 2025",
                    cumulative_gap_rm_million=6832.691999,
                )
            )


class TestCounterfactualYear2025:
    def test_year_row_carries_revision_status(self):
        y = make_counterfactual_year()
        assert y.year == 2025
        assert y.revision_status == "preliminary"

    def test_year_row_defaults_to_final(self):
        assert CounterfactualYear(
            year=2024,
            visitor_arrivals=1.0,
            receipts_nominal_rm_million=1.0,
            per_visitor_nominal_rm=1.0,
            cpi_index=1.0,
            cpi_ratio_to_anchor=1.0,
            per_visitor_real_2019_rm=1.0,
            actual_receipts_2019_prices_rm_million=1.0,
            counterfactual_receipts_2019_prices_rm_million=1.0,
            gap_2019_prices_rm_million=0.0,
            naive_nominal_gap_rm_million=-1.0,
        ).revision_status == "final"


class TestFragmentWith2025:
    def test_fragment_validates_with_2025_row_headline_and_supplementary(self):
        frag = make_missing_billions(
            supplementary=SupplementaryCumulative(
                window="2020-2025",
                label="Supplementary only: includes the preliminary 2025 year — never the headline",
                cumulative_gap_rm_million=6832.691999,
            )
        )
        assert frag.years[-1].year == 2025
        assert frag.headline.window == "2020-2024"

    def test_unknown_additions_rejected(self):
        with pytest.raises(ValidationError):
            make_missing_billions(headline_window="2020-2025")
