import { runAxiCli } from "axi-sdk-js";
import { defaultCacheDir, readStale } from "./cache.ts";
import {
  downloadCommand,
  getDataset,
  listDatasets,
  searchDatasets,
  viewDataset,
  type Env,
} from "./commands.ts";
import type { Catalog } from "./catalog.ts";
import { VERSION } from "./version.ts";

const BIN = "dosm";

const TOP_LEVEL_HELP = `usage:
  ${BIN} list [--limit N]
  ${BIN} search <query> [--limit N]
  ${BIN} view <id> [--full]
  ${BIN} get <id> [flags]
  ${BIN} download <id> [--format csv|parquet|json] [--out <path>]
  ${BIN} update

examples:
  ${BIN} search tourism
  ${BIN} view fuelprice
  ${BIN} get fuelprice --limit 5 --sort -date
  ${BIN} download fuelprice --format csv

global flags:
  --no-cache       bypass the on-disk cache for this call
  --cache-dir <d>  override the cache directory (default ~/.cache/dosm-cli)
`;

const COMMAND_HELP: Record<string, string> = {
  list: `list - browse the dataset catalogue

usage: ${BIN} list [--limit N] [--no-cache] [--cache-dir <d>]

flags:
  --limit <n>      max rows shown (default 100)
  --no-cache       refetch the catalogue from GitHub
  --cache-dir <d>  override the cache directory

examples:
  ${BIN} list
  ${BIN} list --limit 300
`,
  search: `search - find datasets by keyword

usage: ${BIN} search <query> [--limit N] [--no-cache] [--cache-dir <d>]

Matches dataset ids, titles, descriptions, and field names (case-insensitive).

flags:
  --limit <n>      max matches shown (default 20)
  --no-cache       refetch the catalogue from GitHub
  --cache-dir <d>  override the cache directory

examples:
  ${BIN} search tourism
  ${BIN} search "labour force"
`,
  view: `view - full metadata for one dataset

usage: ${BIN} view <id> [--full] [--no-cache] [--cache-dir <d>]

flags:
  --full           print untruncated descriptions, methodology, and caveats
  --no-cache       refetch the catalogue from GitHub
  --cache-dir <d>  override the cache directory

examples:
  ${BIN} view fuelprice
  ${BIN} view fuelprice --full
`,
  get: `get - query records from the API (TOON on stdout)

usage: ${BIN} get <id> [flags]

flags:
  --filter <v@col>   exact match; repeatable (e.g. --filter level@series_type)
  --contains <v@col> partial match (e.g. --contains Langkawi@state)
  --date-start <d>   inclusive, YYYY-MM-DD[@date-col]
  --date-end <d>     inclusive, YYYY-MM-DD[@date-col]
  --sort <col>       sort spec; -col for descending
  --limit <n>        max records (default 20)
  --fields <c1,c2>   column projection (comma separated)
  --range <col[b:e]> numeric range, open ends allowed (e.g. --range year[2020:2024])
  --wait             auto-wait on 429 (api limit: 4 requests/minute)
  --no-cache         bypass the response cache (default TTL 10 min)
  --cache-dir <d>    override the cache directory

examples:
  ${BIN} get fuelprice --limit 3 --sort -date
  ${BIN} get tourism_arrivals --date-start 2024-01-01 --date-end 2024-12-31
  ${BIN} get fuelprice --filter level@series_type --fields date,ron95
`,
  download: `download - save full dataset data to a file

usage: ${BIN} download <id> [--format csv|parquet|json] [--out <path>] [--wait]

Prefers the full file from storage.data.gov.my (no rate limit); --format json
pulls all records through the API instead. Saves to ./data/<id>.<ext> by default.

flags:
  --format <f>     csv (default), parquet, or json
  --out <path>     destination path (default ./data/<id>.<ext>)
  --wait           auto-wait on 429 when using the API
  --no-cache       bypass the response cache (json only)
  --cache-dir <d>  override the cache directory

examples:
  ${BIN} download fuelprice
  ${BIN} download cpi_core --format parquet
  ${BIN} download fuelprice --out ./source/fuelprice.csv
`,
};

function home(env: Env) {
  return async () => {
    const cacheDir = defaultCacheDir();
    const catalog = readStale<Catalog>(["catalog", "index"], { cacheDir });
    if (catalog && catalog.datasets.length > 0) {
      const last = catalog.datasets
        .map((d) => d.last_updated ?? "")
        .sort()
        .at(-1);
      return {
        catalog: `${catalog.count} datasets cached (newest data as of ${last ?? "unknown"})`,
        help: [
          `Run \`${BIN} search <query>\` to find datasets by keyword`,
          `Run \`${BIN} list\` to browse all datasets`,
          `Run \`${BIN} get <id> --limit 5\` to preview records`,
          `Run \`${BIN} download <id>\` to save full data as CSV`,
        ],
      };
    }
    return {
      catalog: "not cached yet - the first catalogue call downloads ~300 dataset metadata files (one tarball, cached for 24h)",
      help: [
        `Run \`${BIN} list\` to fetch and browse the catalogue`,
        `Run \`${BIN} search tourism\` to find datasets by keyword`,
        `Run \`${BIN} get <id> --limit 5\` to preview records`,
      ],
    };
  };
}

export interface MainOptions {
  stdout?: { write: (chunk: string) => unknown };
}

export async function main(
  argv: string[] = process.argv.slice(2),
  opts: MainOptions = {},
): Promise<void> {
  await runAxiCli<Env>({
    stdout: opts.stdout,
    description: "Query and download Malaysia DOSM open data (data.gov.my)",
    version: VERSION,
    argv,
    topLevelHelp: TOP_LEVEL_HELP,
    commands: {
      list: (args, ctx) => listDatasets(args, ctx ?? {}),
      search: (args, ctx) => searchDatasets(args, ctx ?? {}),
      view: (args, ctx) => viewDataset(args, ctx ?? {}),
      get: (args, ctx) => getDataset(args, ctx ?? {}),
      download: (args, ctx) => downloadCommand(args, ctx ?? {}),
    },
    home: home({}),
    getCommandHelp: (command) => COMMAND_HELP[command] ?? null,
  });
}
