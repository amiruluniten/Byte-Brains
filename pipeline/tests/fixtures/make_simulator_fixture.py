"""Generate the T7 simulator round-trip fixture (shared with the dashboard).

Pipeline side of the acceptance criterion "a round-trip test proves Python and
TS arithmetic agree on a fixture vector":

    cd pipeline && .venv/bin/python tests/fixtures/make_simulator_fixture.py

Reads the emitted bundle (data/processed/bundle.json), takes the `simulator`
fragment's coefficients, computes expected results with the pipeline's own
`simulate_mix` arithmetic for three named mix cases, and writes
dashboard/tests/fixtures/simulator-fixture.json. The dashboard's vitest suite
must reproduce every expected number from the inputs alone.

Re-run (and commit) whenever the bundle is re-emitted.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "pipeline" / "src"))

from bytebrains_pipeline.bundle import Bundle  # noqa: E402
from bytebrains_pipeline.simulator import simulate_mix  # noqa: E402

BUNDLE = REPO_ROOT / "data" / "processed" / "bundle.json"
OUT = REPO_ROOT / "dashboard" / "tests" / "fixtures" / "simulator-fixture.json"

# Policy preset (mirrored in dashboard/src/lib/simulator.ts): move this fraction
# of Singapore's 2024 share to the top-K markets by real 2019-price yield,
# redistributed pro-rata by the recipients' own 2024 shares.
POLICY_FROM_MARKET = "Singapore"
POLICY_MOVE_FRACTION = 0.5
POLICY_TOP_K = 3


def policy_mix(frag) -> list[float]:
    shares = [m.share_of_arrivals_2024 for m in frag.markets]
    idx = {m.market: i for i, m in enumerate(frag.markets)}
    from_i = idx[POLICY_FROM_MARKET]
    ranked = sorted(
        (
            (i, m.yield_2024_real_2019_rm_per_visitor)
            for i, m in enumerate(frag.markets)
            if m.coverage == "both" and i != from_i
        ),
        key=lambda t: t[1],
        reverse=True,
    )
    recipients = [i for i, _ in ranked[:POLICY_TOP_K]]
    move = shares[from_i] * POLICY_MOVE_FRACTION
    pool = sum(shares[i] for i in recipients)
    out = list(shares)
    out[from_i] = shares[from_i] - move
    for i in recipients:
        out[i] = shares[i] + move * (shares[i] / pool)
    return out


def main() -> None:
    bundle = Bundle.model_validate_json(BUNDLE.read_text())
    frag = bundle.fragments["simulator"]

    inputs = {
        "markets": [m.market for m in frag.markets],
        "yields_real": [m.yield_2024_real_2019_rm_per_visitor for m in frag.markets],
        "shares_2024": [m.share_of_arrivals_2024 for m in frag.markets],
        "shares_2023": [m.share_of_arrivals_2023 for m in frag.markets],
        "visitor_arrivals": frag.visitor_arrivals_2024,
        "anchor_per_visitor_real": frag.anchor_per_visitor_real_2019_rm,
        "cpi_ratio_to_anchor": frag.cpi_ratio_to_anchor_mix_year,
        "prices": frag.prices,
        "anchor_year": frag.anchor_year,
        "mix_year": frag.mix_year,
    }

    def case(name: str, shares: list[float]) -> dict:
        result = simulate_mix(
            yields_real=inputs["yields_real"],
            shares=shares,
            visitor_arrivals=inputs["visitor_arrivals"],
            anchor_per_visitor_real=inputs["anchor_per_visitor_real"],
        )
        return {"name": name, "shares": shares, "expected": result}

    cases = [
        case("2024 actual mix", list(inputs["shares_2024"])),
        case("2023 mix (earliest observed)", list(inputs["shares_2023"])),
        case("policy: Singapore shift to top-yield", policy_mix(frag)),
    ]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "description": (
            "T7 simulator round-trip fixture: Python (pipeline simulator.simulate_mix) "
            "computed `expected`; the dashboard's vitest suite must reproduce every "
            "number from `inputs` alone. Regenerate with "
            "pipeline/tests/fixtures/make_simulator_fixture.py after re-emitting the bundle."
        ),
        "inputs": inputs,
        "cases": cases,
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"wrote {OUT} ({len(cases)} cases, {len(inputs['markets'])} markets)")


if __name__ == "__main__":
    main()
