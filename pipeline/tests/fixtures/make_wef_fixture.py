"""Generate tests/fixtures/wef_ttdi.fixture.csv from the real WEF TTDI download
(source/dataset/WEF_TTDI.csv): same SDMX/DATA360 shape, sliced to the REF_AREA
codes of Malaysia's top-20 source markets, the five selected indicators, and the
raw-value breakdown (WEF_TTDI_VAL) — plus a few decoy rows that the parser must
filter out (score breakdowns, markets outside the panel, unused indicators).
Stdlib only, so it runs inside the pipeline venv. No network at test time.

    .venv/bin/python tests/fixtures/make_wef_fixture.py
"""
import csv
import sys
from pathlib import Path

REAL = Path(__file__).resolve().parents[3] / "source" / "dataset" / "WEF_TTDI.csv"
OUT = Path(__file__).resolve().parent / "wef_ttdi.fixture.csv"

REF_AREAS = {
    "SGP", "CHN", "IDN", "IND", "THA", "KOR", "AUS", "GBR", "JPN", "PHL",
    "USA", "VNM", "FRA", "DEU", "PAK", "BGD", "CAN", "NLD",
}
INDICATORS = {
    "WEF_TTDI_PPP", "WEF_TTDI_LENGTHSTAY", "WEF_TTDI_TTDI",
    "WEF_TTDI_IATACONNECTIDX", "WEF_TTDI_PASSPORTMOBHPI",
}


def keep(row, area_ok=True):
    if not area_ok:
        return False
    if row["COMP_BREAKDOWN_1"] != "WEF_TTDI_VAL":
        return False
    return row["INDICATOR"] in INDICATORS


def main():
    with open(REAL, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames
    out = [
        row for row in rows
        if keep(row, area_ok=row["REF_AREA"] in REF_AREAS)
        # decoys the parser must filter out: score breakdowns for a covered market
        or (row["REF_AREA"] == "SGP" and row["INDICATOR"] == "WEF_TTDI_TTDI"
            and row["COMP_BREAKDOWN_1"] == "WEF_TTDI_SCR")
        # decoy: a market outside the top-20 panel
        or (row["REF_AREA"] == "MYS" and row["INDICATOR"] in INDICATORS
            and row["COMP_BREAKDOWN_1"] == "WEF_TTDI_VAL")
        # decoy: an indicator outside the selected subset
        or (row["REF_AREA"] == "SGP" and row["INDICATOR"] == "WEF_TTDI_3GNETWORKCOVERAGE"
            and row["COMP_BREAKDOWN_1"] == "WEF_TTDI_VAL")
    ]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(out)
    areas = {r["REF_AREA"] for r in out}
    years = sorted({r["TIME_PERIOD"] for r in out})
    print(f"wrote {OUT}: {len(out)} rows, {len(areas)} ref areas, years {years}")


if __name__ == "__main__":
    sys.exit(main())
