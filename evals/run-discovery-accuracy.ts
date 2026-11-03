import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { discover } from "../src/index.js";

type SourceName = "github" | "digitalocean" | "stripe";

interface DiscoveryCase {
  id: string;
  source: SourceName;
  need: string;
  expectedId: string | null;
  acceptableIds?: string[];
  tier: string;
}

const SOURCE_HASHES: Record<SourceName, string> = {
  github: "0f85424a3c9603e75d11d3819c47f7e67f51d24bd6deb19cbb6b006e953195e1",
  digitalocean: "5f1156a780a769db54abb39183c8b5f1c39a8ba7bf111726f408110965bcaf6f",
  stripe: "2c31317cdff103e4495b5b3501004d9ddc0af61f43b0ab819e2db392eef008f6",
};
const SOURCE_NAMES = ["github", "digitalocean", "stripe"] as const;

const [casesPath, githubPath, digitaloceanPath, stripePath] = process.argv.slice(2);
if (!casesPath || !githubPath || !digitaloceanPath || !stripePath) {
  throw new Error("usage: tsx evals/run-discovery-accuracy.ts CASES.json GITHUB.json DIGITALOCEAN.yaml STRIPE.json");
}
if (!process.env.TYPESAFE_API_KEY?.trim()) {
  throw new Error("Set TYPESAFE_API_KEY before running paid discovery queries.");
}

const sources: Record<SourceName, string> = {
  github: resolve(githubPath),
  digitalocean: resolve(digitaloceanPath),
  stripe: resolve(stripePath),
};
for (const source of SOURCE_NAMES) {
  const digest = createHash("sha256").update(await readFile(sources[source])).digest("hex");
  if (digest !== SOURCE_HASHES[source]) {
    throw new Error(`${source} source hash differs from the frozen evaluation snapshot`);
  }
}

const parsed: unknown = JSON.parse(await readFile(resolve(casesPath), "utf8"));
if (!Array.isArray(parsed) || !parsed.every(isDiscoveryCase)) {
  throw new Error("case file must contain source-backed discovery questions");
}
const cases: DiscoveryCase[] = parsed;
let accepted = 0;
let inputTokens = 0;
let costUsd = 0;

for (const item of cases) {
  const result = await discover(sources[item.source], item.need, { topK: 10 });
  const topId = result.matches[0]?.id ?? null;
  const correct = item.expectedId === null
    ? result.status === "no_confident_match"
    : topId === item.expectedId || item.acceptableIds?.includes(topId ?? "") === true;
  if (correct) accepted += 1;
  inputTokens += result.usage.inputTokens;
  costUsd += result.usage.costUsd;
  process.stdout.write(JSON.stringify({
    id: item.id,
    source: item.source,
    tier: item.tier,
    expectedId: item.expectedId,
    topId,
    status: result.status,
    accepted: correct,
    examinedOperations: result.scan.examinedOperations,
    inputTokens: result.usage.inputTokens,
    costUsd: result.usage.costUsd,
  }) + "\n");
}

process.stderr.write(`Accepted ${accepted}/${cases.length}; Jev input tokens ${inputTokens}; cost $${costUsd.toFixed(6)}\n`);

function isDiscoveryCase(value: unknown): value is DiscoveryCase {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  if (!("id" in value) || !("source" in value) || !("need" in value)
    || !("expectedId" in value) || !("tier" in value)) return false;
  return typeof value.id === "string"
    && SOURCE_NAMES.some((source) => source === value.source)
    && typeof value.need === "string"
    && (typeof value.expectedId === "string" || value.expectedId === null)
    && typeof value.tier === "string"
    && (!("acceptableIds" in value) || value.acceptableIds === undefined
      || (Array.isArray(value.acceptableIds)
        && value.acceptableIds.every((id: unknown) => typeof id === "string")));
}
