# GitHub OpenAPI snapshot

Pinned from `github/rest-api-description`, bundled OpenAPI 3.0.3 (`api.github.com`).

| File | Why it exists |
| --- | --- |
| `pulls-list-files.excerpt.json` | One real operation, small enough to read. `$ref` still points at the full file. |
| `api.github.com.json` | Full catalog for scans. ~13 MB, gitignored. Fetch with `./fetch.sh`. |

Provenance: commit `814de7ac96e215adeeec999308f41f98f94a15db` (2026-09-18), sha256 `4fbdc7d0102276803a07f9880d14ed543ba1afc10a4c9fd7bd3782408d9abaf7`.

Research write-up: [docs/p0-openapi-core.md](../../docs/p0-openapi-core.md).
