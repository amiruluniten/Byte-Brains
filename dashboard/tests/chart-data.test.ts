import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadBundleFromString } from "../src/lib/bundle";
import {
  buildArrivalsChart,
  buildReceiptsChart,
  type ChartSpec,
} from "../src/lib/chart-data";

const bundle = loadBundleFromString(
  readFileSync(join(__dirname, "..", "data", "bundle.json"), "utf8")
);

describe("buildArrivalsChart", () => {
  const spec: ChartSpec = buildArrivalsChart(bundle);

  it("has a title naming the extensive side", () => {
    expect(spec.title).toMatch(/extensive/i);
    expect(spec.title).toMatch(/arrivals/i);
  });

  it("labels the counting basis of every trace, never merges bases", () => {
    const names = spec.series.map((s) => s.name);
    // Tourist-basis and visitor-basis traces exist side by side, each labelled.
    expect(names.some((n) => /tourist/i.test(n))).toBe(true);
    expect(names.some((n) => /visitor/i.test(n))).toBe(true);
    for (const s of spec.series) {
      expect(s.basisLabel).toMatch(/basis/i);
      expect(s.basisLabel).toMatch(/tourist|visitor/i);
      expect(s.basisLabel).toContain(s.window); // window stated, never inferred
    }
  });

  it("carries the known ground-truth values from the bundle", () => {
    const visitor2024 = spec.series.find(
      (s) => s.basis === "visitor" && s.window === "2019-2024"
    )!;
    expect(visitor2024.points.find((p) => p[0] === 2024)?.[1]).toBe(37961485);
    const tourist2019 = spec.series.find(
      (s) => s.basis === "tourist" && s.window === "2015-2023"
    )!;
    expect(tourist2019.points.find((p) => p[0] === 2019)?.[1]).toBe(26100784);
  });

  it("schema 1.1.0: the 2025 window traces are labelled preliminary (2025p)", () => {
    const visitor2025 = spec.series.find(
      (s) => s.basis === "visitor" && s.window === "2019-2025"
    )!;
    expect(visitor2025.name).toMatch(/2025p/);
    expect(visitor2025.points.find((p) => p[0] === 2025)?.[1]).toBe(42196892);
    for (const s of spec.series.filter((s) => s.window === "2019-2025")) {
      expect(s.name).toMatch(/2025p/);
    }
  });

  it("names traces after their measure", () => {
    expect(spec.series.every((s) => /arrivals/i.test(s.name))).toBe(true);
  });

  it("states the unit", () => {
    expect(spec.series.every((s) => s.unit === "persons")).toBe(true);
  });
});

describe("buildReceiptsChart", () => {
  const spec: ChartSpec = buildReceiptsChart(bundle);

  it("has a title naming the intensive side", () => {
    expect(spec.title).toMatch(/intensive/i);
    expect(spec.title).toMatch(/receipt|spending|consumption/i);
  });

  it("carries the known 2019 ground truth (RM 86,706.5M)", () => {
    const s = spec.series[0]; // deterministic: shortest window first
    expect(s.window).toBe("2015-2024");
    expect(s.points.find((p) => p[0] === 2019)?.[1]).toBe(86706.5);
    expect(s.unit).toBe("rm_million");
    expect(s.basisLabel).toMatch(/tourist basis/i);
    expect(s.basisLabel).toContain("2015-2024");
  });

  it("schema 1.1.0: two windows, the 2025 one preliminary-labelled and revised 2024", () => {
    expect(spec.series.map((s) => s.window)).toEqual(["2015-2024", "2015-2025"]);
    const s25 = spec.series[1];
    expect(s25.name).toMatch(/2025p/);
    // the 2025 window carries the TSA 2025 REVISED 2024 value, not the old one
    expect(s25.points.find((p) => p[0] === 2024)?.[1]).toBe(102931.3);
    expect(s25.points.find((p) => p[0] === 2025)?.[1]).toBe(119312.0);
    // the pre-2025 window keeps the values as first published (window discipline)
    expect(spec.series[0].points.find((p) => p[0] === 2024)?.[1]).toBe(102815.3);
  });

  it("names traces after their measure (receipts are not called arrivals)", () => {
    for (const s of spec.series) {
      expect(s.name).toMatch(/inbound consumption/i);
      expect(s.name).not.toMatch(/arrivals/i);
    }
  });
});
