"""Ticket T5: source-market segmentation — clusters named, tiers communicated.

Tests are external-behaviour tests against the emitted `source_segmentation`
bundle fragment:

- deterministic (fixed seed) and stable under re-run;
- human-readable segment names (closed vocabulary, never machine ids);
- quartile tiers reconciled against the SAME yield figures the clusters use;
- WEF TTDI features ingested with source attribution, missing handled explicitly.
"""
import json
import shutil
import statistics

import pytest

from bytebrains_pipeline.bundle import Bundle
from bytebrains_pipeline.emit import build_bundle
from bytebrains_pipeline.segmentation import build_segmentation_fragment

SEGMENT_VOCAB = {
    "Volume Traps",
    "High-Yield Long-Haul",
    "High-Growth Emerging",
    "Mid-Yield Steady",
    "Low-Yield Steady",
    "High-Yield High-Volume",
    "Low-Yield High-Volume",
}
TIER_KEYS = {"top_quartile", "upper_middle", "lower_middle", "bottom_quartile"}


@pytest.fixture
def source_market_fragment(fixtures_dir):
    text = open(fixtures_dir / "inbrief2024.fixture.txt", encoding="utf-8").read()
    from bytebrains_pipeline.extractors.inbrief_markets import build_source_market_fragment

    return build_source_market_fragment(text)


@pytest.fixture
def wef_csv(fixtures_dir):
    return fixtures_dir / "wef_ttdi.fixture.csv"


@pytest.fixture
def segmentation(source_market_fragment, wef_csv):
    return build_segmentation_fragment(source_market_fragment, wef_csv=wef_csv)


class TestDeterminism:
    def test_rerun_is_identical(self, source_market_fragment, wef_csv):
        a = build_segmentation_fragment(source_market_fragment, wef_csv=wef_csv)
        b = build_segmentation_fragment(source_market_fragment, wef_csv=wef_csv)
        assert a.model_dump_json() == b.model_dump_json()

    def test_cluster_labels_stable_across_rerun(self, segmentation, source_market_fragment, wef_csv):
        again = build_segmentation_fragment(source_market_fragment, wef_csv=wef_csv)
        first = {m.market: (m.cluster_id, m.segment_name) for m in segmentation.markets if m.clustered}
        second = {m.market: (m.cluster_id, m.segment_name) for m in again.markets if m.clustered}
        assert first == second
        assert len(first) > 0


class TestSegmentNames:
    def test_names_are_human_readable_not_machine_ids(self, segmentation):
        names = {c.segment_name for c in segmentation.clusters}
        assert names and names <= SEGMENT_VOCAB  # closed vocabulary, judge-readable
        for c in segmentation.clusters:
            assert "cluster" not in c.segment_name.lower()

    def test_names_unique_per_cluster(self, segmentation):
        names = [c.segment_name for c in segmentation.clusters]
        assert len(set(names)) == len(names)

    def test_clustered_markets_carry_their_segment_name(self, segmentation):
        by_id = {c.cluster_id: c for c in segmentation.clusters}
        for m in segmentation.markets:
            if m.clustered:
                assert m.segment_name == by_id[m.cluster_id].segment_name


class TestExplicitMissing:
    def test_markets_absent_from_wef_are_attributed_not_zeroed(self, segmentation):
        by_market = {m.market: m for m in segmentation.markets}
        # Brunei and Chinese Taipei are in the top-20 tables but not in the WEF TTDI file
        for market in ["Brunei", "Chinese Taipei"]:
            assert by_market[market].wef_missing, f"{market} must list its missing indicators"
            assert all(
                by_market[market].wef_indicators[k] is None for k in by_market[market].wef_missing
            )

    def test_markets_without_yield_are_excluded_from_clustering_with_reason(self, segmentation):
        by_market = {m.market: m for m in segmentation.markets}
        for market in ["Bangladesh", "Myanmar"]:  # arrivals_only: no yield to segment on
            assert not by_market[market].clustered
            assert by_market[market].excluded_reason
        for market in ["Canada", "Netherlands"]:  # receipts_only: no arrivals/volume
            assert not by_market[market].clustered

    def test_wef_features_carry_source_attribution(self, segmentation):
        wef_features = [f for f in segmentation.features if f.name.startswith("wef_")]
        assert wef_features, "at least one WEF TTDI feature must be documented"
        for f in wef_features:
            assert "WEF_TTDI" in f.source or "WEF_TTDI.csv" in f.source
        assert segmentation.source.wef_file
        assert segmentation.source.wef_dataset


class TestTiers:
    def test_every_yield_market_has_a_tier(self, segmentation):
        for m in segmentation.markets:
            if m.yield_rm_per_visitor_2024 is not None:
                assert m.yield_tier in TIER_KEYS
                assert m.tier_label
            else:
                assert m.yield_tier is None

    def test_tiers_reconcile_against_the_same_yield_figures(self, segmentation):
        yields = [m.yield_rm_per_visitor_2024 for m in segmentation.markets
                  if m.yield_rm_per_visitor_2024 is not None]
        q25, q50, q75 = statistics.quantiles(yields, n=4, method="inclusive")
        boundaries = segmentation.yield_quartile_boundaries
        assert abs(boundaries["q25"] - q25) < 1e-9
        assert abs(boundaries["q50"] - q50) < 1e-9
        assert abs(boundaries["q75"] - q75) < 1e-9
        for m in segmentation.markets:
            if m.yield_rm_per_visitor_2024 is None:
                continue
            y = m.yield_rm_per_visitor_2024
            expected = ("top_quartile" if y >= q75
                        else "upper_middle" if y >= q50
                        else "lower_middle" if y >= q25
                        else "bottom_quartile")
            assert m.yield_tier == expected, m.market

    def test_tier_labels_are_judge_readable(self, segmentation):
        assert set(segmentation.tier_labels) == TIER_KEYS
        for label in segmentation.tier_labels.values():
            assert "quartile" in label.lower()


class TestReconciliation:
    def test_segmentation_yields_match_the_source_market_fragment(self, source_market_fragment, segmentation):
        src = {m.market: next(o for o in m.observations if o.year == 2024).yield_rm_per_visitor
               for m in source_market_fragment.markets}
        for m in segmentation.markets:
            assert m.yield_rm_per_visitor_2024 == src[m.market]

    def test_cluster_mean_yield_matches_its_members(self, segmentation):
        by_market = {m.market: m for m in segmentation.markets}
        for c in segmentation.clusters:
            member_yields = [by_market[m].yield_rm_per_visitor_2024 for m in c.members]
            assert all(y is not None for y in member_yields)
            assert abs(c.mean_yield_rm_per_visitor - sum(member_yields) / len(member_yields)) < 0.01


class TestFragmentSchema:
    def test_valid_fragment_round_trips_through_json(self, segmentation):
        from bytebrains_pipeline.bundle import SegmentationFragment

        assert SegmentationFragment.model_validate_json(segmentation.model_dump_json()) == segmentation

    def test_bundle_accepts_the_fragment_in_its_union(self, minimal_bundle_with_segmentation):
        bundle = minimal_bundle_with_segmentation
        assert "source_segmentation" in bundle.fragments
        reloaded = Bundle.model_validate_json(bundle.to_json())
        assert reloaded.checksum == bundle.checksum


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
def minimal_bundle_with_segmentation(offline_data_dir, wef_csv):
    return build_bundle(offline_data_dir, wef_csv=wef_csv)


class TestEndToEnd:
    def test_bundle_carries_the_segmentation_fragment(self, minimal_bundle_with_segmentation):
        frag = minimal_bundle_with_segmentation.fragments["source_segmentation"]
        assert len(frag.clusters) == 4
        assert any(m.segment_name == "Volume Traps" for m in frag.markets)

    def test_bundle_rerun_is_deterministic(self, offline_data_dir, wef_csv):
        b1 = build_bundle(offline_data_dir, wef_csv=wef_csv)
        b2 = build_bundle(offline_data_dir, wef_csv=wef_csv)
        assert b1.fragments == b2.fragments
