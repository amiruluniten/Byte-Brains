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

# Ticket #13: TSA 2025 edition ("2025p" preliminary release). Checked only when
# the 2025-edition series are in the bundle (the 2025 workbook is in data/raw/).
GROUND_TRUTHS_2025_EDITION = [
    ("2024 inbound consumption REVISED (TSA 2025 workbook)", "inbound_consumption_tourist_2015_2025", 2024, 102931.3),
    ("2025 inbound consumption (Jad 1A total, 2025p)", "inbound_consumption_tourist_2015_2025", 2025, 119312.0),
    ("2025 visitor arrivals (preliminary)", "arrivals_visitor_2019_2025", 2025, 42196892),
    ("2025 tourist arrivals (preliminary)", "arrivals_tourist_2019_2025", 2025, 26613597),
    ("2025 same-day visitor arrivals (preliminary)", "arrivals_excursionist_2019_2025", 2025, 15583295),
]

# Ticket #13: which years of the 2025-edition series must carry which revision
# status (the honest flags: revised 2024, preliminary 2025).
REVISION_STATUS_2025_EDITION = {
    "inbound_consumption_tourist_2015_2025": {2024: "revised", 2025: "preliminary"},
    "arrivals_visitor_2019_2025": {2025: "preliminary"},
    "arrivals_tourist_2019_2025": {2025: "preliminary"},
    "arrivals_excursionist_2019_2025": {2025: "preliminary"},
}

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

    # ticket #13: the TSA 2025 edition, when present, must reproduce its own
    # official values with the honest revision flags.
    series_2025 = {s.series_id for s in frag.series} & set(REVISION_STATUS_2025_EDITION)
    if not series_2025:
        return passed
    for description, series_id, year, expected in GROUND_TRUTHS_2025_EDITION:
        series = by_id.get(series_id)
        if series is None:
            raise GroundTruthError(f"ground-truth check failed: missing series {series_id}")
        actual = _value_of(series, year)
        if actual is None or abs(actual - expected) > TOLERANCE:
            raise GroundTruthError(
                f"ground-truth check failed: {description}: expected {expected}, got {actual}"
            )
        passed.append(f"OK  {description}: {actual:,}")
    for series_id, expected_statuses in REVISION_STATUS_2025_EDITION.items():
        series = by_id.get(series_id)
        if series is None:
            raise GroundTruthError(f"ground-truth check failed: missing series {series_id}")
        for year, expected_status in expected_statuses.items():
            obs = next((o for o in series.values if o.year == year), None)
            if obs is None or obs.revision_status != expected_status:
                raise GroundTruthError(
                    f"ground-truth check failed: {series_id} {year} must carry "
                    f"revision_status {expected_status!r} (the honest flags), got "
                    f"{obs.revision_status if obs else None!r}"
                )
    passed.append(
        "OK  revision flags (ticket #13): 2024 consumption revised, 2025 observations "
        "preliminary across the TSA 2025 edition series"
    )
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


def check_2025_edition_consistency(bundle: Bundle, current_2024_series: dict[str, Series]) -> list[str]:
    """Ticket #13: the TSA 2025 edition must agree with the TSA 2024 edition on
    every year it does not revise. The 2024 consumption revision is the ONE
    allowed difference — anything else means the layout was misread."""
    frag = bundle.fragments["national_series"]
    by_id = {s.series_id: s for s in frag.series}
    overlaps = {
        "arrivals_visitor_2019_2025": ("arrivals_visitor_2019_2024", range(2019, 2025)),
        "arrivals_tourist_2019_2025": ("arrivals_tourist_2019_2024", range(2019, 2025)),
        "arrivals_excursionist_2019_2025": ("arrivals_excursionist_2019_2024", range(2019, 2025)),
        "inbound_consumption_tourist_2015_2025": ("inbound_consumption_tourist_2015_2024", range(2015, 2024)),
    }
    for new_id, (old_id, years) in overlaps.items():
        new_series, old_series = by_id.get(new_id), current_2024_series.get(old_id)
        if new_series is None or old_series is None:
            continue  # the 2025 edition is not in this bundle
        for year in years:
            new_value = _value_of(new_series, year)
            old_value = _value_of(old_series, year)
            if new_value is None or old_value is None or abs(new_value - old_value) > TOLERANCE:
                raise GroundTruthError(
                    f"2025-edition consistency failed: {new_id} {year} ({new_value}) must "
                    f"match {old_id} ({old_value}) — only the documented 2024 consumption "
                    "revision may differ between the TSA editions"
                )
    new_consumption, old_consumption = (
        by_id["inbound_consumption_tourist_2015_2025"],
        current_2024_series["inbound_consumption_tourist_2015_2024"],
    )
    revised_2024, original_2024 = (
        _value_of(new_consumption, 2024), _value_of(old_consumption, 2024)
    )
    if abs(revised_2024 - original_2024) <= TOLERANCE:
        raise GroundTruthError(
            "2025-edition consistency failed: the TSA 2025 workbook's 2024 consumption "
            f"({revised_2024}) equals the 2024 edition's ({original_2024}) — the documented "
            "revision (RM102,815.3m -> RM102,931.3m) is missing; check the workbook layout"
        )
    return [
        "OK  2025-edition consistency: overlapping years match the TSA 2024 edition; "
        f"the documented 2024 consumption revision is the only difference "
        f"({original_2024:,.1f} -> {revised_2024:,.1f} RM m)"
    ]


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

# Ticket #13: the extended deflator window (checked when the additive
# cpi_national_overall_2015_2025 series is in the bundle).
CPI_GROUND_TRUTHS_2025 = [
    ("2025 national CPI (annual mean, 2010=100)", 2025, 134.625),
]

# Ticket T4: counterfactual ground truths, hand-computed from the Jad 1A receipts,
# visitor arrivals, and the CPI series above. Real-terms gap is NEGATIVE (about
# -RM139m): real per-visitor expenditure in 2024 was essentially flat vs 2019 —
# the nominal increase was inflation. The naive nominal gap is far more negative
# (a false RM8.9bn "surplus"), which is exactly why it is flagged invalid.
MISSING_BILLIONS_CHECKS = [
    # (description, year, field, expected, tolerance)
    ("2019 per-visitor nominal (Jad 1A / visitors)", 2019, "per_visitor_nominal_rm", 2474.103401, 0.05),
    ("2024 counterfactual receipts (2019 prices)", 2024, "counterfactual_receipts_2019_prices_rm_million", 93920.639143, 0.5),
]

# Ticket #13: the 2024 row depends on WHICH workbook the receipts come from.
# Without the TSA 2025 workbook the receipts are the 2024 edition's
# (RM102,815.3m); with it, the 2024 row recomputes from the revised
# RM102,931.3m and the fragment gains the 2025 preliminary year.
MISSING_BILLIONS_CHECKS_2024_ORIGINAL = [
    ("2024 per-visitor nominal (Jad 1A / visitors)", 2024, "per_visitor_nominal_rm", 2708.410906, 0.05),
    ("2024 CPI ratio to 2019", 2024, "cpi_ratio_to_anchor", 1.093085, 1e-4),
    ("2024 real per-visitor (2019 prices)", 2024, "per_visitor_real_2019_rm", 2477.766815, 0.05),
    ("2024 actual receipts (2019 prices)", 2024, "actual_receipts_2019_prices_rm_million", 94059.707775, 0.5),
    ("2024 real gap (2019 prices)", 2024, "gap_2019_prices_rm_million", -139.068632, 0.5),
    ("2024 naive nominal gap (invalid twin)", 2024, "naive_nominal_gap_rm_million", -8894.660857, 0.5),
]

MISSING_BILLIONS_CHECKS_2024_REVISED = [
    ("2024 per-visitor nominal (Jad 1A / visitors, revised)", 2024, "per_visitor_nominal_rm", 2711.466635, 0.05),
    ("2024 CPI ratio to 2019", 2024, "cpi_ratio_to_anchor", 1.093085, 1e-4),
    ("2024 real per-visitor (2019 prices, revised)", 2024, "per_visitor_real_2019_rm", 2480.562309, 0.05),
    ("2024 actual receipts (2019 prices, revised)", 2024, "actual_receipts_2019_prices_rm_million", 94165.828900, 0.5),
    ("2024 real gap (2019 prices, revised)", 2024, "gap_2019_prices_rm_million", -245.189757, 0.5),
    ("2024 naive nominal gap (invalid twin, revised)", 2024, "naive_nominal_gap_rm_million", -9010.660857, 0.5),
]

# Ticket #13: the 2025 preliminary row (real gap is NEGATIVE — a surplus over
# the counterfactual; the naive nominal twin is emitted and stays invalid).
MISSING_BILLIONS_CHECKS_2025 = [
    ("2025 CPI ratio to 2019", 2025, "cpi_ratio_to_anchor", 1.108177, 1e-4),
    ("2025 per-visitor nominal (Jad 1A / visitors)", 2025, "per_visitor_nominal_rm", 2827.506822, 0.05),
    ("2025 real per-visitor (2019 prices)", 2025, "per_visitor_real_2019_rm", 2551.494543, 0.05),
    ("2025 counterfactual receipts (2019 prices)", 2025, "counterfactual_receipts_2019_prices_rm_million", 104399.474006, 0.5),
    ("2025 actual receipts (2019 prices)", 2025, "actual_receipts_2019_prices_rm_million", 107665.139661, 0.5),
    ("2025 real gap (2019 prices)", 2025, "gap_2019_prices_rm_million", -3265.665656, 0.5),
    ("2025 naive nominal gap (invalid twin)", 2025, "naive_nominal_gap_rm_million", -14912.525994, 0.5),
]

# Ticket #13: the pre-registered headline (window fixed before the TSA 2025
# release was examined) and its value, computed from the TSA 2024 edition
# receipts the headline was registered on. The 2024 revision moves the 2024
# ROW, never the headline (no result-shopping); the 2020-2025 cumulative
# appears only as the labelled supplementary figure.
HEADLINE_EXPECTED = {"window": "2020-2024", "cumulative_gap_rm_million": 10204.5}
HEADLINE_TOLERANCE = 0.05
SUPPLEMENTARY_2025_EXPECTED = 6938.8  # headline + the 2025 preliminary gap

VOLUME_TRAP_EXPECTED = {
    "excursionist_share_2019_pct": (25.5, 0.05),
    "excursionist_share_2024_pct": (34.1, 0.05),
    "excursionist_share_change_pp": (8.6, 0.05),
    "land_mode_share_2024_pct": (66.1, 0.0),
}


def check_cpi_ground_truths(bundle: Bundle) -> list[str]:
    """Ticket T4 (+ #13): the CPI series in the bundle must reproduce the recorded
    DOSM values; the extended 2025 window is checked when present."""
    frag = bundle.fragments.get("macro_series")
    if frag is None:
        raise GroundTruthError("ground-truth check failed: macro_series fragment missing")
    passed = []
    for cpi_series in frag.series:
        for description, year, expected in CPI_GROUND_TRUTHS:
            actual = _value_of(cpi_series, year)
            if actual is None or abs(actual - expected) > 1e-4:
                raise GroundTruthError(
                    f"ground-truth check failed: {description}: expected {expected}, got {actual}"
                )
        passed.append(f"OK  CPI series {cpi_series.series_id} reproduces the recorded DOSM values")
    extended = next(
        (s for s in frag.series if s.series_id == "cpi_national_overall_2015_2025"), None
    )
    if extended is not None:
        for description, year, expected in CPI_GROUND_TRUTHS_2025:
            actual = _value_of(extended, year)
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

    has_2025 = any(y.year == 2025 for y in frag.years)
    checks = list(MISSING_BILLIONS_CHECKS)
    checks += MISSING_BILLIONS_CHECKS_2024_REVISED if has_2025 else MISSING_BILLIONS_CHECKS_2024_ORIGINAL
    if has_2025:
        checks += MISSING_BILLIONS_CHECKS_2025
    for description, year, field, expected, tol in checks:
        row = next((y for y in frag.years if y.year == year), None)
        if row is None:
            raise GroundTruthError(f"ground-truth check failed: {description}: {year} missing")
        actual = getattr(row, field)
        if abs(actual - expected) > tol:
            raise GroundTruthError(
                f"ground-truth check failed: {description}: expected {expected}, got {actual}"
            )
        passed.append(f"OK  {description}: {actual:,.4f}")

    # ticket #13: the pre-registered headline — the window is guarded in the
    # model; here the VALUE is pinned to the pre-registered RM10,204.5m (2020-
    # 2024, constant 2019 prices, computed from the TSA 2024 edition receipts).
    headline = frag.headline
    if abs(headline.cumulative_gap_rm_million - HEADLINE_EXPECTED["cumulative_gap_rm_million"]) > HEADLINE_TOLERANCE:
        raise GroundTruthError(
            f"ground-truth check failed: pre-registered headline: expected "
            f"RM{HEADLINE_EXPECTED['cumulative_gap_rm_million']:,.1f}m over "
            f"{HEADLINE_EXPECTED['window']}, got RM{headline.cumulative_gap_rm_million:,.4f}m"
        )
    years_covered = {y.year for y in frag.years}
    if not set(range(2020, 2025)) <= years_covered:
        raise GroundTruthError(
            "ground-truth check failed: the headline window 2020-2024 must be fully "
            f"covered by the fragment's year rows, got {sorted(years_covered)}"
        )
    passed.append(
        f"OK  pre-registered headline: RM{headline.cumulative_gap_rm_million:,.1f}m "
        f"({headline.window}, constant 2019 prices) — window guarded, value pinned"
    )
    if has_2025:
        sup = frag.supplementary
        if sup is None:
            raise GroundTruthError(
                "ground-truth check failed: the 2020-2025 cumulative must be emitted as "
                "the clearly-labelled supplementary figure (ticket #13)"
            )
        if abs(sup.cumulative_gap_rm_million - SUPPLEMENTARY_2025_EXPECTED) > 0.05:
            raise GroundTruthError(
                f"ground-truth check failed: supplementary 2020-2025 cumulative: expected "
                f"~RM{SUPPLEMENTARY_2025_EXPECTED:,.1f}m, got RM{sup.cumulative_gap_rm_million:,.4f}m"
            )
        passed.append(
            f"OK  supplementary (labelled, never the headline): RM{sup.cumulative_gap_rm_million:,.1f}m "
            f"({sup.window}, includes the preliminary 2025 year)"
        )
        row2025 = next(y for y in frag.years if y.year == 2025)
        if row2025.revision_status != "preliminary":
            raise GroundTruthError(
                "ground-truth check failed: the 2025 counterfactual row must carry "
                f"revision_status 'preliminary', got {row2025.revision_status!r}"
            )
        passed.append("OK  2025 counterfactual row flagged preliminary")

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
