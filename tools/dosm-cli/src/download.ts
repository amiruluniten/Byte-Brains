import { createWriteStream } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AxiError } from "axi-sdk-js";
import type { FetchImpl } from "./api.ts";
import { fetchAllRecords } from "./api.ts";
import type { CacheOptions } from "./cache.ts";
import { loadMeta, type CatalogDeps } from "./catalog.ts";

export interface DownloadDeps extends CacheOptions, CatalogDeps {
  wait?: boolean;
  fetchImpl?: FetchImpl;
  cwd?: string;
}

export interface DownloadResult {
  id: string;
  file: string;
  format: string;
  source: "storage" | "api";
  bytes: number;
  records?: number;
}

export interface DownloadOptions {
  id: string;
  format?: "csv" | "parquet" | "json";
  out?: string;
}

const FORMAT_EXT: Record<string, string> = { csv: "csv", parquet: "parquet", json: "json" };

export function defaultOutPath(cwd: string, id: string, format: string): string {
  const ext = FORMAT_EXT[format] ?? "csv";
  return path.join(cwd, "data", `${id}.${ext}`);
}

/** Download full dataset data: storage file when available, API JSON fallback. */
export async function downloadDataset(
  opts: DownloadOptions,
  deps: DownloadDeps = {},
): Promise<DownloadResult> {
  const cwd = deps.cwd ?? process.cwd();
  const format = opts.format ?? "csv";
  const meta = await loadMeta(opts.id, deps);
  const out = opts.out ?? defaultOutPath(cwd, opts.id, format);
  const absolute = path.resolve(cwd, out);

  if (format === "json") {
    const result = await fetchAllRecords({ id: opts.id }, deps);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    const body = JSON.stringify(result.data, null, 2);
    fs.writeFileSync(absolute, body);
    return {
      id: opts.id,
      file: absolute,
      format,
      source: "api",
      bytes: Buffer.byteLength(body),
      records: result.data.length,
    };
  }

  const url = format === "parquet" ? meta.link_parquet : meta.link_csv;
  if (!url) {
    throw new AxiError(
      `no ${format} file is published for ${opts.id}`,
      "NOT_FOUND",
      [
        `try \`dosm download ${opts.id} --format json\` (full dataset via the API)`,
        "or check the dataset page on open.dosm.gov.my",
      ],
    );
  }
  const fetchImpl = deps.fetchImpl ?? fetch;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(300_000) });
  if (!res.ok || !res.body) {
    throw new AxiError(
      `download failed (HTTP ${res.status}) for ${url}`,
      "SERVER_ERROR",
      ["retry later, or try `--format json`"],
    );
  }
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(absolute));
  const bytes = fs.statSync(absolute).size;
  return { id: opts.id, file: absolute, format, source: "storage", bytes };
}
