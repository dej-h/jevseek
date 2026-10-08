import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspect } from "../src/inspect.js";
import { loadCatalog } from "../src/sources/catalog.js";

test("inspection reads the current operation and reports a removed target", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "jevseek-inspect-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, "api.json");
  const doc = { openapi: "3.1.0", paths: { "/items": { get: {
    summary: "First version", responses: { "200": { description: "OK" } },
  } } } };
  await writeFile(source, JSON.stringify(doc));
  const first = await inspect(source, "GET /items");
  assert.equal((first.value as { operation: { summary: string } }).operation.summary, "First version");

  doc.paths["/items"].get.summary = "Second version";
  await writeFile(source, JSON.stringify(doc));
  const second = await inspect(source, "GET /items");
  assert.equal((second.value as { operation: { summary: string } }).operation.summary, "Second version");

  await writeFile(source, JSON.stringify({ openapi: "3.1.0", paths: { "/other": { get: {} } } }));
  await assert.rejects(inspect(source, "GET /items"), /target not found in current source.*rediscover/);
});

test("inspection navigates every reachable local reference and keeps unresolved refs explicit", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "jevseek-references-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, "api.json");
  const schemas: Record<string, unknown> = {};
  for (let index = 0; index < 140; index++) {
    schemas[`Schema${index}`] = index === 139
      ? { type: "object", properties: { final: { type: "string" } } }
      : { $ref: `#/components/schemas/Schema${index + 1}` };
  }
  const doc = { openapi: "3.1.0", paths: { "/items": { get: { responses: {
    "200": { content: { "application/json": { schema: { $ref: "#/components/schemas/Schema0" } } } },
    "404": { $ref: "#/components/responses/Missing" },
  } } } }, components: { schemas } };
  await writeFile(source, JSON.stringify(doc));

  const catalog = await loadCatalog(source);
  assert.equal(catalog.options[0]?.contract, undefined);
  assert.deepEqual(catalog.warningCounts, { unresolved_local_reference: 1 });
  const overview = await inspect(source, "GET /items");
  const value = overview.value as { references: { count: number; names: string[]; nextOffset: number }; contractComplete: boolean; warnings: string[] };
  assert.equal(value.references.count, 140);
  assert.equal(value.references.names.length, 50);
  assert.equal(value.references.nextOffset, 50);
  assert.equal(value.contractComplete, false);
  assert.match(value.warnings.join(" "), /Missing/);
  const last = await inspect(source, "GET /items", { part: ["references", "#/components/schemas/Schema139"] });
  assert.deepEqual(last.value, schemas.Schema139);
});
