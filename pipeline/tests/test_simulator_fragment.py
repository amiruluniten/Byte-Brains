"""Ticket T7: the market-mix simulator coefficient fragment (`simulator`).

Green bar = this file. Offline (committed fixtures + the committed round-trip
fixture shared with the dashboard's vitest suite). Other tickets' red tests are
not this ticket's problem.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from bytebrains_pipeline.bundle import Bundle
from bytebrains_pipeline.bundle.models import SimulatorFragment
from bytebrains_pipeline.cli import main
from bytebrains_pipeline.simulator import (
    RECONCILIATION_TOLERANCE_RM_M,
    build_simulator_fragment,
    check_simulator_reconciliation,
    simulate_mix,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
DASHBOARD_FIXTURE = (
    REPO_ROOT / "dashboard" / "tests" / "fixtures" / "simulator-fixture.json"
)


# --------------------------------------------------------------------------- #
# Pure arithmetic (the contract the dashboard's TypeScript must mirror exactly)
# --------------------------------------------------------------------------- #


class TestSimulateMix:
    def test_hand_computed_two_market_world(self):
        # yields RM/visitor, shares, visitors, anchor per-visitor (2019 real)
        result = simulate_mix(
            yields_real=[100.0, 200.0],
            shares=[0.25, 0.75],
            visitor_arrivals=1_000_000,
            anchor_per_visitor_real=150.0,
        )
        assert result["yield_per_visitor_real_rm"] == 175.0
        assert result["receipts_2019_prices_rm_million"] == pytest.approx(175.0)
        assert result["counterfactual_2019_prices_rm_million"] == pytest.approx(150.0)
        assert result["gap_2019_prices_rm_million"] == pytest.approx(-25.0)
        # positive mix gap = missing billions; negative = receipts beat the anchor
        assert result["contributions_2019_prices_rm_million"] == pytest.approx(
            [25.0, 150.0]
        )

    def test_gap_sign_convention_positive_is_missing_billions(self):
        # a mix of only low-yield visitors: receipts fall short of the anchor
        result = simulate_mix(
            yields_real=[100.0],
            shares=[1.0],
            visitor_arrivals=2_000_000,
            anchor_per_visitor_real=150.0,
        )
        assert result["gap_2019_prices_rm_million"] == pytest.approx(+100.0)

    def test_anchor_mix_reproduces_the_anchor_exactly(self):
        result = simulate_mix(
            yields_real=[2474.1034009237956],
            shares=[1.0],
            visitor_arrivals=35_045_625,
            anchor_per_visitor_real=2474.1034009237956,
        )
        assert result["gap_2019_prices_rm_million"] == pytest.approx(0.0, abs=1e-9)


# --------------------------------------------------------------------------- #
# Builder: coefficients from source_market + missing_billions
# --------------------------------------------------------------------------- #


@pytest.fixture
def offline_data_dir(tmp_path, fixtures_dir):
    d = tmp_path / "data"
    d.mkdir()
    shutil.copy(fixtures_dir / "tourism_2023.fixture.xlsx", d / "tourism_2023.xlsx")
    shutil.copy(fixtures_dir / "tourism_2024.fixture.xlsx", d / "tourism_2024.xlsx")
    shutil.copy(fixtures_dir / "cpi_headline.fixture.csv", d / "cpi_headline.csv")
    shutil.copy(fixtures_dir / "inbrief2024.fixture.txt", d / "inbrief2024.txt")
    return d


@pytest.fixture
def offline_bundle(offline_data_dir, tmp_path):
    out = tmp_path / "bundle.json"
    main(["--data-dir", str(offline_data_dir), "--out", str(out)])
    return Bundle.model_validate_json(out.read_text())


class TestSimulatorFragmentE2E:
    def test_bundle_carries_the_simulator_fragment(self, offline_bundle):
        assert "simulator" in offline_bundle.fragments
        frag = offline_bundle.fragments["simulator"]
        assert isinstance(frag, SimulatorFragment)
        assert frag.prices == "constant_2019_rm"
        assert frag.anchor_year == 2019
        assert frag.mix_year == 2024
        assert frag.comparison_year == 2023

    def test_every_market_has_real_and_nominal_yield(self, offline_bundle):
        frag = offline_bundle.fragments["simulator"]
        mb = offline_bundle.fragments["missing_billions"]
        row24 = next(y for y in mb.years if y.year == 2024)
        for m in frag.markets:
            if m.coverage == "both":
                assert m.yield_2024_nominal_rm_per_visitor is not None
                expected_real = (
                    m.yield_2024_nominal_rm_per_visitor / row24.cpi_ratio_to_anchor
                )
                assert m.yield_2024_real_2019_rm_per_visitor == pytest.approx(
                    expected_real, rel=1e-12
                )
            else:
                assert m.coverage == "residual"
                assert m.yield_2024_nominal_rm_per_visitor is None

    def test_exactly_one_residual_row(self, offline_bundle):
        frag = offline_bundle.fragments["simulator"]
        residuals = [m for m in frag.markets if m.coverage == "residual"]
        assert len(residuals) == 1
        assert residuals[0].market == "Other markets (residual)"
        # the residual must be economically real, never a negative fudge
        assert residuals[0].arrivals_2024_persons > 0
        assert residuals[0].yield_2024_real_2019_rm_per_visitor > 0

    def test_shares_sum_to_one_and_arrivals_reconcile_nationally(self, offline_bundle):
        frag = offline_bundle.fragments["simulator"]
        assert frag.markets[0].share_of_arrivals_2024  # sanity
        assert sum(m.share_of_arrivals_2024 for m in frag.markets) == pytest.approx(
            1.0, abs=1e-9
        )
        assert sum(m.share_of_arrivals_2023 for m in frag.markets) == pytest.approx(
            1.0, abs=1e-9
        )
        assert sum(m.arrivals_2024_persons for m in frag.markets) == frag.visitor_arrivals_2024
        assert sum(m.arrivals_2023_persons for m in frag.markets) == frag.visitor_arrivals_2023

    def test_partial_coverage_markets_fold_into_the_residual(self, offline_bundle):
        frag = offline_bundle.fragments["simulator"]
        names = {m.market for m in frag.markets}
        # partial markets (Bangladesh, Myanmar, Canada, Netherlands) are NOT rows:
        # their data lives inside the residual, never silently zeroed
        for partial in ("Bangladesh", "Myanmar", "Canada", "Netherlands"):
            assert partial not in names

    def test_anchor_yield_is_the_counterfactual_engine(self, offline_bundle):
        frag = offline_bundle.fragments["simulator"]
        mb = offline_bundle.fragments["missing_billions"]
        anchor_row = next(y for y in mb.years if y.year == frag.anchor_year)
        assert frag.anchor_per_visitor_real_2019_rm == anchor_row.per_visitor_real_2019_rm
        row24 = next(y for y in mb.years if y.year == 2024)
        assert frag.cpi_ratio_to_anchor_mix_year == row24.cpi_ratio_to_anchor

    def test_reconciliation_at_the_2024_actual_mix(self, offline_bundle):
        """The acceptance criterion: at the 2024 actual mix the simulator MUST
        reconcile exactly with the pipeline's missing_billions fragment."""
        report = check_simulator_reconciliation(offline_bundle)
        assert report, "reconciliation report must be produced"
        frag = offline_bundle.fragments["simulator"]
        mb = offline_bundle.fragments["missing_billions"]
        row24 = next(y for y in mb.years if y.year == 2024)
        result = simulate_mix(
            yields_real=[m.yield_2024_real_2019_rm_per_visitor for m in frag.markets],
            shares=[m.share_of_arrivals_2024 for m in frag.markets],
            visitor_arrivals=frag.visitor_arrivals_2024,
            anchor_per_visitor_real=frag.anchor_per_visitor_real_2019_rm,
        )
        assert result["receipts_2019_prices_rm_million"] == pytest.approx(
            row24.actual_receipts_2019_prices_rm_million, abs=RECONCILIATION_TOLERANCE_RM_M
        )
        assert result["gap_2019_prices_rm_million"] == pytest.approx(
            row24.gap_2019_prices_rm_million, abs=RECONCILIATION_TOLERANCE_RM_M
        )
        assert result["yield_per_visitor_real_rm"] == pytest.approx(
            row24.per_visitor_real_2019_rm, abs=1e-6
        )

    def test_rerun_is_deterministic(self, offline_data_dir, tmp_path):
        out1, out2 = tmp_path / "b1.json", tmp_path / "b2.json"
        main(["--data-dir", str(offline_data_dir), "--out", str(out1)])
        main(["--data-dir", str(offline_data_dir), "--out", str(out2)])
        b1 = Bundle.model_validate_json(out1.read_text())
        b2 = Bundle.model_validate_json(out2.read_text())
        assert b1.fragments["simulator"] == b2.fragments["simulator"]

    def test_negative_residual_is_loud(self, offline_bundle, monkeypatch):
        """If a data update makes the residual negative (basis drift), emission
        must fail loudly instead of shipping a fudge bucket."""
        sm = offline_bundle.fragments["source_market"]
        mb = offline_bundle.fragments["missing_billions"]
        # inflate the top market's receipts so the residual real receipts go negative
        sing = next(m for m in sm.markets if m.market == "Singapore")
        obs = sing.observations[0]
        obs.receipts_rm_million = obs.receipts_rm_million * 20
        obs.yield_rm_per_visitor = obs.receipts_rm_million * 1_000_000 / obs.arrivals_persons
        with pytest.raises(ValueError, match="residual"):
            build_simulator_fragment(sm, mb)


# --------------------------------------------------------------------------- #
# The committed round-trip fixture (Python wrote it; the dashboard's vitest
# suite must reproduce every expected value with the same arithmetic).
# --------------------------------------------------------------------------- #


class TestRoundTripFixture:
    @pytest.fixture
    def fixture_payload(self):
        assert DASHBOARD_FIXTURE.exists(), (
            f"{DASHBOARD_FIXTURE} missing - generate it with "
            "pipeline/tests/fixtures/make_simulator_fixture.py"
        )
        return json.loads(DASHBOARD_FIXTURE.read_text())

    def test_fixture_shape(self, fixture_payload):
        for key in ("inputs", "cases"):
            assert key in fixture_payload
        inputs = fixture_payload["inputs"]
        for key in (
            "yields_real",
            "markets",
            "visitor_arrivals",
            "anchor_per_visitor_real",
            "cpi_ratio_to_anchor",
        ):
            assert key in inputs
        assert len(inputs["yields_real"]) == len(inputs["markets"])

    def test_python_reproduces_every_expected_case(self, fixture_payload):
        inputs = fixture_payload["inputs"]
        for case in fixture_payload["cases"]:
            result = simulate_mix(
                yields_real=inputs["yields_real"],
                shares=case["shares"],
                visitor_arrivals=inputs["visitor_arrivals"],
                anchor_per_visitor_real=inputs["anchor_per_visitor_real"],
            )
            for field in (
                "yield_per_visitor_real_rm",
                "receipts_2019_prices_rm_million",
                "counterfactual_2019_prices_rm_million",
                "gap_2019_prices_rm_million",
            ):
                assert result[field] == pytest.approx(case["expected"][field], abs=1e-9), (
                    f"case {case['name']!r}: {field} drifted from the committed fixture"
                )
            assert result["contributions_2019_prices_rm_million"] == pytest.approx(
                case["expected"]["contributions_2019_prices_rm_million"], abs=1e-9
            )
