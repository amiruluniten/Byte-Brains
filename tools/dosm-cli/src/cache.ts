import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface CacheOptions {
  cacheDir?: string;
  noCache?: boolean;
}

export function defaultCacheDir(): string {
  const xdg = process.env.XDG_CACHE_HOME;
  return path.join(xdg && xdg.length > 0 ? xdg : path.join(os.homedir(), ".cache"), "dosm-cli");
}

function cacheFile(key: string[], cacheDir: string): string {
  const hash = createHash("sha1").update(JSON.stringify(key)).digest("hex");
  return path.join(cacheDir, "entries", `${hash}.json`);
}

interface CacheEnvelope {
  key: string[];
  expires: number;
  value: unknown;
}

/**
 * Read-through TTL cache. Returns the loader result, from disk when a fresh
 * copy exists (unless noCache), otherwise loads and stores it.
 */
export async function cached<T>(
  key: string[],
  ttlSec: number,
  opts: CacheOptions,
  loader: () => Promise<T>,
): Promise<{ value: T; fromCache: boolean }> {
  const dir = opts.cacheDir ?? defaultCacheDir();
  const file = cacheFile(key, dir);
  if (!opts.noCache) {
    try {
      const env = JSON.parse(fs.readFileSync(file, "utf8")) as CacheEnvelope;
      if (Date.now() < env.expires) {
        return { value: env.value as T, fromCache: true };
      }
    } catch {
      // miss
    }
  }
  const value = await loader();
  const env: CacheEnvelope = { key, expires: Date.now() + ttlSec * 1000, value };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(env));
    fs.renameSync(tmp, file);
  } catch {
    // cache write failures must not fail the command
  }
  return { value, fromCache: false };
}

/** Read a cache entry even if expired; never loads from the network. */
export function readStale<T>(key: string[], opts: CacheOptions): T | null {
  const dir = opts.cacheDir ?? defaultCacheDir();
  try {
    const env = JSON.parse(fs.readFileSync(cacheFile(key, dir), "utf8")) as CacheEnvelope;
    return env.value as T;
  } catch {
    return null;
  }
}

/** Read a cache entry only if fresh; never loads from the network. */
export function readFresh<T>(key: string[], opts: CacheOptions): T | null {
  const dir = opts.cacheDir ?? defaultCacheDir();
  try {
    const env = JSON.parse(fs.readFileSync(cacheFile(key, dir), "utf8")) as CacheEnvelope;
    if (Date.now() < env.expires) return env.value as T;
  } catch {
    // miss
  }
  return null;
}
