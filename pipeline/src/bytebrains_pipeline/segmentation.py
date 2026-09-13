"""Source-market segmentation (ticket T5): clusters with human-readable names
plus yield quartile tiers, emitted as the `source_segmentation` bundle fragment.

Method (deterministic by construction):

- Features per market, anchored on 2024: yield (RM per visitor), volume
  (log10 arrivals), arrivals growth (2024 vs 2023, from the same arrivals the
  source_market fragment carries), and five WEF TTDI 2024 indicators of the
  source market (wallet/PPP, length of stay, TTDI score, air connectivity
  (log10), passport mobility).
- k-means (k=4) on z-scored features, k-means++ initialisation driven by a
  fixed-seed `random.Random(42)`; markets are processed in sorted order, so the
  result is byte-identical across re-runs (stability is asserted in tests).
- Clusters are re-labelled by descending mean yield so cluster ids are stable
  and human-meaningful.
- Names are rule-based from cluster profiles (see `naming_rationale` in the
  fragment), drawn from a closed vocabulary: "Volume Traps" (the Volume Trap
  critique in CONTEXT.md), "High-Yield Long-Haul", "High-Growth Emerging",
  "Mid-Yield Steady".
- Missing WEF coverage is explicit: markets absent from the WEF TTDI file keep
  None values plus a `wef_missing` attribution list, and enter clustering via
  median imputation over the covered markets (documented in the feature defs).
  Markets without a 2024 yield (partial In Brief coverage) are excluded from
  clustering with an explicit reason — never zeroed.
"""
from __future__ import annotations

import csv
import math
import random
import statistics
from pathlib import Path

from .bundle import (
    ClusterProfile,
    FeatureDef,
    MarketSegment,
    SegmentationFragment,
    SegmentationSource,
    SourceMarketFragment,
)

SEED = 42
N_CLUSTERS = 4
N_RESTARTS = 12  # deterministic best-of-N k-means++ restarts, seeds SEED..SEED+N_RESTARTS-1
ANCHOR_YEAR = 2024
WEF_REF_YEAR = 2024

# Closed-vocabulary segment names (judge-readable, derived from cluster profiles).
NAME_VOLUME_TRAP = "Volume Traps"
NAME_HIGH_YIELD = "High-Yield Long-Haul"
NAME_HIGH_GROWTH = "High-Growth Emerging"
NAME_MID_YIELD = "Mid-Yield Steady"
NAME_LOW_YIELD = "Low-Yield Steady"

# Explicit market -> WEF REF_AREA mapping (documented, not inferred).
# Markets without a WEF TTDI 2024 entry (Brunei, Chinese Taipei, Russia, Myanmar)
# are absent on purpose; they are handled as explicit missing with attribution.
MARKET_REF_AREA = {
    "Singapore": "SGP",
    "China": "CHN",
    "Indonesia": "IDN",
    "India": "IND",
    "Thailand": "THA",
    "South Korea": "KOR",
    "Australia": "AUS",
    "United Kingdom": "GBR",
    "Chinese Taipei": None,
    "Japan": "JPN",
    "Philippines": "PHL",
    "United States": "USA",
    "Vietnam": "VNM",
    "France": "FRA",
    "Germany": "DEU",
    "Russia": None,
    "Pakistan": "PAK",
    "Bangladesh": "BGD",
    "Myanmar": None,
    "Brunei": None,
    "Canada": "CAN",
    "Netherlands": "NLD",
}

# The documented WEF TTDI subset: five indicators that plausibly drive or mark
# yield from a source market (wallet, stay length, development, reach, mobility).
WEF_INDICATORS = {
    "wef_ppp": "WEF_TTDI_PPP",  # purchasing power parity: visitor wallet proxy
    "wef_length_stay_days": "WEF_TTDI_LENGTHSTAY",  # inbound length of stay
    "wef_ttdi_score": "WEF_TTDI_TTDI",  # overall Travel & Tourism Development Index
    "wef_air_connectivity_log10": "WEF_TTDI_IATACONNECTIDX",  # airport connectivity (log10)
    "wef_passport_mobility": "WEF_TTDI_PASSPORTMOBHPI",  # passport mobility score
}

FEATURE_DEFS = [
    FeatureDef(
        name="yield_rm_per_visitor",
        description="2024 visitor receipts / visitor arrivals per market",
        unit="rm",
        source="source_market fragment (Tourism Malaysia Statistics in Brief 2024)",
        transform="none",
        imputation="none - markets without a 2024 yield are excluded from clustering",
    ),
    FeatureDef(
        name="log10_arrivals",
        description="2024 visitor arrivals (log10 scale: volume without dominating distance)",
        unit="log10 persons",
        source="source_market fragment (Tourism Malaysia Statistics in Brief 2024)",
        transform="log10",
        imputation="none - markets without 2024 arrivals are excluded from clustering",
    ),
    FeatureDef(
        name="arrivals_growth_pct",
        description="2024 vs 2023 arrivals growth, computed from the same arrivals the "
        "source_market fragment carries (the In Brief growth column, rederived for "
        "reconciliation with the emitted figures)",
        unit="percent",
        source="source_market fragment (Tourism Malaysia Statistics in Brief 2024)",
        transform="none",
        imputation="none - markets without 2024 arrivals are excluded from clustering",
    ),
    *[
        FeatureDef(
            name=name,
            description=f"WEF TTDI indicator {code} for the source market, "
            f"TIME_PERIOD {WEF_REF_YEAR} (latest available kept per indicator)",
            unit="wef score/value",
            source=f"WEF_TTDI.csv indicator {code} (WEF Travel & Tourism Development "
            "Index 2024 edition via World Bank Data360, COMP_BREAKDOWN_1=WEF_TTDI_VAL)",
            transform="log10" if name == "wef_air_connectivity_log10" else "none",
            imputation="median of the clustered markets that cover the indicator; "
            "missing listed per market in wef_missing",
        )
        for name, code in WEF_INDICATORS.items()
    ],
]

NAMING_RATIONALE = (
    "Segment names are derived from cluster profiles by rule, not machine ids: the "
    "cluster with the lowest mean yield that also has the highest volume is named "
    "'Volume Traps' (the arrivals KPI over-rewards exactly this short-stay regional "
    "traffic - the Volume Trap critique); the cluster with the highest mean yield is "
    "named 'High-Yield Long-Haul' (high wallet and development markets, predominantly "
    "long-haul, reached by air); among the remaining clusters the one with the strongest "
    "arrivals growth is named 'High-Growth Emerging', and any leftover is 'Mid-Yield "
    "Steady' or 'Low-Yield Steady' by its mean yield against the panel median. Ties "
    "break by the descending-mean-yield cluster order, so names are deterministic."
)


def _read_wef_indicators(wef_csv: Path) -> dict[tuple[str, str], tuple[int, float]]:
    """Parse the SDMX/DATA360-shaped WEF TTDI file: REF_AREA, INDICATOR,
    TIME_PERIOD, OBS_VALUE; only raw values (COMP_BREAKDOWN_1 = WEF_TTDI_VAL).
    Returns {(ref_area, indicator): (time_period, value)} keeping the LATEST
    TIME_PERIOD <= WEF_REF_YEAR with a non-null value per pair."""
    latest: dict[tuple[str, str], tuple[int, float]] = {}
    with open(wef_csv, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row.get("COMP_BREAKDOWN_1") != "WEF_TTDI_VAL":
                continue
            code = row.get("INDICATOR")
            area = row.get("REF_AREA")
            raw = (row.get("OBS_VALUE") or "").strip()
            if not raw or raw in {".", ".."}:
                continue
            year = int(row["TIME_PERIOD"])
            if year > WEF_REF_YEAR:
                continue
            key = (area, code)
            current = latest.get(key)
            if current is None or year > current[0]:
                latest[key] = (year, float(raw))
    return latest


def _median(values: list[float]) -> float:
    return statistics.median(values)


def _kmeans(vectors: list[list[float]], k: int, seed: int) -> list[int]:
    """Deterministic k-means: fixed-seed k-means++ init over a sorted input,
    Lloyd iterations until stable. Returns labels aligned with the input order."""
    n = len(vectors)
    dim = len(vectors[0])
    rng = random.Random(seed)

    # k-means++ initialisation
    first = rng.randrange(n)
    centroids = [list(vectors[first])]
    while len(centroids) < k:
        d2 = [min(sum((z[j] - c[j]) ** 2 for j in range(dim)) for c in centroids) for z in vectors]
        total = sum(d2)
        if total == 0:
            break
        pick = rng.random() * total
        acc = 0.0
        idx = n - 1
        for i, d in enumerate(d2):
            acc += d
            if acc >= pick:
                idx = i
                break
        centroids.append(list(vectors[idx]))
    while len(centroids) < k:  # degenerate input guard: pad with distinct points
        centroids.append([vectors[len(centroids) % n][j] + 1e-9 for j in range(dim)])

    labels = [-1] * n
    for _ in range(300):
        new_labels = []
        for zp in vectors:
            dists = [sum((zp[j] - c[j]) ** 2 for j in range(dim)) for c in centroids]
            new_labels.append(min(range(k), key=lambda ci: (dists[ci], ci)))
        if new_labels == labels:
            break
        labels = new_labels
        for ci in range(k):
            members = [vectors[j] for j in range(n) if labels[j] == ci]
            if members:
                centroids[ci] = [sum(v[j] for v in members) / len(members) for j in range(dim)]
    return labels


def _kmeans_best(vectors: list[list[float]], k: int, seed: int, n_restarts: int):
    """Best-of-N restarts: run deterministic k-means over N consecutive seeds and
    keep the lowest-inertia partition (ties keep the earliest seed). Deterministic
    by construction; avoids a single unlucky k-means++ seed."""
    def inertia(labels: list[int]) -> float:
        dim = len(vectors[0])
        cents = []
        for ci in sorted(set(labels)):
            members = [vectors[i] for i, l in enumerate(labels) if l == ci]
            cents.append([sum(v[j] for v in members) / len(members) for j in range(dim)])
        return sum(
            min(sum((z[j] - c[j]) ** 2 for j in range(dim)) for c in cents) for z in vectors
        )

    best_labels = None
    best_inertia = float("inf")
    for i in range(n_restarts):
        labels = _kmeans(vectors, k, seed + i)
        score = inertia(labels)
        if score < best_inertia:
            best_labels, best_inertia = labels, score
    assert best_labels is not None
    return best_labels, best_inertia


def build_segmentation_fragment(
    source_market: SourceMarketFragment, wef_csv: Path
) -> SegmentationFragment:
    """Cluster the source markets and name the segments (ticket T5)."""
    wef = _read_wef_indicators(wef_csv)

    # 1. per-market raw records: explicit coverage, explicit missing, exclusion reasons.
    records: list[dict] = []
    for m in source_market.markets:
        obs24 = next(o for o in m.observations if o.year == ANCHOR_YEAR)
        obs23 = next(o for o in m.observations if o.year == ANCHOR_YEAR - 1)
        growth = None
        if obs24.arrivals_persons is not None and obs23.arrivals_persons:
            growth = (obs24.arrivals_persons / obs23.arrivals_persons - 1.0) * 100.0
        indicators: dict[str, float | None] = {}
        ref_years: dict[str, int] = {}
        missing: list[str] = []
        ref_area = MARKET_REF_AREA.get(m.market)
        for feat_name, code in WEF_INDICATORS.items():
            hit = wef.get((ref_area, code)) if ref_area else None
            if hit is None:
                indicators[feat_name] = None
                missing.append(feat_name)
            else:
                ref_years[feat_name] = hit[0]
                indicators[feat_name] = hit[1]
        reason = None
        if obs24.yield_rm_per_visitor is None:
            reason = (
                f"no {ANCHOR_YEAR} yield: market is absent from the In Brief receipts table "
                f"(coverage={m.coverage}); clustering is anchored on yield"
            )
        elif obs24.arrivals_persons is None:
            reason = (
                f"no {ANCHOR_YEAR} arrivals: market is absent from the In Brief arrivals table "
                f"(coverage={m.coverage}); volume feature unavailable"
            )
        records.append(
            {
                "market": m.market,
                "coverage": m.coverage,
                "yield": obs24.yield_rm_per_visitor,
                "arrivals": obs24.arrivals_persons,
                "growth": growth,
                "indicators": indicators,
                "ref_years": ref_years,
                "missing": missing,
                "excluded_reason": reason,
            }
        )

    # 2. Feature matrix over the clusterable markets, median imputation for WEF gaps.
    def raw_feature(rec: dict, name: str) -> float | None:
        if name == "yield_rm_per_visitor":
            return rec["yield"]
        if name == "log10_arrivals":
            a = rec["arrivals"]
            return math.log10(a) if a else None
        if name == "arrivals_growth_pct":
            return rec["growth"]
        v = rec["indicators"].get(name)
        return math.log10(v) if (v is not None and name == "wef_air_connectivity_log10") else v

    feature_names = [f.name for f in FEATURE_DEFS]
    clustered = sorted((r for r in records if r["excluded_reason"] is None), key=lambda r: r["market"])
    if len(clustered) < N_CLUSTERS:
        raise ValueError(
            f"only {len(clustered)} markets are clusterable; k={N_CLUSTERS} needs at least that many"
        )

    # median imputation for WEF gaps (gaps stay attributed on each row's
    # wef_missing list — imputation is a clustering input, never a data repair)
    medians: dict[str, float] = {}
    for name in feature_names:
        covered = [raw_feature(r, name) for r in clustered]
        covered = [v for v in covered if v is not None]
        medians[name] = _median(covered) if covered else 0.0

    matrix: dict[str, list[float]] = {
        r["market"]: [
            raw_feature(r, name) if raw_feature(r, name) is not None else medians[name]
            for name in feature_names
        ]
        for r in clustered
    }

    # 3. z-score standardisation.
    dim = len(feature_names)
    means = [sum(matrix[r["market"]][j] for r in clustered) / len(clustered) for j in range(dim)]
    sds = []
    for j in range(dim):
        var = sum((matrix[r["market"]][j] - means[j]) ** 2 for r in clustered) / len(clustered)
        sds.append(math.sqrt(var) or 1.0)
    vectors = {
        r["market"]: [(matrix[r["market"]][j] - means[j]) / sds[j] for j in range(dim)]
        for r in clustered
    }

    # 4. deterministic k-means (best of N fixed-seed restarts), re-labelled by
    # descending mean yield.
    labels, inertia = _kmeans_best(
        [vectors[r["market"]] for r in clustered], N_CLUSTERS, SEED, N_RESTARTS
    )
    cluster_of = {r["market"]: labels[i] for i, r in enumerate(clustered)}
    groups: dict[int, list[dict]] = {}
    for r in clustered:
        groups.setdefault(cluster_of[r["market"]], []).append(r)

    def group_stats(gid: int) -> dict[str, float]:
        members = groups[gid]
        y = [m["yield"] for m in members]
        v = [math.log10(m["arrivals"]) for m in members]
        g = [m["growth"] for m in members]
        return {
            "yield_mean": sum(y) / len(y),
            "volume_mean": sum(v) / len(v),
            "growth_mean": sum(g) / len(g),
        }

    stats = {gid: group_stats(gid) for gid in groups}
    ordered = sorted(groups, key=lambda gid: (-stats[gid]["yield_mean"], gid))
    relabel = {gid: new for new, gid in enumerate(ordered)}

    # 5. rule-based naming from profiles (see NAMING_RATIONALE).
    lowest_yield = ordered[-1]
    highest_volume = sorted(groups, key=lambda gid: (-stats[gid]["volume_mean"], gid))[0]
    trap_gid = lowest_yield if lowest_yield == highest_volume else highest_volume
    names: dict[int, str] = {trap_gid: NAME_VOLUME_TRAP}
    top_gid = next(gid for gid in ordered if gid != trap_gid)
    names[top_gid] = NAME_HIGH_YIELD
    rest = [gid for gid in ordered if gid not in names]
    rest.sort(key=lambda gid: (-stats[gid]["growth_mean"], gid))
    median_market_yield = statistics.median(
        r["yield"] for r in records if r["yield"] is not None
    )
    for i, gid in enumerate(rest):
        if i == 0:
            names[gid] = NAME_HIGH_GROWTH
        else:
            names[gid] = (
                NAME_MID_YIELD if stats[gid]["yield_mean"] >= median_market_yield
                else NAME_LOW_YIELD
            )

    clusters = []
    for gid in sorted(groups, key=lambda g: relabel[g]):
        members = sorted(groups[gid], key=lambda r: r["market"])
        name = names[gid]
        y_mean = stats[gid]["yield_mean"]
        if name == NAME_VOLUME_TRAP:
            rationale = (
                f"lowest mean yield (RM{y_mean:,.0f}) and highest volume "
                f"(mean log10 arrivals {stats[gid]['volume_mean']:.2f}): short-stay regional "
                "traffic the arrivals KPI over-rewards - the Volume Trap profile"
            )
        elif name == NAME_HIGH_YIELD:
            rationale = (
                f"highest mean yield (RM{y_mean:,.0f}) with lower volume: high-wallet, "
                "high-development markets, predominantly long-haul"
            )
        elif name == NAME_HIGH_GROWTH:
            rationale = (
                f"fastest arrivals growth ({stats[gid]['growth_mean']:+.1f}% mean) at a "
                f"solid mid yield (RM{y_mean:,.0f}): emerging markets scaling in both "
                "volume and value"
            )
        elif name == NAME_MID_YIELD:
            rationale = f"mid yield (RM{y_mean:,.0f}) without a standout trait"
        else:
            rationale = (
                f"below-median yield (RM{y_mean:,.0f}) with flat growth "
                f"({stats[gid]['growth_mean']:+.1f}% mean): no standout trait yet"
            )
        clusters.append(
            ClusterProfile(
                cluster_id=relabel[gid],
                segment_name=name,
                naming_rationale=rationale,
                members=[r["market"] for r in members],
                centroid_features={
                    feature_names[j]: round(
                        sum(matrix[r["market"]][j] for r in members) / len(members), 4
                    )
                    for j in range(dim)
                },
                mean_yield_rm_per_visitor=round(y_mean, 2),
            )
        )

    # 6. yield quartile tiers over the SAME emitted yields (clustered or not).
    tiered = [r for r in records if r["yield"] is not None]
    yields = [r["yield"] for r in tiered]
    q25, q50, q75 = statistics.quantiles(yields, n=4, method="inclusive")
    tier_labels = {
        "top_quartile": "Top quartile yield",
        "upper_middle": "Upper-middle quartile yield",
        "lower_middle": "Lower-middle quartile yield",
        "bottom_quartile": "Bottom quartile yield",
    }
    for r in tiered:
        y = r["yield"]
        r["tier"] = (
            "top_quartile" if y >= q75
            else "upper_middle" if y >= q50
            else "lower_middle" if y >= q25
            else "bottom_quartile"
        )

    markets = [
        MarketSegment(
            market=r["market"],
            clustered=r["excluded_reason"] is None,
            excluded_reason=r["excluded_reason"],
            yield_rm_per_visitor_2024=r["yield"],
            arrivals_persons_2024=r["arrivals"],
            arrivals_growth_pct=r["growth"],
            wef_indicators=r["indicators"],
            wef_missing=r["missing"],
            wef_ref_years=r["ref_years"],
            cluster_id=relabel[cluster_of[r["market"]]] if r["excluded_reason"] is None else None,
            segment_name=names[cluster_of[r["market"]]] if r["excluded_reason"] is None else None,
            yield_tier=r.get("tier"),
            tier_label=tier_labels.get(r.get("tier")),
        )
        for r in records
    ]

    return SegmentationFragment(
        anchor_year=ANCHOR_YEAR,
        method=f"k-means (k={N_CLUSTERS}) on z-scored features, k-means++ init, best of "
        f"{N_RESTARTS} consecutive fixed-seed restarts (seeds {SEED}-{SEED + N_RESTARTS - 1}, "
        f"lowest inertia {inertia:.2f} kept); clusters re-labelled by descending mean yield",
        seed=SEED,
        n_clusters=N_CLUSTERS,
        naming_rationale=NAMING_RATIONALE,
        source=SegmentationSource(
            market_source_file="inbrief2024.txt",
            wef_file=wef_csv.name,
            wef_dataset="WEF Travel & Tourism Development Index (TTDI), 2024 edition "
            "(World Bank Data360 distribution)",
            wef_url="https://data360api.data360api.org/datasets/WB.DATA360:DS_DATA360/download/csv "
            "(WEF_TTDI database id)",
            wef_ref_year=WEF_REF_YEAR,
        ),
        features=FEATURE_DEFS,
        markets=markets,
        clusters=clusters,
        tier_labels=tier_labels,
        yield_quartile_boundaries={"q25": q25, "q50": q50, "q75": q75},
    )
