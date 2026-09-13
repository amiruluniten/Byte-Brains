import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { buildTar } from "../src/tar.ts";
import { loadCatalog, loadMeta } from "../src/catalog.ts";
import { fixture } from "./fixture.ts";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dosm-cat-"));
}

function metaTar(): Uint8Array {
  const a = JSON.stringify({ title_en: "Dataset A", description_en: "about arrivals", frequency: "MONTHLY", geography: ["NATIONAL"], fields: [{ name: "date", title_en: "Date" }] });
  const b = JSON.stringify({ title_en: "Dataset B", description_en: "prices", exclude_openapi: true, link_csv: "https://storage.data.gov.my/b.csv" });
  const tar = buildTar([
    { name: "data-catalogue/dataset-a.json", data: a },
    { name: "data-catalogue/dataset-b.json", data: b },
    { name: "README.md", data: "ignore" },
  ]);
  return new Uint8Array(zlib.gzipSync(tar));
}

function deps(dir: string) {
  return {
    cacheDir: dir,
    fetchBuffer: async () => ({ status: 200, headers: { get: () => null }, data: metaTar() }),
  };
}

describe("catalog", () => {
  it("builds summaries and per-dataset meta files from one tarball", async () => {
    const dir = tmpDir();
    const catalog = await loadCatalog(deps(dir));
    expect(catalog.count).toBe(2);
    expect(catalog.datasets.map((d) => d.id).sort()).toEqual(["dataset-a", "dataset-b"]);
    expect(fs.existsSync(path.join(dir, "catalog", "meta", "dataset-a.json"))).toBe(true);
  });

  it("caches: second call does not refetch", async () => {
    const dir = tmpDir();
    let fetches = 0;
    const d = deps(dir);
    d.fetchBuffer = async () => {
      fetches++;
      return { status: 200, headers: { get: () => null }, data: metaTar() };
    };
    await loadCatalog(d);
    await loadCatalog(d);
    expect(fetches).toBe(1);
  });

  it("falls back to stale cache when offline", async () => {
    const dir = tmpDir();
    await loadCatalog(deps(dir));
    const offline = await loadCatalog({
      cacheDir: dir,
      fetchBuffer: async () => {
        throw new Error("network down");
      },
    });
    expect(offline.count).toBe(2);
  });

  it("loadMeta reads the extracted meta and errors for unknown ids", async () => {
    const dir = tmpDir();
    await loadCatalog(deps(dir));
    const meta = await loadMeta("dataset-b", { cacheDir: dir });
    expect(meta.exclude_openapi).toBe(true);
    await expect(loadMeta("nope", { cacheDir: dir })).rejects.toThrow("unknown dataset id");
  });

  it("parses the real fuelprice fixture schema", async () => {
    const meta = fixture<DatasetLike>("fuelprice.meta.json");
    expect(meta.title_en).toBe("Price of Petroleum & Diesel");
    expect(meta.link_csv).toContain("storage.data.gov.my");
    expect(meta.fields?.length).toBeGreaterThan(3);
  });
});

interface DatasetLike {
  title_en: string;
  link_csv: string;
  fields: unknown[];
}
