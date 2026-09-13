#!/usr/bin/env node
/**
 * Sync the data bundle from the pipeline output (the single seam) into the
 * dashboard directory so a Vercel build (repo checkout = dashboard root) can
 * read it at build time without any path outside this folder.
 *
 * - If ../data/processed/bundle.json exists, copy it over the local copy.
 * - Otherwise keep the committed copy (data/bundle.json) untouched.
 * - Fails loudly if neither is present: a build without the bundle is an error,
 *   not a blank site.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dashboardRoot = join(here, "..");
const pipelineBundle = join(dashboardRoot, "..", "data", "processed", "bundle.json");
const localBundle = join(dashboardRoot, "data", "bundle.json");

if (existsSync(pipelineBundle)) {
  mkdirSync(dirname(localBundle), { recursive: true });
  copyFileSync(pipelineBundle, localBundle);
  console.log(`[sync-bundle] copied ${pipelineBundle} -> ${localBundle}`);
} else if (existsSync(localBundle)) {
  console.log(
    "[sync-bundle] pipeline bundle not found; using committed copy " + localBundle
  );
} else {
  console.error(
    "[sync-bundle] FATAL: no data bundle found. Expected " +
      pipelineBundle +
      " (run the pipeline first) or a committed copy at " +
      localBundle +
      "."
  );
  process.exit(1);
}
