import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { formatShortResult } from "../src/cli/format.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const need = "I need filenames and change metadata for a pull request";

function cli(args: string[], fail = false) {
  const result = spawnSync(process.execPath, [
    "--import", "tsx", "--import", "./tests/fixtures/mock-provider.mjs", "src/cli/index.ts", ...args,
  ], {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
    env: { ...process.env, JEVSEEK_TEST_PROVIDER_FAILURE: fail ? "1" : "0" },
  });
  assert.ifError(result.error);
  return result;
}

test("discover CLI returns parseable JSON with a source contract", () => {
  const result = cli(["discover", need, "tests/fixtures/discover.json", "--top", "1", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.need, need);
  assert.equal(output.matches[0].contract.operation.operationId, "listFiles");
  assert.equal(output.matches.length, 1);
});

test("CLI version flags report the package version", () => {
  const manifest: { version: string } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  for (const flag of ["--version", "-v"]) {
    const result = cli([flag]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `${manifest.version}\n`);
    assert.equal(result.stderr, "");
  }
  const invalid = cli(["--version", "extra"]);
  assert.notEqual(invalid.status, 0);
  assert.equal(invalid.stdout, "");
});

test("discover accepts a need followed by an HTTPS OpenAPI URL", () => {
  const source = "https://catalog.test/openapi.json";
  const result = cli(["discover", need, source, "--top", "1"]);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.need, need);
  assert.equal(output.source.location, source);
  assert.equal(output.matches[0].contract.operation.operationId, "listFiles");
});

test("--short prints bounded OpenAPI and MCP match summaries", () => {
  const openApi = cli(["discover", need, "tests/fixtures/discover.json", "--top", "1", "--short"]);
  assert.equal(openApi.status, 0, openApi.stderr);
  assert.equal(openApi.stdout, [
    "Status: matches",
    "Scanned: 2 operations",
    "Matches:",
    "  1. [0.96] GET /pulls/{number}/files (listFiles): List changed files",
    "Usage: 1 Jev request, 100 input tokens, $0.0000042",
    "",
  ].join("\n"));
  assert.doesNotMatch(openApi.stdout, /contract|references|responses/);

  const mcp = cli(["discover", need, "https://catalog.test/mcp", "--top", "1", "--short"]);
  assert.equal(mcp.status, 0, mcp.stderr);
  assert.match(mcp.stdout, /^Status: matches\nScanned: 1 tool\nMatches:\n  1\. \[0\.96\] MCP tool list_files:/);
  assert.doesNotMatch(mcp.stdout, /inputSchema|invocation/);
});

test("short summaries flatten control characters and cap catalog text", () => {
  const output = formatShortResult({
    need,
    model: "fixture-model",
    status: "matches",
    matches: [{
      rank: 1,
      id: "fallback",
      score: 0.8,
      contract: {
        method: "GET",
        path: `/items\n\u001b[31m${"x".repeat(300)}`,
        operation: { summary: `line one\n${"y".repeat(200)}` },
      },
    }],
    usage: { jevRequests: 1, inputTokens: 10, costUsd: 0.00000042 },
  });
  const matchLine = output.split("\n")[2];
  assert.ok(matchLine);
  assert.ok(matchLine.length < 400);
  assert.doesNotMatch(matchLine, /\u001b|\[31m/);
  assert.match(matchLine, /…/);
});

test("CLI rejects malformed invocations and reports provider failure without success JSON", () => {
  for (const args of [
    ["discover"],
    ["discover", need],
    ["discover", need, "tests/fixtures/discover.json", "extra"],
    ["discover", need, "tests/fixtures/discover.json", "--top", "nope"],
    ["discover", need, "tests/fixtures/discover.json", "--file", "wrong.json"],
    ["discover", need, "tests/fixtures/discover.json", "--short", "--json"],
  ]) {
    const result = cli(args);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
  }
  const failed = cli(["discover", need, "tests/fixtures/discover.json"], true);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /fixture authentication failure/);
  assert.equal(failed.stdout, "");
});

test("help uses capability needs and existing rank remains usable", () => {
  const help = cli(["discover", "--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /discover "<need>" <source>/);
  assert.match(help.stdout, /--short prints one bounded line per match/);
  const ranked = cli(["rank", need, "--openapi", "tests/fixtures/discover.json", "--top", "1"]);
  assert.equal(ranked.status, 0, ranked.stderr);
  assert.equal(JSON.parse(ranked.stdout).matches[0].id, "GET /pulls/{number}/files");
});
