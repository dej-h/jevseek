import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rankOptions } from "../src/core/rank.js";
import type { RankResult } from "../src/core/rank.js";
import { loadOpenApiOperations } from "../src/sources/openapi.js";
import { GITHUB_PACKING_QUERIES } from "./github-packing-queries.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = resolve(ROOT, "examples/github/api.github.com.json");
const OUT = resolve(ROOT, "evals/github-rank-eval.json");

interface Snapshot {
  status: RankResult["status"];
  model: string;
  topId: string | undefined;
  topScore: number;
  expectedRank: number | null;
  expectedScore: number | null;
  top5: RankResult["matches"];
  inputTokens: number;
  costUsd: number;
  jevRequests: number;
  elapsedMs: number;
}

function snapshot(result: RankResult, expectedId: string, elapsedMs: number): Snapshot {
  const expected = result.matches.find((match) => match.id === expectedId);
  return {
    status: result.status,
    model: result.model,
    topId: result.matches[0]?.id,
    topScore: result.matches[0]?.score ?? 0,
    expectedRank: expected?.rank ?? null,
    expectedScore: expected?.score ?? null,
    top5: result.matches,
    inputTokens: result.usage.inputTokens,
    costUsd: result.usage.costUsd,
    jevRequests: result.usage.jevRequests,
    elapsedMs,
  };
}

async function main(): Promise<void> {
  const options = await loadOpenApiOperations(SPEC);
  const ids = new Set(options.map((option) => option.id));
  for (const query of GITHUB_PACKING_QUERIES) {
    if (!ids.has(query.expectedId)) {
      throw new Error(`expected id missing from spec: ${query.expectedId}`);
    }
  }
  if (GITHUB_PACKING_QUERIES.length !== 50) {
    throw new Error(`expected 50 queries, got ${String(GITHUB_PACKING_QUERIES.length)}`);
  }

  const rows = [];
  for (const [index, query] of GITHUB_PACKING_QUERIES.entries()) {
    process.stderr.write(`[${String(index + 1)}/50] ${query.id}\n`);
    const started = Date.now();
    const result = await rankOptions({
      need: query.need,
      options,
      topK: 10,
    });
    const snap = snapshot(result, query.expectedId, Date.now() - started);
    rows.push({
      id: query.id,
      need: query.need,
      expectedId: query.expectedId,
      hit: snap.topId === query.expectedId && snap.topScore >= 0.5,
      result: snap,
    });
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(
      OUT,
      `${JSON.stringify({ updatedAt: new Date().toISOString(), rows }, null, 2)}\n`,
    );
  }

  const summary = {
    queries: rows.length,
    model: rows[0]?.result.model,
    hits: rows.filter((row) => row.hit).length,
    inputTokens: rows.reduce((sum, row) => sum + row.result.inputTokens, 0),
    costUsd: rows.reduce((sum, row) => sum + row.result.costUsd, 0),
  };
  const payload = {
    catalog: "examples/github/api.github.com.json",
    operations: options.length,
    priceUsdPerMillionInput: 0.042,
    summary,
    rows,
  };
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

await main();
