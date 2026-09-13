"""Generate the committed fixture extract of the In Brief 2024 PDF text.

Provenance (mirrors tests/fixtures/make_fixtures.py for the TSA workbooks):

    pdftotext -layout data/raw/inbrief2024.pdf data/raw/inbrief2024.txt

then this script slices the pages the source-market extractor needs (foreword
totals sentence, mode-of-transport TOTAL row, arrivals top-20 table, receipts
infographic totals, receipts top-20 table) into a small committed fixture. No
network, no PDF parsing at test time — raw extracted text committed under
tests/fixtures/inbrief2024.fixture.txt.

Usage (from repo root or pipeline/):
    .venv/bin/python tests/fixtures/make_pdf_fixture.py [full-extract.txt]
"""
import sys
from pathlib import Path

PAGE_MARKERS = [
    "In 2024, Malaysia welcomed",            # foreword: national arrivals + receipts headline
    "MODE OF",                               # mode-of-transport TOTAL row (national arrivals 2024/2023)
    "18,855,680",                            # arrivals by country of nationality (top 20)
    "106,783.11",                            # visitor receipts infographic (national totals 2024/2023)
    "27,941.65",                             # visitor receipts by country of nationality (top 20)
]


def build(full_text: str) -> str:
    pages = full_text.split("\f")
    keep = [p for p in pages if any(m in p for m in PAGE_MARKERS)]
    assert len(keep) == len(PAGE_MARKERS), (
        f"expected {len(PAGE_MARKERS)} marker pages, matched {len(keep)} — "
        "extract layout changed; update PAGE_MARKERS"
    )
    return "\f".join(keep)


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parents[3] / "data" / "raw" / "inbrief2024.txt"
    full = src.read_text()
    out = Path(__file__).parent / "inbrief2024.fixture.txt"
    out.write_text(build(full))
    print(f"wrote {out} ({out.stat().st_size} bytes, {full.count(chr(12)) + 1} -> {build(full).count(chr(12)) + 1} pages)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
