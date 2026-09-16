"""Ticket #13 slice C (red): the Missing Billions counterfactual with the 2025
preliminary year, the revised 2024, and the pre-registered headline guard.

In-memory series fixtures following the existing missing-billions test style
(test_missing_billions.py). Real national numbers:

- receipts: Jad 1A totals — 2019-2023 from the TSA 2024 edition, 2024 REVISED to
  RM102,931.3m and 2025 preliminary RM119,312.0m from the TSA 2025 edition;
- arrivals: visitor basis 2019-2025 (2025 = 42,196,892, preliminary);
- CPI: overall annual means, 2025 = 134.625 (2010=100);
- headline basis: the ORIGINAL TSA 2024 edition receipts (2024 = RM102,815.3m),
  the figures the 2020-2024 headline was pre-registered on.

Expected values are hand-computed (same arithmetic as the calculator):
- 2025 real per-visitor = RM2,551.49 (+3.1% vs the 2019 anchor RM2,474.10);
- 2025 real gap = counterfactual - actual = -RM3,265.7m (negative = surplus);
- headline (2020-2024, frozen on the pre-revision basis) = RM10,204.5m;
- supplementary 2020-2025 = headline + 2025 gap = RM6,938.8m.
"""
import pytest
from pydantic import ValidationError

from bytebrains_pipeline.bundle import MacroSeries, MissingBillionsFragment, Observation, Series, SourceRef
from bytebrains_pipeline.missing_billions import compute_missing_billions


CPI_VALUES = [
    (2015, 112.808333), (2016, 115.15), (2017, 119.525), (2018, 120.683333),
    (2019, 121.483333), (2020, 120.1), (2021, 123.075), (2022, 127.233333),
    (2023, 130.4), (2024, 132.791667), (2025, 134.625),
]
ARRIVALS = [
    (2019, 35_045_625), (2020, 6_101_378), (2021, 399_865), (2022, 14_267_416),
    (2023, 28_964_308), (2024, 37_961_485), (2025, 42_196_892),
]
RECEIPTS_REVISED_2025 = [
    (2015, 72_592.5), (2016, 79_325.9), (2017, 82_921.5), (2018, 84_929.9),
    (2019, 86_706.5), (2020, 13_157.3), (2021, 389.8), (2022, 32_473.3),
    (2023, 72_992.8), (2024, 102_931.3), (2025, 119_312.0),
]
RECEIPTS_ORIGINAL_2024 = [
    (2015, 72_592.5), (2016, 79_325.9), (2017, 82_921.5), (2018, 84_929.9),
    (2019, 86_706.5), (2020, 13_157.3), (2021, 389.8), (2022, 32_473.3),
    (2023, 72_992.8), (2024, 102_815.3),
]
EXCURSIONISTS = [
    (2019, 8_944_841), (2020, 1_768_656), (2021, 265_137), (2022, 4_196_452),
    (2023, 8_822_462), (2024, 12_944_787), (2025, 15_583_295),
]


def make_series(series_id, values, unit="persons", basis="visitor", measure="arrivals",
                revision_status_by_year=None):
    # revision_status_by_year: {year: status} — mirrors what the extractors emit
    # (the TSA 2025 workbook's revised 2024 and preliminary 2025, ticket #13)
    status_by_year = revision_status_by_year or {}
    return Series(
        series_id=series_id,
        measure=measure,
        basis=basis,
        unit=unit,
        window=f"{values[0][0]}-{values[-1][0]}",
        source=SourceRef(file="tourism_2025.xlsx", sheet="s", row_label="r", row=1),
        values=[
            Observation(year=y, value=v, revision_status=status_by_year.get(y, "final"))
            for y, v in values
        ],
    )


def make_cpi():
    return MacroSeries(
        series_id="cpi_national_overall_2015_2025",
        measure="cpi",
        unit="index",
        window="2015-2025",
        source={
            "dataset_id": "cpi_headline",
            "title": "Monthly CPI by Division (2-digit), overall",
            "url": "https://storage.dosm.gov.my/cpi/cpi_2d.csv",
            "fetched_utc": "2026-09-13T00:00:00Z",
            "index_base": "2010=100",
        },
        values=[Observation(year=y, value=v) for y, v in CPI_VALUES],
    )


def frag_2025():
    arrivals = make_series(
        "arrivals_visitor_2019_2025", ARRIVALS, revision_status_by_year={2025: "preliminary"}
    )
    receipts = make_series(
        "inbound_consumption_tourist_2015_2025", RECEIPTS_REVISED_2025,
        unit="rm_million", basis="tourist", measure="inbound_tourism_consumption",
        revision_status_by_year={2024: "revised", 2025: "preliminary"},
    )
    headline_basis = make_series(
        "inbound_consumption_tourist_2015_2024", RECEIPTS_ORIGINAL_2024,
        unit="rm_million", basis="tourist", measure="inbound_tourism_consumption",
    )
    cpi = make_cpi()
    excursionists = make_series("arrivals_excursionist_2019_2025", EXCURSIONISTS, basis="excursionist")
    return compute_missing_billions(
        receipts=receipts, arrivals=arrivals, cpi=cpi,
        excursionist_arrivals=excursionists, land_mode_share_2024_pct=66.1,
        headline_basis_receipts=headline_basis,
    )


class TestCounterfactual2025Row:
    def test_years_run_2019_through_2025(self):
        frag = frag_2025()
        assert [y.year for y in frag.years] == list(range(2019, 2026))

    def test_2025_row_hand_computed(self):
        y = next(y for y in frag_2025().years if y.year == 2025)
        assert y.revision_status == "preliminary"
        assert y.visitor_arrivals == 42_196_892
        assert y.receipts_nominal_rm_million == 119_312.0
        assert y.per_visitor_nominal_rm == pytest.approx(2827.506822, abs=1e-4)
        assert y.cpi_index == 134.625
        assert y.cpi_ratio_to_anchor == pytest.approx(1.1081767076640876, abs=1e-9)
        # real per-visitor finally crosses the 2019 anchor: RM2,551.49 (+3.1%)
        assert y.per_visitor_real_2019_rm == pytest.approx(2551.494543, abs=1e-3)
        assert y.per_visitor_real_2019_rm > 2474.103401  # above the 2019 anchor
        assert y.counterfactual_receipts_2019_prices_rm_million == pytest.approx(104399.474006, abs=0.01)
        assert y.actual_receipts_2019_prices_rm_million == pytest.approx(107665.139661, abs=0.01)
        # real gap NEGATIVE: a surplus over the counterfactual (sign convention:
        # positive = missing billions), about -RM3.3 billion
        assert y.gap_2019_prices_rm_million == pytest.approx(-3265.665656, abs=0.01)
        assert y.gap_2019_prices_rm_million < 0

    def test_2025_naive_nominal_twin_is_emitted_negative_and_invalid(self):
        y = next(y for y in frag_2025().years if y.year == 2025)
        assert y.naive_nominal_gap_rm_million == pytest.approx(-14912.525994, abs=0.01)
        assert y.naive_nominal_gap_rm_million < 0

    def test_2024_row_recomputes_from_the_revised_receipts(self):
        y = next(y for y in frag_2025().years if y.year == 2024)
        # the row rests on the restated receipts — flagged, never silent
        assert y.revision_status == "revised"
        assert y.receipts_nominal_rm_million == 102_931.3  # revised (2024 edition: 102,815.3)
        assert y.per_visitor_nominal_rm == pytest.approx(2711.466635, abs=1e-4)
        assert y.actual_receipts_2019_prices_rm_million == pytest.approx(94165.828900, abs=0.01)
        assert y.gap_2019_prices_rm_million == pytest.approx(-245.189757, abs=0.01)

    def test_deflator_metadata_carries_the_2025_cpi_ratio(self):
        frag = frag_2025()
        y2025 = next(y for y in frag.years if y.year == 2025)
        assert frag.deflator.series_id == "cpi_national_overall_2015_2025"
        assert frag.cpi_series_id == "cpi_national_overall_2015_2025"
        # 2025 deflator ratio: overall CPI 134.625 vs the 2019 anchor 121.483333
        assert y2025.cpi_ratio_to_anchor == pytest.approx(134.625 / 121.483333, abs=1e-9)


class TestHeadlineGuard:
    def test_headline_window_stays_2020_2024(self):
        frag = frag_2025()
        assert frag.headline.window == "2020-2024"
        assert frag.headline.prices == "constant_2019_rm"
        assert frag.headline.pre_registered is True

    def test_headline_is_frozen_on_the_pre_revision_basis(self):
        # RM10,204.5m: computed from the ORIGINAL TSA 2024 edition receipts
        # (2024 = RM102,815.3m) the headline was pre-registered on — the 2024
        # revision moves the fragment's 2024 ROW (-RM245.2m), not the headline.
        frag = frag_2025()
        assert frag.headline.cumulative_gap_rm_million == pytest.approx(10_204.479271, abs=0.05)

    def test_supplementary_2020_2025_is_labelled_and_separate(self):
        frag = frag_2025()
        sup = frag.supplementary
        assert sup is not None
        assert sup.window == "2020-2025"
        assert "supplementary" in sup.label.lower()
        # headline (frozen) + the 2025 preliminary gap, ~RM6.9 billion
        assert sup.cumulative_gap_rm_million == pytest.approx(6938.813616, abs=0.05)

    def test_no_supplementary_without_a_year_beyond_2024(self):
        arrivals = make_series("arrivals_visitor_2019_2024", ARRIVALS[:-1])
        receipts = make_series(
            "inbound_consumption_tourist_2015_2024", RECEIPTS_ORIGINAL_2024,
            unit="rm_million", basis="tourist", measure="inbound_tourism_consumption",
        )
        cpi = make_cpi()
        cpi = cpi.model_copy(update={
            "values": [o for o in cpi.values if o.year <= 2024],
            "series_id": "cpi_national_overall_2015_2024",
            "window": "2015-2024",
        })
        excursionists = make_series("arrivals_excursionist_2019_2024", EXCURSIONISTS[:-1], basis="excursionist")
        frag = compute_missing_billions(
            receipts=receipts, arrivals=arrivals, cpi=cpi,
            excursionist_arrivals=excursionists, land_mode_share_2024_pct=66.1,
        )
        assert frag.supplementary is None
        # without a revision, the headline is the fragment's own 2020-2024 sum
        assert frag.headline.cumulative_gap_rm_million == pytest.approx(10_204.479271, abs=0.05)

    def test_model_rejects_any_other_headline_window(self):
        # the guard is in the contract: a fragment claiming a different headline
        # window fails validation, whoever constructs it — including on reload
        frag = frag_2025()
        payload = frag.model_dump(mode="json")
        payload["headline"]["window"] = "2020-2025"
        payload["headline"]["cumulative_gap_rm_million"] = 6938.813616
        with pytest.raises(ValidationError, match="2020-2024"):
            MissingBillionsFragment.model_validate(payload)

    def test_supplementary_cannot_pose_as_the_headline(self):
        frag = frag_2025()
        payload = frag.model_dump(mode="json")
        payload["headline"]["cumulative_gap_rm_million"] = 6938.813616  # moved headline
        payload["supplementary"]["window"] = "2020-2024"  # same window as "headline"
        with pytest.raises(ValidationError, match="headline"):
            MissingBillionsFragment.model_validate(payload)


def test_result_is_deterministic_under_recompute():
    assert frag_2025() == frag_2025()
