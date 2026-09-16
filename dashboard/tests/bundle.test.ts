import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BundleLoadError,
  loadBundleFromString,
  seriesFor,
  type Bundle,
} from "../src/lib/bundle";

const committedBundlePath = join(__dirname, "..", "data", "bundle.json");

function readCommitted(): string {
  return readFileSync(committedBundlePath, "utf8");
}

describe("loadBundleFromString", () => {
  it("loads and validates the committed bundle (checksum verified)", () => {
    const bundle = loadBundleFromString(readCommitted());
    expect(bundle.bundle_version).toBe(1);
    expect(bundle.fragments.national_series.series.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects invalid JSON with a clear error", () => {
    expect(() => loadBundleFromString("{not json")).toThrow(BundleLoadError);
    expect(() => loadBundleFromString("{not json")).toThrow(/not valid JSON/i);
  });

  it("rejects a bundle with a bad checksum (corruption fails loudly)", () => {
    const parsed = JSON.parse(readCommitted()) as Record<string, unknown>;
    parsed.checksum = "0".repeat(64);
    expect(() => loadBundleFromString(JSON.stringify(parsed))).toThrow(BundleLoadError);
    expect(() => loadBundleFromString(JSON.stringify(parsed))).toThrow(/checksum/i);
  });

  it("rejects a bundle missing the national_series fragment", () => {
    const parsed = JSON.parse(readCommitted()) as {
      fragments: Record<string, unknown>;
    };
    const { national_series: _drop, ...rest } = parsed.fragments;
    const without = { ...parsed, fragments: rest };
    expect(() => loadBundleFromString(JSON.stringify(without))).toThrow(
      BundleLoadError
    );
  });

  it("rejects a series whose years are not strictly ascending", () => {
    const parsed = JSON.parse(readCommitted()) as Bundle;
    const series = parsed.fragments.national_series.series[0];
    const scrambled = {
      ...parsed,
      fragments: {
        ...parsed.fragments,
        national_series: {
          series: [
            {
              ...series,
              values: [...series.values].reverse(),
            },
          ],
        },
      },
    };
    expect(() => loadBundleFromString(JSON.stringify(scrambled))).toThrow(
      BundleLoadError
    );
  });
});

describe("seriesFor (bundle selection helpers)", () => {
  const bundle = loadBundleFromString(readCommitted());

  it("finds series by measure and basis", () => {
    const visitor = seriesFor(bundle, "arrivals", "visitor");
    expect(visitor.map((s) => s.series_id)).toEqual([
      "arrivals_visitor_2019_2024",
      "arrivals_visitor_2019_2025",
    ]);

    const tourist = seriesFor(bundle, "arrivals", "tourist");
    expect(tourist.map((s) => s.series_id)).toEqual([
      "arrivals_tourist_2015_2023",
      "arrivals_tourist_2019_2024",
      "arrivals_tourist_2019_2025",
    ]);

    expect(seriesFor(bundle, "arrivals", "excursionist").map((s) => s.series_id)).toEqual([
      "arrivals_excursionist_2019_2024",
      "arrivals_excursionist_2019_2025",
    ]);
    expect(seriesFor(bundle, "inbound_tourism_consumption", "tourist").map((s) => s.series_id)).toEqual([
      "inbound_consumption_tourist_2015_2024",
      "inbound_consumption_tourist_2015_2025",
    ]);
    expect(seriesFor(bundle, "arrivals", "nonexistent" as never)).toHaveLength(0);
  });

  it("schema 1.1.0: the 2025 series row is preliminary and the 2024 row revised", () => {
    const receipts = seriesFor(bundle, "inbound_tourism_consumption", "tourist").find(
      (s) => s.window === "2015-2025"
    )!;
    const last = receipts.values[receipts.values.length - 1];
    expect(last.year).toBe(2025);
    expect(last.revision_status).toBe("preliminary");
    expect(last.revision_flag).toBe("p");
    const row24 = receipts.values.find((o) => o.year === 2024)!;
    expect(row24.revision_status).toBe("revised"); // TSA 2025 restated 2024
  });

  it("schema 1.1.0: the guarded headline and the labelled supplementary", () => {
    const mb = bundle.fragments.missing_billions!;
    expect(mb.headline.window).toBe("2020-2024");
    expect(mb.headline.pre_registered).toBe(true);
    expect(mb.headline.prices).toBe("constant_2019_rm");
    expect(mb.supplementary!.window).toBe("2020-2025");
    expect(mb.supplementary!.label.toLowerCase()).toContain("supplementary");
  });

  it("rejects a bundle whose headline window breaks the pre-registered contract", () => {
    // A synthetic minimal bundle (integers and plain decimals only, so a JS
    // canonical-JSON re-serialization is byte-identical to Python's) with a
    // result-shopped headline window: the parser must fail on the guard, not
    // merely on the (recomputed) checksum.
    const payload = {
      bundle_version: 1,
      schema_version: "1.1.0",
      generated_utc: "2026-01-01T00:00:00Z",
      sources: { "tourism_2023.xlsx": "0".repeat(64) },
      fragments: {
        national_series: {
          series: [
            {
              series_id: "arrivals_visitor_2019_2020",
              measure: "arrivals",
              basis: "visitor",
              unit: "persons",
              window: "2019-2020",
              source: { file: "tourism_2023.xlsx", sheet: "S", row_label: "A", row: 2 },
              values: [
                { year: 2019, value: 1000 },
                { year: 2020, value: 900 },
              ],
            },
          ],
        },
        missing_billions: {
          anchor_year: 2019,
          prices: "constant_2019_rm",
          receipts_series_id: "arrivals_visitor_2019_2020",
          arrivals_series_id: "arrivals_visitor_2019_2020",
          cpi_series_id: "cpi_x",
          deflator: {
            series_id: "cpi_x",
            description: "d",
            anchor_year: 2019,
            anchor_index: 100,
            index_base: "2010=100",
            source: {
              dataset_id: "cpi_headline",
              title: "t",
              url: "https://example.com",
              fetched_utc: "2026-01-01T00:00:00Z",
              index_base: "2010=100",
            },
          },
          years: [
            {
              year: 2019,
              visitor_arrivals: 1000,
              receipts_nominal_rm_million: 10.5,
              per_visitor_nominal_rm: 10.5,
              cpi_index: 100,
              cpi_ratio_to_anchor: 1,
              per_visitor_real_2019_rm: 10.5,
              actual_receipts_2019_prices_rm_million: 10.5,
              counterfactual_receipts_2019_prices_rm_million: 10.5,
              gap_2019_prices_rm_million: 0,
              naive_nominal_gap_rm_million: 0,
              revision_status: "final",
            },
          ],
          volume_trap: {
            excursionist_share_2019_pct: 25,
            excursionist_share_2024_pct: 34,
            excursionist_share_change_pp: 9,
            land_mode_share_2024_pct: 66,
            land_mode_share_source: "s",
          },
          headline: {
            window: "2020-2025", // result-shopping: NOT the pre-registered window
            prices: "constant_2019_rm",
            cumulative_gap_rm_million: 0,
            pre_registered: true,
            basis_note: "n",
          },
        },
      },
    };
    const canonical = (v: unknown): string => {
      if (v === null || typeof v === "boolean") return JSON.stringify(v);
      if (typeof v === "number") return String(v);
      if (typeof v === "string") return JSON.stringify(v);
      if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
      const obj = v as Record<string, unknown>;
      return `{${Object.keys(obj)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
        .join(",")}}`;
    };
    // the emitter hashes exactly {bundle_version, schema_version, sources,
    // fragments} — generated_utc is excluded
    const withChecksum = (p: typeof payload) =>
      JSON.stringify({
        ...p,
        checksum: createHash("sha256")
          .update(
            canonical({
              bundle_version: p.bundle_version,
              schema_version: p.schema_version,
              sources: p.sources,
              fragments: p.fragments,
            }),
            "utf8"
          )
          .digest("hex"),
      });
    expect(() => loadBundleFromString(withChecksum(payload))).toThrow(BundleLoadError);
    expect(() => loadBundleFromString(withChecksum(payload))).toThrow(/pre-registered/i);
  });
});
