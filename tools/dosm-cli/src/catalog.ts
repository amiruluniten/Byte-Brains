import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { AxiError } from "axi-sdk-js";
import { cached, defaultCacheDir, readStale, type CacheOptions } from "./cache.ts";
import { extractTarEntries } from "./tar.ts";

export const META_TARBALL_URL =
  "https://github.com/data-gov-my/datagovmy-meta/archive/refs/heads/main.tar.gz";
export const CATALOG_TTL_SEC = 24 * 60 * 60;

export interface FetchBufferResult {
  status: number;
  headers: { get(name: string): string | null };
  /** Exact bytes of the body (must not be a wider pooled buffer view). */
  data: Uint8Array;
}

export type FetchBuffer = (
  url: string,
  init?: RequestInit,
) => Promise<FetchBufferResult>;

export interface DatasetSummary {
  id: string;
  title: string;
  frequency: string | null;
  geography: string[];
  /** category + subcategory names from site_category (lowercased, unique) */
  categories: string[];
  data_as_of: string | null;
  last_updated: string | null;
}

export interface Catalog {
  fetched_at: string;
  count: number;
  datasets: DatasetSummary[];
}

export interface DatasetMeta {
  title_en?: string;
  description_en?: string;
  exclude_openapi?: boolean;
  data_as_of?: string;
  last_updated?: string;
  next_update?: string;
  methodology_en?: string;
  caveat_en?: string;
  publication_en?: string;
  link_csv?: string;
  link_parquet?: string;
  frequency?: string;
  geography?: string[];
  data_source?: string[];
  site_category?: Array<{ category_en?: string; subcategory_en?: string }>;
  fields?: Array<{ name: string; title_en?: string; description_en?: string }>;
  [key: string]: unknown;
}

export interface CatalogDeps extends CacheOptions {
  fetchBuffer?: FetchBuffer;
}

const CATALOG_KEY = ["catalog", "index"];

function metaPath(cacheDir: string, id: string): string {
  return path.join(cacheDir, "catalog", "meta", `${id}.json`);
}

function summarize(id: string, meta: DatasetMeta): DatasetSummary {
  const siteCategory = meta.site_category as
    | Array<{ category_en?: string; subcategory_en?: string }>
    | undefined;
  const categories = [
    ...new Set(
      (siteCategory ?? [])
        .flatMap((c) => [c.category_en ?? "", c.subcategory_en ?? ""])
        .filter((c) => c.length > 0),
    ),
  ];
  return {
    id,
    title: meta.title_en ?? id,
    frequency: meta.frequency ?? null,
    geography: meta.geography ?? [],
    categories,
    data_as_of: meta.data_as_of ?? null,
    last_updated: meta.last_updated ?? null,
  };
}

/** Read a per-dataset metadata JSON, refreshing the catalog once if missing. */
export async function loadMeta(
  id: string,
  deps: CatalogDeps = {},
): Promise<DatasetMeta> {
  const cacheDir = deps.cacheDir ?? defaultCacheDir();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return JSON.parse(fs.readFileSync(metaPath(cacheDir, id), "utf8")) as DatasetMeta;
    } catch {
      if (attempt === 0) await loadCatalog(deps);
    }
  }
  throw new AxiError(`unknown dataset id: ${id}`, "NOT_FOUND", [
    "Run `dosm search <query>` to find valid dataset ids",
    "Run `dosm list` to browse the catalogue",
  ]);
}

/**
 * Load the dataset catalogue from the datagovmy-meta GitHub repo (one tarball,
 * extracted and cached for 24h). Falls back to a stale cache copy when offline.
 */
export async function loadCatalog(deps: CatalogDeps = {}): Promise<Catalog> {
  const cacheDir = deps.cacheDir ?? defaultCacheDir();
  const fetchBuffer =
    deps.fetchBuffer ??
    (async (url, init) => {
      const res = await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(120_000) });
      return {
        status: res.status,
        headers: { get: (n: string) => res.headers.get(n) },
        data: new Uint8Array(await res.arrayBuffer()),
      };
    });
  try {
    const { value, fromCache } = await cached(CATALOG_KEY, CATALOG_TTL_SEC, deps, async () => {
      const res = await fetchBuffer(META_TARBALL_URL);
      if (res.status !== 200) {
        throw new AxiError(
          `failed to download dataset metadata (HTTP ${res.status})`,
          "SERVER_ERROR",
          ["retry later"],
        );
      }
      const tar = zlib.gunzipSync(res.data);
      const datasets: DatasetSummary[] = [];
      fs.mkdirSync(path.join(cacheDir, "catalog", "meta"), { recursive: true });
      for (const entry of extractTarEntries(tar)) {
        // GitHub archives wrap entries in <repo>-<ref>/data-catalogue/...; plain
        // catalogs use data-catalogue/... directly. Match the last two segments.
        const m = entry.name.match(/data-catalogue\/([^/]+)\.json$/);
        if (!m) continue;
        const id = m[1]!;
        const meta = JSON.parse(new TextDecoder().decode(entry.data)) as DatasetMeta;
        datasets.push(summarize(id, meta));
        const file = metaPath(cacheDir, id);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(meta));
      }
      return { fetched_at: new Date().toISOString(), count: datasets.length, datasets };
    });
    void fromCache;
    return value;
  } catch (error) {
    // Offline or GitHub unreachable: serve a stale cached index if we have one.
    const stale = staleIndex(deps);
    if (stale) return stale;
    throw error;
  }
}

function staleIndex(deps: CatalogDeps): Catalog | null {
  return readStale<Catalog>(CATALOG_KEY, { cacheDir: deps.cacheDir });
}
