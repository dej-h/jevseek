# After installable CLI packaging

The local file/HTTPS discovery path, caller-supplied capability need, independent Jev scoring, contract return, installable package, and stdio MCP discovery server now exist. Release automation is configured; a successful local build is separate from a completed GitHub release.

The next milestone is a real agent using a selected contract through the installed client. This follows the [first OpenAPI milestone and v0.1 scope](JevSeek_Design_Spec.md#4-scope-and-implementation-order). Public remote MCP tool discovery now also uses the shared ranking pipeline; live execution evidence remains separate.

## 1. Make returned contracts sufficient for the next action

Preserving raw operations fixed the immediate loss of contract data. Remaining gaps include security scheme definitions, effective inherited parameter overrides, reference/unsupported-feature diagnostics, and a bound on returned contract size. `contractComplete` currently reflects reference traversal warnings, not full validation of every OpenAPI feature.

Add deterministic coverage for cycles, limits, required inputs, security definitions, and score-to-contract mapping across batches. Keep descriptors separate from returned contracts. The acceptance case is an agent constructing a correct public GitHub request using the selected contract without reopening the full spec. See [candidate construction](JevSeek_Design_Spec.md#6-openapi-aware-candidate-construction).

## 2. Prove the installed MCP server in a coding agent

`jevseek serve` now exposes one `jevseek_discover` tool over `discover()`. Sources are supplied per call, with optional `--allow-source` startup restrictions. The installed-package test covers real MCP listing and calls with mocked provider responses. [Setup instructions](coding-agents.md) cover Codex and Claude Code; those recipes are separate from evidence of an actual agent workflow.

Install the packaged client in one coding agent and record discovery followed by a public read-only GitHub request. This is the [core MCP packaging role](JevSeek_Design_Spec.md#two-different-uses-of-mcpdo-not-conflate-them), separate from using MCP servers as input catalogs.

## 3. Cover failed queries and strengthen evidence

The saved 50-query benchmark covers clear positive needs with basic descriptors. Extend the primary suite with near misses, impossible needs, input/output distinctions, and usable-contract checks. Pin the downloaded GitHub snapshot in the fetch script; it currently downloads main despite recording a specific snapshot in the docs.

MCP discovery now has a total deadline, cancellation, and a result-size limit. Partial-batch reporting and fuller incomplete-scan handling remain. The SDK already provides per-request retries; use its behavior rather than adding a second retry loop blindly. Then run the three Jira transfer checks described in [test scope](JevSeek_Design_Spec.md#10-test-scope-and-evidence).

## 4. Build the demo from the proven workflow

Use the installed CLI for the terminal demo. The spec also calls for a single-screen local view using the same engine. Show the need, source, operation counts, selected contract, and actual next action. Distinguish source size, returned context, and Jev usage. Finish clean installation and agent-run evidence before recording broader compatibility or performance claims.

Public remote MCP-as-source is implemented for tools over Streamable HTTP, with automatic detection and invocation breadcrumbs. TODO: local stdio adapters, resources, prompts, and authentication that also serves the eventual execution client. Discovery does not execute tools or share credentials/sessions.
