# dosm

Query and download Malaysia DOSM open data (data.gov.my) from the terminal.

Built on the verified Open API at `api.data.gov.my` (no auth, no key) and the
`data-gov-my/datagovmy-meta` dataset metadata repo. Output is TOON by default.
Follows the [AXI](https://github.com/kunchenguid/axi) agent-CLI conventions.

## Run

```sh
node bin/dosm.js            # or install: npm link
```

## Commands

| command | what it does |
|---|---|
| `dosm list` | browse the catalogue (~290 datasets, cached 24h) |
| `dosm search <query>` | match ids, titles, descriptions, categories, field names |
| `dosm view <id>` | full dataset metadata (fields, caveats, links) |
| `dosm get <id>` | query records from the API (TOON on stdout) |
| `dosm download <id>` | save the full file (CSV/parquet from storage.data.gov.my, or JSON via API) |
| `dosm update` | built-in self-update (from axi-sdk-js) |

Global flags: `--no-cache`, `--cache-dir <d>`, `--wait` (auto-wait on 429).

## Examples

```sh
dosm search petrol
dosm view fuelprice
dosm get fuelprice --limit 5 --sort -date --fields date,ron95
dosm get arrivals --date-start 2024-01-01 --date-end 2024-12-31
dosm download fuelprice                 # -> ./data/fuelprice.csv
dosm download cpi_core --format parquet
```

## Rate limit

The API allows **4 requests/minute**. `get` and `download --format json` cache
responses (10 min TTL) and fail fast on 429 with the retry time; add `--wait`
to sleep and retry automatically. Bulk pulls should use `dosm download`
(storage.data.gov.my has no documented rate limit).

## Cache

- location: `~/.cache/dosm-cli/` (override: `--cache-dir` or `$XDG_CACHE_HOME`)
- catalogue + per-dataset metadata: 24 h TTL
- API responses: 10 min TTL
- `--no-cache` forces a fresh fetch and refreshes the cache

## Development

```sh
npm install
npm test          # vitest, no network needed (recorded fixtures)
npm run typecheck # tsc --noEmit
```

Node >= 26 (native TypeScript type stripping, no build step).
