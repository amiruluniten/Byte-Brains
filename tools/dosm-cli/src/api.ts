import { AxiError } from "axi-sdk-js";
import { cached, type CacheOptions } from "./cache.ts";

export const API_BASE = "https://api.data.gov.my";
/** API responses are cheap and datasets update on schedules; 10 min is a safe TTL. */
export const API_TTL_SEC = 10 * 60;
/** Documented and verified limit: 4 requests/minute per API. */
export const RATE_LIMIT_PER_MIN = 4;

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export interface QueryParams {
  id: string;
  endpoint?: "data-catalogue" | "opendosm";
  /** exact match values in `value@column` form */
  filters?: string[];
  /** partial match in `value@column` form */
  contains?: string;
  /** inclusive date range start, `YYYY-MM-DD[@column]` (column defaults to `date`) */
  dateStart?: string;
  /** inclusive date range end, `YYYY-MM-DD[@column]` (column defaults to `date`) */
  dateEnd?: string;
  /** sort spec, `-` prefix for descending */
  sort?: string;
  /** max records; null sends no limit (full dataset) */
  limit?: number | null;
  /** column projection (include) */
  fields?: string[];
  /** numeric range `column[begin:end]`, open ends allowed */
  range?: string;
}

export interface ApiMeta {
  catalogue_id?: string;
  data_as_of?: string;
  last_updated?: string;
  next_update?: string;
  data_source?: string[];
  update_frequency?: string;
  total?: number;
  limit?: number;
}

export interface ApiResult {
  meta: ApiMeta | null;
  data: Record<string, unknown>[];
}

function withDateColumn(value: string, fallback: string): string {
  return value.includes("@") ? value : `${value}@${fallback}`;
}

export function buildApiUrl(p: QueryParams): string {
  const endpoint = p.endpoint ?? "data-catalogue";
  const url = new URL(`${API_BASE}/${endpoint}`);
  url.searchParams.set("id", p.id);
  url.searchParams.set("meta", "true");
  if (p.filters && p.filters.length > 0) {
    url.searchParams.set("filter", p.filters.join(","));
  }
  if (p.contains) url.searchParams.set("contains", p.contains);
  if (p.dateStart) url.searchParams.set("date_start", withDateColumn(p.dateStart, "date"));
  if (p.dateEnd) url.searchParams.set("date_end", withDateColumn(p.dateEnd, "date"));
  if (p.sort) url.searchParams.set("sort", p.sort);
  if (p.limit !== null && p.limit !== undefined) {
    url.searchParams.set("limit", String(p.limit));
  }
  if (p.fields && p.fields.length > 0) {
    url.searchParams.set("include", p.fields.join(","));
  }
  if (p.range) url.searchParams.set("range", p.range);
  return url.toString();
}

interface ApiDeps extends CacheOptions {
  wait?: boolean;
  fetchImpl?: FetchImpl;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: string, fetchImpl: FetchImpl, timeoutMs: number): Promise<Response> {
  return fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
}

async function translateErrorResponse(res: Response, url: string): Promise<AxiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // ignore body parse failures
  }
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after") ?? 60);
    return new AxiError(
      `rate limited by api.data.gov.my (4 requests/minute); retry in ~${retry}s`,
      "RATE_LIMITED",
      [
        `wait ~${retry}s before the next API call`,
        "use `--wait` to retry automatically",
        "use `dosm download <id>` for bulk pulls - storage.data.gov.my has no rate limit",
      ],
    );
  }
  const details = (body as { details?: unknown } | null)?.details;
  if (res.status === 400) {
    const msg = Array.isArray(details) ? details.join(" ") : String(details ?? "bad request");
    return new AxiError(`API rejected the query: ${msg}`, "VALIDATION_ERROR", [
      `check flags with \`dosm get --help\``,
    ]);
  }
  if (res.status === 404) {
    return new AxiError(`dataset not found: ${url}`, "NOT_FOUND", [
      "Run `dosm search <query>` to find valid dataset ids",
    ]);
  }
  return new AxiError(
    `api.data.gov.my returned HTTP ${res.status}`,
    "SERVER_ERROR",
    ["retry later, or pull the full file with `dosm download <id>`"],
  );
}

/** Query a dataset from api.data.gov.my with caching, 429 handling, and error translation. */
export async function queryDataset(p: QueryParams, deps: ApiDeps = {}): Promise<ApiResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = buildApiUrl(p);
  const { value } = await cached(
    ["api", url],
    API_TTL_SEC,
    deps,
    async () => {
      let res = await fetchJson(url, fetchImpl, 60_000);
      if (res.status === 429 && deps.wait) {
        const retry = Math.min(Number(res.headers.get("retry-after") ?? 60), 120);
        await sleep((retry + 1) * 1000);
        res = await fetchJson(url, fetchImpl, 60_000);
      }
      if (!res.ok) throw await translateErrorResponse(res, url);
      const body = (await res.json()) as ApiResult;
      if (Array.isArray(body)) {
        // meta=true should always wrap, but guard anyway
        return { meta: null, data: body };
      }
      return { meta: body.meta ?? null, data: body.data ?? [] };
    },
  );
  return value;
}

/** Fetch the full record set as JSON (used by `download --format json`). */
export async function fetchAllRecords(p: QueryParams, deps: ApiDeps = {}): Promise<ApiResult> {
  return queryDataset({ ...p, limit: null }, deps);
}
