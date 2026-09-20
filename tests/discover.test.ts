import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { discover } from "../src/index.js";
import { loadOpenApiCatalog, operationsFromOpenApi } from "../src/sources/openapi.js";
import { readSourceDocument } from "../src/sources/document.js";
import type { SystemOneRequestPayload } from "@typesafe-ai/sdk";

const fixture = fileURLToPath(new URL("./fixtures/discover.json", import.meta.url));
const need = "I need filenames and change metadata for a pull request";

test("discovery sends the exact need, ranks all operations, and returns the selected contract", async (t) => {
  const oldKey = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = "fixture-key";
  t.after(() => {
    if (oldKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = oldKey;
  });
  let sent: SystemOneRequestPayload | undefined;
  const transport = t.mock.method(globalThis, "fetch", async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    sent = JSON.parse(String(init?.body)) as SystemOneRequestPayload;
    return Response.json({
      model: "fixture-model",
      answers: { opt_0: { type: "noul", noul: 0.05 }, opt_1: { type: "noul", noul: 0.96 } },
      usage: { input_tokens: 100, output_tokens: 0 },
    });
  });

  const result = await discover(fixture, need, { topK: 1 });
  assert.equal(transport.mock.callCount(), 1);
  assert.ok(sent);
  assert.equal((sent.state as { need: string }).need, need);
  assert.equal(Object.keys(sent.questions).length, 2);
  assert.ok(!JSON.stringify(sent).includes("#/components/schemas/Files"));
  assert.equal(result.need, need);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.id, "GET /pulls/{number}/files");
  assert.equal(result.status, "matches");
  assert.equal(result.source.location, await realpath(fixture));
  const bytes = await readFile(fixture);
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.equal(result.source.sha256, digest);
  assert.equal(result.matches[0]?.identity, `sha256:${digest}:GET /pulls/{number}/files`);
  const contract = result.matches[0]?.contract;
  assert.ok(contract && typeof contract === "object" && !Array.isArray(contract));
  assert.equal(contract.sourcePointer, "#/paths/~1pulls~1{number}~1files/get");
  assert.equal(contract.contractComplete, true);
  assert.deepEqual(contract.operation, JSON.parse(bytes.toString()).paths["/pulls/{number}/files"].get);
  assert.ok(JSON.stringify(contract.references).includes("filename"));
  assert.deepEqual(result.scan, { totalOperations: 2, examinedOperations: 2, complete: true, warnings: [] });
  assert.equal(result.usage.inputTokens, 100);
  assert.equal(result.contextAccounting.returnedMatches, Buffer.byteLength(JSON.stringify(result.matches)));

  transport.mock.mockImplementation(async () => Response.json({
    model: "fixture-model",
    answers: { opt_0: { type: "noul", noul: 0.05 }, opt_1: { type: "noul", noul: 0.1 } },
    usage: { input_tokens: 100, output_tokens: 0 },
  }));
  const noMatch = await discover(fixture, "I need a capability this API does not provide", { topK: 1 });
  assert.equal(noMatch.status, "no_confident_match");
  assert.equal(noMatch.scan.examinedOperations, 2);
  assert.equal(noMatch.matches[0]?.score, 0.1);
});

test("invalid needs and topK fail before any source or provider request", async (t) => {
  const transport = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected request"); });
  await assert.rejects(discover("missing.json", "   "), /non-empty capability need/);
  for (const topK of [0, -1, 1.5, NaN, Infinity]) {
    await assert.rejects(discover("missing.json", need, { topK }), /positive integer/);
  }
  assert.equal(transport.mock.callCount(), 0);
});

test("discovery cancellation stops before loading and aborts an in-flight HTTPS source read", async (t) => {
  const cancelled = AbortSignal.abort(new Error("cancelled before loading"));
  await assert.rejects(discover("missing.json", need, { signal: cancelled }), /cancelled before loading/);

  const controller = new AbortController();
  let started!: () => void;
  const fetching = new Promise<void>((resolve) => { started = resolve; });
  t.mock.method(globalThis, "fetch", async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const signal = init?.signal;
    assert.ok(signal);
    started();
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });
  const pending = discover("https://example.test/spec", need, { signal: controller.signal });
  const rejected = assert.rejects(pending, /cancelled while fetching/);
  await fetching;
  controller.abort(new Error("cancelled while fetching"));
  await rejected;
});

test("unsupported versions and referenced Path Items cannot report a complete scan", () => {
  assert.throws(() => operationsFromOpenApi({ openapi: "3.2.0", paths: {} }), /3.0 and 3.1/);
  assert.throws(() => operationsFromOpenApi({
    openapi: "3.1.0", paths: { "/files": { $ref: "#/components/pathItems/files" } },
  }), /referenced Path Item/);
  assert.throws(() => operationsFromOpenApi({
    openapi: "3.1.0", paths: { "/files": { get: null } },
  }), /invalid operation/);
});

test("HTTPS documents are bounded and redirects are not followed", async (t) => {
  const body = "openapi: 3.1.0\npaths:\n  /files:\n    get:\n      summary: List files\n      responses:\n        '200':\n          description: Files\n";
  const transport = t.mock.method(globalThis, "fetch", async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    assert.equal(init?.redirect, "manual");
    assert.ok(init?.signal);
    return new Response(body);
  });
  const result = await readSourceDocument("https://example.test/openapi.yaml");
  assert.equal(result.text, body);
  assert.equal(result.bytes, Buffer.byteLength(body));
  const catalog = await loadOpenApiCatalog("https://example.test/openapi.yaml");
  assert.equal(catalog.source.format, "yaml");
  assert.equal(catalog.options[0]?.id, "GET /files");
  transport.mock.mockImplementation(async () => new Response(null, { status: 302, headers: { location: "https://other.test" } }));
  await assert.rejects(readSourceDocument("https://example.test/spec"), /redirects are not followed/);
  transport.mock.mockImplementation(async () => new Response("", { headers: { "content-length": String(65 * 1024 * 1024) } }));
  await assert.rejects(readSourceDocument("https://example.test/spec"), /64 MiB/);
  await assert.rejects(readSourceDocument("http://example.test/spec"), /HTTPS/);
});
