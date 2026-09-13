"""T4 slice 3 (red): the Missing Billions counterfactual calculator.

Hand-computed validation cases, both on a trivial synthetic vector and on the real
2019-vs-2024 national numbers. Constant 2019 prices ONLY; the naive nominal gap is
emitted next to the real gap, flagged invalid, and asserted negative at the latest
year (per the data it shows a false "surplus" — nominal per-visitor expenditure rose).
"""
import pytest

from bytebrains_pipeline.bundle import MacroSeries, MissingBillionsFragment, Observation, Series, SourceRef
from bytebrains_pipeline.missing_billions import compute_missing_billions


def make_series(series_id, values, unit="persons", basis="visitor", measure="arrivals"):
    return Series(
        series_id=series_id,
        measure=measure,
        basis=basis,
        unit=unit,
        window=f"{values[0][0]}-{values[-1][0]}",
        source=SourceRef(file="tourism_2024.xlsx", sheet="s", row_label="r", row=1),
        values=[Observation(year=y, value=v) for y, v in values],
    )


def make_cpi(values):
    return MacroSeries(
        series_id=f"cpi_national_overall_{values[0][0]}_{values[-1][0]}",
        measure="cpi",
        unit="index",
        window=f"{values[0][0]}-{values[-1][0]}",
        source={
            "dataset_id": "cpi_headline",
            "title": "Monthly CPI by Division (2-digit), overall",
            "url": "https://storage.dosm.gov.my/cpi/cpi_2d.csv",
            "fetched_utc": "2026-09-13T00:00:00Z",
            "index_base": "2010=100",
        },
        values=[Observation(year=y, value=v) for y, v in values],
    )


# Trivial synthetic world: anchor 2019, CPI 100 -> 110 (+10% prices).
# 2019: 1,000 visitors spend RM1.0m -> RM1,000/visitor.
# 2024: 2,000 visitors, RM2.4m -> RM1,200/visitor nominal (naive gap negative, like the real data).
SYNTHETIC_ARRIVALS = [(2019, 1_000), (2024, 2_000)]
SYNTHETIC_RECEIPTS = [(2019, 1.0), (2024, 2.4)]  # rm_million
SYNTHETIC_CPI = [(2019, 100.0), (2024, 110.0)]


def test_synthetic_hand_computed():
    arrivals = make_series("arrivals_visitor_2019_2024", SYNTHETIC_ARRIVALS)
    receipts = make_series(
        "inbound_consumption_tourist_2019_2024", SYNTHETIC_RECEIPTS,
        unit="rm_million", basis="tourist", measure="inbound_tourism_consumption",
    )
    cpi = make_cpi(SYNTHETIC_CPI)

    excursionists = make_series(
        "arrivals_excursionist_2019_2024", [(2019, 255), (2024, 680)], basis="excursionist"
    )
    frag = compute_missing_billions(
        receipts=receipts, arrivals=arrivals, cpi=cpi,
        excursionist_arrivals=excursionists, land_mode_share_2024_pct=60.0,
    )

    y2024 = next(y for y in frag.years if y.year == 2024)
    # nominal per-visitor 2024 = 2.4m / 2,000 = RM1,200
    assert y2024.per_visitor_nominal_rm == pytest.approx(1200.0)
    # real per-visitor 2024 = 1200 / 1.1 = 1090.9091 (2019 prices); 2019 real = 1000
    assert y2024.per_visitor_real_2019_rm == pytest.approx(1090.9091, abs=1e-3)
    # counterfactual = 2,000 visitors x RM1,000 (2019 real) = RM2.0m (2019 prices)
    assert y2024.counterfactual_receipts_2019_prices_rm_million == pytest.approx(2.0, abs=1e-9)
    # actual in 2019 prices = 2.4 / 1.1 = 2.1818
    assert y2024.actual_receipts_2019_prices_rm_million == pytest.approx(2.181818, abs=1e-4)
    # real gap = 2.0 - 2.1818 = -0.1818 (no missing billions here: real pcv rose)
    assert y2024.gap_2019_prices_rm_million == pytest.approx(-0.181818, abs=1e-4)
    # naive nominal gap = 2.0 - 2.4 = -0.4 (negative: nominal flatters receipts)
    assert y2024.naive_nominal_gap_rm_million == pytest.approx(-0.4, abs=1e-9)


def test_anchor_year_gap_is_zero_by_construction():
    arrivals = make_series("arrivals_visitor_2019_2024", SYNTHETIC_ARRIVALS)
    receipts = make_series(
        "inbound_consumption_tourist_2019_2024", SYNTHETIC_RECEIPTS,
        unit="rm_million", basis="tourist", measure="inbound_tourism_consumption",
    )
    cpi = make_cpi(SYNTHETIC_CPI)
    excursionists = make_series(
        "arrivals_excursionist_2019_2024", [(2019, 255), (2024, 680)], basis="excursionist"
    )
    frag = compute_missing_billions(
        receipts=receipts, arrivals=arrivals, cpi=cpi,
        excursionist_arrivals=excursionists, land_mode_share_2024_pct=60.0,
    )
    y2019 = frag.years[0]
    assert y2019.year == 2019
    assert y2019.gap_2019_prices_rm_million == pytest.approx(0.0, abs=1e-9)
    assert y2019.naive_nominal_gap_rm_million == pytest.approx(0.0, abs=1e-9)
    assert y2019.cpi_ratio_to_anchor == pytest.approx(1.0)


# Real national numbers (ticket T4): 2019 nominal RM2,474/visitor, 2024 RM2,708
# (Jad 1A basis; the In Brief RM2,813 variant reconciles in ticket T3).
REAL_ARRIVALS = [(2019, 35_045_625), (2024, 37_961_485)]
REAL_RECEIPTS = [(2019, 86_706.5), (2024, 102_815.3)]  # rm_million, Jad 1A
REAL_CPI = [(2019, 121.483333), (2024, 132.791667)]


def real_frag():
    arrivals = make_series("arrivals_visitor_2019_2024", REAL_ARRIVALS)
    receipts = make_series(
        "inbound_consumption_tourist_2019_2024", REAL_RECEIPTS,
        unit="rm_million", basis="tourist", measure="inbound_tourism_consumption",
    )
    cpi = make_cpi(REAL_CPI)
    excursionists = make_series(
        "arrivals_excursionist_2019_2024", [(2019, 8_944_841), (2024, 12_944_787)],
        basis="excursionist",
    )
    return compute_missing_billions(
        receipts=receipts, arrivals=arrivals, cpi=cpi,
        excursionist_arrivals=excursionists, land_mode_share_2024_pct=66.1,
    )


def test_real_2024_hand_computed():
    frag = real_frag()
    y2024 = next(y for y in frag.years if y.year == 2024)
    assert y2024.per_visitor_nominal_rm == pytest.approx(2708.410906, abs=1e-4)
    assert y2024.cpi_ratio_to_anchor == pytest.approx(1.093085, abs=1e-5)
    assert y2024.per_visitor_real_2019_rm == pytest.approx(2477.766815, abs=1e-3)
    assert y2024.counterfactual_receipts_2019_prices_rm_million == pytest.approx(93920.639143, abs=0.01)
    assert y2024.actual_receipts_2019_prices_rm_million == pytest.approx(94059.707775, abs=0.01)
    assert y2024.gap_2019_prices_rm_million == pytest.approx(-139.068632, abs=0.01)
    # the naive nominal twin: NEGATIVE per the data — a regression must be loud
    assert y2024.naive_nominal_gap_rm_million == pytest.approx(-8894.660857, abs=0.01)
    assert y2024.naive_nominal_gap_rm_million < 0


def test_real_2019_hand_computed():
    frag = real_frag()
    y2019 = frag.years[0]
    assert y2019.per_visitor_nominal_rm == pytest.approx(2474.103401, abs=1e-4)
    assert y2019.per_visitor_real_2019_rm == pytest.approx(2474.103401, abs=1e-4)
    assert y2019.counterfactual_receipts_2019_prices_rm_million == pytest.approx(86_706.5, abs=0.01)


def test_deflator_metadata_documents_source_and_fetch_date():
    frag = real_frag()
    d = frag.deflator
    assert d.series_id == frag.cpi_series_id
    assert d.anchor_year == 2019
    assert d.anchor_index == pytest.approx(121.483333, abs=1e-5)
    assert d.index_base == "2010=100"
    assert d.source.dataset_id == "cpi_headline"
    assert d.source.fetched_utc


def test_volume_trap_indicators_from_series():
    frag = real_frag()
    vt = frag.volume_trap
    assert vt.excursionist_share_2019_pct == pytest.approx(25.5, abs=0.05)
    assert vt.excursionist_share_2024_pct == pytest.approx(34.1, abs=0.05)
    assert vt.excursionist_share_change_pp == pytest.approx(8.6, abs=0.05)
    assert vt.land_mode_share_2024_pct == 66.1
    assert "in Brief 2024" in vt.land_mode_share_source


def test_result_is_deterministic_under_recompute():
    assert real_frag() == real_frag()


def test_missing_arrival_year_fails_loudly():
    arrivals = make_series("arrivals_visitor_2019_2024", [(2019, 35_045_625), (2024, 37_961_485)])
    receipts = make_series(
        "inbound_consumption_tourist_2019_2023", [(2019, 86_706.5), (2023, 72_992.8)],
        unit="rm_million", basis="tourist", measure="inbound_tourism_consumption",
    )
    cpi = make_cpi(REAL_CPI)
    with pytest.raises(ValueError, match="2024"):
        compute_missing_billions(
            receipts=receipts, arrivals=arrivals, cpi=cpi,
            excursionist_arrivals=None, land_mode_share_2024_pct=None,
        )
