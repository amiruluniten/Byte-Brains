import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cached, readStale } from "../src/cache.ts";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dosm-cache-"));
}

describe("cache", () => {
  it("stores and reuses values within TTL", async () => {
    const dir = tmpDir();
    let loads = 0;
    const load = async () => ++loads;
    const first = await cached(["k"], 60, { cacheDir: dir }, load);
    const second = await cached(["k"], 60, { cacheDir: dir }, load);
    expect(first.value).toBe(1);
    expect(first.fromCache).toBe(false);
    expect(second.value).toBe(1);
    expect(second.fromCache).toBe(true);
  });

  it("--no-cache bypasses and refreshes", async () => {
    const dir = tmpDir();
    let loads = 0;
    const load = async () => ++loads;
    await cached(["k"], 60, { cacheDir: dir }, load);
    const refreshed = await cached(["k"], 60, { cacheDir: dir, noCache: true }, load);
    expect(refreshed.value).toBe(2);
  });

  it("readStale returns even expired entries", async () => {
    const dir = tmpDir();
    await cached(["k"], -1, { cacheDir: dir }, async () => "old");
    expect(readStale(["k"], { cacheDir: dir })).toBe("old");
  });
});
