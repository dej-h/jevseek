# P0 research: OpenAPI JSON core

Recorded 19 September 2026. Product direction is still [JevSeek_Design_Spec.md](./JevSeek_Design_Spec.md). This note is the library, snapshot, and batching evidence for the first end-to-end path: OpenAPI JSON in, ranked contracts out. MCP source, toolset, and the discovery server are out of scope until that path works.

## What we are wrapping

JevSeek is a TypeScript wrapper around TypeSafe Jev (`@typesafe-ai/sdk`, `TypeSafeClient.systemOne`). Code enumerates operations. Jev judges relevance. The CLI returns source-backed contracts. No embedding index. No agent framework.

## P0 modules

| Module | Job |
| --- | --- |
| `src/sources/openapi.ts` | Load a local JSON file or HTTPS URL. Detect OpenAPI 3.0/3.1. Refuse Swagger 2.0 silently. Walk `paths`. One candidate = one HTTP method + path. |
| `src/core/candidates.ts` | Two objects per operation: a bounded **descriptor** for Jev, and the original **contract** plus resolved `$ref` closure for the agent. |
| `src/core/judge.ts` | Independent Noul per operation. Pack by token budget. Bounded concurrency. |
| `src/core/rank.ts` | Sort, abstain if nothing is a direct match, attach contracts. |
| `src/cli/index.ts` | `discover "<need>" <source>`. The caller states its capability need directly. |

Leave empty for now: `src/sources/mcp.ts`, `src/sources/toolset.ts`, `src/mcp/server.ts`. Same `discover()` later.

Candidate identity is source digest + method + path. Do not use optional `operationId` as the only id.

## How OpenAPI JSON is shaped

Top-level keys that matter: `openapi`, `info`, `servers`, `paths`, `components`.

`paths` is a map of URL templates. Each path object has HTTP methods (`get`, `post`, …). An OpenAPI operation is that pair, not the path alone and not an arbitrary JSON slice.

`components` is the spare-parts bin: schemas, parameters, responses, headers, examples. Most GitHub operations do not inline those. They point with `$ref`, for example `#/components/parameters/owner` or `#/components/schemas/diff-entry`.

If a descriptor is sent to Jev without resolving those pointers, Jev sees that references exist. It does not see that `owner`, `repo`, and `pull_number` are required path params, or that a 200 body is an array of diff entries. Resolve `$ref`s with a depth budget when building descriptors. Keep the original document as the contract store. Do not fully expand the whole catalog.

Readable example: `examples/github/pulls-list-files.excerpt.json` (`GET /repos/{owner}/{repo}/pulls/{pull_number}/files`, operationId `pulls/list-files`).

## GitHub snapshot (primary test catalog)

Pinned from [`github/rest-api-description`](https://github.com/github/rest-api-description), bundled OpenAPI 3.0, `api.github.com`.

| Fact | Value |
| --- | --- |
| File | `examples/github/api.github.com.json` |
| Format | OpenAPI 3.0.3, bundled (uses `$ref`, not fully inlined) |
| Title / version | GitHub v3 REST API 1.1.4 |
| Size | 13,012,129 bytes (~13.0 MB) |
| Paths | 819 |
| Operations | 1,239 |
| Component schemas | 990 |
| Upstream commit | `814de7ac96e215adeeec999308f41f98f94a15db` (2026-09-18) |
| sha256 | `4fbdc7d0102276803a07f9880d14ed543ba1afc10a4c9fd7bd3782408d9abaf7` |
| Upstream URL | https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json |

The fully dereferenced GitHub copy is 75,389,143 bytes. Do not use it as the working document.

The 13 MB file is gitignored. Fetch with `examples/github/fetch.sh`. The excerpt is committed so the `$ref` shape is visible without the dump.

`evals/` is for later hand-checked tasks against this snapshot, not for storing the spec.

## Parser library

Use [`@scalar/openapi-parser`](https://github.com/scalar/openapi-parser) to parse and resolve local `$ref`s. Walk `paths` ourselves.

Reasons:

- Current TypeScript parser. Supports OpenAPI 3.0 and 3.1. Positions itself as the successor to `@apidevtools/swagger-parser`.
- `@redocly/openapi-core` is a linter/bundler. Its public API is not an operation enumerator.
- Chunking is still our job. A parser that dumps one giant dereferenced object would expand GitHub to 75 MB and still would not define “one HTTP operation”.

Do not let the parser fetch arbitrary remote `$ref` URLs by default. Spec: fetching the supplied document is not permission to crawl.

## Batching and search

1,239 GitHub operations will not fit in one Jev request. TypeSafe currently documents a 64k total request budget and a 32k limit for shared state plus the longest question (`jev-1.13.0`). Log the resolved model and actual usage. Do not hard-code those limits as product guarantees.

Public interface: one `discover()` call. Internally: several `systemOne` requests, packed by token budget, bounded concurrency, retry/backoff, a total query budget.

Shared state: the capability need plus the direct-match rubric. Each question is that operation’s structured descriptor only. Do not copy the rubric onto every Noul (measured: [packing-mode-benchmark.md](./packing-mode-benchmark.md)). Do not put the catalog in shared state.

Question: “Does this operation directly provide the capability stated in the need, according to its documented inputs, behavior, and outputs?” Related subject matter is not a direct match. Missing values for otherwise appropriate required params are prerequisites, not automatic irrelevance.

### What to take from jev-mcp

[`jkudish/jev-mcp`](https://github.com/jkudish/jev-mcp) (reviewed via its README, 19 September 2026) exposes Jev as MCP tools. Two search shapes:

| Tool | Shape | Take it? |
| --- | --- | --- |
| `jev_find` | One Choice over up to 250 candidate ids. Probabilities sum to 1, so there is always a winner. Extra Noul asks whether anything matches. Texts truncated at 2,000 characters. Pattern: [TypeSafe semantic-find cookbook](https://docs.typesafe.ai/cookbooks/semantic_find). | No. The design spec already forbids winner-takes-all Choice across a batch. Those probabilities are not comparable across batches. |
| `jev_rerank` | Independent yes/no relevance per candidate. Ordering survives. Split on a ~100k character aggregate budget, up to 250 candidates. | Yes, as the packing pattern. |

JevSeek P0 matches rerank, not find: independent Noul per operation. Difference: descriptors stay structured (method, path, required params, request/response fields). Do not flatten operations into truncated file text.

Also take from `jev_find`: an existence/abstain signal so a top hit cannot masquerade as a match when nothing is a direct match. Implement that as rank-time abstain (`no_confident_match`), not as a Choice over the whole catalog.

Cookbook note: Choice is capped around 255 options. That is another reason GitHub cannot be one Choice question.

## Sources

- OpenAPI 3.1.1: https://spec.openapis.org/oas/v3.1.1.html
- TypeSafe JS SDK: https://docs.typesafe.ai/sdk/javascript
- TypeSafe models: https://docs.typesafe.ai/models
- Semantic-find cookbook: https://docs.typesafe.ai/cookbooks/semantic_find
- jev-mcp: https://github.com/jkudish/jev-mcp
- GitHub REST OpenAPI repo: https://github.com/github/rest-api-description
- Scalar parser: https://github.com/scalar/openapi-parser
