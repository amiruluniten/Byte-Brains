"""TSA national-series extractor.

Emits the labelled, never-mixed national series (ticket T1):
- tourist-basis arrivals 2015-2023   (tourism_2023.xlsx, Indicator Inbound, row "A1")
- visitor-basis arrivals 2019-2024   (tourism_2024.xlsx, Indicator Inbound, row "A1")
- tourist-basis arrivals 2019-2024   (tourism_2024.xlsx, Indicator Inbound, row "A2")
- excursionist arrivals 2019-2024    (tourism_2024.xlsx, Indicator Inbound, row "A3")
- inbound tourism consumption, tourist basis, 2015-2024 (Jad/table 1A totals)
"""
from __future__ import annotations

from openpyxl.workbook.workbook import Workbook

from ..bundle import Observation, Series, SourceRef
from ..workbook import collapse, to_number, year_columns


def _row_values(ws, row: int, columns: list[tuple[int, int, str | None]]) -> list[Observation]:
    out = []
    for year, col, flag in columns:
        value = to_number(ws.cell(row, col).value)
        if value is not None and value.is_integer():
            value = int(value)  # person counts are integers; RM million stays decimal
        out.append(Observation(year=year, value=value, revision_flag=flag))
    return out


def _find_anchor(ws, prefix: str, column: int = 2) -> int:
    """Find the sheet row whose label cell (bilingual, merged A:B) starts with prefix."""
    for row in range(1, ws.max_row + 1):
        for col in (column, 1):
            label = collapse(ws.cell(row, col).value)
            if label.lower().startswith(prefix.lower()):
                return row
    raise ValueError(f"anchor row starting {prefix!r} not found in sheet {ws.title!r}")


def _year_header(ws, row: int = 3, first_col: int = 2):
    return year_columns(ws[row])


def _make_series(series_id, measure, basis, unit, window, file, sheet, row, row_label, values):
    return Series(
        series_id=series_id,
        measure=measure,
        basis=basis,
        unit=unit,
        window=window,
        source=SourceRef(file=file, sheet=sheet, row_label=collapse(row_label), row=row),
        values=values,
    )


def extract_visitor_arrivals(wb: Workbook) -> Series:
    """Visitor arrivals, national total, 2019-2024 (2024 file, Indicator Inbound A1)."""
    ws = wb["Indicator Inbound"]
    cols = _year_header(ws)
    row = _find_anchor(ws, "A1.")
    return _make_series(
        "arrivals_visitor_2019_2024", "arrivals", "visitor", "persons", "2019-2024",
        "tourism_2024.xlsx", ws.title, row, ws.cell(row, 2).value, _row_values(ws, row, cols),
    )


def extract_tourist_arrivals_2024(wb: Workbook) -> Series:
    """Tourist arrivals, national total, 2019-2024 (2024 file, Indicator Inbound A2)."""
    ws = wb["Indicator Inbound"]
    cols = _year_header(ws)
    row = _find_anchor(ws, "A2.")
    return _make_series(
        "arrivals_tourist_2019_2024", "arrivals", "tourist", "persons", "2019-2024",
        "tourism_2024.xlsx", ws.title, row, ws.cell(row, 2).value, _row_values(ws, row, cols),
    )


def extract_excursionist_arrivals(wb: Workbook) -> Series:
    """Same-day visitor (excursionist) arrivals, national total, 2019-2024 (2024 file, A3)."""
    ws = wb["Indicator Inbound"]
    cols = _year_header(ws)
    row = _find_anchor(ws, "A3.")
    return _make_series(
        "arrivals_excursionist_2019_2024", "arrivals", "excursionist", "persons", "2019-2024",
        "tourism_2024.xlsx", ws.title, row, ws.cell(row, 2).value, _row_values(ws, row, cols),
    )


def extract_tourist_arrivals_2023(wb: Workbook) -> Series:
    """Tourist arrivals, national total, 2015-2023 (2023 file, Indicator Inbound A1).

    The A1 anchor row is itself the national total; country rows sit below it.
    """
    ws = wb["Indicator Inbound"]
    cols = _year_header(ws)
    row = _find_anchor(ws, "A1.")
    return _make_series(
        "arrivals_tourist_2015_2023", "arrivals", "tourist", "persons", "2015-2023",
        "tourism_2023.xlsx", ws.title, row, ws.cell(row, 2).value, _row_values(ws, row, cols),
    )


def extract_inbound_consumption(wb: Workbook) -> Series:
    """Inbound tourism consumption by tourists, totals 2015-2024 (Jad/table 1A, RM million).

    Reads the first "Jumlah/Total" row (values block); the share block repeats
    "Jumlah/Total" below the "Peratus sumbangan (%)" sub-header and is ignored.
    """
    ws = wb["Jad 1A"] if "Jad 1A" in wb.sheetnames else wb["table 1A"]
    cols = _year_header(ws)
    total_row = _find_anchor(ws, "Jumlah")
    file = "tourism_2024.xlsx" if "Jad 1A" in wb.sheetnames else "tourism_2023.xlsx"
    return _make_series(
        "inbound_consumption_tourist_2015_2024", "inbound_tourism_consumption",
        "tourist", "rm_million", "2015-2024",
        file, ws.title, total_row, ws.cell(total_row, 1).value,
        _row_values(ws, total_row, cols),
    )
