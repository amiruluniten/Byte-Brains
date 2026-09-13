"""Ground-truth validation and cross-file consistency checks (ticket T1)."""
from __future__ import annotations

from .bundle import Bundle, Series

GROUND_TRUTHS = [
    # (description, series_id, year, expected)
    ("2019 inbound tourism consumption (Jad 1A total)", "inbound_consumption_tourist_2015_2024", 2019, 86706.5),
    ("2019 tourist arrivals (2023 file)", "arrivals_tourist_2015_2023", 2019, 26100784),
    ("2019 tourist arrivals (2024 file)", "arrivals_tourist_2019_2024", 2019, 26100784),
    ("2024 visitor arrivals", "arrivals_visitor_2019_2024", 2024, 37961485),
    ("2024 inbound tourism consumption (Jad 1A total)", "inbound_consumption_tourist_2015_2024", 2024, 102815.3),
]

TOLERANCE = 0.05  # RM million; arrivals are exact integers


class GroundTruthError(SystemExit):
    pass


def _value_of(series: Series, year: int):
    for obs in series.values:
        if obs.year == year:
            return obs.value
    return None


def check_ground_truths(bundle: Bundle) -> list[str]:
    """Raise GroundTruthError if any known official value fails to reproduce."""
    frag = bundle.fragments["national_series"]
    by_id = {s.series_id: s for s in frag.series}
    passed = []
    for description, series_id, year, expected in GROUND_TRUTHS:
        series = by_id.get(series_id)
        if series is None:
            raise GroundTruthError(f"ground-truth check failed: missing series {series_id}")
        actual = _value_of(series, year)
        if actual is None:
            raise GroundTruthError(
                f"ground-truth check failed: {description}: {year} missing from {series_id}"
            )
        if abs(actual - expected) > TOLERANCE:
            raise GroundTruthError(
                f"ground-truth check failed: {description}: expected {expected}, got {actual}"
            )
        passed.append(f"OK  {description}: {actual:,}")
    return passed


def check_cross_file_consistency(bundle: Bundle, legacy_total_series: Series) -> list[str]:
    """The 2023 edition's table 1A totals must equal the 2024 edition's Jad 1A totals
    for the overlapping years 2015-2023 (research/tsa-xlsx-map.md promises this)."""
    frag = bundle.fragments["national_series"]
    current = next(s for s in frag.series if s.series_id == "inbound_consumption_tourist_2015_2024")
    legacy = {o.year: o.value for o in legacy_total_series.values}
    mismatched = [
        (year, current_value, legacy.get(year))
        for year, current_value in ((o.year, o.value) for o in current.values)
        if year in legacy and legacy[year] is not None and current_value is not None
        and abs(current_value - legacy[year]) > TOLERANCE
    ]
    if mismatched:
        raise GroundTruthError(
            f"cross-file consistency failed (table 1A vs Jad 1A): {mismatched}"
        )
    return [f"OK  cross-file consistency (table 1A 2023 vs Jad 1A 2024, 2015-2023)"]


# Ticket T3: In Brief 2024 top-20 source-market ground truths
# (description, market, year, field, expected)
MARKET_GROUND_TRUTHS = [
    ("Singapore receipts RM m (In Brief 2024)", "Singapore", 2024, "receipts_rm_million", 27_941.65),
    ("China receipts RM m (In Brief 2024)", "China", 2024, "receipts_rm_million", 20_866.57),
    ("Singapore visitor arrivals (In Brief 2024)", "Singapore", 2024, "arrivals_persons", 18_855_680),
]

NATIONAL_YIELD_EXPECTED = 2_813.0  # RM per visitor, In Brief 2024 headline reconciliation
NATIONAL_YIELD_TOLERANCE = 1.0

MARKET_TOLERANCE = 0.01  # RM million; arrivals exact integers


def check_market_ground_truths(bundle: Bundle) -> list[str]:
    """Ticket T3 checks: In Brief spot values, explicit coverage of partial markets,
    and the national reconciliation (receipts / arrivals = RM2,813 per visitor)."""
    frag = bundle.fragments["source_market"]
    by_market = {m.market: m for m in frag.markets}
    passed = []
    for description, market, year, field, expected in MARKET_GROUND_TRUTHS:
        row = by_market.get(market)
        if row is None:
            raise GroundTruthError(f"market ground-truth check failed: missing market {market}")
        obs = next((o for o in row.observations if o.year == year), None)
        if obs is None:
            raise GroundTruthError(f"market ground-truth check failed: {description}: {year} missing")
        actual = getattr(obs, field)
        if actual is None or abs(actual - expected) > MARKET_TOLERANCE:
            raise GroundTruthError(
                f"market ground-truth check failed: {description}: expected {expected}, got {actual}"
            )
        passed.append(f"OK  {description}: {actual:,}")

    partial = {
        m.market: m.coverage for m in frag.markets if m.coverage != "both"
    }
    expected_partial = {"Bangladesh": "arrivals_only", "Myanmar": "arrivals_only",
                        "Canada": "receipts_only", "Netherlands": "receipts_only"}
    if partial != expected_partial:
        raise GroundTruthError(
            f"market ground-truth check failed: partial-coverage markets {partial} "
            f"must be explicit and equal {expected_partial}"
        )
    passed.append(f"OK  partial-coverage markets explicit: {sorted(partial)}")

    # national reconciliation: In Brief totals -> RM2,813 per visitor
    nat24 = next((o for o in frag.national_totals if o.year == 2024), None)
    if nat24 is None or nat24.receipts_rm_million is None or nat24.arrivals_persons is None:
        raise GroundTruthError("market ground-truth check failed: 2024 national totals missing")
    national_yield = nat24.receipts_rm_million * 1_000_000 / nat24.arrivals_persons
    if abs(national_yield - NATIONAL_YIELD_EXPECTED) > NATIONAL_YIELD_TOLERANCE:
        raise GroundTruthError(
            "national reconciliation check failed: expected RM2,813 per visitor, got "
            f"RM{national_yield:,.2f}"
        )
    passed.append(f"OK  national reconciliation: RM{national_yield:,.0f} per visitor (2024)")

    # consistency: In Brief national arrivals must match the TSA national series
    national_frag = bundle.fragments["national_series"]
    tsa = next(
        (o.value for s in national_frag.series if s.series_id == "arrivals_visitor_2019_2024"
         for o in s.values if o.year == 2024),
        None,
    )
    if tsa is not None and tsa != nat24.arrivals_persons:
        raise GroundTruthError(
            "consistency check failed: In Brief national arrivals "
            f"({nat24.arrivals_persons:,}) != TSA visitor arrivals 2024 ({tsa:,})"
        )
    if tsa is not None:
        passed.append("OK  In Brief national arrivals == TSA visitor arrivals 2024: "
                      f"{int(tsa):,}")
    return passed

# Ticket T4: CPI deflator ground truths (DOSM OpenDOSM cpi_headline, overall,
# 2010=100, annual mean of monthly index; recorded fixture fetched 2026-09-13).
CPI_GROUND_TRUTHS = [
    ("2019 national CPI (annual mean, 2010=100)", 2019, 121.483333),
    ("2024 national CPI (annual mean, 2010=100)", 2024, 132.791667),
]

# Ticket T4: counterfactual ground truths, hand-computed from the Jad 1A receipts,
# visitor arrivals, and the CPI series above. Real-terms gap is NEGATIVE (about
# -RM139m): real per-visitor expenditure in 2024 was essentially flat vs 2019 —
# the nominal increase was inflation. The naive nominal gap is far more negative
# (a false RM8.9bn "surplus"), which is exactly why it is flagged invalid.
MISSING_BILLIONS_CHECKS = [
    # (description, year, field, expected, tolerance)
    ("2019 per-visitor nominal (Jad 1A / visitors)", 2019, "per_visitor_nominal_rm", 2474.103401, 0.05),
    ("2024 per-visitor nominal (Jad 1A / visitors)", 2024, "per_visitor_nominal_rm", 2708.410906, 0.05),
    ("2024 CPI ratio to 2019", 2024, "cpi_ratio_to_anchor", 1.093085, 1e-4),
    ("2024 real per-visitor (2019 prices)", 2024, "per_visitor_real_2019_rm", 2477.766815, 0.05),
    ("2024 counterfactual receipts (2019 prices)", 2024, "counterfactual_receipts_2019_prices_rm_million", 93920.639143, 0.5),
    ("2024 actual receipts (2019 prices)", 2024, "actual_receipts_2019_prices_rm_million", 94059.707775, 0.5),
    ("2024 real gap (2019 prices)", 2024, "gap_2019_prices_rm_million", -139.068632, 0.5),
    ("2024 naive nominal gap (invalid twin)", 2024, "naive_nominal_gap_rm_million", -8894.660857, 0.5),
]

VOLUME_TRAP_EXPECTED = {
    "excursionist_share_2019_pct": (25.5, 0.05),
    "excursionist_share_2024_pct": (34.1, 0.05),
    "excursionist_share_change_pp": (8.6, 0.05),
    "land_mode_share_2024_pct": (66.1, 0.0),
}


def check_cpi_ground_truths(bundle: Bundle) -> list[str]:
    """Ticket T4: the CPI series in the bundle must reproduce the recorded DOSM values."""
    frag = bundle.fragments.get("macro_series")
    if frag is None:
        raise GroundTruthError("ground-truth check failed: macro_series fragment missing")
    cpi_series = frag.series[0]
    passed = []
    for description, year, expected in CPI_GROUND_TRUTHS:
        actual = _value_of(cpi_series, year)
        if actual is None or abs(actual - expected) > 1e-4:
            raise GroundTruthError(
                f"ground-truth check failed: {description}: expected {expected}, got {actual}"
            )
        passed.append(f"OK  {description}: {actual}")
    return passed


def check_missing_billions(bundle: Bundle) -> list[str]:
    """Ticket T4: counterfactual values, the loud naive-nominal-negative assertion,
    Volume Trap indicators, and deflator provenance."""
    frag = bundle.fragments.get("missing_billions")
    if frag is None:
        raise GroundTruthError("ground-truth check failed: missing_billions fragment missing")
    passed = []

    for description, year, field, expected, tol in MISSING_BILLIONS_CHECKS:
        row = next((y for y in frag.years if y.year == year), None)
        if row is None:
            raise GroundTruthError(f"ground-truth check failed: {description}: {year} missing")
        actual = getattr(row, field)
        if abs(actual - expected) > tol:
            raise GroundTruthError(
                f"ground-truth check failed: {description}: expected {expected}, got {actual}"
            )
        passed.append(f"OK  {description}: {actual:,.4f}")

    latest = max(frag.years, key=lambda y: y.year)
    if latest.year > frag.anchor_year and latest.naive_nominal_gap_rm_million >= 0:
        raise GroundTruthError(
            f"ground-truth check failed: naive nominal counterfactual for {latest.year} is "
            f"{latest.naive_nominal_gap_rm_million:+.1f} (>= 0); the real-terms path may have "
            "regressed — the naive nominal twin must stay negative-or-flagged (ticket T4)"
        )
    passed.append(
        f"OK  naive nominal counterfactual {latest.year}: "
        f"{latest.naive_nominal_gap_rm_million:,.1f} (negative, flagged invalid)"
    )

    for field, (expected, tol) in VOLUME_TRAP_EXPECTED.items():
        actual = getattr(frag.volume_trap, field)
        if abs(actual - expected) > tol:
            raise GroundTruthError(
                f"ground-truth check failed: Volume Trap {field}: expected {expected}, got {actual}"
            )
    passed.append(
        "OK  Volume Trap: excursionist share 25.5% (2019) -> 34.1% (2024), "
        "land-mode share 66.1% (2024)"
    )
    return passed


def check_segmentation_reconciliation(bundle: "Bundle") -> list[str]:
    """Ticket T5: the segmentation fragment must reconcile against the same yield
    figures the source_market fragment carries (clusters AND tiers)."""
    from .bundle import SegmentationFragment

    seg = bundle.fragments["source_segmentation"]
    if not isinstance(seg, SegmentationFragment):
        raise GroundTruthError("fragment source_segmentation is not a SegmentationFragment")
    market_frag = bundle.fragments["source_market"]
    src_yield = {
        m.market: next(o for o in m.observations if o.year == 2024).yield_rm_per_visitor
        for m in market_frag.markets
    }
    for m in seg.markets:
        expected = src_yield[m.market]
        if m.yield_rm_per_visitor_2024 != expected:
            raise GroundTruthError(
                f"segmentation reconciliation failed: {m.market} yield "
                f"{m.yield_rm_per_visitor_2024} != source_market fragment {expected}"
            )
    clustered = [m for m in seg.markets if m.clustered]
    named = sorted({m.segment_name for m in clustered})
    return [
        f"OK  segmentation: {len(clustered)} markets clustered into {len(seg.clusters)} named "
        f"segments ({', '.join(named)}), yields reconciled with the source_market fragment"
    ]


def check_regional_benchmark(bundle: "Bundle") -> list[str]:
    """Ticket T6: the regional benchmark fragment must reconcile with the
    source_market fragment (the Malaysia baseline row IS the national totals)."""
    from .bundle import RegionalBenchmarkFragment

    frag = bundle.fragments.get("regional_benchmark")
    if frag is None:
        return []
    if not isinstance(frag, RegionalBenchmarkFragment):
        raise GroundTruthError("fragment regional_benchmark is not a RegionalBenchmarkFragment")
    market_frag = bundle.fragments["source_market"]
    totals_2024 = next(o for o in market_frag.national_totals if o.year == 2024)
    my = next(c for c in frag.countries if c.country == frag.baseline_market)
    if my.arrivals_2024 != totals_2024.arrivals_persons:
        raise GroundTruthError(
            f"regional benchmark Malaysia arrivals {my.arrivals_2024} != source_market "
            f"national totals {totals_2024.arrivals_persons}"
        )
    implied_yield = totals_2024.receipts_rm_million * 1e6 / totals_2024.arrivals_persons
    # the researched RM2,813 per visitor, in USD at the documented 2024 rate
    if abs(implied_yield - 2813) > 1.0:
        raise GroundTruthError(
            f"regional benchmark baseline drifted from the In Brief reconciliation: "
            f"RM {implied_yield:.2f} per visitor (expected ~2,813)"
        )
    comparators = [c.country for c in frag.countries if c.role == "comparator"]
    excluded = [e.country for e in frag.excluded_markets]
    return [
        f"OK  regional benchmark: Malaysia baseline reconciles with the source_market "
        f"national totals (RM {implied_yield:,.0f} per visitor, 2024); comparators "
        f"{', '.join(comparators)}; excluded (documented): {', '.join(excluded)}"
    ]
