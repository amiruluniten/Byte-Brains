import { describe, expect, it } from "vitest";
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
    expect(visitor).toHaveLength(1);
    expect(visitor[0].series_id).toBe("arrivals_visitor_2019_2024");

    const tourist = seriesFor(bundle, "arrivals", "tourist");
    expect(tourist.map((s) => s.series_id)).toEqual([
      "arrivals_tourist_2015_2023",
      "arrivals_tourist_2019_2024",
    ]);

    expect(seriesFor(bundle, "arrivals", "excursionist")).toHaveLength(1);
    expect(seriesFor(bundle, "inbound_tourism_consumption", "tourist")).toHaveLength(1);
    expect(seriesFor(bundle, "arrivals", "nonexistent" as never)).toHaveLength(0);
  });
});
