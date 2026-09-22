import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test, { type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import { SourcePolicy } from "../src/mcp/sources.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = join(root, "tests/fixtures/discover.json");
const need = "I need filenames and change metadata for a pull request";
const args = { source: fixture, need, top_k: 1 };

async function connect(t: TestContext, options: { failure?: boolean; modern?: boolean; allowedSources?: string[] } = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "--import", "./tests/fixtures/mock-provider.mjs", "src/cli/index.ts",
      "serve", ...(options.allowedSources ?? []).flatMap((source) => ["--allow-source", source])],
    cwd: root,
    stderr: "pipe",
    env: { ...getDefaultEnvironment(), TYPESAFE_LOG_LEVEL: "info", JEVSEEK_TEST_PROVIDER_FAILURE: options.failure ? "1" : "0" },
  });
  const client = new Client({ name: "jevseek-test", version: "1.0.0" }, {
    versionNegotiation: { mode: options.modern ? { pin: "2026-07-28" } : "legacy" },
  });
  const protocolErrors: Error[] = [];
  client.onerror = (error) => protocolErrors.push(error);
  let stderr = "";
  transport.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  t.after(async () => {
    await client.close();
    assert.deepEqual(protocolErrors, [], "stdout must contain only valid protocol messages");
  });
  await client.connect(transport);
  return { client, transport, stderr: () => stderr };
}

test("MCP lists one discovery tool and serves local/HTTPS contracts through the shared engine", { timeout: 15_000 }, async (t) => {
  const { client, stderr } = await connect(t);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name), ["jevseek_discover"]);
  assert.doesNotMatch(JSON.stringify(tools[0]?.inputSchema.properties?.source), /"enum"/);
  assert.equal(tools[0]?.annotations?.readOnlyHint, true);
  for (const location of [fixture, "https://catalog.test/openapi.json"]) {
    const result = await client.callTool({ name: "jevseek_discover", arguments: {
      ...args, source: location, include: { responses: true },
    } });
    assert.ok(!result.isError, JSON.stringify(result));
    const content = result.content[0];
    assert.ok(content?.type === "text");
    const data = JSON.parse(content.text);
    assert.deepEqual(result.structuredContent, data);
    assert.equal(data.need, need);
    assert.equal(data.matches[0].id, "GET /pulls/{number}/files");
    assert.equal(data.matches[0].contract.operation.operationId, "listFiles");
    assert.equal(data.scan.examinedOperations, 2);
  }
  assert.match(stderr(), /200/, "provider info logs must be on stderr");
  const noMatch = await client.callTool({ name: "jevseek_discover", arguments: {
    ...args, need: "I need something this API does not provide",
  } });
  const noMatchText = noMatch.content[0];
  assert.ok(noMatchText?.type === "text");
  assert.equal(JSON.parse(noMatchText.text).status, "no_confident_match");
});

test("MCP rejects invalid arguments without breaking the connection", { timeout: 15_000 }, async (t) => {
  const { client } = await connect(t);
  for (const arguments_ of [
    { ...args, source: "http://example.test/openapi.json" },
    { ...args, source: " " },
    { ...args, source: join(root, "package.json") },
    { ...args, need: " " }, { ...args, top_k: 0 }, { ...args, top_k: 21 },
    { ...args, command: "arbitrary-command" },
  ]) {
    const result = await client.callTool({ name: "jevseek_discover", arguments: arguments_ });
    assert.equal(result.isError, true);
  }
  assert.ok(!(await client.callTool({ name: "jevseek_discover", arguments: args })).isError);
});

test("MCP accepts a new file after startup without registration or restart", { timeout: 15_000 }, async (t) => {
  const { client } = await connect(t);
  const temp = await mkdtemp(join(tmpdir(), "jevseek-new-source-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const source = join(temp, "new.json");
  await writeFile(source, await readFile(fixture));
  const result = await client.callTool({ name: "jevseek_discover", arguments: {
    ...args, source: source,
  } });
  assert.ok(!result.isError, JSON.stringify(result));
});

test("optional source restrictions reject other files and URLs but allow configured sources", { timeout: 15_000 }, async (t) => {
  const url = "https://catalog.test/openapi.json";
  const { client } = await connect(t, { allowedSources: [fixture, url] });
  assert.match(JSON.stringify((await client.listTools()).tools[0]?.inputSchema), /catalog.test/);
  for (const location of [join(root, "package.json"), "https://unapproved.test/openapi.json"]) {
    const result = await client.callTool({ name: "jevseek_discover", arguments: {
      ...args, source: location,
    } });
    assert.equal(result.isError, true);
  }
  for (const location of [fixture, url]) {
    const result = await client.callTool({ name: "jevseek_discover", arguments: {
      ...args, source: location,
    } });
    assert.ok(!result.isError, JSON.stringify(result));
  }
});

test("MCP also serves clients using the modern protocol", { timeout: 15_000 }, async (t) => {
  const { client } = await connect(t, { modern: true });
  assert.equal((await client.listTools()).tools[0]?.name, "jevseek_discover");
  const result = await client.callTool({ name: "jevseek_discover", arguments: args });
  assert.ok(!result.isError, JSON.stringify(result));
});

test("MCP discovery automatically detects a remote MCP source", { timeout: 15_000 }, async (t) => {
  const { client } = await connect(t);
  const result = await client.callTool({ name: "jevseek_discover", arguments: {
    source: "https://catalog.test/mcp", need, top_k: 1,
  } });
  assert.ok(!result.isError, JSON.stringify(result));
  assert.match(JSON.stringify(result.structuredContent), /list_files/);
  assert.match(JSON.stringify(result.structuredContent), /tools\/call/);
});

test("CLI discovers a remote MCP source without a source-type flag", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--import", "./tests/fixtures/mock-provider.mjs",
    "src/cli/index.ts", "discover", need, "https://catalog.test/mcp"], { cwd: root, encoding: "utf8", timeout: 10_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.source.kind, "mcp");
  assert.equal(data.matches[0].contract.tool.name, "list_files");
});

test("MCP reports provider failures as tool errors, not no-match results", { timeout: 15_000 }, async (t) => {
  const { client } = await connect(t, { failure: true });
  const result = await client.callTool({ name: "jevseek_discover", arguments: args });
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /fixture authentication failure/);
  assert.equal(result.structuredContent, undefined);
  assert.equal((await client.listTools()).tools.length, 1);
});

test("MCP cancellation aborts only its request while overlapping discoveries complete", { timeout: 15_000 }, async (t) => {
  const { client, transport } = await connect(t);
  function waitForLog(marker: string) {
    return new Promise<void>((resolve) => {
      const listener = (chunk: Buffer) => {
        if (chunk.toString().includes(marker)) {
          transport.stderr?.removeListener("data", listener);
          resolve();
        }
      };
      transport.stderr?.on("data", listener);
    });
  }
  const started = waitForLog("fixture request started");
  const aborted = waitForLog("fixture request aborted");
  const controller = new AbortController();
  const pending = client.callTool({ name: "jevseek_discover", arguments: {
    ...args, need: "I need a slow discovery for cancellation testing",
  } }, { signal: controller.signal });
  const rejected = assert.rejects(pending);
  await started;
  const overlapping = await client.callTool({ name: "jevseek_discover", arguments: args });
  assert.ok(!overlapping.isError, JSON.stringify(overlapping));
  const overlappingContent = overlapping.content[0];
  assert.ok(overlappingContent?.type === "text");
  const overlappingResult = JSON.parse(overlappingContent.text);
  assert.equal(overlappingResult.need, need);
  assert.equal(overlappingResult.matches[0]?.id, "GET /pulls/{number}/files");
  controller.abort();
  await rejected;
  await aborted;
  await client.ping();
  assert.ok(!(await client.callTool({ name: "jevseek_discover", arguments: args })).isError);
});

test("MCP refuses oversized results instead of silently truncating contracts", { timeout: 15_000 }, async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "jevseek-large-result-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const doc = JSON.parse(await readFile(fixture, "utf8"));
  doc.paths["/pulls/{number}/files"].get.description = "x".repeat(600_000);
  const path = join(temp, "large.json");
  await writeFile(path, JSON.stringify(doc));
  const { client } = await connect(t);
  const result = await client.callTool({ name: "jevseek_discover", arguments: {
    ...args, source: path,
  } });
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /1 MiB/);
  assert.equal(result.structuredContent, undefined);
});

test("source grants canonicalize files and reject symlink retargeting, directories, and unsafe URLs", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "jevseek-grants-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const link = join(temp, "source.json");
  await symlink(fixture, link);
  const approved = await SourcePolicy.create([link]);
  assert.equal(await approved.resolve(link), fixture);
  await rm(link);
  await symlink(join(root, "package.json"), link);
  await assert.rejects(approved.resolve(link), /not approved/);
  const unrestricted = await SourcePolicy.create();
  assert.equal(unrestricted.locations, undefined);
  assert.equal(await unrestricted.resolve(link), join(root, "package.json"));
  await assert.rejects(SourcePolicy.create([temp]), /regular file/);
  await assert.rejects(SourcePolicy.create([""]), /must not be blank/);
  for (const source of ["http://example.test/spec", "https://user:secret@example.test/spec", "https://example.test/spec#part"]) {
    await assert.rejects(SourcePolicy.create([source]), /HTTPS/);
    await assert.rejects(unrestricted.resolve(source), /HTTPS/);
  }
});

test("serve startup errors are actionable and stay off stdout", () => {
  for (const [extra, expected] of [
    [[], /Set TYPESAFE_API_KEY/],
    [["--transport", "http"], /only --transport stdio/],
    [["--allow-source", fixture], /Set TYPESAFE_API_KEY/],
  ] as const) {
    const result = spawnSync(process.execPath, ["--import", "tsx", "src/cli/index.ts", "serve", ...extra], {
      cwd: root, encoding: "utf8", timeout: 10_000,
      env: { ...getDefaultEnvironment(), TYPESAFE_API_KEY: "" },
    });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, expected);
  }
});
