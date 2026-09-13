"""The simulator coefficient exporter (ticket T7).

The prescriptive half of ADR-0002: Python exports per-source-market yield
coefficients (from the `source_market` fragment) into a `simulator` fragment of
the data bundle; the browser recomputes receipts, yield per visitor and the
Missing Billions gap for any user-chosen market mix with EXACTLY the arithmetic
in `simulate_mix` — transparent constant-2019-prices arithmetic, no ML, no
network.

Arithmetic contract (mirrored 1:1 in `dashboard/src/lib/simulator.ts`):

    yield_per_visitor_real   = sum(share_i * yield_real_i)          [2019 RM]
    receipts_real            = visitors * yield_per_visitor_real    [2019 RM]
    counterfactual           = visitors * anchor_per_visitor_real   [2019 RM]
    gap                      = counterfactual - receipts_real       (positive = missing billions)

Reconciliation: the fragment's markets partition the national totals the
`missing_billions` fragment uses (TSA Jad 1A receipts, visitor-basis arrivals)
via an explicit "Other markets (residual)" row, so at the 2024 actual mix the
simulator equals the headline calculator exactly (float tolerance). The
residual absorbs (a) the non-top-20 markets, (b) the four partial-coverage
top-20 markets (Bangladesh, Myanmar = arrivals-only; Canada, Netherlands =
receipts-only), and (c) the In Brief vs Jad 1A receipts basis difference. All
three are stated in the fragment, never silent.

Deflator: per-market yields are deflated by the NATIONAL CPI — no market-level
price index exists. Stated in the fragment.
"""
from __future__ import annotations

from .bundle import (
    MacroSeries,
    MissingBillionsFragment,
    SimulatorFragment,
    SimulatorMarket,
    SourceMarketFragment,
    Series,
)

RESIDUAL_MARKET = "Other markets (residual)"
# RM million. The reconciliation is exact arithmetic on the same doubles
# (same additions in the same order); the tolerance only absorbs float
# non-associativity across the two implementations.
RECONCILIATION_TOLERANCE_RM_M = 1e-6


def simulate_mix(
    yields_real: list[float],
    shares: list[float],
    visitor_arrivals: int,
    anchor_per_visitor_real: float,
) -> dict:
    """The client-side arithmetic, defined ONCE here and mirrored in
    `dashboard/src/lib/simulator.ts`. Same operations, same order: plain
    left-to-right float sums, no rounding, no numpy."""
    if len(yields_real) != len(shares):
        raise ValueError("yields and shares must have the same length")
    if any(s < 0 for s in shares):
        raise ValueError("shares must be non-negative")
    yield_per_visitor = 0.0
    contributions: list[float] = []
    for share, y in zip(shares, yields_real):
        yield_per_visitor += share * y  # left-to-right, the order TS must copy
    for share, y in zip(shares, yields_real):
        contributions.append(visitor_arrivals * (share * y) / 1_000_000.0)
    receipts = visitor_arrivals * yield_per_visitor / 1_000_000.0
    counterfactual = visitor_arrivals * anchor_per_visitor_real / 1_000_000.0
    return {
        "yield_per_visitor_real_rm": yield_per_visitor,
        "receipts_2019_prices_rm_million": receipts,
        "counterfactual_2019_prices_rm_million": counterfactual,
        "gap_2019_prices_rm_million": counterfactual - receipts,
        "contributions_2019_prices_rm_million": contributions,
    }


def _year_row(fragment: MissingBillionsFragment, year: int):
    row = next((y for y in fragment.years if y.year == year), None)
    if row is None:
        raise ValueError(f"missing_billions fragment has no {year} row")
    return row


def build_simulator_fragment(
    source_market: SourceMarketFragment,
    missing_billions: MissingBillionsFragment,
) -> SimulatorFragment:
    """Export the simulator coefficients from already-validated fragments.

    Never re-extracts anything: the yields are the source_market fragment's
    own figures (the same numbers segmentation reconciles against), deflated
    by the missing_billions deflator.
    """
    anchor_row = _year_row(missing_billions, missing_billions.anchor_year)
    row24 = _year_row(missing_billions, 2024)
    row23 = _year_row(missing_billions, 2023)
    ratio = row24.cpi_ratio_to_anchor

    markets: list[SimulatorMarket] = []
    sum_arrivals_2024 = 0
    sum_arrivals_2023 = 0
    sum_real_receipts = 0.0  # RM million, 2019 prices, left-to-right

    for row in source_market.markets:
        obs24 = next(o for o in row.observations if o.year == 2024)
        obs23 = next(o for o in row.observations if o.year == 2023)
        if row.coverage != "both":
            # partial-coverage markets carry no (yield, arrivals) pair for the
            # mix arithmetic; they are absorbed by the residual, never zeroed
            continue
        nominal_yield = obs24.yield_rm_per_visitor
        assert nominal_yield is not None and obs24.arrivals_persons is not None
        assert obs23.arrivals_persons is not None
        real_yield = nominal_yield / ratio
        share24 = obs24.arrivals_persons / row24.visitor_arrivals
        share23 = obs23.arrivals_persons / row23.visitor_arrivals
        markets.append(
            SimulatorMarket(
                market=row.market,
                coverage="both",
                yield_2024_nominal_rm_per_visitor=nominal_yield,
                yield_2024_real_2019_rm_per_visitor=real_yield,
                arrivals_2024_persons=obs24.arrivals_persons,
                arrivals_2023_persons=obs23.arrivals_persons,
                share_of_arrivals_2024=share24,
                share_of_arrivals_2023=share23,
            )
        )
        sum_arrivals_2024 += obs24.arrivals_persons
        sum_arrivals_2023 += obs23.arrivals_persons
        sum_real_receipts += real_yield * obs24.arrivals_persons / 1_000_000.0

    # the residual partitions the national totals the headline calculator uses
    residual_arrivals_2024 = int(row24.visitor_arrivals) - sum_arrivals_2024
    residual_arrivals_2023 = int(row23.visitor_arrivals) - sum_arrivals_2023
    residual_real_receipts = row24.actual_receipts_2019_prices_rm_million - sum_real_receipts
    if residual_arrivals_2024 <= 0 or residual_arrivals_2023 <= 0:
        raise ValueError(
            f"simulator residual: arrivals went non-negative-unfriendly "
            f"({residual_arrivals_2024:,} / {residual_arrivals_2023:,}) — the market set no "
            "longer fits inside the national totals; re-derive the residual, do not fudge it"
        )
    if residual_real_receipts <= 0:
        raise ValueError(
            f"simulator residual: real receipts went negative ({residual_real_receipts:,.1f} "
            "RM m, 2019 prices) — the In Brief top-20 receipts now exceed the Jad 1A national "
            "total (basis drift); re-derive the residual, do not fudge it"
        )
    residual_yield = residual_real_receipts * 1_000_000.0 / residual_arrivals_2024
    markets.append(
        SimulatorMarket(
            market=RESIDUAL_MARKET,
            coverage="residual",
            yield_2024_nominal_rm_per_visitor=None,
            yield_2024_real_2019_rm_per_visitor=residual_yield,
            arrivals_2024_persons=residual_arrivals_2024,
            arrivals_2023_persons=residual_arrivals_2023,
            share_of_arrivals_2024=residual_arrivals_2024 / row24.visitor_arrivals,
            share_of_arrivals_2023=residual_arrivals_2023 / row23.visitor_arrivals,
        )
    )

    return SimulatorFragment(
        prices="constant_2019_rm",
        anchor_year=missing_billions.anchor_year,
        mix_year=2024,
        comparison_year=2023,
        cpi_series_id=missing_billions.cpi_series_id,
        cpi_ratio_to_anchor_mix_year=ratio,
        visitor_arrivals_2024=int(row24.visitor_arrivals),
        visitor_arrivals_2023=int(row23.visitor_arrivals),
        anchor_per_visitor_real_2019_rm=anchor_row.per_visitor_real_2019_rm,
        markets=markets,
    )


def check_simulator_reconciliation(bundle) -> list[str]:
    """Ticket T7 ground truth: at the 2024 actual mix the simulator must
    reproduce the missing_billions fragment exactly (float tolerance)."""
    sim = bundle.fragments.get("simulator")
    if sim is None:
        raise ValueError("ground-truth check failed: simulator fragment missing")
    mb = bundle.fragments["missing_billions"]
    row24 = _year_row(mb, 2024)
    result = simulate_mix(
        yields_real=[m.yield_2024_real_2019_rm_per_visitor for m in sim.markets],
        shares=[m.share_of_arrivals_2024 for m in sim.markets],
        visitor_arrivals=sim.visitor_arrivals_2024,
        anchor_per_visitor_real=sim.anchor_per_visitor_real_2019_rm,
    )
    for field, expected in (
        ("receipts_2019_prices_rm_million", row24.actual_receipts_2019_prices_rm_million),
        ("counterfactual_2019_prices_rm_million", row24.counterfactual_receipts_2019_prices_rm_million),
        ("gap_2019_prices_rm_million", row24.gap_2019_prices_rm_million),
    ):
        if abs(result[field] - expected) > RECONCILIATION_TOLERANCE_RM_M:
            raise ValueError(
                f"simulator reconciliation failed: {field} {result[field]} != "
                f"missing_billions {expected} (tolerance {RECONCILIATION_TOLERANCE_RM_M})"
            )
    yield_diff = abs(result["yield_per_visitor_real_rm"] - row24.per_visitor_real_2019_rm)
    if yield_diff > 1e-6:
        raise ValueError(
            f"simulator reconciliation failed: per-visitor yield differs by {yield_diff} RM"
        )
    return [
        f"OK  simulator: {len(sim.markets)} market coefficients (constant 2019 prices, "
        f"deflated by {sim.cpi_series_id}); at the 2024 actual mix the client-side "
        f"arithmetic reproduces the Missing Billions headline exactly "
        f"(gap {result['gap_2019_prices_rm_million']:+,.4f} RM m, 2019 prices)"
    ]
