"""T4 slice 4 (red): end-to-end emission of the Missing Billions fragment.

Offline (recorded fixtures), deterministic under re-run, and loud when the
deflator data is corrupted.
"""
import json
import shutil

import pytest

from bytebrains_pipeline.bundle import Bundle
from bytebrains_pipeline.cli import main


@pytest.fixture
def offline_data_dir(tmp_path, fixtures_dir):
    d = tmp_path / "data"
    d.mkdir()
    shutil.copy(fixtures_dir / "tourism_2023.fixture.xlsx", d / "tourism_2023.xlsx")
    shutil.copy(fixtures_dir / "tourism_2024.fixture.xlsx", d / "tourism_2024.xlsx")
    shutil.copy(fixtures_dir / "cpi_headline.fixture.csv", d / "cpi_headline.csv")
    shutil.copy(fixtures_dir / "inbrief2024.fixture.txt", d / "inbrief2024.txt")
    return d


def test_bundle_carries_all_three_fragments(offline_data_dir, tmp_path):
    out = tmp_path / "bundle.json"
    main(["--data-dir", str(offline_data_dir), "--out", str(out)])
    payload = json.loads(out.read_text())
    # tickets T5 (source_segmentation) and T7 (simulator) add fragments
    # additively; the T4 fragments must always be present.
    assert {
        "national_series",
        "source_market",
        "macro_series",
        "missing_billions",
    } <= set(payload["fragments"])


def test_missing_billions_values_end_to_end(offline_data_dir, tmp_path):
    out = tmp_path / "bundle.json"
    main(["--data-dir", str(offline_data_dir), "--out", str(out)])
    bundle = Bundle.model_validate_json(out.read_text())
    frag = bundle.fragments["missing_billions"]
    assert frag.anchor_year == 2019
    assert frag.prices == "constant_2019_rm"
    assert [y.year for y in frag.years] == [2019, 2020, 2021, 2022, 2023, 2024]

    y2024 = frag.years[-1]
    # hand-computed (Jad 1A receipts / visitor arrivals / DOSM CPI, 2010=100)
    assert y2024.per_visitor_nominal_rm == pytest.approx(2708.410906, abs=0.01)
    assert y2024.cpi_ratio_to_anchor == pytest.approx(1.093085, abs=1e-4)
    assert y2024.per_visitor_real_2019_rm == pytest.approx(2477.766815, abs=0.01)
    assert y2024.counterfactual_receipts_2019_prices_rm_million == pytest.approx(93920.639143, abs=0.5)
    assert y2024.actual_receipts_2019_prices_rm_million == pytest.approx(94059.707775, abs=0.5)
    assert y2024.gap_2019_prices_rm_million == pytest.approx(-139.068632, abs=0.5)
    assert y2024.naive_nominal_gap_rm_million == pytest.approx(-8894.660857, abs=0.5)
    assert y2024.naive_nominal_gap_rm_million < 0  # the loud assertion

    # deflator provenance documented in the bundle
    assert frag.deflator.source.dataset_id == "cpi_headline"
    assert frag.deflator.source.fetched_utc
    assert frag.deflator.anchor_index == pytest.approx(121.483333, abs=1e-4)
    cpi_series = next(
        s for s in bundle.fragments["macro_series"].series
        if s.series_id == frag.cpi_series_id
    )
    assert cpi_series.measure == "cpi"


def test_volume_trap_indicators_end_to_end(offline_data_dir, tmp_path):
    out = tmp_path / "bundle.json"
    main(["--data-dir", str(offline_data_dir), "--out", str(out)])
    bundle = Bundle.model_validate_json(out.read_text())
    vt = bundle.fragments["missing_billions"].volume_trap
    assert vt.excursionist_share_2019_pct == pytest.approx(25.5, abs=0.05)
    assert vt.excursionist_share_2024_pct == pytest.approx(34.1, abs=0.05)
    assert vt.excursionist_share_change_pp == pytest.approx(8.6, abs=0.05)
    assert vt.land_mode_share_2024_pct == 66.1
    assert "in Brief 2024" in vt.land_mode_share_source


def test_rerun_is_deterministic(offline_data_dir, tmp_path):
    out1, out2 = tmp_path / "b1.json", tmp_path / "b2.json"
    main(["--data-dir", str(offline_data_dir), "--out", str(out1)])
    main(["--data-dir", str(offline_data_dir), "--out", str(out2)])
    b1 = Bundle.model_validate_json(out1.read_text())
    b2 = Bundle.model_validate_json(out2.read_text())
    assert b1.checksum == b2.checksum
    assert b1.fragments == b2.fragments


def test_corrupted_cpi_is_loud(tmp_path, fixtures_dir):
    corrupt = tmp_path / "corrupt"
    corrupt.mkdir()
    for name in [
        "tourism_2023.fixture.xlsx",
        "tourism_2024.fixture.xlsx",
        "cpi_headline.fixture.csv",
        "inbrief2024.fixture.txt",
    ]:
        shutil.copy(fixtures_dir / name, corrupt / name)
    (corrupt / "tourism_2023.fixture.xlsx").rename(corrupt / "tourism_2023.xlsx")
    (corrupt / "tourism_2024.fixture.xlsx").rename(corrupt / "tourism_2024.xlsx")
    (corrupt / "cpi_headline.fixture.csv").rename(corrupt / "cpi_headline.csv")
    (corrupt / "inbrief2024.fixture.txt").rename(corrupt / "inbrief2024.txt")
    text = (corrupt / "cpi_headline.csv").read_text()
    # inflate every 2019 index reading x2 -> the deflator ground truth must fail loudly
    lines = text.splitlines()
    header, rows = lines[0], lines[1:]
    fixed = []
    for line in rows:
        date, division, index = line.split(",")
        if date.startswith("2019"):
            index = str(float(index) * 2)
        fixed.append(f"{date},{division},{index}")
    (corrupt / "cpi_headline.csv").write_text("\n".join([header] + fixed) + "\n")

    with pytest.raises(SystemExit, match="ground-truth"):
        main(["--data-dir", str(corrupt), "--out", str(tmp_path / "bundle.json")])


class TestTsa2025EndToEnd:
    """Ticket #13: the pipeline run against the TSA 2025 workbook (offline
    fixtures) emits the schema-1.1.0 bundle with the revised 2024, the
    preliminary 2025, and the guarded headline."""

    @pytest.fixture
    def offline_2025_data_dir(self, tmp_path, fixtures_dir):
        d = tmp_path / "data2025"
        d.mkdir()
        for name in [
            "tourism_2023.fixture.xlsx", "tourism_2024.fixture.xlsx",
            "tourism_2025.fixture.xlsx", "cpi_headline.fixture.csv",
            "inbrief2024.fixture.txt",
        ]:
            shutil.copy(fixtures_dir / name, d / name.replace(".fixture", ""))
        return d

    def test_bundle_carries_the_2025_edition_series(self, offline_2025_data_dir, tmp_path):
        out = tmp_path / "bundle.json"
        main(["--data-dir", str(offline_2025_data_dir), "--out", str(out)])
        bundle = Bundle.model_validate_json(out.read_text())
        assert bundle.schema_version == "1.1.0"
        frag = bundle.fragments["national_series"]
        assert len(frag.series) == 9  # 5 pre-existing + 4 additive 2025-edition series
        ids = {s.series_id for s in frag.series}
        # existing series ids/windows unchanged (additive only)
        assert {
            "arrivals_tourist_2015_2023", "arrivals_visitor_2019_2024",
            "arrivals_tourist_2019_2024", "arrivals_excursionist_2019_2024",
            "inbound_consumption_tourist_2015_2024",
        } <= ids
        assert {
            "arrivals_visitor_2019_2025", "arrivals_tourist_2019_2025",
            "arrivals_excursionist_2019_2025", "inbound_consumption_tourist_2015_2025",
        } <= ids
        consumption = next(s for s in frag.series if s.series_id == "inbound_consumption_tourist_2015_2025")
        by_year = {o.year: o for o in consumption.values}
        assert by_year[2024].value == 102931.3 and by_year[2024].revision_status == "revised"
        assert by_year[2025].value == 119312.0 and by_year[2025].revision_status == "preliminary"
        arrivals = next(s for s in frag.series if s.series_id == "arrivals_visitor_2019_2025")
        assert arrivals.values[-1].value == 42196892
        assert arrivals.values[-1].revision_status == "preliminary"

    def test_missing_billions_gains_2025_and_the_guard(self, offline_2025_data_dir, tmp_path):
        out = tmp_path / "bundle.json"
        main(["--data-dir", str(offline_2025_data_dir), "--out", str(out)])
        bundle = Bundle.model_validate_json(out.read_text())
        frag = bundle.fragments["missing_billions"]
        assert [y.year for y in frag.years] == list(range(2019, 2026))
        y2025 = frag.years[-1]
        assert y2025.revision_status == "preliminary"
        assert y2025.gap_2019_prices_rm_million == pytest.approx(-3265.665656, abs=0.5)
        assert y2025.naive_nominal_gap_rm_million == pytest.approx(-14912.525994, abs=0.5)
        assert y2025.per_visitor_real_2019_rm == pytest.approx(2551.494543, abs=0.01)
        # the pre-registered headline stays 2020-2024; its VALUE recomputes from
        # the revised receipts (later official workbook wins) -> RM10,098.4m
        assert frag.headline.window == "2020-2024"
        assert frag.headline.cumulative_gap_rm_million == pytest.approx(10098.357654, abs=0.05)
        sup = frag.supplementary
        assert sup is not None and sup.window == "2020-2025"
        assert "supplementary" in sup.label.lower()
        assert sup.cumulative_gap_rm_million == pytest.approx(6832.691999, abs=0.05)
        # deflator metadata: 2025 overall CPI ratio vs 2019
        assert frag.deflator.series_id == "cpi_national_overall_2015_2025"
        assert y2025.cpi_ratio_to_anchor == pytest.approx(134.625 / 121.483333, abs=1e-6)

    def test_2025_workbook_is_hashed_into_the_sources(self, offline_2025_data_dir, tmp_path):
        import hashlib
        out = tmp_path / "bundle.json"
        main(["--data-dir", str(offline_2025_data_dir), "--out", str(out)])
        bundle = Bundle.model_validate_json(out.read_text())
        raw = (offline_2025_data_dir / "tourism_2025.xlsx").read_bytes()
        assert bundle.sources["tourism_2025.xlsx"] == hashlib.sha256(raw).hexdigest()

    def test_cli_prints_headline_and_supplementary(self, offline_2025_data_dir, tmp_path, capsys):
        out = tmp_path / "bundle.json"
        main(["--data-dir", str(offline_2025_data_dir), "--out", str(out)])
        captured = capsys.readouterr().out
        assert "Headline (pre-registered): RM10,098.4m (2020-2024, constant 2019 prices)" in captured
        assert "Supplementary (labelled, NEVER the headline): RM6,832.7m (2020-2025" in captured
        assert "42,196,892" in captured and "119,312.0" in captured and "102,931.3" in captured

    def test_2025_rerun_is_deterministic(self, offline_2025_data_dir, tmp_path):
        out1, out2 = tmp_path / "a.json", tmp_path / "b.json"
        main(["--data-dir", str(offline_2025_data_dir), "--out", str(out1)])
        main(["--data-dir", str(offline_2025_data_dir), "--out", str(out2)])
        b1 = Bundle.model_validate_json(out1.read_text())
        b2 = Bundle.model_validate_json(out2.read_text())
        assert b1.checksum == b2.checksum
        assert b1.fragments == b2.fragments


def test_cli_prints_counterfactual(offline_data_dir, tmp_path, capsys):
    out = tmp_path / "bundle.json"
    main(["--data-dir", str(offline_data_dir), "--out", str(out)])
    captured = capsys.readouterr().out
    assert "Missing Billions" in captured
    assert "constant 2019 prices" in captured
    assert "naive nominal" in captured
    assert "Volume Trap" in captured
    assert "25.5" in captured and "34.1" in captured and "66.1" in captured
