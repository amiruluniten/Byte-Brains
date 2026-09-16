"""TSA national-series extractor.

Emits the labelled, never-mixed national series (ticket T1):
- tourist-basis arrivals 2015-2023   (tourism_2023.xlsx, Indicator Inbound, row "A1")
- visitor-basis arrivals 2019-2024   (tourism_2024.xlsx, Indicator Inbound, row "A1")
- tourist-basis arrivals 2019-2024   (tourism_2024.xlsx, Indicator Inbound, row "A2")
- excursionist arrivals 2019-2024    (tourism_2024.xlsx, Indicator Inbound, row "A3")
- inbound tourism consumption, tourist basis, 2015-2024 (Jad/table 1A totals)

Ticket #13 adds the TSA 2025 edition ("2025p" preliminary release), ADDITIVELY —
existing series identifiers and windows are unchanged:
- visitor/tourist/excursionist arrivals 2019-2025 (tourism_2025.xlsx, rows A1/A2/A3)
- inbound tourism consumption, tourist basis, 2015-2025 (Jad 1A totals), with the
  workbook's revised 2024 (RM102,931.3m, revision_status "revised") and its
  preliminary 2025 column (revision_status "preliminary")

The anchor/year-header strategy is edition-independent: the label-prefix search
tolerates the blank spacer rows the 2025 export inserts between sections, and the
year header stays in row 3.
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


def _with_revision_status(values: list[Observation], year: int, status: str) -> list[Observation]:
    """Re-flag one year's observations with an explicit revision status.

    The TSA 2025 release (ticket #13) restates 2024 and marks 2025 preliminary
    (the "2025p" year headers in the Jad tables). The year-header suffix already
    carries the workbook's own marker in revision_flag; this sets the bundle's
    revision_status vocabulary on top, from the release-level marker.
    """
    return [
        obs if obs.year != year else obs.model_copy(update={"revision_status": status})
        for obs in values
    ]


def _extract_indicator_inbound(
    wb: Workbook, anchor: str, series_id: str, basis: str, window: str, file: str,
    preliminary_year: int | None = None,
) -> Series:
    """One labelled arrivals series from the "Indicator Inbound" sheet.

    The anchor/year-header strategy is edition-independent: the bilingual
    label-prefix search tolerates the blank spacer rows the 2025 export inserts
    between sections, and the year header stays in row 3 (ticket #13).
    """
    ws = wb["Indicator Inbound"]
    cols = _year_header(ws)
    row = _find_anchor(ws, anchor)
    values = _row_values(ws, row, cols)
    if preliminary_year is not None:
        # the TSA 2025 release marks the 2025 column preliminary ("2025p" in the
        # Jad table year headers); the Indicator Inbound header prints "2025"
        # without the suffix, but the release-level marker applies (ticket #13)
        values = _with_revision_status(values, preliminary_year, "preliminary")
    return _make_series(
        series_id, "arrivals", basis, "persons", window, file, ws.title, row,
        ws.cell(row, 2).value, values,
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


def extract_visitor_arrivals_2025(wb: Workbook) -> Series:
    """Visitor arrivals, national total, 2019-2025 (2025 file, Indicator Inbound A1).

    2025 is the TSA 2025 release's preliminary year (revision_status
    "preliminary"); see _extract_indicator_inbound.
    """
    return _extract_indicator_inbound(
        wb, "A1.", "arrivals_visitor_2019_2025", "visitor", "2019-2025",
        "tourism_2025.xlsx", preliminary_year=2025,
    )


def extract_tourist_arrivals_2025(wb: Workbook) -> Series:
    """Tourist arrivals, national total, 2019-2025 (2025 file, Indicator Inbound A2)."""
    return _extract_indicator_inbound(
        wb, "A2.", "arrivals_tourist_2019_2025", "tourist", "2019-2025",
        "tourism_2025.xlsx", preliminary_year=2025,
    )


def extract_excursionist_arrivals_2025(wb: Workbook) -> Series:
    """Same-day visitor (excursionist) arrivals, 2019-2025 (2025 file, A3)."""
    return _extract_indicator_inbound(
        wb, "A3.", "arrivals_excursionist_2019_2025", "excursionist", "2019-2025",
        "tourism_2025.xlsx", preliminary_year=2025,
    )


def extract_inbound_consumption_2025(wb: Workbook) -> Series:
    """Inbound tourism consumption by tourists, totals 2015-2025 (2025 file, Jad 1A).

    The TSA 2025 workbook REVISES 2024 (RM102,931.3m vs the 2024 edition's
    RM102,815.3m — revision_status "revised") and marks 2025 preliminary via its
    own "2025p" year header. Later official workbook wins (ticket #12/#13).
    """
    ws = wb["Jad 1A"] if "Jad 1A" in wb.sheetnames else wb["table 1A"]
    cols = _year_header(ws)
    total_row = _find_anchor(ws, "Jumlah")
    values = _row_values(ws, total_row, cols)
    values = _with_revision_status(values, 2024, "revised")
    values = _with_revision_status(values, 2025, "preliminary")
    return _make_series(
        "inbound_consumption_tourist_2015_2025", "inbound_tourism_consumption",
        "tourist", "rm_million", "2015-2025",
        "tourism_2025.xlsx", ws.title, total_row, ws.cell(total_row, 1).value, values,
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
