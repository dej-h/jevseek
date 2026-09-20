# JevSeek — Design & Launch Spec

**Revision:** 0.3 — OpenAPI-first, TypeScript, unfamiliar-integration discovery  
**Date:** 19 September 2026  
**Target release:** Sunday, 20 September 2026  
**Status:** Build specification; no implementation, live Jev evaluation, or harness integration is represented as tested in this document.

**Interface correction:** Discovery takes a caller-authored capability `need`. The caller states what it needs, for example, "I need filenames and change metadata for a pull request." JevSeek passes that need directly to Jev. It does not derive a discovery prompt from the agent's original task. Examples and proposed interfaces below use this convention; optional context is supplementary.

> **Give your agent a new API. JevSeek finds the operations it needs—not the whole spec.**
>
> Point it at an OpenAPI document and state the capability you need. JevSeek discovers the available operations, uses Jev to judge their relevance, and returns the matching contracts for the agent to work with. No hand-written integration skill or endpoint-by-endpoint MCP wrapper required for discovery.

## 0. What changed from the previous spec

The earlier spec drifted toward a generic semantic reranker and a replacement for existing coding-agent tool search. Neither is the product we are building.

This revision also renames the product to **JevSeek** and switches the implementation to TypeScript. npm already has `jevgrep` as a semantic code-grep tool. The product, OpenAPI-first scope, and Jev judgment design are unchanged. TypeScript is for installability: a Node CLI and stdio MCP server is the default path for Claude Code, Codex, and Cursor.

| Decision | This revision |
| --- | --- |
| Product | Dynamic discovery within an unfamiliar integration, from a supplied source and task. |
| Name | **JevSeek**. GitHub and npm: `jevseek`. Do not publish as `jevgrep`. |
| Starting surface | **OpenAPI**, not a pre-exported GitHub MCP catalog. |
| First test suite | One GitHub **OpenAPI** snapshot. Jira is a small transfer/demo check, not another research program. |
| Second source adapter | MCP tool discovery through a configured server. Same search interface; built after OpenAPI works. |
| What the agent receives | Relevant operations, useful request/response details, source references, and limitations—not just names and scores. |
| Coding-agent integration | Ordinary CLI or a small MCP discovery server. No replacement of Codex/Claude Code internal retrieval required. |
| Main demonstration | A new API source becomes usable context through one discovery call, followed by a concrete agent action or request preview. |
| Main claim | Less integration-specific setup and more focused discovery. Speed, accuracy, and total token savings remain measurements to establish. |
| Stack | TypeScript on Node.js 20+, official `@typesafe-ai/sdk`, and a thin CLI/MCP interface. |
| Launch priority | Finished, legible demo and easy installation first; compact supporting evaluation second. |

**Do not broaden the product back into generic document search to make it look more original. Do not narrow it back into selecting among tools the agent already has.**

---

## 1. The actual user problem

An agent is working on a task and encounters an integration it has not been configured to use. The service has a substantial API description, but the agent does not already have the relevant operations installed as tools or explained in a custom skill.

Today, the developer or agent might inspect the documentation, search a large specification, follow schema references, and assemble the request contract. Alternatively, somebody prepares an integration-specific skill, wrapper, or retrieval index beforehand.

JevSeek should make this interaction possible:

```text
“Here is this service’s OpenAPI document.
Find how to do this particular thing.”
                 │
                 ▼
             JevSeek
      fetch / parse / discover
      structure-aware Jev selection
                 │
                 ▼
  a few relevant operation contracts
  required inputs + response shape
  source pointers + caveats
                 │
                 ▼
  agent uses its existing HTTP / shell / coding tools
```

The agent supplies the source and its objective. **It does not first read the whole catalog, invent a shortlist, or manually construct hundreds of questions for Jev.**

### Five simple propositions

1. **Bring a new integration.** Supply its OpenAPI document instead of preparing a custom skill for it.
2. **Ask for a capability.** Search by what needs to happen, not by knowing the endpoint name.
3. **Get the contract, not just a hit.** Return enough original schema information to take the next step.
4. **Keep the catalog out of the main model’s context.** Only the discovery result is returned to the agent.
5. **Use one discovery interface.** OpenAPI first; MCP catalogs through a second adapter, without changing the core interaction.

### The boundary that matters

This is primarily **discovery within a supplied integration**, not global discovery of which company’s API to use. Finding a service’s OpenAPI URL from its marketing homepage is a later adapter, not a hidden prerequisite the first version claims to solve.

“Automatic discovery” means enumerating and interpreting the supplied machine-readable source. It does not mean automatically authenticating, granting permissions, executing arbitrary operations, or learning the main model’s private thoughts.

---

## 2. Best-fit use case and product thesis

### The sweet spot

**A newly encountered or changing catalog whose total useful description is small enough to judge directly, where the desired result is one or a few operations.**

Likely examples include an unfamiliar SaaS API, an internal service’s current OpenAPI document, or a newly connected MCP server. The collection may have hundreds of entries; the useful sizing variable is **descriptor tokens and number of queries**, not entry count alone.

The strongest case is a cold or low-reuse discovery workload: there is little opportunity to amortize an embedding pipeline, and the catalog is not already represented in the agent’s installed tooling.

This is **not** a campaign against skill files. The user’s observation that existing skill descriptions use only a small part of his context is a reason not to make that the initial problem. Established, well-designed integrations should keep working normally.

### What must remain a hypothesis

Do not state that Jev must be more accurate than embeddings or that scanning must be faster than indexing. A warm lexical or embedding index can be very fast; a conventional reranker can already judge query–candidate relevance. Jev’s advantage has to be demonstrated on this workload.

The testable proposition is narrower:

> For an unfamiliar, bounded API catalog, can structure-aware direct judgment find useful operation contracts without an integration-specific index or repeated frontier-model inspection?

Index-building cost is only relevant to a fair comparison when the index really has to be built or refreshed. Report cold discovery separately from repeated searches on the same source.

### Why OpenAPI is more interesting than a flat catalog

OpenAPI gives us a machine-readable contract, not just a list of docstrings. Methods, paths, input locations, request bodies, response shapes, reusable schemas, and security declarations can influence whether an operation actually satisfies the task. The specification defines these structures; JevSeek’s proposed use of them is described in Section 6. [S1]

The product is therefore **API discovery that understands enough of the contract to return useful context**, not merely a generic candidate ranker with an OpenAPI file extension.

---

## 3. Inspiration preserved from the discussion

### From RAG reranking to new-integration discovery

The original idea was a Jev-based final selector after embedding retrieval. That remains a legitimate future mode. The useful next observation was that, for a bounded catalog, candidate generation can simply enumerate the catalog rather than retrieve an approximate shortlist.

However, “no vectors” is an implementation property, not the user’s problem. The practical payoff here is that an agent can meet a new API and discover the relevant operations without an integration-specific setup phase.

### Cheap judgment around expensive reasoning

Jev does the repeated bounded decisions. The main model retains open-ended reasoning, argument generation, coding, and explanation.

```text
Code discovers existing operations.
Jev selects among those operations.
The main agent decides how to use the selected contracts.
The existing execution environment performs approved actions.
```

The agent is not used as a clerk to prepare Jev’s candidate list. JevSeek owns parsing, candidate construction, batching, scoring, and result packaging behind one call.

### Why not BranchJev this weekend?

Prefetching a fast file read may hide little wall-clock latency. Speculating on expensive tests or programs introduces candidate-generation, validity, safety, and wasted-compute questions. Those are separate from this project’s task and remain in the backlog.

### What we are not claiming to invent

Semantic ranking, dynamic tool discovery, deferred tool loading, and Jev candidate selection have prior art. Claude Code and Cursor already document forms of dynamic MCP discovery; Atlassian also exposes discovery over its own deferred tools. [S8, S10, S14]

Our contribution is the **OpenAPI-aware, source-driven discovery experience**, its implementation, and the quality of its contract selection. Do not use “first ever” or imply a new retrieval research result.

---

## 4. Scope and implementation order

### First working milestone: OpenAPI only

Build one complete path:

```text
GitHub OpenAPI snapshot
  + natural-language task
  → operation discovery
  → Jev selection
  → useful selected contracts
  → CLI / JSON output
```

No agent framework is needed to prove this path. Keep all initial relevance tests against this one source format and one primary catalog.

### v0.1 core release

- OpenAPI 3.0 and 3.1, JSON and YAML, supplied as a local file or HTTPS URL in each discovery call.
- Bundled documents with local references; bounded reference traversal and explicit unsupported-reference diagnostics.
- One common `discover(source, need, options)` implementation, with any future supplementary context carried in options.
- Ranked operation results with compact contracts and source references.
- A CLI and a stdio MCP server exposing **one discovery tool**.
- A single-screen local demo using the same engine.
- One primary OpenAPI evaluation suite and a few Jira transfer checks.
- One real coding-agent end-to-end demonstration using the ordinary discovery tool, not an internal harness patch.

OpenAPI 3.2, Swagger 2.0, remote multi-document resolution, and unusual serialization combinations are not silently accepted. Detect unsupported versions/features and explain them. Add support only through an explicit, tested compatibility change.

### MCP as an input source

The adapter accepts a public remote MCP endpoint as the same source string used for OpenAPI files and URLs. Detect the source through document inspection and protocol negotiation, not URL naming or a caller-supplied kind. List all tool pages and send tool descriptors through the same selector. MCP tool listing is paginated and the protocol provides catalog-change notifications. [S11] Each discovery takes a fresh catalog snapshot rather than maintaining a subscription.

The first transport is Streamable HTTP, without target-server credentials. Return original tool definitions plus invocation breadcrumbs: endpoint, transport, tool name, and `tools/call`. Discovery never invokes tools, and the eventual execution client establishes its own connection. Authentication-required responses are explicit errors, not empty matches. Preserve bounded collection, cancellation, and failure on incomplete pagination.

Public remote tool discovery is implemented. Tests cover controlled protocol responses and installed-client discovery. A live unauthenticated catalog check against Oxford Ledge returned 62 tools on September 20, 2026; this does not establish compatibility with every public server or prove an agent execution workflow. TODO: local stdio source adapters, resources, prompts, and authentication shared with the execution client. Discovery-only OAuth, arbitrary server installation, and generic tool execution are outside this increment.

### Two different uses of MCP—do not conflate them

| Role | Purpose | Priority |
| --- | --- | --- |
| JevSeek **as an MCP server** | Lets Claude Code/Codex call the OpenAPI discovery function. | Core packaging. |
| An MCP server **as a JevSeek source** | Lets JevSeek discover operations from another server’s catalog. | Second source adapter. |

A release can support the first without supporting the second.

### Deferred inputs

An already available tool array can enter through the internal/library adapter; it does not require another public product surface. A CLI client’s help output is a later source adapter. Initially support exported help text before considering allowlisted, bounded `--help` traversal. Do not let model-supplied “discovery” commands become arbitrary shell execution.

---

## 5. Product contract

All commands and interfaces below are **proposed interfaces to implement**, not claims that the package is already published.

### CLI

```bash
# Development, from the repository.
npx tsx src/cli/index.ts discover \
  "I need filenames and change metadata for a pull request" ./openapi.json \
  --top 3

# Supply an unfamiliar API definition directly.
npx tsx src/cli/index.ts discover \
  "I need the projects mapped to a particular custom-field context" "$OPENAPI_URL" \
  --top 3 --json

# Optional task context is a bounded file, not an entire agent transcript.
npx tsx src/cli/index.ts discover \
  "I need to roll back a deployment" ./openapi.yaml \
  --context-file ./task-context.json

# Same engine, exposed to a coding agent.
npx tsx src/cli/index.ts serve --transport stdio

# Second adapter, once implemented: a configured alias, not arbitrary code.
npx tsx src/cli/index.ts discover \
  "I need logs from a failed workflow" mcp:catalog-demo
```

### Agent-facing discovery tool

One tool: `jevseek_discover`.

```json
{
  "source": {
    "kind": "openapi",
    "location": "https://service.example/openapi.json"
  },
  "need": "I need filenames and change metadata for a pull request",
  "context": {
    "known_inputs": ["owner", "repo", "pull_number"],
    "desired_output": "filenames and change metadata"
  },
  "top_k": 3
}
```

`service.example` is illustrative. Real demonstrations must use verified source URLs or pinned local copies.

For an MCP source, `location` becomes a configured alias. The caller may not supply a subprocess command or arbitrary credential values through this model-visible interface.

**Do not require the agent to pass the entire API document inline.** A path, URL, or configured source handle is the normal path. Accept inline objects in the TypeScript library when a program already has the catalog in memory.

### Result contract

Return a structured result with:

| Field | Meaning |
| --- | --- |
| `source` | Canonical source location, digest/revision, and format. |
| `scan` | Total operations, examined operations, explicit exclusions, completeness, and warnings. |
| `matches` | Ordered operations with Jev scores, identity, and source-backed contracts. |
| `status` | `matches`, `no_confident_match`, `partial`, or `error`. |
| `usage` | Actual Jev request/token counts and separate source-fetch/parse/score timings. |
| `context_accounting` | Source/descriptor size and returned-context size, with tokenizer or estimation method. |

Each match should contain:

```text
identity: source digest + HTTP method + path
operation_id: original operationId, when present
method / path / summary
relevance_score: actual returned score; not “probability of successful execution”
parameters: names, locations, required flags, types, useful constraints
request_body: media type and relevant original schema
response: useful success-response details and relevant schema
security / server information: declared requirements, not a claim of access
source_pointer: exact original operation and referenced components
contract_complete: whether the returned contract is self-contained
warnings: unsupported/truncated/ambiguous elements
```

Return the best few contracts automatically; do not impose a mandatory second detail call for ordinary results. Keep complete source fragments locally so the CLI/library can inspect them by handle. Large contracts must carry a clear completeness flag and references instead of being silently cut into something that looks executable.

### Important result semantics

Finding an operation is not the same as proving the caller has credentials, proving the request will succeed, or registering a new native tool with a model provider.

The initial product returns **discovered capabilities and their contracts**. The agent can subsequently use its existing HTTP tool, shell, SDK, or code generator. JevSeek itself does not execute the target API.

---

## 6. OpenAPI-aware candidate construction

### Architecture

```text
source pointer
    │
    ▼
fetch + safe parse + version detection
    │
    ▼
operation enumeration + bounded reference resolution
    │
    ├── original contract store, outside model context
    │
    ▼
compact, structured operation descriptors
    │
capability need + optional bounded context
    │
    ▼
Jev judgments in bounded batches
    │
    ▼
rank / abstain / attach selected original contracts
    │
    ▼
CLI, MCP discovery result, or TypeScript object
```

### Candidate identity

Use one candidate per HTTP operation, not one per path and not one per arbitrary JSON chunk. Identify candidates through source revision, method, and path. Do not rely on an optional `operationId` as the only stable identifier.

Preserve exact source pointers so every result can be checked against the original document.

### What to preserve and why

The following is the **proposed normalization policy**, not a promise that every OpenAPI feature will be completely implemented in the weekend version.

| Structure | How JevSeek should use it |
| --- | --- |
| Method, path, summary, tags | Establish the action, resource, and surrounding domain. |
| Parameter locations and descriptions | Distinguish operations that require a known ID from discovery/list operations. |
| Required inputs and enums | Surface prerequisites and distinguish supported modes of a shared operation. |
| Request-body fields | Match the requested behavior to fields that enable it, not merely a similar endpoint name. |
| Success-response fields | Check whether the operation returns the information the task actually needs. |
| Reusable schema references | Resolve relevant content before judgment rather than asking Jev to chase raw references mentally. |
| Deprecation, security, and server declarations | Return operational caveats; do not confuse relevance with availability or authorization. |

The source fields and reference mechanisms are documented by OpenAPI. [S1] How much of each field improves retrieval is an experiment, not a settled fact.

### Two representations, not one giant JSON dump

**Descriptor:** a bounded, structured representation for relevance decisions.

**Contract:** source-faithful operation data plus the reference closure needed for the selected operation. This is what makes the result useful to the agent.

A descriptor should not contain every example, every generic error response, and every unrelated nested object. Conversely, do not remove a field merely because it looks verbose if it distinguishes two plausible operations.

### Parser behavior to implement explicitly

Preserve inherited operation settings and resolve overrides rather than treating an operation as an isolated dictionary. Keep composition alternatives identifiable; do not blindly merge alternatives into a fictitious request schema. Detect cycles and retain references when expansion would repeat indefinitely.

Use an explicit resolution budget. Unresolved external references produce warnings and incomplete-contract flags. By default, fetching the supplied document must not grant permission to crawl arbitrary reference URLs or local files.

Do not treat HTTP method alone as a safety classifier. A selection result is never permission to execute it.

### Structural shortcuts versus relevance filtering

Cheap parsing and exact user-supplied constraints are allowed. A user may explicitly search one tag or service section. Display that scope.

The default semantic scan should not silently discard operations using guessed keywords or a coarse category router: doing so could remove the desired operation before Jev sees it. Hierarchical or hybrid filtering remains an experimental mode and must report the reduced search space.

---

## 7. Jev request design and small experiment plan

### Verified API facts relevant to implementation

TypeSafe documents typed Noul, Choice, and Score questions, and permits multiple questions per request. The JavaScript SDK exposes these as `noul()`, `choice()`, and `score()` on `TypeSafeClient.systemOne`. Noul provides a yes/no score. Question IDs are response keys, not semantic instructions sent to the model. Therefore, putting an operation’s identity only in the dictionary key is insufficient. [S2, S7]

Structured question instructions can contain the relevant schema data. [S3] TypeSafe describes parallel question evaluation against shared state. [S4]

The current models page lists `jev-1.13.0`, a 64k total request budget, and a 32k limit for shared state plus the longest question. It also lists input-only pricing and separate request/token rate limits that can change. Log the resolved model version and actual usage; do not hard-code these operational limits as permanent product guarantees. [S5]

### Starting packing strategy

Start with:

```text
shared state:
    requested capability
    bounded task context
    explicit constraints

question for operation A:
    direct-match rubric
    operation A's structured descriptor

question for operation B:
    same rubric
    operation B's structured descriptor

...
```

This avoids making each relevance question navigate the entire catalog as shared state. It is a proposed design to test, not an assertion that this packing is always superior.

TypeSafe itself documents weaknesses with indirection and large amounts of irrelevant state. That is a concrete reason to compare representations instead of assuming a larger batch always improves the result. [S6]

### Initial judgment

Ask one clear question per candidate:

> Does this operation directly provide the capability stated in the need, according to its documented inputs, behavior, and outputs?

Define the boundary: related subject matter alone is not a direct match. Missing actual values for otherwise appropriate required parameters are prerequisites, not automatic irrelevance.

Use independent candidate scores so multiple operations can be relevant and all candidates can be poor. Do not rank across batches using one winner-takes-all Choice per batch: those local probabilities describe different alternative sets.

### A bounded Saturday experiment—not an AutoML project

Use the same initial eight tasks to compare at most these variations:

| Variation | Question being tested |
| --- | --- |
| Basic descriptor vs structure-aware descriptor | Do request/response details distinguish the near misses? |
| One Noul vs per-operation Choice of direct/supporting/unrelated/unclear | Is a supporting operation being confused with an operation that completes the task? |
| Small shared-catalog batches vs candidate-local question instructions | Does question packing affect confusion, latency, or billed input? |

First establish the structure-aware Noul path. Try another variation only to explain a real failure. Freeze the first acceptable configuration after a short timebox; do not spend the weekend searching prompts.

These are request/rubric experiments, not model fine-tuning. TypeSafe currently says customer-specific fine-tuning/LoRA is not offered. [S5]

### Batching and accounting

“One discovery call” is the public interface. It may require several Jev requests internally. Pack by token budget, not a guessed fixed number of operations, and use bounded concurrency, retry/backoff, and a total query budget.

This is TypeSafe’s multi-question inference, **not** the OpenAI asynchronous Batch API. No generative model is required for the core selector.

Free output does not make input repetition, transport overhead, or rate limits free. A useful accounting approximation is:

```text
Jev input ≈ repeated task context across batches
          + all candidate descriptors
          + all question rubrics
```

Use API-reported input usage for final accounting. Source downloading and normalization also consume time. Reuse parsed source snapshots by digest; that is an ordinary cache, not an embedding index.

---

## 8. Coding-agent integration and where the context goes

### The core integration does not need a pre-tool-loading hook

Earlier research focused on replacing a harness’s existing tool-search backend. That is unnecessary for the current product.

```text
stable existing agent tools
    + jevseek_discover

user / task / newly encountered API URL
    ↓
agent calls jevseek_discover(source, need)
    ↓
JevSeek discovers and selects internally
    ↓
selected operation contracts arrive as a normal tool result
    ↓
agent uses existing shell / HTTP / coding tools
```

The main agent makes one high-level discovery request. It does not route each endpoint through Jev or assemble the candidate catalog itself. A caller that already knows the source and task can also invoke the TypeScript library before making its own model request; that is optional application integration, not an assumed hook in every coding agent.

### Current evidence and release promises

| Harness | Supported path for this product | What we must not promise |
| --- | --- | --- |
| Claude Code | A local stdio MCP discovery server, or the CLI through its shell. Its docs describe both MCP installation and its own deferred search. [S8] | Replacement of internal ToolSearch or automatic native registration of every returned API operation. |
| Codex | A local stdio MCP discovery server, or the CLI. Official docs cover MCP configuration in the CLI and IDE. [S9] | A pre-inference selector callback or native tool-search override that we have not implemented and tested. |
| Cursor | Ordinary MCP/terminal integration; dynamic MCP discovery already exists in its documented design. [S10] | Fixing an assumed “always load every tool” behavior or claiming a universal cache/context improvement. |
| Pi / custom harness | A later adapter can invoke the selector directly. | A second full integration before the primary demo is finished. |

These rows document an available integration route, not successful JevSeek compatibility tests. Mark a harness “tested” only after an actual installed-package run.

### The cache story is deliberately simple

Keep JevSeek’s own tool definition stable. Return selected API contracts in the ordinary conversation/tool-result stream. Do not replace the native `tools` array, rewrite old tool outputs, or rebuild the system prompt after each query.

A contract returned as data is **not** a newly registered native callable tool. This distinction avoids relying on provider-specific tool-insertion features. Anthropic’s prompt-caching documentation explicitly distinguishes tools, system content, and message content; changing early content can invalidate later cached content. [S12]

The catalog stays outside the frontier context until selected material is returned. Subsequent discovery results still accumulate in history. This is selection before context admission, **not retrospective compression of an already loaded context window**.

### Execution remains separate

For the OpenAPI demonstration, the agent can construct an ordinary HTTP request from the returned contract. Use a public, read-only GitHub operation to show the full path without adding an authentication project.

For an MCP source that is not already connected to the main agent, returning its selected schema does not automatically make it executable. A generic `execute_discovered` proxy would add permissions, validation, and authorization responsibilities. Defer it rather than imply it exists.

---

## 9. Demo sources

### Primary: GitHub REST OpenAPI

Use the official `github/rest-api-description` repository, with a pinned snapshot and provenance manifest. GitHub publishes bundled and dereferenced descriptions; start with the bundled 3.0 document rather than a huge fully expanded copy. [S13]

**Why this source:** the audience recognizes pull requests, comments, and Actions; similar operations create visible distinctions; a public read-only request can demonstrate that the returned contract is useful.

**What not to claim:** GitHub lacks MCP. It does not. This is a recognizable OpenAPI discovery example, not an argument to replace the existing GitHub integration.

Suggested discovery tasks:

```text
“List the files changed by this pull request.”
“Find comments attached to lines in the pull-request diff,
 rather than the general conversation.”
“Get the logs for this workflow run, not a build artifact.”
```

For the first task, the documented operation is:

```text
GET /repos/{owner}/{repo}/pulls/{pull_number}/files
```

GitHub documents this operation and its request parameters. [S15] Select a real public PR during implementation, verify it, and freeze the demo input. Do not invent a live PR number in the spec.

### Secondary: Jira Cloud REST API, custom-field administration

Atlassian publishes a downloadable OpenAPI description for Jira Cloud REST v3. [S16]

Use a concrete capability such as:

> “Find which projects are mapped to a particular custom-field context.”

Jira documents a project-mapping operation under its custom-field-context resources, alongside nearby context, default-value, and issue-type mapping operations. These give the normalizer and selector useful structural distinctions. [S17]

This is a **candidate coverage-gap demo**, not “Jira has no MCP.” Atlassian’s current MCP documentation lists its supported tools and includes its own `discover` mechanism. In this review, dedicated custom-field-context administration was not listed in that tool catalog. That is a documentation-level observation, not proof that every deployed or third-party MCP server lacks the capability. [S14]

Before recording, recheck the exact operation against the current published MCP catalog. If a suitable existing tool covers it, choose another verified API operation or simply present Jira as an unfamiliar OpenAPI source. Do not force a false missing-MCP story.

Jira’s demo can end at the correct request contract. Do not pretend an authenticated admin action ran when only discovery was performed.

### Why only these two for now?

One primary catalog keeps implementation focused. One different provider demonstrates the absence of GitHub-specific hard-coding. A third brand adds less value than finishing the first two experiences.

The strongest long-term source is a user’s own service specification, but no private company schema should be used publicly without permission.

---

## 10. Test scope and evidence

### One compact primary suite

Create roughly 24–30 hand-checked tasks against the pinned GitHub OpenAPI snapshot. Include direct matches, close alternatives, input constraints, requested output distinctions, and several impossible or unsupported requests.

Store expected **method + path** identities, acceptable supporting operations, and a short reason. Reserve a small group of tasks from prompt tuning.

Add three Jira smoke tests only after the primary path works. Their purpose is transfer and parser coverage, not a second benchmark campaign.

### Deterministic tests

Test operation enumeration, local reference cycles, inherited settings, ambiguous identities, unsupported document versions, malformed sources, score-to-candidate mapping, token-budget packing, incomplete scans, and bounded result construction.

No paid API calls in ordinary unit tests. Live Jev checks must be explicitly enabled and budgeted. Do not use mock scores as evidence of model quality.

### Baselines that answer useful questions

**For the product video:** the same coding agent inspecting the same OpenAPI source with its ordinary tools versus using JevSeek. Permit normal `rg`, `jq`, and file reads; do not sabotage the baseline by forcing it to read the entire raw document.

**For development:** a simple lexical/BM25 baseline over the same descriptors is useful. An embedding baseline is optional, not a release dependency.

Measure successful discovery of a usable contract, not merely whether a familiar endpoint name appears somewhere.

### Metrics worth retaining

- Expected operation in top 1/top 3.
- False positive behavior on no-match requests.
- Whether returned contracts preserve the inputs needed for the next step.
- End-to-end discovery latency, split into download, parse, Jev, and packaging.
- Main-model discovery calls and model-visible tokens in the actual agent run.
- Jev input usage and cache state, separately from frontier-model usage.

A small result table can support the README later. It is not the lead story and it must not expand into a benchmark platform.

---

## 11. TypeScript and implementation shape

### Decision: use TypeScript for v0.1

TypeSafe has an official typed JavaScript/TypeScript SDK. The client is `TypeSafeClient` from `@typesafe-ai/sdk`. Questions are `noul()`, `choice()`, and `score()`; answer types are inferred from the question map. It requires Node.js 20+. Reuse it rather than writing another provider client. [S7]

The official MCP TypeScript SDK v2 is the stable line for the 2026-07-28 spec. Use `@modelcontextprotocol/server` to expose the discovery tool over stdio, and `@modelcontextprotocol/client` later for MCP-as-source. Do not copy v1 `@modelcontextprotocol/sdk` examples into a new installation. [S18]

**TypeScript is the right default here because installation is the bottleneck, not a claim of maximum runtime speed.** Coding agents already run Node. `npx jevseek` is the analog of a Python `uvx` install, without asking the user for a second toolchain. The likely latency drivers are still source I/O and remote inference. That is a design expectation to verify by profiling. JSON normalization, startup, and serialization can matter too.

Keep a long-lived process for MCP and the local demo to avoid repeated process startup and connection setup. CLI cold-start latency gets measured separately. Do not rewrite in Rust/Go before identifying a local bottleneck.

### Minimal implementation

```text
jevseek/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts            # public discover()
│   ├── core/
│   │   ├── candidates.ts
│   │   ├── judge.ts
│   │   └── rank.ts
│   ├── sources/
│   │   ├── openapi.ts      # P0
│   │   ├── mcp.ts          # P1
│   │   └── toolset.ts      # P1/P2
│   ├── cli/
│   │   └── index.ts
│   └── mcp/
│       └── server.ts       # exposes the discovery tool
├── evals/
├── examples/
│   └── github/             # fetched GitHub OpenAPI snapshot and committed excerpt
└── tests/
```

Use typed internal models, async I/O, bounded concurrency, and local source caches. No accounts, hosted database, vector store, job queue, agent framework, or separate cloud backend is needed.

The npm name `jevgrep` is taken. `jevseek@0.0.1` was published on 19 September 2026 to reserve the name. The working CLI is not in that version. [S19]

### Useful boundaries

`SourceAdapter` discovers source-backed candidates. `DescriptorBuilder` controls their semantic representation. `JevScorer` produces judgments. `ResultBuilder` attaches contracts without inventing them. CLI, MCP, and demo UI call the same `discover()` entry.

Keep ranking policy replaceable for experiments, but do not build a plugin system before two real implementations need one.

---

## 12. Demo experience and visual story

### The moment the viewer should understand

> “The agent did not have an integration for this API. I gave it the spec, and it got the operation it needed.”

Not:

> “Here are 25 classifier probabilities.”

### One-screen local interface

Serve one lightweight local page from the Node process; no second frontend application or hosted account system.

Show three areas:

1. **Task and source:** the supplied OpenAPI file/URL, detected version, and discovered operation count.
2. **Selection:** real progress as batches finish and a short ranked list of operation cards.
3. **Returned context:** the selected operation’s request/response contract and the next agent step.

The public CLI still needs to be attractive. The local page is the recording surface, not a separate SaaS product.

### Token display: make the denominator honest

Good labels:

```text
Catalog descriptors available: [computed tokens]
Selected discovery result:    [computed tokens]
Operations examined:          [actual count / total]
Main-model discovery input:   [measured, where available]
Jev input:                    [API-reported, separately]
```

Never label the full catalog’s size as “tokens Codex normally uses” unless the baseline actually sent it. Never animate an existing context window shrinking when the implementation only avoids adding future material.

A catalog-to-result narrowing animation is legitimate. A fabricated claim of total-agent cost reduction is not.

If exact provider tokenization is unavailable, show bytes or clearly labeled token estimates. Save the actual serialized strings so counts are reproducible.

### Proposed 40–50 second recording

| Segment | What happens |
| --- | --- |
| First 5 seconds | “New API. No custom integration.” Show the source and the task immediately. |
| Next 10–15 seconds | Fetch/parse the source, show actual operation count, run JevSeek, reveal the top contracts. |
| Next 10 seconds | Open the selected contract: method, path, required arguments, requested output. |
| Next 10 seconds | In the tested coding agent, use that result for a real public GitHub read, or show the corresponding verified run. |
| Final seconds | Switch to Jira with the same discovery interface; end with repo/install CTA. |

Adjust duration to actual behavior. Do not speed up a recording while leaving an apparently real-time stopwatch on screen. Label cuts, replay, and cache state. A pinned real public spec is reproducible input, not a fake demo.

### Before/after version

Use two clean sessions with the same task, model, source, permissions, and success condition. The baseline may search normally. The JevSeek run adds the discovery tool. Keep both traces.

If the baseline already finds the answer immediately, do not manufacture a slow path. Choose a genuinely less obvious task or lead with the no-custom-integration experience instead of a speed claim.

---

## 13. Installation and first-run experience

### Intended published experience

After the package name is available and a tested release is published:

```bash
npx jevseek discover "I need filenames and change metadata for a pull request" ./openapi.json
```

The user still needs Node.js 20+ and a TypeSafe API key. Say “one-command run after setting your key,” not zero-setup magic. `npx` is npm’s documented package-running interface. [S19]

Before publishing, use `npx tsx src/cli/index.ts` from the repository. Do not put an unverified package name in a public install command that might resolve to somebody else’s project. The unscoped name `jevgrep` is already somebody else’s project.

### Coding-agent setup targets

These are installation recipes to test after the package exists:

```bash
# Claude Code
claude mcp add --scope user \
  --env TYPESAFE_API_KEY="$TYPESAFE_API_KEY" \
  --transport stdio jevseek \
  -- jevseek serve

# Codex
codex mcp add jevseek \
  --env TYPESAFE_API_KEY="$TYPESAFE_API_KEY" \
  -- jevseek serve
```

The command shapes are supported by the respective official MCP setup documentation. [S8, S9] They register the already installed release client without asking users to edit agent configuration files. The shell expands `TYPESAFE_API_KEY` and the agent stores it in its private MCP configuration. Do not commit or share that configuration, and do not expose the key in the recording.

Test installation on a clean environment. The README should identify the exact tested agent version and platform, and distinguish tested from expected compatibility.

### First-run behavior

A missing key gives a short actionable error. Unsupported input identifies the problem. Rate limiting does not look like “no matching endpoint.” A failed batch produces a partial-result warning. The demo works with public schema input and does not require the user to grant access to a private account just to understand the product.

---

## 14. Positioning, narrative, and launch copy

### Product line

> **Discover the right API operations without teaching your agent the whole API.**

### Supporting sentence

> Give JevSeek an OpenAPI document and a task. It searches the operation contracts with Jev and returns the relevant endpoints, inputs, and response details—without a hand-written skill or an embedding index.

### What belongs below the fold

The descriptor design, Jev packing strategy, scoring variants, cache behavior, and future MCP/CLI adapters. These explain the implementation after the audience has understood the use case.

### “Why I built it” — first-person draft

> I use coding agents a lot, and I don’t want to build a custom integration every time one encounters another API.
>
> The service often already describes its capabilities in an OpenAPI file. But somebody still has to find the right operation and work out which parameters and response fields matter.
>
> I built JevSeek so the agent can pass in the spec and its task. Code discovers the operations, Jev judges the candidates, and the agent gets back the relevant contracts instead of searching the whole document itself.
>
> I started with OpenAPI because that is where the integration already has useful structure but may not have a ready-made agent interface. MCP catalogs are the next input, not the reason the project exists.

This is draft launch copy. Change completed-tense claims to match what actually ships.

### X main post draft

> Your agent found a new API. Now what?
>
> I built JevSeek: give it an OpenAPI spec + a task, and it returns the operations the agent needs—with the request/response details.
>
> No custom skill per API. No embedding index.
>
> Demo + open-source repo ↓

Use the video as the main attachment. Put the implementation explanation, exact tested sources, installation link, and limitations in a reply. Do not lead with a benchmark headline or an unverified percentage.

### Discord draft

> Built JevSeek for discovery inside unfamiliar APIs. An agent supplies an OpenAPI source and a capability request; the tool enumerates operations, asks Jev about their relevance, and returns selected contracts. The agent never has to assemble the candidate list itself.
>
> Demo: [video]. Repo: [repo]. Starts with GitHub and a Jira administration example. Looking for awkward real OpenAPI specs and intents where endpoint names are misleading.

### LinkedIn draft — optional

> I don’t think every API should need a hand-written agent integration before an agent can discover how to use it.
>
> This weekend I built JevSeek: supply an OpenAPI document and a task, then get back the relevant operation contracts. Jev handles candidate selection; the coding agent handles the actual work.
>
> The interesting part was using the structure already present in the API—inputs, outputs, and constraints—instead of treating the documentation as a flat text-search problem.
>
> [Short demo and repository.]

No claims about beating existing search methods unless the released evidence supports them.

---

## 15. Distribution plan

### Repository and package

Publish under **your own GitHub account**. The repository is `dej-h/jevseek`. The npm package name is `jevseek`. Do not use `jevgrep`; that npm name is a different product.

The README should open with the task/source/result example and video, followed by installation, supported inputs, exact compatibility, architecture, limitations, and a small evidence section. Choose a license for your code; preserve upstream specification notices separately.

Make the repo the canonical home. A public video and a locally runnable demo are enough; a hosted backend is not a release requirement.

### TypeSafe Discord

Use the official server linked from TypeSafe’s documentation: **https://discord.gg/typesafe**. [S20] The community directory identifies a Show and Tell channel; verify the channel’s current name and posting rules inside Discord before posting. [S21]

Post the working demo, repo, and one concrete question for builders. Do not pitch it as a generic Jev wrapper.

### Awesome Jev

Target **https://github.com/hellogumbo/awesome-jev**.

Its contribution instructions currently ask for an entry in `data/projects.json`; README/site content is generated. Validate the entry and submit one project per PR. An issue submission is also supported. Do not submit a placeholder repository. [S22]

Suggested description:

> Discover relevant API operations from OpenAPI specs using structure-aware Jev judgments, returning compact contracts to coding agents without per-API skills or an embedding index.

Mention MCP-source support only after it is implemented.

### X and optional LinkedIn

Post on your own X account with the recording and repo. Tag TypeSafe only when relevant, and reply to genuinely related discussions with the working artifact rather than a generic announcement.

LinkedIn is optional; use the integration-discovery problem, not community hype, as the explanation. Defer Hacker News and additional channels unless the package is sufficiently polished and the launch does not take time away from finishing it.

### A concrete first-week success signal

As an internal target, aim for a few independent users to run it against their own specification, and at least one usable report of success or failure outside the demo sources. Stars and views are distribution signals; external use is stronger evidence that the package is useful.

---

## 16. Schedule and definition of done

### Friday night: freeze the build

Use this revision as the product direction. Create the repo skeleton, record the source choices, and write the README opening and demo storyboard before broad implementation.

### Saturday morning: one real vertical slice

Load the pinned GitHub OpenAPI source, build structure-aware descriptors, make actual Jev calls, and return selected contracts. Run the initial eight tasks and freeze a reasonable question/packing design.

If the API is inaccessible or the core selections are unreliable, resolve that before building integrations. Do not bury the uncertainty behind a polished fake UI.

### Saturday afternoon: packaging and visible value

Build CLI/JSON output, source budgets, source provenance, and the local demo. Add the stdio discovery server and complete one real agent run using OpenAPI input.

### Saturday evening: test and rehearse

Complete the compact primary suite, verify a clean installation, and rehearse the video. Reserve real time for readable UI, concise output, and the first 10 seconds of the demo.

### Sunday morning: transfer and the second adapter

Run the Jira smoke queries. Add MCP-source listing only if the OpenAPI experience and integration already work. Freeze supported features rather than adding generic execution or terminal discovery.

### Sunday afternoon: record and release

Record the truthful demonstration, publish the repo/package, submit to Awesome Jev, post to the appropriate Discord channel and X, then handle the first installation reports.

### Definition of done

- [ ] New OpenAPI sources can be supplied by path or URL without provider-specific endpoint mappings.
- [ ] Returned matches include source-backed contracts, not only opaque scores.
- [ ] GitHub primary tests and Jira transfer checks have actually run.
- [ ] Unsupported schemas, incomplete scans, and no-match cases are visible.
- [ ] At least one coding agent has completed a real run through the normal discovery interface.
- [ ] The integration does not depend on an undocumented internal retrieval hook.
- [ ] Installation works outside the developer’s existing environment.
- [ ] The README says exactly which formats, source adapters, and harnesses are tested.
- [ ] The video shows a task, a new source, a useful result, and a next step.
- [ ] Counts, scores, timing, and cache state shown in the video are real or explicitly labeled estimates/replay.
- [ ] Public repo, release instructions, and distribution posts are ready.
- [ ] MCP-input support is either tested or clearly marked planned.

---

## 17. Claims, privacy, and scope guardrails

### Accuracy and speed

Do not promise better accuracy than embeddings, faster warm retrieval, or guaranteed subsecond scans. Separate query-time performance from first-source setup and remember that linear scans still scale with total descriptor size.

Do not describe a returned relevance score as calibrated end-to-end success probability. Errors in the source, parser, candidate representation, ranking, authentication, and execution all sit outside that number.

### Performance publication

TypeSafe’s current public Master Customer Agreement includes a restriction on publishing benchmark or performance information about its services. [S23] Before publishing comparative timing, cost, or provider-performance charts, seek written clarification or permission. Do not assume that using a video instead of a table creates an exemption.

Keep the launch centered on the workflow and working artifact. Resolve publication permissions before making performance claims. This is a release check, not an assumption about which legal terms govern every account.

### Data and source handling

API documents can contain private descriptions or sensitive examples. Make it explicit that selected descriptor content is sent to TypeSafe. Do not send API keys, authorization headers, full environment variables, or the entire agent transcript.

The local stdio server accepts source paths and direct HTTPS URLs per discovery call, using the server process's filesystem and network permissions. Source registration is not required. Operators can opt into exact-source restrictions with repeatable `--allow-source` startup flags. This is not an agent sandbox: unrestricted mode can read accessible local files and fetch internal HTTPS destinations. Keep source size/time limits, reject URL credentials and fragments, and do not follow redirects or fetch external references. The need and enabled descriptor fields are sent to TypeSafe; document that boundary in setup instructions and the tool description.

Source text is untrusted data, not a new system instruction. Selected contracts do not authorize execution. The existing agent’s permission model remains in charge.

### No silent scope growth

No generic API executor, global API marketplace, OpenAPI crawler, skill replacement system, full RAG framework, speculative tool executor, automatic OAuth broker, or per-turn native tool-registry optimizer in the weekend release.

### Future experiments retained

After launch: MCP catalogs; exported CLI help; hierarchical discovery over very large specs; lexical/ANN shortlist followed by Jev; a filter after existing tool discovery; native dynamic-tool adapters in supported runtimes; context-aware preselection by a caller that already owns the source and task.

The other weekend concepts remain in `Jev_Weekend_Idea_Backlog.md`. They are not hidden requirements for JevSeek.

---

## 18. Final build decision

**Build OpenAPI discovery for unfamiliar integrations.**

Start with one GitHub OpenAPI test suite, transfer to a Jira administration example, and package the same function as a CLI and an ordinary agent discovery tool. MCP catalogs are the next source adapter. Do not spend the weekend fighting native tool-loading internals.

The claim we should be able to demonstrate is:

> **The agent encountered an API it was not configured to use, supplied its definition and task to JevSeek, and received the relevant operation contracts without an integration-specific skill or prebuilt embedding index.**

Everything else—speedups, token savings, superior retrieval, and adoption—must come from the working result.

---

## Sources and verification notes

Reviewed on 18 September 2026. Sources establish API contracts, integration routes, and documented product behavior; they do not establish JevSeek performance or implementation success. GitHub repository content was read through the connected GitHub tool. No live Jev request or authenticated demo operation was run during this design revision.

- **[S1] OpenAPI Specification 3.1.1** — operation structure, parameters, references, schemas, servers, and security. A scoped compatibility target, not a claim that 3.1.1 is the newest edition. https://spec.openapis.org/oas/v3.1.1.html
- **[S2] TypeSafe API reference** — typed questions, response structure, and question-ID semantics. https://docs.typesafe.ai/api
- **[S3] TypeSafe: Advanced structure** — structured instructions and criteria. https://docs.typesafe.ai/primitives/advanced
- **[S4] TypeSafe: Speculative fan-out** — multiple questions per shared-state request. https://docs.typesafe.ai/patterns/fan-out
- **[S5] TypeSafe: Models** — current model/version, limits, pricing, and customization boundary. https://docs.typesafe.ai/models
- **[S6] TypeSafe: Jev 1.13 jaggedness** — documented indirection and irrelevant-state weaknesses. https://docs.typesafe.ai/model-jaggedness/jev-1.13
- **[S7] TypeSafe JavaScript SDK** — official typed client, `TypeSafeClient`, `noul` / `choice` / `score`. https://docs.typesafe.ai/sdk/javascript
- **[S8] Claude Code MCP documentation** — stdio registration and native tool-search behavior. https://code.claude.com/docs/en/mcp
- **[S9] Codex MCP documentation** — CLI and IDE setup; the previous developer URL redirects to this current documentation. https://learn.chatgpt.com/docs/extend/mcp?surface=cli
- **[S10] Cursor: Dynamic context discovery** — existing skill/MCP discovery design. https://cursor.com/blog/dynamic-context-discovery
- **[S11] MCP 2026-07-28: Tools** — listing, pagination, schemas, and tool catalog behavior. https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- **[S12] Anthropic: Prompt caching** — cached content hierarchy and prefix sensitivity. https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- **[S13] GitHub REST API OpenAPI repository** — bundled/dereferenced source descriptions and versions. https://github.com/github/rest-api-description — README content SHA observed: `c54f7a1a0fbfaaad87e73e5b36cea23a7b8ee488` (README identity, not a pinned API-spec commit).
- **[S14] Atlassian MCP supported tools** — current published catalog, native discovery, and execution routes. https://support.atlassian.com/atlassian-ai-gateway/docs/supported-tools/
- **[S15] GitHub pull-request REST API** — real operation used for the primary demo. https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files
- **[S16] Jira REST API introduction and OpenAPI download** — canonical source landing page. https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/ — download observed: https://dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json?_v=1.8516.116 . Resolve from the landing page and pin a digest during the build.
- **[S17] Jira custom-field-context operations** — project mappings and related administration operations. https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-custom-field-contexts/
- **[S18] Official MCP TypeScript SDK** — v2 stable line (`@modelcontextprotocol/server`, `@modelcontextprotocol/client`). https://github.com/modelcontextprotocol/typescript-sdk — documentation: https://ts.sdk.modelcontextprotocol.io/v2/
- **[S19] npx documentation** — run a local or published package binary. https://docs.npmjs.com/cli/v11/commands/npx
- **[S20] TypeSafe official documentation footer** — official Discord link. https://docs.typesafe.ai/sdk — https://discord.gg/typesafe
- **[S21] Awesome Jev directory** — community directory and Show and Tell pointer; not an official TypeSafe directory. https://github.com/hellogumbo/awesome-jev
- **[S22] Awesome Jev contribution instructions** — edit `data/projects.json` or submit an issue. https://github.com/hellogumbo/awesome-jev/blob/main/CONTRIBUTING.md
- **[S23] TypeSafe Master Customer Agreement, Section 2.3** — publication restriction relevant to performance claims. https://typesafe.ai/legal/mca
