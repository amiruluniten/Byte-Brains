import fs from "node:fs";
import path from "node:path";
import { AxiError } from "axi-sdk-js";
import { queryDataset } from "./api.ts";
import type { FetchBuffer } from "./catalog.ts";
import { loadCatalog, loadMeta, type Catalog, type DatasetMeta } from "./catalog.ts";
import type { FetchImpl } from "./api.ts";
import { defaultCacheDir } from "./cache.ts";
import { bool, num, parseFlags, str, strArray, type FlagType, type FlagValue } from "./flags.ts";
import { downloadDataset } from "./download.ts";
import { truncate } from "./output.ts";

/** Injectable runtime bits (tests stub these; the CLI uses platform defaults). */
export interface Env {
  fetchImpl?: FetchImpl;
  fetchBuffer?: FetchBuffer;
  cwd?: string;
  /** default cacheDir for this invocation (flags take precedence) */
  cacheDir?: string;
  /** default noCache for this invocation (flags take precedence) */
  noCache?: boolean;
}

const GLOBAL_FLAGS: Record<string, FlagType> = {
  "no-cache": "boolean",
  "cache-dir": "string",
  wait: "boolean",
};

interface Runtime {
  cacheDir: string;
  noCache: boolean;
  wait: boolean;
}

function runtime(flags: Record<string, FlagValue>, env: Env): Runtime & Env {
  return {
    cacheDir: str(flags, "cache-dir") ?? env.cacheDir ?? defaultCacheDir(),
    noCache: bool(flags, "no-cache") || env.noCache === true,
    wait: bool(flags, "wait"),
    fetchImpl: env.fetchImpl,
    fetchBuffer: env.fetchBuffer,
    cwd: env.cwd,
  };
}

function requireId(positionals: string[], command: string): string {
  if (positionals.length === 0) {
    throw new AxiError(`\`${command}\` requires a dataset id`, "VALIDATION_ERROR", [
      `Run \`dosm search <query>\` to find dataset ids`,
      `Run \`${command} --help\` for usage`,
    ]);
  }
  if (positionals.length > 1) {
    throw new AxiError(
      `\`${command}\` takes exactly one dataset id, got ${positionals.length}`,
      "VALIDATION_ERROR",
      [`Run \`${command} --help\` for usage`],
    );
  }
  return positionals[0]!;
}

// ---------------------------------------------------------------- list

export async function listDatasets(args: string[], env: Env = {}) {
  const { positionals, flags } = parseFlags(
    args,
    { ...GLOBAL_FLAGS, limit: "number" },
    "list",
  );
  if (positionals.length > 0) {
    throw new AxiError(
      `\`list\` takes no positional arguments, got "${positionals[0]}"`,
      "VALIDATION_ERROR",
      ["Run `dosm search <query>` to filter by keyword"],
    );
  }
  const rt = runtime(flags, env);
  const limit = num(flags, "limit") ?? 100;
  const catalog = await loadCatalog(rt);
  const rows = catalog.datasets
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, limit)
    .map((d) => ({ id: d.id, title: d.title, frequency: d.frequency ?? "" }));
  const help: string[] = [];
  if (rows.length < catalog.count) {
    help.push(`Run \`dosm list --limit ${catalog.count}\` to see all ${catalog.count} datasets`);
  }
  help.push(`Run \`dosm view <id>\` for dataset details`);
  help.push(`Run \`dosm search <query>\` to filter by keyword`);
  return {
    count: `${rows.length} of ${catalog.count} datasets`,
    datasets: rows,
    help,
  };
}

// ---------------------------------------------------------------- search

function readMetaQuiet(cacheDir: string, id: string): DatasetMeta | null {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(cacheDir, "catalog", "meta", `${id}.json`), "utf8"),
    ) as DatasetMeta;
  } catch {
    return null;
  }
}

interface Match {
  id: string;
  title: string;
  match: string;
  rank: number;
}

function searchDatasetsIn(catalog: Catalog, cacheDir: string, query: string): Match[] {
  const q = query.toLowerCase();
  const matches: Match[] = [];
  const consider = (id: string, title: string, where: string, rank: number) => {
    const existing = matches.find((m) => m.id === id);
    if (existing) {
      if (rank < existing.rank) {
        existing.rank = rank;
        existing.match = where;
      }
      return;
    }
    matches.push({ id, title, match: where, rank });
  };
  for (const ds of catalog.datasets) {
    if (ds.id.toLowerCase().includes(q)) consider(ds.id, ds.title, "id", 0);
    if (ds.title.toLowerCase().includes(q)) consider(ds.id, ds.title, "title", 1);
    const meta = readMetaQuiet(cacheDir, ds.id);
    if (meta?.description_en?.toLowerCase().includes(q)) {
      consider(ds.id, ds.title, "description", 2);
    }
    if (ds.categories.some((c) => c.toLowerCase().includes(q))) {
      consider(ds.id, ds.title, "category", 2);
    }
    for (const field of meta?.fields ?? []) {
      if (
        field.name.toLowerCase().includes(q) ||
        (field.title_en ?? "").toLowerCase().includes(q)
      ) {
        consider(ds.id, ds.title, `field:${field.name}`, 3);
      }
    }
  }
  return matches.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
}

export async function searchDatasets(args: string[], env: Env = {}) {
  const { positionals, flags } = parseFlags(
    args,
    { ...GLOBAL_FLAGS, limit: "number" },
    "search",
  );
  if (positionals.length === 0) {
    throw new AxiError(
      `\`search\` requires a query`,
      "VALIDATION_ERROR",
      ["example: `dosm search tourism`"],
    );
  }
  const query = positionals.join(" ");
  const rt = runtime(flags, env);
  const limit = num(flags, "limit") ?? 20;
  const catalog = await loadCatalog(rt);
  const matches = searchDatasetsIn(catalog, rt.cacheDir, query);
  if (matches.length === 0) {
    return {
      count: `0 datasets matching "${query}"`,
      matches: [],
      help: [
        `Run \`dosm list\` to browse all ${catalog.count} datasets`,
        `Run \`dosm search <other-keyword>\` with a different keyword`,
      ],
    };
  }
  const shown = matches.slice(0, limit);
  const help: string[] = [];
  if (shown.length < matches.length) {
    help.push(`Run \`dosm search ${JSON.stringify(query)} --limit ${matches.length}\` to see all ${matches.length} matches`);
  }
  help.push(`Run \`dosm view <id>\` for dataset details`);
  return {
    count: `${shown.length} of ${matches.length} matches for "${query}"`,
    matches: shown.map(({ id, title, match }) => ({ id, title, match })),
    help,
  };
}

// ---------------------------------------------------------------- view

export async function viewDataset(args: string[], env: Env = {}) {
  const { positionals, flags } = parseFlags(
    args,
    { ...GLOBAL_FLAGS, full: "boolean" },
    "view",
  );
  const id = requireId(positionals, "view");
  const full = bool(flags, "full");
  const rt = runtime(flags, env);
  const meta = await loadMeta(id, rt);
  const text = (value: string | undefined) =>
    value ? (full ? value : truncate(value).text) : undefined;
  const dataset: Record<string, unknown> = {
    id,
    title: meta.title_en,
    description: text(meta.description_en),
    frequency: meta.frequency,
    geography: meta.geography,
    data_as_of: meta.data_as_of,
    last_updated: meta.last_updated,
    next_update: meta.next_update,
    source: meta.data_source?.join(", "),
    api: !meta.exclude_openapi,
  };
  if (meta.methodology_en) dataset.methodology = text(meta.methodology_en);
  if (meta.caveat_en) dataset.caveat = text(meta.caveat_en);
  if (meta.publication_en) dataset.publication = text(meta.publication_en);
  const links: Record<string, string> = {};
  if (meta.link_csv) links.csv = meta.link_csv;
  if (meta.link_parquet) links.parquet = meta.link_parquet;
  const help: string[] = [];
  if (!full && [meta.description_en, meta.methodology_en, meta.caveat_en, meta.publication_en]
    .some((t) => t && truncate(t).truncated)) {
    help.push(`Run \`dosm view ${id} --full\` for untruncated text`);
  }
  if (meta.exclude_openapi) {
    help.push(`This dataset is not queryable via the API - use \`dosm download ${id}\` instead`);
  } else {
    help.push(`Run \`dosm get ${id} --limit 5\` to preview records`);
  }
  return {
    dataset,
    fields: (meta.fields ?? []).map((f) => ({ name: f.name, title: f.title_en ?? "" })),
    links,
    help,
  };
}

// ---------------------------------------------------------------- get

export async function getDataset(args: string[], env: Env = {}) {
  const { positionals, flags } = parseFlags(
    args,
    {
      ...GLOBAL_FLAGS,
      filter: "string[]",
      contains: "string",
      "date-start": "string",
      "date-end": "string",
      sort: "string",
      limit: "number",
      fields: "string[]",
      range: "string",
    },
    "get",
  );
  const id = requireId(positionals, "get");
  const rt = runtime(flags, env);
  const meta = await loadMeta(id, rt);
  if (meta.exclude_openapi) {
    throw new AxiError(
      `${id} is not exposed via the API`,
      "VALIDATION_ERROR",
      [`Run \`dosm download ${id}\` to save the full data file instead`],
    );
  }
  const limit = num(flags, "limit") ?? 20;
  const result = await queryDataset(
    {
      id,
      filters: strArray(flags, "filter"),
      contains: str(flags, "contains"),
      dateStart: str(flags, "date-start"),
      dateEnd: str(flags, "date-end"),
      sort: str(flags, "sort"),
      limit,
      fields: strArray(flags, "fields"),
      range: str(flags, "range"),
    },
    rt,
  );
  const metaOut: Record<string, unknown> = {};
  for (const key of ["data_as_of", "last_updated", "next_update", "update_frequency"] as const) {
    if (result.meta?.[key]) metaOut[key] = result.meta[key];
  }
  if (result.meta?.data_source) metaOut.source = result.meta.data_source.join(", ");
  const help: string[] = [];
  if (result.data.length === 0) {
    return {
      count: `0 records match this query for ${id}`,
      records: [],
      help: [
        `Run \`dosm view ${id}\` to check field names and the date column`,
        "relax --filter/--contains, or widen --date-start/--date-end",
      ],
    };
  }
  if (result.data.length === limit) {
    help.push(`Run \`dosm get ${id} --limit ${Math.max(limit * 4, 100)}\` for more rows`);
    help.push(`Run \`dosm download ${id}\` to save the full dataset as a file`);
  } else {
    help.push(`Run \`dosm download ${id}\` to save the full dataset as a file`);
  }
  return {
    meta: metaOut,
    count: `${result.data.length} records`,
    records: result.data,
    help,
  };
}

// ---------------------------------------------------------------- download

export async function downloadCommand(args: string[], env: Env = {}) {
  const { positionals, flags } = parseFlags(
    args,
    { ...GLOBAL_FLAGS, format: "string", out: "string" },
    "download",
  );
  const id = requireId(positionals, "download");
  const format = str(flags, "format") ?? "csv";
  if (!["csv", "parquet", "json"].includes(format)) {
    throw new AxiError(
      `--format expects csv, parquet, or json, got "${format}"`,
      "VALIDATION_ERROR",
    );
  }
  const rt = runtime(flags, env);
  const result = await downloadDataset(
    { id, format: format as "csv" | "parquet" | "json", out: str(flags, "out") },
    rt,
  );
  const out: Record<string, unknown> = {
    id: result.id,
    file: result.file,
    format: result.format,
    source: result.source,
    bytes: result.bytes,
  };
  if (result.records !== undefined) out.records = result.records;
  return { download: out };
}
