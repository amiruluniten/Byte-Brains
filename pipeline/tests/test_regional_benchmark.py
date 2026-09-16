"""Ticket T6: regional yield benchmark (Thailand, Indonesia vs Malaysia, 2024).

Tests are external-behaviour tests against the emitted `regional_benchmark`
bundle fragment — an additive fragment built from the officially published
2024 figures researched in research/regional-yield-benchmark-2024.md:

- every country row reconciles internally (yield vs receipts/arrivals);
- the reported change-vs-2019 percentages and Malaysia multiples reconcile;
- Malaysia is the baseline and matches the source_market fragment totals;
- Vietnam is excluded with the documented reason (receipts include domestic);
- basis caveats (survey vs balance-of-payments vs administrative) are explicit;
- the fragment is additive: bundle union accepts it, schema_version unchanged;
- deterministic across re-runs (no hidden state).
"""
import shutil

import pytest

from bytebrains_pipeline.bundle import Bundle, RegionalBenchmarkFragment
from bytebrains_pipeline.emit import build_bundle
from bytebrains_pipeline.regional_benchmark import build_regional_benchmark_fragment


@pytest.fixture
def regional():
    return build_regional_benchmark_fragment()


class TestFragmentContent:
    def test_three_countries_malaysia_baseline(self, regional):
        by_name = {c.country: c for c in regional.countries}
        assert set(by_name) == {"Malaysia", "Thailand", "Indonesia"}
        assert regional.baseline_market == "Malaysia"
        assert by_name["Malaysia"].role == "baseline"
        assert by_name["Thailand"].role == "comparator"
        assert by_name["Indonesia"].role == "comparator"

    def test_yields_match_the_researched_headline_table(self, regional):
        by_name = {c.country: c for c in regional.countries}
        assert by_name["Malaysia"].yield_2024_usd_per_visitor == pytest.approx(600, abs=1)
        assert by_name["Thailand"].yield_2024_usd_per_visitor == pytest.approx(1363, abs=1)
        assert by_name["Indonesia"].yield_2024_usd_per_visitor == pytest.approx(1202, abs=1)

    def test_yield_reconciles_with_receipts_over_arrivals(self, regional):
        for c in regional.countries:
            expected = c.receipts_2024.usd_billion * 1e9 / c.arrivals_2024
            assert c.yield_2024_usd_per_visitor == pytest.approx(expected, rel=0.01), c.country

    def test_change_vs_2019_reconciles_with_yields(self, regional):
        for c in regional.countries:
            expected = (c.yield_2024_usd_per_visitor / c.yield_2019_usd_per_visitor - 1) * 100
            assert c.yield_change_2024_vs_2019_pct == pytest.approx(expected, abs=1.0), c.country

    def test_malaysia_multiple_is_none_comparators_have_one(self, regional):
        by_name = {c.country: c for c in regional.countries}
        assert by_name["Malaysia"].yield_multiple_of_malaysia_2024 is None
        assert by_name["Thailand"].yield_multiple_of_malaysia_2024 == pytest.approx(
            by_name["Thailand"].yield_2024_usd_per_visitor / by_name["Malaysia"].yield_2024_usd_per_visitor,
            abs=0.05,
        )
        assert by_name["Indonesia"].yield_multiple_of_malaysia_2024 == pytest.approx(
            by_name["Indonesia"].yield_2024_usd_per_visitor / by_name["Malaysia"].yield_2024_usd_per_visitor,
            abs=0.05,
        )

    def test_every_country_cites_official_sources(self, regional):
        for c in regional.countries:
            assert c.source_urls, c.country
            assert all(u.startswith("http") for u in c.source_urls), c.country
            assert c.receipts_basis_note, c.country


class TestBasisCaveats:
    def test_receipts_bases_are_explicit_and_differ(self, regional):
        by_name = {c.country: c for c in regional.countries}
        assert by_name["Malaysia"].receipts_basis == "survey"
        assert by_name["Thailand"].receipts_basis == "survey"
        assert by_name["Indonesia"].receipts_basis == "balance_of_payments"

    def test_survey_vs_bop_vs_administrative_caveat_is_stated(self, regional):
        joined = " ".join(regional.caveats).lower()
        assert "survey" in joined
        assert "balance of payments" in joined or "balance-of-payments" in joined

    def test_vietnam_excluded_with_documented_reason(self, regional):
        assert [e.country for e in regional.excluded_markets] == ["Vietnam"]
        reason = regional.excluded_markets[0].reason.lower()
        assert "domestic" in reason  # the numerator includes domestic revenue


class TestAdditiveSchema:
    def test_valid_fragment_round_trips_through_json(self, regional):
        assert RegionalBenchmarkFragment.model_validate_json(regional.model_dump_json()) == regional

    def test_malaysia_reconciles_with_the_source_market_fragment(self, regional, source_market_fragment):
        totals_2024 = next(o for o in source_market_fragment.national_totals if o.year == 2024)
        my = next(c for c in regional.countries if c.country == "Malaysia")
        assert my.arrivals_2024 == totals_2024.arrivals_persons

    def test_bundle_accepts_the_fragment_in_its_union(self, offline_data_dir):
        bundle = build_bundle(offline_data_dir)
        assert "regional_benchmark" in bundle.fragments
        # additive schema discipline: tickets T5-T7 kept 1.0.0; ticket #13's
        # additive 2025 extension is what moved the schema, to 1.1.0
        assert bundle.schema_version == "1.1.0"
        reloaded = Bundle.model_validate_json(bundle.to_json())
        assert reloaded.checksum == bundle.checksum

    def test_bundle_regional_fragment_is_the_researched_one(self, offline_data_dir):
        bundle = build_bundle(offline_data_dir)
        frag = bundle.fragments["regional_benchmark"]
        by_name = {c.country: c for c in frag.countries}
        assert by_name["Thailand"].yield_2024_usd_per_visitor == pytest.approx(1363, abs=1)


@pytest.fixture
def offline_data_dir(tmp_path, fixtures_dir):
    d = tmp_path / "data"
    d.mkdir()
    shutil.copy(fixtures_dir / "tourism_2023.fixture.xlsx", d / "tourism_2023.xlsx")
    shutil.copy(fixtures_dir / "tourism_2024.fixture.xlsx", d / "tourism_2024.xlsx")
    shutil.copy(fixtures_dir / "inbrief2024.fixture.txt", d / "inbrief2024.txt")
    shutil.copy(fixtures_dir / "cpi_headline.fixture.csv", d / "cpi_headline.csv")
    shutil.copy(fixtures_dir / "wef_ttdi.fixture.csv", d / "WEF_TTDI.csv")
    return d


@pytest.fixture
def source_market_fragment(fixtures_dir):
    text = open(fixtures_dir / "inbrief2024.fixture.txt", encoding="utf-8").read()
    from bytebrains_pipeline.extractors.inbrief_markets import build_source_market_fragment

    return build_source_market_fragment(text)


class TestDeterminism:
    def test_rerun_is_identical(self):
        a = build_regional_benchmark_fragment()
        b = build_regional_benchmark_fragment()
        assert a.model_dump_json() == b.model_dump_json()
