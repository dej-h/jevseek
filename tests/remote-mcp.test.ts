import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog } from "../src/sources/catalog.js";
import { AuthenticationRequiredError } from "../src/sources/mcp.js";
import { discover } from "../src/index.js";

const endpoint = "https://public.test/catalog.json";
const tool = { name: "search_issues", description: "Search project issues", inputSchema: {
  type: "object", properties: { query: { type: "string" } }, required: ["query"],
}, annotations: { readOnlyHint: true } };

function server(options: { repeat?: boolean; duplicate?: boolean; invalid?: boolean; denied?: boolean; empty?: boolean; session?: boolean } = {}) {
  const methods: string[] = [];
  const cursors: unknown[] = [];
  const fetcher = async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    assert.equal(init?.redirect, "manual");
    if (init?.method === "DELETE") {
      methods.push("DELETE");
      return new Response(null, { status: 200 });
    }
    if (!init?.body) return new Response(null, { status: 405 });
    const request = JSON.parse(String(init.body));
    methods.push(request.method);
    const reply = (result: unknown) => Response.json({ jsonrpc: "2.0", id: request.id, result });
    switch (request.method) {
      case "server/discover":
        return Response.json({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Unknown method" } });
      case "initialize":
        const response = reply({ protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" } });
        if (options.session) response.headers.set("mcp-session-id", "fixture-session");
        return response;
      case "notifications/initialized": return new Response(null, { status: 202 });
      case "tools/list":
        if (options.denied) return new Response(null, { status: 401 });
        if (options.empty) return reply({ tools: [] });
        cursors.push(request.params?.cursor);
        return reply(request.params?.cursor
          ? { tools: [options.invalid ? { name: "broken" } : { ...tool, name: options.duplicate ? tool.name : "list_projects" }],
            ...(options.repeat ? { nextCursor: "next" } : {}) }
          : { tools: [tool], nextCursor: "next" });
      default: throw new Error(`Unexpected request, discovery must not execute tools: ${request.method}`);
    }
  };
  return { fetcher, methods, cursors };
}

test("detects MCP despite a .json suffix, reads all pages, and preserves invocation contracts", async (t) => {
  const fixture = server();
  t.mock.method(globalThis, "fetch", fixture.fetcher);
  const catalog = await loadCatalog(endpoint);
  assert.deepEqual(catalog.options.map((option) => option.id), ["search_issues", "list_projects"]);
  assert.deepEqual(fixture.cursors, [undefined, "next"]);
  const contract = catalog.options[0]?.contract;
  assert.ok(contract && typeof contract === "object" && !Array.isArray(contract));
  assert.deepEqual(contract.tool, tool);
  assert.ok(JSON.stringify(contract.invocation).includes(endpoint));
  assert.ok(!fixture.methods.includes("tools/call"));
  assert.ok("kind" in catalog.source && catalog.source.kind === "mcp");
});

test("an empty MCP catalog makes no ranking request and closes its remote session", async (t) => {
  const fixture = server({ empty: true, session: true });
  t.mock.method(globalThis, "fetch", fixture.fetcher);
  const result = await discover(endpoint, "I need to search project issues");
  assert.equal(result.status, "no_confident_match");
  assert.equal(result.usage.jevRequests, 0);
  assert.equal(result.scan.totalOperations, 0);
  assert.deepEqual(result.matches, []);
  assert.ok(fixture.methods.includes("DELETE"));
});

test("MCP transport rejects redirects and oversized responses during negotiation", async (t) => {
  for (const response of [
    () => new Response(null, { status: 302 }),
    () => new Response("{}", { headers: { "content-length": String(65 * 1024 * 1024) } }),
  ]) {
    const mock = t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) =>
      init?.body ? response() : new Response(null, { status: 405 }));
    await assert.rejects(loadCatalog(endpoint), /redirects|64 MiB/);
    mock.mock.restore();
  }
});

test("authentication, broken pagination, duplicate names, and malformed tools fail the whole scan", async (t) => {
  for (const [options, expected] of [
    [{ repeat: true }, /pagination cursor/], [{ duplicate: true }, /Duplicate MCP tool/],
    [{ invalid: true }, /MCP:/], [{ denied: true }, /Authentication required/],
  ] as const) {
    const mock = t.mock.method(globalThis, "fetch", server(options).fetcher);
    await assert.rejects(loadCatalog(endpoint), expected);
    mock.mock.restore();
  }
});

test("does not probe past authentication or redirects and detects OpenAPI without a file suffix", async (t) => {
  const calls: unknown[] = [];
  const mock = t.mock.method(globalThis, "fetch", async (input: unknown) => {
    calls.push(input);
    return new Response(null, { status: 401 });
  });
  await assert.rejects(loadCatalog(endpoint), AuthenticationRequiredError);
  assert.equal(calls.length, 1);
  mock.mock.mockImplementation(async () => new Response(null, { status: 302 }));
  await assert.rejects(loadCatalog(endpoint), /redirects/);
  mock.mock.mockImplementation(async () => Response.json({ openapi: "3.1.0", paths: { "/ping": { get: { summary: "Ping" } } } }));
  const catalog = await loadCatalog("https://public.test/mcp");
  assert.equal(catalog.options[0]?.id, "GET /ping");
});

test("cancellation interrupts MCP negotiation", async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    if (!init?.body) return new Response(null, { status: 405 });
    controller.abort(new Error("cancel discovery"));
    init.signal?.throwIfAborted();
    throw new Error("unreachable");
  });
  await assert.rejects(loadCatalog(endpoint, undefined, controller.signal));
});
