"""Slice 3 (red): one command runs extraction + validation end to end and prints
the national series table. Run offline against the committed fixtures.
"""
import json
import shutil

import pytest
from openpyxl import load_workbook

from bytebrains_pipeline.bundle import Bundle
from bytebrains_pipeline.cli import main

@pytest.fixture
def offline_data_dir(tmp_path, fixtures_dir):
    d = tmp_path / "data"
    d.mkdir()
    shutil.copy(fixtures_dir / "tourism_2023.fixture.xlsx", d / "tourism_2023.xlsx")
    shutil.copy(fixtures_dir / "tourism_2024.fixture.xlsx", d / "tourism_2024.xlsx")
    shutil.copy(fixtures_dir / "inbrief2024.fixture.txt", d / "inbrief2024.txt")
    shutil.copy(fixtures_dir / "cpi_headline.fixture.csv", d / "cpi_headline.csv")  # ticket T4
    return d


def test_end_to_end(offline_data_dir, tmp_path, capsys):
    out = tmp_path / "bundle.json"
    main(["--data-dir", str(offline_data_dir), "--out", str(out)])

    captured = capsys.readouterr().out
    # national series table, with basis labels and key values
    assert "visitor" in captured
    assert "tourist" in captured
    assert "26,100,784" in captured
    assert "37,961,485" in captured
    assert "86,706.5" in captured
    assert "102,815.3" in captured
    # source-market table (ticket T3)
    assert "Singapore" in captured
    assert "27,941.65" in captured
    assert "18,855,680" in captured
    assert "arrivals_only" in captured
    assert "receipts_only" in captured
    assert "never silently zeroed" in captured
    assert "RM2,813 per visitor" in captured or "2,813" in captured

    payload = json.loads(out.read_text())
    bundle = Bundle.model_validate(payload)
    assert bundle.bundle_version == 1
    frag = bundle.fragments["national_series"]
    assert len(frag.series) == 5
    ids = {s.series_id for s in frag.series}
    assert "arrivals_tourist_2015_2023" in ids
    assert "arrivals_visitor_2019_2024" in ids
    market_frag = bundle.fragments["source_market"]
    assert {m.market for m in market_frag.markets if m.coverage == "arrivals_only"} == {
        "Bangladesh", "Myanmar"
    }
    # reloaded bundle still passes its own checksum
    Bundle.model_validate_json(out.read_text())


def test_ground_truth_failure_is_loud(offline_data_dir, tmp_path):
    # corrupt the 2019 Jad 1A total in a copy of the fixture workbook
    corrupt = tmp_path / "corrupt"
    corrupt.mkdir()
    for name in ["tourism_2023.xlsx", "tourism_2024.xlsx", "inbrief2024.txt", "cpi_headline.csv"]:
        shutil.copy(offline_data_dir / name, corrupt / name)
    for name in ["tourism_2023.xlsx", "tourism_2024.xlsx"]:
        src = offline_data_dir / name
        wb = load_workbook(src)
        if name == "tourism_2024.xlsx":
            wb["Jad 1A"]["F14"] = 999.9
        wb.save(corrupt / name)
    with pytest.raises(SystemExit, match="ground-truth"):
        main(["--data-dir", str(corrupt), "--out", str(tmp_path / "bundle.json")])
