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


def test_cli_prints_counterfactual(offline_data_dir, tmp_path, capsys):
    out = tmp_path / "bundle.json"
    main(["--data-dir", str(offline_data_dir), "--out", str(out)])
    captured = capsys.readouterr().out
    assert "Missing Billions" in captured
    assert "constant 2019 prices" in captured
    assert "naive nominal" in captured
    assert "Volume Trap" in captured
    assert "25.5" in captured and "34.1" in captured and "66.1" in captured
