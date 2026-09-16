"""Offline checks for the report pack (ticket T8, issue amiruluniten/Byte-Brains#9).

The pack is documentation for the report-writing teammates, so these tests pin
the things that would be embarrassing to get wrong:

1. every required pack file exists;
2. every headline number in the pack is grounded in the data bundle (or the
   research files) — nothing invented;
3. the pack cites the bundle version + checksum the dashboard displays;
4. the pack uses CONTEXT.md vocabulary (banned avoid-terms never appear in
   prose; "excursionist" only ever appears as "(excursionist)" after
   "same-day visitor", or inside inline code / field names);
5. the source registry covers every dataset and PDF the project used, with
   access dates;
6. the findings material is structured against the official report template.

Run (offline, no network):

    cd pipeline && .venv/bin/python -m pytest ../report-pack/tests -q
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PACK = REPO / "report-pack"
BUNDLE_PATH = REPO / "data" / "processed" / "bundle.json"

PACK_FILES = [
    "README.md",
    "pinned-bundle.md",
    "1-data-cleaning-log.md",
    "2-method-notes.md",
    "3-source-registry.md",
    "4-findings-material.md",
    "5-advisor-summary.md",
]

REPORT_TEMPLATE_SECTIONS = [
    "Introduction",
    "Problem Statement",
    "Objectives",
    "Literature Review",
    "Methodology",
    "Findings",
    "Output",
    "Conclusion",
]

SEGMENT_NAMES = [
    "Volume Traps",
    "High-Yield Long-Haul",
    "High-Growth Emerging",
    "Low-Yield Steady",
]

# CONTEXT.md avoid-terms must never appear in the pack prose.
AVOID_TERMS = [
    "volume growth",
    "quality growth",
    "tourism value",
    "receipts per head",
    "revenue gap",
    "shortfall",
    "numbers game",
    "tourism income",
    "tourism GDP",
    "TSA report",
    "tourism xlsx",
    "overnight visitor",
    "day tripper",
    "local tourist",
    "traveller",
    "portfolio",
]


def load_bundle() -> dict:
    return json.loads(BUNDLE_PATH.read_text())


def all_pack_markdown() -> str:
    return "\n".join((PACK / f).read_text() for f in PACK_FILES)


def strip_inline_code(text: str) -> str:
    """Remove `inline code` spans and markdown emphasis so field names and
    formatting never trip prose checks."""
    text = re.sub(r"`[^`]*`", " ", text)
    text = text.replace("**", "")
    return text


def strip_negative_guidance(text: str) -> str:
    """Drop explicit 'not "term"' guidance — the pack legitimately tells writers
    which CONTEXT.md avoid-terms to shun."""
    return re.sub(r'not\s+"[^"]*"', ' ', text)


def fmt_rm(x: float, dp: int = 1) -> str:
    return f"{x:,.{dp}f}"


# ---------------------------------------------------------------- files ----

def test_required_pack_files_exist():
    for name in PACK_FILES:
        assert (PACK / name).is_file(), f"missing pack file: {name}"


# ------------------------------------------------ numbers are grounded ----

def test_headline_counterfactual_numbers_match_bundle():
    mb = load_bundle()["fragments"]["missing_billions"]
    years = mb["years"]
    cum = sum(y["gap_2019_prices_rm_million"] for y in years if 2020 <= y["year"] <= 2024)
    y24 = next(y for y in years if y["year"] == 2024)
    y19 = next(y for y in years if y["year"] == 2019)
    # the headline window stays the pre-registered 2020-2024 (issue #12/#13 guard)
    assert mb["headline"]["window"] == "2020-2024"
    assert abs(cum - mb["headline"]["cumulative_gap_rm_million"]) < 0.05, (
        "headline must equal the sum of the fragment's own 2020-2024 rows"
    )
    pack = all_pack_markdown()
    for grounded, needle in [
        (cum, "10,098.4"),                                # cumulative 2020-2024 real gap, revised receipts
        (y24["gap_2019_prices_rm_million"], "-RM245.19"),   # 2024 real gap, revised receipts
        (y24["naive_nominal_gap_rm_million"], "-RM9,010.66"),
        (y19["per_visitor_real_2019_rm"], "2,474.10"),
        (y24["per_visitor_real_2019_rm"], "2,480.56"),
        (y24["per_visitor_nominal_rm"], "2,711.47"),
    ]:
        # the bundle value must actually appear in the pack at some quoted
        # precision — presence of the curated needle alone is not enough.
        # The pack decorates negatives and RM amounts ("−RM8,894.66"), so check
        # those variants too.
        bare = [f"{grounded:,.{dp}f}" for dp in (0, 1, 2)]
        rm = [f"RM{abs(grounded):,.{dp}f}" for dp in (0, 1, 2)]
        signed_rm = [f"-RM{abs(grounded):,.{dp}f}" for dp in (0, 1, 2)]
        candidates = bare + rm + signed_rm
        assert any(c in pack for c in candidates), (
            f"pack cites {needle} but the bundle now says {grounded:,.2f} — re-ground the pack"
        )
        assert needle in pack, f"pack never states {needle}"
    # the headline is RM10.1 billion, recomputed from the TSA 2025 revised
    # receipts — the old RM10.2 billion wording must be gone from the pack
    assert "RM10.1 billion" in pack
    for stale in ("10,204.5", "RM10.2 billion", "-RM139.07", "2,477.77", "2,708.41"):
        assert stale not in pack, f"stale pre-#13 value still quoted: {stale}"


def test_2025_preliminary_row_and_supplementary_match_bundle():
    """Issue #14: the 2025 preliminary row and the labelled supplementary
    cumulative figure are quoted from the bundle, never as the headline."""
    mb = load_bundle()["fragments"]["missing_billions"]
    y25 = next(y for y in mb["years"] if y["year"] == 2025)
    assert y25["revision_status"] == "preliminary"
    supp = mb["supplementary"]
    assert supp["window"] == "2020-2025"
    pack = all_pack_markdown()
    for grounded, needle in [
        (y25["receipts_nominal_rm_million"], "119,312.0"),
        (y25["visitor_arrivals"], "42,196,892"),
        (y25["per_visitor_real_2019_rm"], "2,551.49"),
        (y25["actual_receipts_2019_prices_rm_million"], "107,665.1"),
        (y25["counterfactual_receipts_2019_prices_rm_million"], "104,399.5"),
        (y25["gap_2019_prices_rm_million"], "-3,265.7"),
        (supp["cumulative_gap_rm_million"], "6,832.7"),
    ]:
        candidates = [f"{grounded:,.0f}", f"{grounded:,.1f}", f"{grounded:,.2f}"]
        assert any(c in pack for c in candidates), (
            f"pack never states 2025 figure {grounded:,.2f} — re-ground the pack"
        )
        assert needle in pack, f"pack never states {needle}"
    # 2025 is visibly preliminary, and the 2020-2025 figure is labelled
    # supplementary only (never the headline)
    assert "2025p" in pack
    assert "preliminary" in pack.lower()
    assert "upplementary" in pack


def test_volume_trap_numbers_match_bundle():
    vt = load_bundle()["fragments"]["missing_billions"]["volume_trap"]
    pack = all_pack_markdown()
    for needle in [
        f"{vt['excursionist_share_2019_pct']}",   # 25.5
        f"{vt['excursionist_share_2024_pct']}",   # 34.1
        f"{vt['excursionist_share_change_pp']}",  # 8.6
        f"{vt['land_mode_share_2024_pct']}",      # 66.1
    ]:
        assert needle in pack, f"pack never states Volume Trap figure {needle}"


def test_national_series_numbers_match_bundle():
    ns = load_bundle()["fragments"]["national_series"]["series"]
    vals = {}
    for s in ns:
        for v in s["values"]:
            vals[(s["series_id"], v["year"])] = v["value"]
    pack = all_pack_markdown()
    for sid, year, needle in [
        ("arrivals_visitor_2019_2024", 2019, "35,045,625"),
        ("arrivals_visitor_2019_2024", 2024, "37,961,485"),
        ("arrivals_tourist_2019_2024", 2019, "26,100,784"),
        ("arrivals_excursionist_2019_2024", 2019, "8,944,841"),
        ("arrivals_excursionist_2019_2024", 2024, "12,944,787"),
        ("inbound_consumption_tourist_2015_2024", 2019, "86,706.5"),
        ("inbound_consumption_tourist_2015_2024", 2024, "102,815.3"),
        # the TSA 2025 edition (issue #13): 2024 restated, 2025 preliminary
        ("inbound_consumption_tourist_2015_2025", 2024, "102,931.3"),
        ("inbound_consumption_tourist_2015_2025", 2025, "119,312.0"),
        ("arrivals_visitor_2019_2025", 2025, "42,196,892"),
    ]:
        bundle_str = f"{vals[(sid, year)]:,.0f}"
        assert bundle_str in pack, (
            f"pack never states {needle} ({sid} {year}); bundle says {bundle_str} — re-ground the pack"
        )
        assert needle in pack, f"pack never states {needle} ({sid} {year})"


def test_source_market_numbers_match_bundle():
    sm = load_bundle()["fragments"]["source_market"]
    pack = all_pack_markdown()
    tot24 = next(t for t in sm["national_totals"] if t["year"] == 2024)
    assert f"{tot24['receipts_rm_million']:,.2f}" in pack      # 106,783.11
    assert "2,813" in pack                                     # reconciliation
    sg = next(m for m in sm["markets"] if m["market"] == "Singapore")
    obs = next(o for o in sg["observations"] if o["year"] == 2024)
    assert f"{obs['yield_rm_per_visitor']:,.2f}" in pack       # 1,481.87


def test_segmentation_numbers_match_bundle():
    seg = load_bundle()["fragments"]["source_segmentation"]
    pack = all_pack_markdown()
    assert seg["n_clusters"] == 4
    for name in SEGMENT_NAMES:
        assert name in pack, f"pack never names segment {name}"
    q = seg["yield_quartile_boundaries"]
    for needle in [f"{q['q25']:,.2f}", f"{q['q50']:,.2f}", f"{q['q75']:,.2f}"]:
        assert needle in pack, f"pack never states quartile boundary {needle}"


def test_segment_cluster_means_consistent_with_bundle():
    """Every mean-yield figure the pack quotes for a segment must be derivable."""
    seg = load_bundle()["fragments"]["source_segmentation"]
    pack = all_pack_markdown()
    for cluster in seg["clusters"]:
        yields = [m["yield_rm_per_visitor_2024"] for m in seg["markets"]
                  if m.get("cluster_id") == cluster["cluster_id"]]
        mean = sum(yields) / len(yields)
        assert f"{mean:,.0f}" in pack, (
            f"pack never states {cluster.get('segment_name') or 'cluster'} mean yield {mean:,.0f}"
        )


def test_cpi_deflator_matches_bundle():
    mb = load_bundle()["fragments"]["missing_billions"]
    pack = all_pack_markdown()
    assert f"{mb['deflator']['anchor_index']:,.6f}" in pack     # 121.483333
    assert "132.791667" in pack                                 # CPI 2024
    assert "1.093085" in pack                                   # 2024/2019 ratio
    assert "134.625" in pack                                    # CPI 2025
    assert "1.108177" in pack                                   # 2025/2019 ratio


# ------------------------------------------------- bundle citation -------

def test_pack_cites_bundle_version_and_checksum():
    b = load_bundle()
    pack = all_pack_markdown()
    # no fallback: after a version bump a stale "bundle v1" citation must go red
    assert f"bundle v{b['bundle_version']}" in pack
    assert b["schema_version"] in pack                          # 1.0.0
    assert b["checksum"][:8] in pack                            # ad9523c8...


# --------------------------------------------- pinned bundle note (T9) ----

PIN_FILE = "pinned-bundle.md"


def test_pinned_bundle_note_exists_and_pins_full_checksum():
    """Ticket T9: the pack pins the exact bundle version + sha256 checksum the
    dashboard displays. If the pipeline re-runs and the bundle changes, this
    test goes red until the pin (and every pack citation) is refreshed."""
    b = load_bundle()
    assert (PACK / PIN_FILE).is_file(), f"missing pinned-bundle note: {PIN_FILE}"
    pin = (PACK / PIN_FILE).read_text()
    assert f"bundle v{b['bundle_version']}" in pin, "pin must state the bundle version"
    assert b["schema_version"] in pin, "pin must state the schema version"
    assert b["checksum"] in pin, (
        "pin must carry the FULL sha256 checksum; drift between bundle and pack must go red"
    )
    assert b["generated_utc"][:10] in pin, "pin must state the generation date"


def test_dashboard_bundle_matches_pinned_bundle():
    """The committed dashboard bundle and the pipeline bundle must be the same
    file (same checksum) — otherwise the report cites data the dashboard does
    not show."""
    dash = json.loads((REPO / "dashboard" / "data" / "bundle.json").read_text())
    proc = load_bundle()
    assert dash["checksum"] == proc["checksum"], (
        f"dashboard bundle checksum {dash['checksum'][:8]} != pipeline bundle "
        f"{proc['checksum'][:8]} — re-sync with the prebuild hook (dashboard/scripts/sync-bundle.mjs)"
    )
    assert dash["bundle_version"] == proc["bundle_version"]


def test_pinned_bundle_referenced_from_pack_entry_points():
    pack = all_pack_markdown()
    assert PIN_FILE in pack, (
        "README/findings material must point report writers at the pinned-bundle note"
    )


# ---------------------------------------------------- screenshots (T9) ----

SCREENSHOTS = [
    "landing.png",
    "diagnosis-decomposition.png",
    "diagnosis-source-markets.png",
    "diagnosis-regional.png",
    "simulator.png",
    "method.png",
]


def test_screenshots_exist_and_are_referenced():
    """Ticket T9: one high-resolution screenshot per dashboard route, captured
    from the static export, and referenced from the findings material."""
    shots_dir = PACK / "screenshots"
    for name in SCREENSHOTS:
        p = shots_dir / name
        assert p.is_file(), f"missing screenshot: {p}"
        assert p.stat().st_size > 20_000, f"suspiciously small screenshot: {p}"
    findings = (PACK / "4-findings-material.md").read_text()
    readme = (PACK / "README.md").read_text()
    for name in SCREENSHOTS:
        stem = name.removesuffix(".png")
        assert stem in findings, f"findings material never references screenshot {stem}"
    assert "screenshots" in readme.lower()


# ----------------------------------------------------- vocabulary -------

def test_avoid_terms_never_appear_in_prose():
    for f in PACK_FILES:
        prose = strip_negative_guidance(strip_inline_code((PACK / f).read_text()))
        low = prose.lower()
        for term in AVOID_TERMS:
            assert term not in low, f"{f}: CONTEXT.md avoid-term used: {term!r}"


def test_excursionist_only_as_parenthesis_or_code():
    for f in PACK_FILES:
        prose = strip_inline_code((PACK / f).read_text())
        for m in re.finditer(r"excursionist", prose, re.I):
            start = prose.rfind("(", max(0, m.start() - 30), m.start())
            ctx = prose[max(0, m.start() - 30):m.start()].rstrip().lower()
            assert ctx.endswith("same-day visitor ("), (
                f"{f}: bare 'excursionist' in prose near: ...{prose[max(0, m.start()-40):m.end()+20]}..."
            )


# -------------------------------------------------- source registry -----

def test_source_registry_covers_every_source():
    reg = (PACK / "3-source-registry.md").read_text()
    low = reg.lower()
    for needle in [
        "tourism_2023.xlsx", "tourism_2024.xlsx", "storage.dosm.gov.my",
        "statistics in brief 2024", "inbrief2024", "data.tourism.gov.my",
        "cpi_headline", "cpi_2d.csv", "wef_ttdi", "data360api",
        "st.int.arvl", "st.int.rcpt.cd", "world bank",
        "quarterly", "tourism_domestic_2025", "tourism_domestic_2026-q1",
        "thesun.my", "wttc.org", "theedgemalaysia", "i3investor", "roadgenius",
        "2026-09-13", "2026-09-12", "2026-09-10", "2026-09-08",
    ]:
        assert needle in low, f"source registry missing: {needle}"


# ------------------------------------------- report template mapping ----

def test_findings_material_covers_official_template_sections():
    text = (PACK / "4-findings-material.md").read_text()
    for section in REPORT_TEMPLATE_SECTIONS:
        assert section in text, f"findings material missing template section: {section}"


def test_simulator_section_degrades_gracefully():
    """The pack must describe the simulator without depending on T7 being done."""
    b = load_bundle()
    text = (PACK / "2-method-notes.md").read_text()
    if "simulator" not in b["fragments"]:
        assert "not yet" in text.lower() or "in progress" in text.lower()
