import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { buildTar } from "../src/tar.ts";
import { AxiError } from "axi-sdk-js";
import { getDataset, listDatasets, searchDatasets, viewDataset, downloadCommand, type Env } from "../src/commands.ts";
import type { FetchBuffer } from "../src/catalog.ts";
import { fixture, fixtureResponse } from "./fixture.ts";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dosm-cmd-"));
}

const FUEL_META = fixture<Record<string, unknown>>("fuelprice.meta.json");
const FUEL_API = fixture<Record<string, unknown>>("fuelprice.api.json");

function envWithCatalog(dir: string, extra: Partial<Env> = {}): Env {
  const tar = buildTar([{ name: "data-catalogue/fuelprice.json", data: JSON.stringify(FUEL_META) }]);
  const env: Env & { cacheDir: string } = {
    cacheDir: dir,
    fetchBuffer: async () => ({ status: 200, headers: { get: () => null }, data: new Uint8Array(zlib.gzipSync(tar)) }),
    fetchImpl: async (url: string) => {
      if (url.includes("api.data.gov.my")) return fixtureResponse("fuelprice.api.json");
      throw new Error(`unexpected fetch: ${url}`);
    },
    ...extra,
  };
  return env;
}

describe("list", () => {
  it("lists datasets with count and hints", async () => {
    const out = (await listDatasets([], envWithCatalog(tmpDir()))) as Record<string, unknown>;
    expect(out.count).toBe("1 of 1 datasets");
    expect((out.datasets as unknown[]).length).toBe(1);
    expect((out.help as string[]).join(" ")).toContain("dosm view <id>");
  });

  it("respects --limit with a see-all hint", async () => {
    const dir = tmpDir();
    const e = envWithCatalog(dir);
    // build a 3-dataset catalog
    const metas = ["a", "b", "c"].map((id) => JSON.stringify({ title_en: `T ${id}`, frequency: "DAILY" }));
    const tar = buildTar(metas.map((m, i) => ({ name: `data-catalogue/ds-${i}.json`, data: m })));
    e.fetchBuffer = async () => ({ status: 200, headers: { get: () => null }, data: new Uint8Array(zlib.gzipSync(tar)) });
    const out = (await listDatasets(["--limit", "2"], e)) as Record<string, unknown>;
    expect(out.count).toBe("2 of 3 datasets");
    expect((out.help as string[]).join(" ")).toContain("--limit 3");
  });

  it("rejects positional args", async () => {
    await expect(listDatasets(["oops"], envWithCatalog(tmpDir()))).rejects.toThrow("takes no positional");
  });
});

describe("search", () => {
  it("matches titles, descriptions, and field names", async () => {
    const out = (await searchDatasets(["petrol"], envWithCatalog(tmpDir()))) as Record<string, unknown>;
    expect(out.count).toContain("1 of 1");
    expect((out.matches as Array<Record<string, string>>)[0]!.id).toBe("fuelprice");
  });

  it("gives a definitive empty state", async () => {
    const out = (await searchDatasets(["zzz-nothing"], envWithCatalog(tmpDir()))) as Record<string, unknown>;
    expect(out.count).toBe('0 datasets matching "zzz-nothing"');
    expect(out.matches).toEqual([]);
  });

  it("requires a query", async () => {
    await expect(searchDatasets([], envWithCatalog(tmpDir()))).rejects.toThrow("requires a query");
  });
});

describe("view", () => {
  it("shows truncated text by default and hints --full", async () => {
    const out = (await viewDataset(["fuelprice"], envWithCatalog(tmpDir()))) as Record<string, unknown>;
    const ds = out.dataset as Record<string, unknown>;
    expect(ds.api).toBe(true);
    const long = FUEL_META.caveat_en as string;
    expect(ds.caveat).toBe(long.slice(0, 500));
    expect((out.help as string[]).join(" ")).toContain("--full");
    expect((out.fields as unknown[]).length).toBe((FUEL_META.fields as unknown[]).length);
  });

  it("--full prints untruncated", async () => {
    const out = (await viewDataset(["fuelprice", "--full"], envWithCatalog(tmpDir()))) as Record<string, unknown>;
    const ds = out.dataset as Record<string, unknown>;
    expect(ds.caveat).toBe(FUEL_META.caveat_en);
  });

  it("flags api-excluded datasets", async () => {
    const dir = tmpDir();
    const meta = { ...FUEL_META, exclude_openapi: true };
    const tar = buildTar([{ name: "data-catalogue/fuelprice.json", data: JSON.stringify(meta) }]);
    const e = envWithCatalog(dir);
    e.fetchBuffer = async () => ({ status: 200, headers: { get: () => null }, data: new Uint8Array(zlib.gzipSync(tar)) });
    const out = (await viewDataset(["fuelprice"], e)) as Record<string, unknown>;
    expect((out.dataset as Record<string, unknown>).api).toBe(false);
  });
});

describe("get", () => {
  it("returns records with meta and next-step hints", async () => {
    const out = (await getDataset(["fuelprice", "--limit", "3"], envWithCatalog(tmpDir()))) as Record<string, unknown>;
    expect(out.count).toBe("3 records");
    expect((out.records as unknown[]).length).toBe(3);
    const meta = out.meta as Record<string, unknown>;
    expect(meta.data_as_of).toBe("2026-09-10 00:01");
  });

  it("empty result is definitive", async () => {
    const dir = tmpDir();
    const e = envWithCatalog(dir);
    e.fetchImpl = async () => fixtureResponse("fuelprice.api.json").clone();
    // serve an empty result for the filtered URL
    e.fetchImpl = async (url: string) => {
      if (url.includes("filter=")) {
        return new Response(JSON.stringify({ meta: { catalogue_id: "fuelprice", total: 0 }, data: [] }), { status: 200 });
      }
      return fixtureResponse("fuelprice.api.json");
    };
    const out = (await getDataset(["fuelprice", "--filter", "none@x"], e)) as Record<string, unknown>;
    expect(out.count).toContain("0 records");
    expect((out.help as string[]).join(" ")).toContain("dosm view fuelprice");
  });

  it("rejects api-excluded datasets with a download suggestion", async () => {
    const dir = tmpDir();
    const meta = { ...FUEL_META, exclude_openapi: true };
    const tar = buildTar([{ name: "data-catalogue/fuelprice.json", data: JSON.stringify(meta) }]);
    const e = envWithCatalog(dir);
    e.fetchBuffer = async () => ({ status: 200, headers: { get: () => null }, data: new Uint8Array(zlib.gzipSync(tar)) });
    try {
      await getDataset(["fuelprice"], e);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as AxiError).message).toBe("fuelprice is not exposed via the API");
      expect((err as AxiError).suggestions.join(" ")).toContain("dosm download fuelprice");
    }
  });
});

describe("download", () => {
  it("validates --format", async () => {
    await expect(downloadCommand(["fuelprice", "--format", "xlsx"], envWithCatalog(tmpDir()))).rejects.toThrow("--format expects csv");
  });

  it("saves storage CSV to ./data/<id>.csv", async () => {
    const dir = tmpDir();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "dosm-dl-"));
    const e = envWithCatalog(dir);
    e.cwd = cwd;
    e.fetchImpl = async (url: string) => {
      if (url.includes("storage.data.gov.my")) {
        return new Response("date,ron95\n2026-01-01,2.05\n", { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };
    const out = (await downloadCommand(["fuelprice"], e)) as Record<string, unknown>;
    const dl = out.download as Record<string, unknown>;
    expect(dl.source).toBe("storage");
    expect(dl.file).toBe(path.join(cwd, "data", "fuelprice.csv"));
    expect(fs.readFileSync(dl.file as string, "utf8")).toContain("ron95");
  });

  it("json format pulls via API and counts records", async () => {
    const dir = tmpDir();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "dosm-dl-"));
    const e = envWithCatalog(dir);
    e.cwd = cwd;
    const out = (await downloadCommand(["fuelprice", "--format", "json"], e)) as Record<string, unknown>;
    const dl = out.download as Record<string, unknown>;
    expect(dl.source).toBe("api");
    expect(dl.records).toBe(3);
    expect(fs.existsSync(dl.file as string)).toBe(true);
  });
});
