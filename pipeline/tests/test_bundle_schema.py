"""Slice 1 (red): the versioned, schema-validated data bundle contract.

The bundle is the project's single seam (spec issue #1): the pipeline writes it,
the dashboard reads it. These tests pin the contract, not internals.
"""
import pytest
from pydantic import ValidationError

from bytebrains_pipeline.bundle import (
    Bundle,
    NationalSeriesFragment,
    Observation,
    SourceRef,
    Series,
)


def make_series(**overrides):
    defaults = dict(
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
        values=[Observation(year=y, value=v) for y, v in [(2019, 35_045_625), (2024, 37_961_485)]],
    )
    defaults.update(overrides)
    return Series(**defaults)


class TestSeriesContract:
    def test_visitor_and_tourist_basis_series_are_separate(self):
        visitor = make_series()
        tourist = make_series(
            series_id="arrivals_tourist_2015_2023",
            basis="tourist",
            window="2015-2023",
            values=[Observation(year=2019, value=26_100_784)],
        )
        assert visitor.basis == "visitor"
        assert tourist.basis == "tourist"
        assert visitor.series_id != tourist.series_id

    def test_basis_is_a_closed_vocabulary(self):
        with pytest.raises(ValidationError):
            make_series(basis="overnight")

    def test_basis_must_match_series_id_window_label(self):
        # counting-basis discipline: the window (tourist-basis 2015-2023,
        # visitor-basis 2019-2024) must be stated in both id and window field.
        with pytest.raises(ValidationError):
            make_series(window="2015-2023")

    def test_years_strictly_ascending_no_duplicates(self):
        with pytest.raises(ValidationError):
            make_series(values=[Observation(year=2019, value=1), Observation(year=2019, value=2)])
        with pytest.raises(ValidationError):
            make_series(values=[Observation(year=2021, value=1), Observation(year=2020, value=2)])

    def test_observation_may_carry_revision_flag(self):
        obs = Observation(year=2023, value=72_992.8, revision_flag="p")
        assert obs.revision_flag == "p"

    def test_unit_is_a_closed_vocabulary(self):
        with pytest.raises(ValidationError):
            make_series(unit="ringgit")


class TestFragmentContract:
    def test_national_series_fragment_holds_series(self):
        frag = NationalSeriesFragment(series=[make_series()])
        assert frag.series[0].measure == "arrivals"

    def test_series_ids_unique_within_fragment(self):
        with pytest.raises(ValidationError):
            NationalSeriesFragment(series=[make_series(), make_series()])


class TestBundleContract:
    def bundle(self, frag):
        return Bundle(
            schema_version="1.0.0",
            sources={"tourism_2024.xlsx": "deadbeef"},
            fragments={"national_series": frag},
        )

    def test_bundle_is_versioned(self):
        b = self.bundle(NationalSeriesFragment(series=[make_series()]))
        assert b.bundle_version == 1
        assert b.schema_version == "1.0.0"

    def test_schema_version_is_semver(self):
        with pytest.raises(ValidationError):
            Bundle(bundle_version=1, schema_version="latest", sources={}, fragments={})

    def test_unknown_fragments_rejected(self):
        with pytest.raises(ValidationError):
            self.bundle(None)  # type: ignore[arg-type]

    def test_checksum_is_stable_and_covers_fragments(self):
        b1 = self.bundle(NationalSeriesFragment(series=[make_series()]))
        b2 = self.bundle(NationalSeriesFragment(series=[make_series()]))
        assert b1.checksum == b2.checksum
        assert len(b1.checksum) == 64
        changed = self.bundle(
            NationalSeriesFragment(
                series=[make_series(values=[Observation(year=2019, value=35_045_626)])]
            )
        )
        assert changed.checksum != b1.checksum

    def test_round_trips_through_json(self):
        b = self.bundle(NationalSeriesFragment(series=[make_series()]))
        payload = b.to_json()
        assert Bundle.model_validate_json(payload) == b
