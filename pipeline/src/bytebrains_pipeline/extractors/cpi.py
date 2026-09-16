"""CPI deflator extractor (ticket T4).

Source: DOSM OpenDOSM, dataset `cpi_headline` (Monthly CPI by Division, overall
division), downloaded with tools/dosm-cli and recorded as a raw CSV under data/raw/.
No network at run time: the pipeline reads the recorded file, the tests read a
committed fixture copy of the same shape.

Choice note (ticket T4): the national CPI (all items) is the deflator for the
Missing Billions counterfactual — it is the official DOSM price index for the
economy as a whole, which is what "deflated by national CPI" means for a national
receipts aggregate. The base year of the index is irrelevant to the counterfactual
(only CPI(year)/CPI(2019) ratios enter), so the published 2010=100 series is used as-is.
"""
from __future__ import annotations

import csv
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from ..bundle import MacroSeries, MacroSource, Observation

DATASET_ID = "cpi_headline"
DATASET_TITLE = "Monthly CPI by Division (2-digit), overall"
DATASET_URL = "https://storage.dosm.gov.my/cpi/cpi_2d.csv"
INDEX_BASE = "2010=100"
DIVISION = "overall"

# Default window matches the TSA series the counterfactual deflates. Ticket #13
# extends the window to 2025 for the 2025-edition bundle: pass window_end=2025
# to get the additive extended series (existing series ids/windows unchanged).
WINDOW_START, WINDOW_END = 2015, 2024


def extract_cpi(csv_path: Path, window_end: int = WINDOW_END) -> MacroSeries:
    """Annual-mean national CPI series from a recorded OpenDOSM cpi_headline CSV.

    The default window (2015-2024) reproduces the pre-2025 series exactly;
    window_end=2025 emits the additive extended series
    `cpi_national_overall_2015_2025` (ticket #13). Raises loudly when any year
    in the window is missing — a coverage gap is never shrunk silently.
    """
    by_year: dict[int, list[float]] = defaultdict(list)
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["division"].strip() != DIVISION:
                continue
            year = int(row["date"][:4])
            if WINDOW_START <= year <= window_end:
                by_year[year].append(float(row["index"]))
    missing = [y for y in range(WINDOW_START, window_end + 1) if y not in by_year]
    if missing:
        raise ValueError(f"CPI CSV {csv_path.name}: missing years {missing}; re-fetch with dosm-cli")
    values = [
        Observation(year=year, value=round(sum(xs) / len(xs), 6))
        for year, xs in sorted(by_year.items())
    ]
    source = MacroSource(
        dataset_id=DATASET_ID,
        title=DATASET_TITLE,
        url=DATASET_URL,
        fetched_utc=getattr(extract_cpi, "_fetched_utc", "2026-09-13T00:00:00Z"),
        index_base=INDEX_BASE,
    )
    return MacroSeries(
        series_id=f"cpi_national_{DIVISION}_{WINDOW_START}_{window_end}",
        measure="cpi",
        unit="index",
        window=f"{WINDOW_START}-{window_end}",
        source=source,
        values=values,
    )
