"""One command: extract the TSA national series, validate the bundle end to end,
write the data bundle, and print the national series table.

    tsa-pipeline [--data-dir DIR] [--out FILE]

Defaults: --data-dir <repo>/data/raw, --out <repo>/data/processed/bundle.json
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .emit import build_bundle, write_bundle

REPO_ROOT = Path(__file__).resolve().parents[3]

HEADERS = [
    "Year",
    "Visitor arrivals (2019-2024)",
    "Tourist arrivals 2015-2023",
    "Tourist arrivals (2019-2024)",
    "Excursionist arrivals",
    "Inbound consumption, RM m (Jad 1A, 2015-2024)",
]
# ticket #13: the additive TSA 2025 edition series (shown when in the bundle)
HEADERS_2025 = [
    "Visitor arrivals (2019-2025)",
    "Tourist arrivals (2019-2025)",
    "Same-day visitors (2019-2025)",
    "Inbound consumption, RM m (Jad 1A, 2015-2025)",
]


def _cell(series_by_id, series_id, year):
    series = series_by_id.get(series_id)
    if series is None:
        return ""
    for obs in series.values:
        if obs.year == year:
            return f"{obs.value:,.1f}" if series.unit == "rm_million" else f"{int(obs.value):,}"
    return ""


def render_table(bundle) -> str:
    frag = bundle.fragments["national_series"]
    by_id = {s.series_id: s for s in frag.series}
    has_2025 = "arrivals_visitor_2019_2025" in by_id
    headers = HEADERS + (HEADERS_2025 if has_2025 else [])
    widths = [len(h) + 1 for h in headers]
    years = sorted({o.year for s in frag.series for o in s.values})
    lines = [" | ".join(h.ljust(w) for h, w in zip(headers, widths))]
    lines.append("-+-".join("-" * w for w in widths))
    base_cells = [
        "arrivals_visitor_2019_2024",
        "arrivals_tourist_2015_2023",
        "arrivals_tourist_2019_2024",
        "arrivals_excursionist_2019_2024",
        "inbound_consumption_tourist_2015_2024",
    ]
    cells_2025 = [
        "arrivals_visitor_2019_2025",
        "arrivals_tourist_2019_2025",
        "arrivals_excursionist_2019_2025",
        "inbound_consumption_tourist_2015_2025",
    ]
    for year in years:
        row = [str(year)] + [_cell(by_id, sid, year) for sid in base_cells]
        if has_2025:
            row += [_cell(by_id, sid, year) for sid in cells_2025]
        lines.append(" | ".join(c.ljust(w) for c, w in zip(row, widths)))
    lines.append("")
    lines.append("Basis note: tourist-basis series (2015-2023) and visitor-basis series (2019-2024)")
    lines.append("are separate by contract; never read across the two for one year without labels.")
    market_frag = bundle.fragments.get("source_market")
    if market_frag is not None:
        lines.append(render_market_table(market_frag))
    mb_frag = bundle.fragments.get("missing_billions")
    if mb_frag is not None:
        lines.extend(render_missing_billions_table(mb_frag))
    return "\n".join(lines)


MB_HEADERS = [
    "Year",
    "Receipts nominal (RM m)",
    "Per-visitor nominal (RM)",
    "Per-visitor real 2019 (RM)",
    "Actual receipts 2019 prices (RM m)",
    "Counterfactual 2019 prices (RM m)",
    "Real gap (RM m)",
    "Naive nominal gap (RM m, INVALID)",
]
MB_WIDTHS = [6, 23, 24, 26, 34, 34, 16, 32]


def render_missing_billions_table(frag) -> list[str]:
    lines = [
        "",
        "Missing Billions (ticket T4) — constant 2019 prices only, deflated by the "
        f"national CPI ({frag.deflator.source.dataset_id}, {frag.deflator.index_base}, "
        f"fetched {frag.deflator.source.fetched_utc[:10]}):",
        " | ".join(h.ljust(w) for h, w in zip(MB_HEADERS, MB_WIDTHS)),
        "-+-".join("-" * w for w in MB_WIDTHS),
    ]
    for y in frag.years:
        lines.append(
            " | ".join(
                [
                    str(y.year).ljust(6),
                    f"{y.receipts_nominal_rm_million:,.1f}".ljust(23),
                    f"{y.per_visitor_nominal_rm:,.2f}".ljust(24),
                    f"{y.per_visitor_real_2019_rm:,.2f}".ljust(26),
                    f"{y.actual_receipts_2019_prices_rm_million:,.1f}".ljust(34),
                    f"{y.counterfactual_receipts_2019_prices_rm_million:,.1f}".ljust(34),
                    f"{y.gap_2019_prices_rm_million:+,.1f}".ljust(16),
                    f"{y.naive_nominal_gap_rm_million:+,.1f}".ljust(32),
                ]
            )
        )
    lines.append("")
    lines.append(
        "Sign convention: real gap = counterfactual - actual in 2019 prices; "
        "positive = missing billions."
    )
    # ticket #13: the pre-registered headline (guarded to 2020-2024) and, when
    # the fragment reaches beyond it, the clearly-labelled supplementary figure.
    h = frag.headline
    lines.append(
        f"Headline (pre-registered): RM{h.cumulative_gap_rm_million:,.1f}m "
        f"({h.window}, constant 2019 prices) — the window is guarded, never result-shopped."
    )
    if frag.supplementary is not None:
        sup = frag.supplementary
        lines.append(
            f"Supplementary (labelled, NEVER the headline): RM{sup.cumulative_gap_rm_million:,.1f}m "
            f"({sup.window}, includes the preliminary latest year)."
        )
    lines.append(
        "The naive nominal gap compares ringgit of different years and is flagged "
        "INVALID: per the data it shows a false 'surplus' (nominal per-visitor "
        "expenditure rose), which is why the real-terms path is the only headline."
    )
    vt = frag.volume_trap
    lines.append(
        f"Volume Trap: excursionist (same-day) share {vt.excursionist_share_2019_pct}% (2019) "
        f"-> {vt.excursionist_share_2024_pct}% (2024) "
        f"(+{vt.excursionist_share_change_pp} pp); land-mode share "
        f"{vt.land_mode_share_2024_pct}% (2024)."
    )
    return lines


MARKET_HEADERS = [
    "Source market",
    "Receipts 2024 (RM m)",
    "Arrivals 2024",
    "Yield 2024 (RM/visitor)",
    "Coverage",
]


def render_market_table(frag) -> str:
    lines = ["", "Source markets (Tourism Malaysia In Brief 2024, top 20 per table, 2024/2023):"]
    lines.append(" | ".join(h.ljust(w) for h, w in zip(MARKET_HEADERS, [16, 21, 14, 23, 14])))
    lines.append("-+-".join("-" * w for w in [16, 21, 14, 23, 14]))
    for m in frag.markets:
        obs24 = next(o for o in m.observations if o.year == 2024)
        lines.append(
            " | ".join(
                [
                    m.market.ljust(16),
                    f"{obs24.receipts_rm_million:,.2f}".ljust(21) if obs24.receipts_rm_million is not None else "-".ljust(21),
                    f"{obs24.arrivals_persons:,}".ljust(14) if obs24.arrivals_persons is not None else "-".ljust(14),
                    f"{obs24.yield_rm_per_visitor:,.2f}".ljust(23) if obs24.yield_rm_per_visitor is not None else "n/a".ljust(23),
                    m.coverage.ljust(14),
                ]
            )
        )
    partial = sorted(m.market for m in frag.markets if m.coverage != "both")
    lines.append("")
    lines.append(
        "Coverage note: markets missing from one top-20 table are kept with null values "
        f"({', '.join(partial)}), never silently zeroed."
    )
    lines.append("Counting basis: In Brief receipts pair with In Brief arrivals per market (visitor basis).")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="tsa-pipeline",
        description="Extract TSA national series, validate, emit the data bundle.",
    )
    parser.add_argument("--data-dir", type=Path, default=REPO_ROOT / "data" / "raw")
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "data" / "processed" / "bundle.json")
    args = parser.parse_args(argv)

    bundle = build_bundle(args.data_dir)
    write_bundle(bundle, args.out)

    for line in bundle._ground_truth_report:  # type: ignore[attr-defined]
        print(line)
    for line in bundle._cross_file_report:  # type: ignore[attr-defined]
        print(line)
    for line in bundle._cpi_report:  # type: ignore[attr-defined]
        print(line)
    for line in getattr(bundle, "_edition_2025_report", []):  # type: ignore[attr-defined]
        print(line)
    for line in bundle._market_ground_truth_report:  # type: ignore[attr-defined]
        print(line)
    print(f"bundle v{bundle.bundle_version} (schema {bundle.schema_version}) "
          f"checksum {bundle.checksum} -> {args.out}")
    print()
    print(render_table(bundle))
    return 0


if __name__ == "__main__":
    sys.exit(main())
