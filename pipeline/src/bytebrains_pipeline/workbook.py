"""openpyxl helpers for the DOSM TSA workbooks.

Every gotcha from research/tsa-xlsx-map.md lives here:
- bilingual merged A:B label cells (read the anchor cell only)
- year header row 3 with mixed str/int cells and revision flags ("2023p", "2024p")
- footnote strings ("n.a", "..", "4.1*")
- phantom max_col=16384 formatting artifacts (we only scan columns we mapped)
"""
from __future__ import annotations

import re
from typing import Iterable

YEAR_CELL = re.compile(r"^(\d{4})\s*([a-zA-Z])?$")

FOOTNOTE_NULL = {"n.a", "n.a.", "..", "-", "na", ""}


def collapse(value) -> str:
    """Collapse a (possibly multiline, bilingual) label into single-spaced text."""
    return re.sub(r"\s+", " ", str(value)).strip() if value is not None else ""


def to_number(value) -> float | None:
    """Coerce a sheet cell to a number.

    - ints/floats pass through
    - "4.1*" keeps the number, drops the asterisk footnote
    - "n.a", "..", "-" and anything else unparseable become None
    """
    if isinstance(value, (int, float)):
        return float(value)
    if value is None:
        return None
    text = str(value).strip()
    if text.lower() in FOOTNOTE_NULL:
        return None
    text = text.replace("*", "").replace(",", "").strip()
    try:
        return float(text)
    except ValueError:
        return None


def year_columns(header_cells: Iterable) -> list[tuple[int, int, str | None]]:
    """Parse (year, column_index, revision_flag) from a year header row.

    Non-year header cells ("Tahun / Year", "RM Juta / RM Million") are skipped.
    """
    out = []
    for cell in header_cells:
        if cell.value is None:
            continue
        m = YEAR_CELL.match(str(cell.value).strip())
        if m:
            out.append((int(m.group(1)), cell.column, m.group(2)))
    return out
