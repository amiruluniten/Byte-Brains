"""The data bundle contract (schema v1).

Decision note — pydantic models, not a standalone JSON Schema file:

- The bundle is emitted by Python and consumed by TypeScript. pydantic v2 gives us
  runtime validation at emission AND on reload, with actionable error messages,
  while `Bundle.model_json_schema()` can still publish the JSON Schema for the
  dashboard team whenever it is needed.
- A hand-maintained .json schema would drift from the emitting code; pydantic keeps
  one source of truth in code that is already tested.

Counting-basis discipline (spec issue #1, CONTEXT.md vocabulary):

- Tourist-basis series (2015-2023) and visitor-basis series (2019-2024) are separate
  Series objects, never merged. Each Series states its `basis` (closed vocabulary),
  its `window`, and its `source`; the series_id embeds the window so a mixed series
  is impossible to construct silently.
"""
import hashlib
import json
import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

BUNDLE_VERSION = 1
# Ticket #13 (issue #13): 1.0.0 -> 1.1.0, ADDITIVE ONLY. New in 1.1.0:
# Observation.revision_status (final/preliminary/revised), the revised-2024 and
# preliminary-2025 observations they flag, the counterfactual fragment's
# pre-registered headline guard and its labelled supplementary cumulative.
# No existing field changed meaning; a 1.0.0 bundle still validates.
SCHEMA_VERSION = "1.1.0"

Basis = Literal["visitor", "tourist", "excursionist"]
Unit = Literal["persons", "rm_million", "percent"]

# Ticket #13: how current an observation is, judged from the latest official
# workbook. "final" = matches the workbook it was first published in and has not
# been restated; "revised" = a later official workbook restates the year;
# "preliminary" = the release itself marks the year provisional ("2025p").
RevisionStatus = Literal["final", "preliminary", "revised"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SourceRef(StrictModel):
    """Where a series was read from, down to the sheet row."""

    file: str
    sheet: str
    row_label: str
    row: int


class Observation(StrictModel):
    year: int
    value: float | None  # None only where DOSM prints a footnote (n.a) instead of a number
    revision_flag: str | None = None  # e.g. "p" from a "2025p" year header
    revision_status: RevisionStatus = "final"  # ticket #13: final / preliminary / revised


class Series(StrictModel):
    series_id: str
    measure: str
    basis: Basis
    unit: Unit
    window: str  # "2015-2023" — stated explicitly, never inferred from values
    source: SourceRef
    values: list[Observation] = Field(min_length=1)

    @model_validator(mode="after")
    def _check_window_and_years(self):
        norm = self.window.replace("-", "_")
        if norm not in self.series_id:
            raise ValueError(
                f"series_id {self.series_id!r} must embed its window {self.window!r} "
                "(counting-basis discipline: series are labelled, never silently mixed)"
            )
        years = [o.year for o in self.values]
        if years != sorted(years) or len(set(years)) != len(years):
            raise ValueError(f"years must be strictly ascending without duplicates: {years}")
        return self


class NationalSeriesFragment(StrictModel):
    """National TSA series: arrivals and inbound tourism consumption."""

    series: list[Series] = Field(min_length=1)

    @model_validator(mode="after")
    def _check_unique_ids(self):
        ids = [s.series_id for s in self.series]
        if len(set(ids)) != len(ids):
            dupes = sorted({i for i in ids if ids.count(i) > 1})
            raise ValueError(f"duplicate series_id: {dupes}")
        return self


class MacroSource(StrictModel):
    """Where a macro indicator (no xlsx row) was downloaded from, with fetch date."""

    dataset_id: str  # e.g. OpenDOSM "cpi_headline"
    title: str
    url: str
    fetched_utc: str  # documented fetch date (ticket T4: deflator provenance)
    index_base: str  # e.g. "2010=100"


class MacroSeries(StrictModel):
    """A national macro indicator series (e.g. CPI). No counting basis — the
    visitor/tourist/excursionist vocabulary does not apply, so the field does not
    exist. Same labelling discipline as Series: the window is embedded in series_id."""

    series_id: str
    measure: str
    unit: Literal["index"]
    window: str
    source: MacroSource
    values: list[Observation] = Field(min_length=1)

    @model_validator(mode="after")
    def _check_window_and_years(self):
        norm = self.window.replace("-", "_")
        if norm not in self.series_id:
            raise ValueError(
                f"series_id {self.series_id!r} must embed its window {self.window!r}"
            )
        years = [o.year for o in self.values]
        if years != sorted(years) or len(set(years)) != len(years):
            raise ValueError(f"years must be strictly ascending without duplicates: {years}")
        return self


class MacroSeriesFragment(StrictModel):
    """Macro indicators (CPI deflator) — downloaded series, not workbook extracts."""

    series: list[MacroSeries] = Field(min_length=1)

    @model_validator(mode="after")
    def _check_unique_ids(self):
        ids = [s.series_id for s in self.series]
        if len(set(ids)) != len(ids):
            dupes = sorted({i for i in ids if ids.count(i) > 1})
            raise ValueError(f"duplicate series_id: {dupes}")
        return self


class DeflatorMeta(StrictModel):
    """The price deflator behind the constant-2019-prices counterfactual.
    Documented in the bundle (ticket T4): source, fetch date, base, anchor index."""

    series_id: str  # must resolve in the macro_series fragment
    description: str
    anchor_year: int
    anchor_index: float
    index_base: str
    source: MacroSource


class CounterfactualYear(StrictModel):
    """One year of the Missing Billions counterfactual, constant 2019 prices ONLY.

    Sign convention: gap = counterfactual (2019 prices) − actual (2019 prices).
    Positive = missing billions (receipts fell short of the 2019-yield counterfactual).
    The naive nominal gap is emitted next to it, flagged invalid by the fragment:
    it compares ringgit of different years and, per the data, shows a false
    "surplus" (nominal per-visitor expenditure rose).
    """

    year: int
    visitor_arrivals: float
    receipts_nominal_rm_million: float
    per_visitor_nominal_rm: float
    cpi_index: float
    cpi_ratio_to_anchor: float  # CPI(year) / CPI(anchor); >1 = prices rose since 2019
    per_visitor_real_2019_rm: float  # nominal per-visitor / cpi_ratio_to_anchor
    actual_receipts_2019_prices_rm_million: float  # nominal / cpi_ratio_to_anchor
    counterfactual_receipts_2019_prices_rm_million: float  # arrivals × 2019 real per-visitor
    gap_2019_prices_rm_million: float
    naive_nominal_gap_rm_million: float  # INVALID comparison, kept for the decomposition
    revision_status: RevisionStatus = "final"  # ticket #13: 2025 row is "preliminary"


# ---------------------------------------------------------------------------
# Ticket #13: the pre-registered headline guard and the labelled supplementary
# cumulative. What was pre-registered — and therefore must not move — is the
# headline WINDOW (2020-2024): it was fixed BEFORE the TSA 2025 release was
# examined (no result-shopping). The headline VALUE follows the revision
# policy (later official workbook wins): it is recomputed from the latest
# official receipts, so the headline always equals the sum of the fragment's
# own 2020-2024 rows (checked at emission). The model rejects any other
# headline window; the 2020-2025 cumulative may appear only as a
# clearly-labelled supplementary figure.
# ---------------------------------------------------------------------------

PRE_REGISTERED_HEADLINE_WINDOW = "2020-2024"


class HeadlineGap(StrictModel):
    """The Missing Billions headline: the pre-registered window (2020-2024),
    constant 2019 prices, with the cumulative real gap RECOMPUTED from the
    latest official receipts (revision policy: later official workbook wins —
    the headline equals the sum of the fragment's own 2020-2024 rows, checked
    in validate.py at emission). Guarded: a fragment claiming any other
    headline window fails validation (result-shopping guard, ticket #13)."""

    window: str
    prices: Literal["constant_2019_rm"]
    cumulative_gap_rm_million: float
    pre_registered: Literal[True]
    basis_note: str

    @model_validator(mode="after")
    def _check_pre_registered_window(self):
        if self.window != PRE_REGISTERED_HEADLINE_WINDOW:
            raise ValueError(
                f"headline window {self.window!r} violates the pre-registered contract: "
                f"the pre-registered Missing Billions headline window is "
                f"{PRE_REGISTERED_HEADLINE_WINDOW} (constant 2019 prices); a different "
                "headline window is result-shopping and fails the fragment contract "
                "(ticket #13)"
            )
        return self


class SupplementaryCumulative(StrictModel):
    """A cumulative gap window BEYOND the pre-registered headline (e.g. the
    2020-2025 cumulative including the preliminary 2025 year). Clearly labelled
    supplementary — it must never pose as the headline, and its window must
    differ from the headline's."""

    window: str
    label: str  # must contain "supplementary"
    cumulative_gap_rm_million: float

    @model_validator(mode="after")
    def _check_labelled_supplementary(self):
        if "supplementary" not in self.label.lower():
            raise ValueError(
                f"supplementary cumulative must be clearly labelled supplementary, got "
                f"label {self.label!r} (ticket #13: it may never pose as the headline)"
            )
        return self


class VolumeTrap(StrictModel):
    """Volume Trap indicators (ticket T4): the arrivals KPI rewards low-yield
    same-day traffic. Excursionist shares are computed from the national series;
    the land-mode share is hand-extracted from the In Brief PDF (documented)."""

    excursionist_share_2019_pct: float
    excursionist_share_2024_pct: float
    excursionist_share_change_pp: float
    land_mode_share_2024_pct: float
    land_mode_share_source: str


class MissingBillionsFragment(StrictModel):
    """The headline counterfactual: actual receipts vs receipts at the 2019 real
    per-visitor expenditure, in CONSTANT 2019 prices, deflated by the national CPI.

    Basis caveat, stated (never silent): the receipts series is the TSA inbound
    tourism consumption (tourist basis, Jad 1A) paired with visitor-basis arrivals —
    the same pairing the ticket's RM2,474 (2019) headline per-visitor figure uses.
    """

    anchor_year: int
    prices: Literal["constant_2019_rm"]
    receipts_series_id: str
    arrivals_series_id: str
    cpi_series_id: str
    deflator: DeflatorMeta
    years: list[CounterfactualYear] = Field(min_length=1)
    volume_trap: VolumeTrap
    headline: HeadlineGap  # ticket #13: the pre-registered, window-guarded headline
    supplementary: SupplementaryCumulative | None = None  # ticket #13: labelled, never the headline

    @model_validator(mode="after")
    def _check_supplementary_never_poses_as_headline(self):
        sup = self.supplementary
        if sup is None:
            return self
        if sup.window == self.headline.window:
            raise ValueError(
                f"supplementary window {sup.window!r} equals the headline window — a "
                "supplementary figure must extend beyond the pre-registered headline "
                "(ticket #13: it may never pose as the headline)"
            )
        latest = max(y.year for y in self.years)
        sup_end = int(sup.window.split("-")[-1])
        if sup_end != latest:
            raise ValueError(
                f"supplementary window must end at the latest fragment year ({latest}), "
                f"got {sup.window!r}"
            )
        return self

    @model_validator(mode="after")
    def _check_naive_nominal_is_loudly_negative(self):
        # Per the data the naive nominal counterfactual FAILS: nominal per-visitor
        # expenditure rose vs the anchor year, so the naive gap at the latest year
        # is negative. If a regression ever flips this sign (or a data update does),
        # emission and reload fail loudly instead of silently changing the story.
        latest = max(self.years, key=lambda y: y.year)
        if latest.year > self.anchor_year and latest.naive_nominal_gap_rm_million >= 0:
            raise ValueError(
                f"naive nominal counterfactual for {latest.year} is "
                f"{latest.naive_nominal_gap_rm_million:+.1f} (>= 0): the nominal per-visitor "
                "expenditure no longer exceeds the anchor year's, so the 'nominal flatters "
                "receipts' premise fails — re-derive the naive-negative expectation, do not "
                "suppress this error"
            )
        return self


class TextSourceRef(StrictModel):
    """Where a pdftotext-extract table was read from (file + table + printed page)."""

    file: str
    table: str
    page: int | None = None


class MarketObservation(StrictModel):
    """One market, one year. A missing table entry stays None — never zeroed."""

    year: int
    receipts_rm_million: float | None = None
    arrivals_persons: int | None = None
    receipts_rank: int | None = None
    arrivals_rank: int | None = None
    yield_rm_per_visitor: float | None = None


class SourceMarketRow(StrictModel):
    """One source market across the fragment's years, with explicit coverage."""

    market: str
    coverage: Literal["both", "arrivals_only", "receipts_only"]
    observations: list[MarketObservation] = Field(min_length=1)

    @model_validator(mode="after")
    def _check_coverage_and_yield(self):
        for obs in self.observations:
            has_receipts = obs.receipts_rm_million is not None
            has_arrivals = obs.arrivals_persons is not None
            if self.coverage == "arrivals_only" and (has_receipts or not has_arrivals):
                raise ValueError(
                    f"{self.market} {obs.year}: coverage 'arrivals_only' requires arrivals "
                    "and null receipts (never a silent zero)"
                )
            if self.coverage == "receipts_only" and (has_arrivals or not has_receipts):
                raise ValueError(
                    f"{self.market} {obs.year}: coverage 'receipts_only' requires receipts "
                    "and null arrivals (never a silent zero)"
                )
            if self.coverage == "both" and not (has_receipts and has_arrivals):
                raise ValueError(
                    f"{self.market} {obs.year}: coverage 'both' requires both values; "
                    "use the explicit arrivals_only/receipts_only coverage instead"
                )
            if has_receipts and has_arrivals:
                expected = obs.receipts_rm_million * 1_000_000 / obs.arrivals_persons
                if obs.yield_rm_per_visitor is None or abs(obs.yield_rm_per_visitor - expected) > 0.01:
                    raise ValueError(
                        f"{self.market} {obs.year}: yield {obs.yield_rm_per_visitor} does not "
                        f"match receipts/arrivals ({expected:.2f})"
                    )
            elif obs.yield_rm_per_visitor is not None:
                raise ValueError(
                    f"{self.market} {obs.year}: yield requires both receipts and arrivals"
                )
        return self


class SourceMarketFragment(StrictModel):
    """Source-market panel from the Tourism Malaysia Statistics in Brief (ticket T3):
    visitor receipts + visitor arrivals, top-20 tables, and derived per-market yield.
    In Brief receipts pair with In Brief arrivals per market (same counting basis)."""

    source_receipts: TextSourceRef
    source_arrivals: TextSourceRef
    national_totals: list[MarketObservation] = Field(min_length=1)
    markets: list[SourceMarketRow] = Field(min_length=1)

    @model_validator(mode="after")
    def _check_unique_markets_and_years(self):
        names = [m.market for m in self.markets]
        if len(set(names)) != len(names):
            dupes = sorted({n for n in names if names.count(n) > 1})
            raise ValueError(f"duplicate source market: {dupes}")
        for row in self.markets:
            years = [o.year for o in row.observations]
            if sorted(set(years)) != [2023, 2024]:
                raise ValueError(
                    f"{row.market}: source-market years must be exactly 2023 and 2024, got {years}"
                )
        return self

# ---------------------------------------------------------------------------
# Ticket T5: source-market segmentation (clusters + yield tiers).
# Additive schema extension: a new fragment kind in the Bundle union. No
# existing model changed; consumers that ignore unknown fragments are unaffected,
# so SCHEMA_VERSION stays 1.0.0.
# ---------------------------------------------------------------------------

SEGMENT_NAME_VOCAB = {
    "Volume Traps",
    "High-Yield Long-Haul",
    "High-Growth Emerging",
    "Mid-Yield Steady",
    "Low-Yield Steady",
}
YieldTier = Literal["top_quartile", "upper_middle", "lower_middle", "bottom_quartile"]


class FeatureDef(StrictModel):
    """One clustering feature, documented: what it is, where it came from, how
    missing values are handled. The feature subset is a contract, not a guess."""

    name: str
    description: str
    unit: str
    source: str
    transform: str  # "none" | "log10"
    imputation: str  # e.g. "none" or "median of clustered markets"


class SegmentationSource(StrictModel):
    """Provenance of the segmentation inputs (explicit attribution)."""

    market_source_file: str  # e.g. "inbrief2024.txt" (yield, arrivals, growth)
    wef_file: str  # e.g. "WEF_TTDI.csv"
    wef_dataset: str  # e.g. "WEF Travel & Tourism Development Index (TTDI) 2024 edition"
    wef_url: str
    wef_ref_year: int  # TIME_PERIOD selected from the WEF file


class MarketSegment(StrictModel):
    """One source market's segmentation result. Missing features stay None with
    attribution in `wef_missing` — never zeroed, never silently imputed."""

    market: str
    clustered: bool
    excluded_reason: str | None = None  # required when clustered is False
    yield_rm_per_visitor_2024: float | None = None
    arrivals_persons_2024: int | None = None
    arrivals_growth_pct: float | None = None  # 2024 vs 2023 arrivals
    wef_indicators: dict[str, float | None]  # feature name -> observed value (None = missing)
    wef_missing: list[str] = []  # indicators imputed, with the reason in the fragment docs
    wef_ref_years: dict[str, int] = {}  # indicator -> TIME_PERIOD actually used
    cluster_id: int | None = None
    segment_name: str | None = None
    yield_tier: YieldTier | None = None
    tier_label: str | None = None

    @model_validator(mode="after")
    def _check_cluster_fields(self):
        if self.clustered:
            if self.cluster_id is None or self.segment_name is None:
                raise ValueError(f"{self.market}: clustered markets need cluster_id and segment_name")
            if self.excluded_reason is not None:
                raise ValueError(f"{self.market}: clustered market must not carry an excluded_reason")
            if self.segment_name not in SEGMENT_NAME_VOCAB:
                raise ValueError(
                    f"{self.market}: segment_name {self.segment_name!r} is not in the judge-readable "
                    f"vocabulary {sorted(SEGMENT_NAME_VOCAB)}"
                )
        else:
            if self.excluded_reason is None:
                raise ValueError(f"{self.market}: non-clustered markets must state an excluded_reason")
            if self.cluster_id is not None or self.segment_name is not None or self.yield_tier is not None:
                raise ValueError(f"{self.market}: non-clustered markets must not carry cluster/tier fields")
        return self


class ClusterProfile(StrictModel):
    """A named cluster: members, profile means in original units, and the naming
    rationale (why this cluster earned its human-readable name)."""

    cluster_id: int
    segment_name: str
    naming_rationale: str
    members: list[str] = Field(min_length=1)
    centroid_features: dict[str, float]
    mean_yield_rm_per_visitor: float

    @model_validator(mode="after")
    def _check_name_in_vocab(self):
        if self.segment_name not in SEGMENT_NAME_VOCAB:
            raise ValueError(
                f"segment_name {self.segment_name!r} is not in the judge-readable vocabulary "
                f"{sorted(SEGMENT_NAME_VOCAB)}"
            )
        return self


class SegmentationFragment(StrictModel):
    """Unsupervised segmentation of source markets (ticket T5): k-means clusters
    with human-readable names plus yield quartile tiers for communication.

    Reconciliation contract: every yield figure here is copied from the
    `source_market` fragment (never recomputed); tiers are quartiles of exactly
    those figures, checked in the model validator; cluster profile means are
    means over the same member yields.
    """

    anchor_year: int  # the year the panel is segmented on (2024)
    method: str  # e.g. "k-means, k=3, z-scored features, k-means++ init"
    seed: int
    n_clusters: int
    naming_rationale: str  # the naming rules, stated
    source: SegmentationSource
    features: list[FeatureDef] = Field(min_length=1)
    markets: list[MarketSegment] = Field(min_length=1)
    clusters: list[ClusterProfile] = Field(min_length=1)
    tier_labels: dict[YieldTier, str]
    yield_quartile_boundaries: dict[str, float]  # q25 / q50 / q75 of the tiered yields

    @model_validator(mode="after")
    def _check_reconciliation(self):
        ids = [m.market for m in self.markets]
        if len(set(ids)) != len(ids):
            raise ValueError("duplicate market in segmentation fragment")
        by_id = {m.market: m for m in self.markets}

        clusters = {c.cluster_id: c for c in self.clusters}
        if len(clusters) != len(self.clusters):
            raise ValueError("duplicate cluster_id")
        names = [c.segment_name for c in self.clusters]
        if len(set(names)) != len(names):
            raise ValueError("segment names must be unique per cluster")
        if len(clusters) != self.n_clusters:
            raise ValueError("n_clusters must match the emitted clusters")

        for m in self.markets:
            if m.clustered:
                cluster = clusters.get(m.cluster_id)
                if cluster is None:
                    raise ValueError(f"{m.market}: unknown cluster_id {m.cluster_id}")
                if m.segment_name != cluster.segment_name:
                    raise ValueError(f"{m.market}: segment_name disagrees with its cluster")
                if m.market not in cluster.members:
                    raise ValueError(f"{m.market}: not listed in cluster {m.cluster_id} members")

        for c in self.clusters:
            for member in c.members:
                row = by_id.get(member)
                if row is None or not row.clustered or row.cluster_id != c.cluster_id:
                    raise ValueError(f"cluster {c.cluster_id}: member {member!r} disagrees with its market row")

        # tiers are quartiles of the SAME emitted yield figures
        yields = [m.yield_rm_per_visitor_2024 for m in self.markets if m.yield_rm_per_visitor_2024 is not None]
        import statistics

        q25, q50, q75 = statistics.quantiles(yields, n=4, method="inclusive")
        boundaries = self.yield_quartile_boundaries
        for key, expected in (("q25", q25), ("q50", q50), ("q75", q75)):
            if key not in boundaries or abs(boundaries[key] - expected) > 1e-6:
                raise ValueError(
                    f"yield_quartile_boundaries[{key}] does not reconcile with the emitted yields"
                )
        for m in self.markets:
            if m.yield_rm_per_visitor_2024 is None:
                continue
            y = m.yield_rm_per_visitor_2024
            expected_tier = (
                "top_quartile" if y >= q75
                else "upper_middle" if y >= q50
                else "lower_middle" if y >= q25
                else "bottom_quartile"
            )
            if m.yield_tier != expected_tier:
                raise ValueError(f"{m.market}: tier {m.yield_tier!r} does not reconcile with yield {y}")
        return self


# ---------------------------------------------------------------------------
# Ticket T7: the client-side market-mix simulator. Additive schema extension:
# a new fragment kind in the Bundle union. No existing model changed; consumers
# that ignore unknown fragments are unaffected, so SCHEMA_VERSION stays 1.0.0.
# ---------------------------------------------------------------------------


class SimulatorMarket(StrictModel):
    """One source market's simulator coefficients, CONSTANT 2019 PRICES.

    The nominal yield is the source_market fragment's 2024 figure; the real
    yield is that figure deflated by the national CPI (cpi_ratio_to_anchor of
    the mix year). Arrivals + shares are the volume data the mix arithmetic
    needs; 2023 shares power the "earliest observed mix" preset.
    """

    market: str
    coverage: Literal["both", "residual"]
    yield_2024_nominal_rm_per_visitor: float | None = None  # None only for the residual row
    yield_2024_real_2019_rm_per_visitor: float
    arrivals_2024_persons: int
    arrivals_2023_persons: int
    share_of_arrivals_2024: float
    share_of_arrivals_2023: float


class SimulatorFragment(StrictModel):
    """Client-side market-mix simulator coefficients (ticket T7).

    The browser recomputes receipts, yield per visitor and the Missing
    Billions gap for any user-chosen market mix with EXACTLY the arithmetic in
    `simulator.simulate_mix` — transparent constant-2019-prices arithmetic on
    these exported coefficients, no ML, no network.

    Reconciliation contract: the fragment partitions the national totals the
    missing_billions fragment uses (TSA Jad 1A receipts / visitor-basis
    arrivals) via an explicit "Other markets (residual)" row, so at the 2024
    actual mix the client-side result equals the headline calculator EXACTLY
    (float tolerance). The residual also absorbs the In Brief vs Jad 1A
    receipts basis difference and the partial-coverage top-20 markets
    (Bangladesh, Myanmar, Canada, Netherlands) — stated here, never silent.
    """

    prices: Literal["constant_2019_rm"]
    anchor_year: int  # price anchor AND counterfactual yield anchor (2019)
    mix_year: int  # the year the yield coefficients and default mix describe (2024)
    comparison_year: int  # earliest observed mix, preset-only (2023)
    cpi_series_id: str  # must resolve in the macro_series fragment
    cpi_ratio_to_anchor_mix_year: float  # CPI(mix_year) / CPI(anchor_year)
    visitor_arrivals_2024: int  # national, visitor basis (missing_billions pairing)
    visitor_arrivals_2023: int
    anchor_per_visitor_real_2019_rm: float  # the counterfactual per-visitor yield
    markets: list[SimulatorMarket] = Field(min_length=2)

    @model_validator(mode="after")
    def _check_simulator_invariants(self):
        if (self.mix_year, self.comparison_year, self.anchor_year) != (2024, 2023, 2019):
            raise ValueError(
                f"simulator years are (anchor, comparison, mix) = (2019, 2023, 2024) by "
                f"contract, got {(self.anchor_year, self.comparison_year, self.mix_year)}"
            )
        residuals = [m for m in self.markets if m.coverage == "residual"]
        if len(residuals) != 1:
            raise ValueError(
                f"exactly one residual row is required (it partitions the national totals), "
                f"got {len(residuals)}"
            )
        for m in self.markets:
            if m.coverage == "residual":
                if m.yield_2024_nominal_rm_per_visitor is not None:
                    raise ValueError(
                        f"{m.market}: the residual row has no observable nominal yield; "
                        "leave it None (its real yield is derived from the reconciliation)"
                    )
                if m.arrivals_2024_persons <= 0 or m.arrivals_2023_persons <= 0:
                    raise ValueError(
                        f"{m.market}: non-positive residual — the market set no longer "
                        "partitions the national totals; the reconciliation would be a fudge"
                    )
                if m.yield_2024_real_2019_rm_per_visitor <= 0:
                    raise ValueError(
                        f"{m.market}: non-positive residual real yield — receipts basis "
                        "drift; re-derive the residual, do not ship a negative fudge bucket"
                    )
            else:
                if m.yield_2024_nominal_rm_per_visitor is None:
                    raise ValueError(f"{m.market}: coverage 'both' needs a nominal yield")
                expected_real = (
                    m.yield_2024_nominal_rm_per_visitor / self.cpi_ratio_to_anchor_mix_year
                )
                if abs(m.yield_2024_real_2019_rm_per_visitor - expected_real) > 1e-9:
                    raise ValueError(
                        f"{m.market}: real yield {m.yield_2024_real_2019_rm_per_visitor} is "
                        f"not the nominal yield deflated by the mix-year CPI ratio "
                        f"({expected_real})"
                    )
        for year, arrivals_total, share_field, arrivals_field in (
            (2024, self.visitor_arrivals_2024, "share_of_arrivals_2024", "arrivals_2024_persons"),
            (2023, self.visitor_arrivals_2023, "share_of_arrivals_2023", "arrivals_2023_persons"),
        ):
            if sum(getattr(m, arrivals_field) for m in self.markets) != arrivals_total:
                raise ValueError(
                    f"{year}: market arrivals must sum exactly to the national visitor "
                    "arrivals (the residual row guarantees the partition)"
                )
            share_sum = sum(getattr(m, share_field) for m in self.markets)
            if abs(share_sum - 1.0) > 1e-9:
                raise ValueError(f"{year}: shares must sum to 1, got {share_sum}")
        return self


# ---------------------------------------------------------------------------
# Ticket T6: the regional yield benchmark (Thailand, Indonesia vs Malaysia,
# 2024). Additive schema extension: a new fragment kind in the Bundle union.
# No existing model changed; consumers that ignore unknown fragments are
# unaffected, so SCHEMA_VERSION stays 1.0.0.
#
# Provenance: these are officially published figures researched and documented
# in research/regional-yield-benchmark-2024.md (per-country official tourism
# authority / statistical office releases). They are constants of the
# derivation (the pipeline cannot re-scrape foreign statistical offices), so
# every row carries its receipts basis, conversion note and source URLs, and
# the model validators reconcile each row internally.
# ---------------------------------------------------------------------------

ReceiptsBasis = Literal["survey", "balance_of_payments", "administrative_aggregate"]


class RegionalReceipts(StrictModel):
    """A country's 2024 international tourism receipts, as published.

    `local_amount_billion` is None where the authority publishes USD only
    (Indonesia) — never a converted figure dressed up as official.
    """

    local_amount_billion: float | None = None
    local_currency: str | None = None  # ISO 4217, e.g. "THB" (None when no official local figure)
    usd_billion: float
    usd_note: str  # conversion basis: rate used or "authority-stated conversion"


class RegionalCountry(StrictModel):
    """One country's 2024 receipts-per-visitor row against its 2019 WDI baseline.

    The 2019 figure is always the World Bank WDI receipts-per-visitor
    (ST.INT.RCPT.CD / arrivals) — the latest WDI-comparable year for these
    countries (the current WDI build stops at 2020)."""

    country: str
    role: Literal["baseline", "comparator"]
    receipts_basis: ReceiptsBasis
    receipts_basis_note: str
    arrivals_2024: int
    receipts_2024: RegionalReceipts
    yield_2024_usd_per_visitor: float
    yield_2019_usd_per_visitor: float
    yield_change_2024_vs_2019_pct: float
    yield_multiple_of_malaysia_2024: float | None  # None for the baseline itself
    source_urls: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def _check_reconciliation(self):
        expected_yield = self.receipts_2024.usd_billion * 1e9 / self.arrivals_2024
        if abs(self.yield_2024_usd_per_visitor - expected_yield) > expected_yield * 0.01:
            raise ValueError(
                f"{self.country}: yield {self.yield_2024_usd_per_visitor} does not match "
                f"receipts/arrivals ({expected_yield:.1f})"
            )
        expected_change = (self.yield_2024_usd_per_visitor / self.yield_2019_usd_per_visitor - 1) * 100
        if abs(self.yield_change_2024_vs_2019_pct - expected_change) > 1.0:
            raise ValueError(
                f"{self.country}: change {self.yield_change_2024_vs_2019_pct}% does not reconcile "
                f"with the yields ({expected_change:+.1f}%)"
            )
        if self.role == "baseline":
            if self.yield_multiple_of_malaysia_2024 is not None:
                raise ValueError(f"{self.country}: the baseline must not carry a multiple of itself")
        else:
            if self.yield_multiple_of_malaysia_2024 is None:
                raise ValueError(f"{self.country}: comparators must state their multiple of Malaysia")
        for url in self.source_urls:
            if not url.startswith("http"):
                raise ValueError(f"{self.country}: source_urls must be URLs, got {url!r}")
        return self


class ExcludedMarket(StrictModel):
    """A market dropped from the comparison, with the documented reason
    (never silently omitted)."""

    country: str
    reason: str


class RegionalBenchmarkFragment(StrictModel):
    """Cross-country receipts-per-visitor benchmark (ticket T6), from the
    researched official 2024 releases. The regional gap is SUPPORTING context
    for the Missing Billions headline — never the headline itself (CONTEXT.md).
    """

    anchor_year: int  # 2024
    baseline_year: int  # 2019 (the WDI baseline year)
    currency: Literal["usd"]
    baseline_market: str  # "Malaysia"
    countries: list[RegionalCountry] = Field(min_length=2)
    excluded_markets: list[ExcludedMarket] = Field(min_length=1)
    caveats: list[str] = Field(min_length=1)
    research_doc: str  # path of the research note this fragment documents

    @model_validator(mode="after")
    def _check_structure(self):
        names = [c.country for c in self.countries]
        if len(set(names)) != len(names):
            raise ValueError(f"duplicate country: {names}")
        baselines = [c for c in self.countries if c.role == "baseline"]
        if len(baselines) != 1 or baselines[0].country != self.baseline_market:
            raise ValueError(
                f"exactly one baseline country ({self.baseline_market}) is required, got "
                f"{[c.country for c in baselines]}"
            )
        if not any(e.country == "Vietnam" for e in self.excluded_markets):
            raise ValueError(
                "Vietnam must be an explicitly excluded market with the documented reason "
                "(its published revenue includes domestic tourism), not a silent omission"
            )
        return self


def _canonical_json(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


class Bundle(StrictModel):
    bundle_version: int = BUNDLE_VERSION
    schema_version: Annotated[str, Field(pattern=r"^\d+\.\d+\.\d+$")] = SCHEMA_VERSION
    generated_utc: str = ""  # set by the emitter; excluded from the checksum
    sources: dict[str, str]  # file name -> sha256 of the raw file bytes
    fragments: dict[str, NationalSeriesFragment | SourceMarketFragment | MacroSeriesFragment | MissingBillionsFragment | SegmentationFragment | SimulatorFragment | RegionalBenchmarkFragment]
    checksum: str | None = None

    @model_validator(mode="after")
    def _compute_checksum(self):
        computed = hashlib.sha256(
            _canonical_json(
                {
                    "bundle_version": self.bundle_version,
                    "schema_version": self.schema_version,
                    "sources": self.sources,
                    "fragments": {k: v.model_dump(mode="json") for k, v in self.fragments.items()},
                }
            ).encode("utf-8")
        ).hexdigest()
        if self.checksum is not None and self.checksum != computed:
            raise ValueError(f"checksum mismatch: recorded {self.checksum}, computed {computed}")
        object.__setattr__(self, "checksum", computed)
        return self

    def to_json(self) -> str:
        return self.model_dump_json(indent=2)
