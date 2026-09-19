# After installable CLI packaging

The local file/HTTPS discovery path, caller-supplied capability need, independent Jev scoring, contract return, and installable package now exist. Release automation is configured; a successful local build is separate from a completed GitHub release.

The next milestone is a real agent using a selected contract through the installed client. This follows the [first OpenAPI milestone and v0.1 scope](JevSeek_Design_Spec.md#4-scope-and-implementation-order). Finish that path before adding another source adapter.

## 1. Make returned contracts sufficient for the next action

Preserving raw operations fixed the immediate loss of contract data. Remaining gaps include security scheme definitions, effective inherited parameter overrides, reference/unsupported-feature diagnostics, and a bound on returned contract size. `contractComplete` currently reflects reference traversal warnings, not full validation of every OpenAPI feature.

Add deterministic coverage for cycles, limits, required inputs, security definitions, and score-to-contract mapping across batches. Keep descriptors separate from returned contracts. The acceptance case is an agent constructing a correct public GitHub request using the selected contract without reopening the full spec. See [candidate construction](JevSeek_Design_Spec.md#6-openapi-aware-candidate-construction).

## 2. Expose the same function through stdio MCP

Implement `jevseek serve` with one `jevseek_discover` tool over the existing `discover()` function. Accept a source and an explicit capability `need`. Keep execution with the agent's existing tools. Define permitted local sources and outbound destinations before making source loading model-accessible.

Install the packaged client in one coding agent and record discovery followed by a public read-only GitHub request. This is the [core MCP packaging role](JevSeek_Design_Spec.md#two-different-uses-of-mcpdo-not-conflate-them), separate from using MCP servers as input catalogs.

## 3. Cover failed queries and strengthen evidence

The saved 50-query benchmark covers clear positive needs with basic descriptors. Extend the primary suite with near misses, impossible needs, input/output distinctions, and usable-contract checks. Pin the downloaded GitHub snapshot in the fetch script; it currently downloads main despite recording a specific snapshot in the docs.

Add a total discovery budget and explicit incomplete-scan handling. The SDK already provides per-request retries; use its behavior rather than adding a second retry loop blindly. Test cancellation and partial batch failure. Then run the three Jira transfer checks described in [test scope](JevSeek_Design_Spec.md#10-test-scope-and-evidence).

## 4. Build the demo from the proven workflow

Use the installed CLI for the terminal demo. The spec also calls for a single-screen local view using the same engine. Show the need, source, operation counts, selected contract, and actual next action. Distinguish source size, returned context, and Jev usage. Finish clean installation and agent-run evidence before recording broader compatibility or performance claims.

MCP-as-source remains later work. It should not delay the OpenAPI discovery server, verified contract use, or demo.
