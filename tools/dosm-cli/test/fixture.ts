import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export function fixture<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(here, "fixtures", name), "utf8")) as T;
}

export function fixtureResponse(name: string, status = 200, headers?: Record<string, string>): Response {
  const body = fs.readFileSync(path.join(here, "fixtures", name), "utf8");
  const h = new Headers(headers);
  return new Response(body, { status, headers: h });
}
