import { describe, expect, it } from "vitest";
import { parseFlags } from "../src/flags.ts";
import { AxiError } from "axi-sdk-js";

describe("parseFlags", () => {
  const specs = { limit: "number", filter: "string[]", full: "boolean", out: "string" } as const;

  it("splits positionals and flags", () => {
    const { positionals, flags } = parseFlags(["fuelprice", "--limit", "5"], specs, "get");
    expect(positionals).toEqual(["fuelprice"]);
    expect(flags.limit).toBe(5);
  });

  it("supports --flag=value form", () => {
    const { flags } = parseFlags(["--out=./data/x.csv"], specs, "download");
    expect(flags.out).toBe("./data/x.csv");
  });

  it("collects repeated string[] flags", () => {
    const { flags } = parseFlags(["--filter", "a@col1", "--filter=b@col2"], specs, "get");
    expect(flags.filter).toEqual(["a@col1", "b@col2"]);
  });

  it("booleans take no value", () => {
    const { flags } = parseFlags(["--full"], specs, "view");
    expect(flags.full).toBe(true);
  });

  it("rejects unknown flags with valid list (AXI fail-loud)", () => {
    expect(() => parseFlags(["--stat", "x"], specs, "list")).toThrow(AxiError);
    try {
      parseFlags(["--stat", "x"], specs, "list");
    } catch (e) {
      expect((e as AxiError).code).toBe("VALIDATION_ERROR");
      expect((e as AxiError).message).toContain("unknown flag --stat for `list`");
      expect((e as AxiError).suggestions.join(" ")).toContain("--limit, --filter, --full, --out");
    }
  });

  it("rejects bad numbers", () => {
    expect(() => parseFlags(["--limit", "abc"], specs, "list")).toThrow(AxiError);
    expect(() => parseFlags(["--limit", "-1"], specs, "list")).toThrow(AxiError);
  });
});
