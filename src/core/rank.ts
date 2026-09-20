import type { RankOption } from "./candidates.js";
import type { JsonValue } from "@typesafe-ai/sdk";
import { estimateTokens, packBatches } from "./candidates.js";
import { createJudgeClient, judgeBatch } from "./judge.js";
import type { Judgment } from "./judge.js";
import { inputCostUsd, packingState } from "./packing.js";

/** Conservative packing vs TypeSafe's 64k total / 32k state+longest limits. */
const TOKEN_BUDGET = { total: 48_000, statePlusLongest: 24_000 };
const DEFAULT_CONCURRENCY = 4;

export interface RankRequest {
  signal?: AbortSignal;
  need: string;
  options: RankOption[];
  topK?: number;
  concurrency?: number;
}

export interface RankedOption {
  rank: number;
  id: string;
  score: number;
  contract?: JsonValue;
}

export interface RankResult {
  need: string;
  model: string;
  status: "matches" | "no_confident_match";
  matches: RankedOption[];
  usage: {
    jevRequests: number;
    inputTokens: number;
    costUsd: number;
  };
}

export async function rankOptions(request: RankRequest): Promise<RankResult> {
  request.signal?.throwIfAborted();
  validateRankSettings(request.need, request.topK, request.concurrency);
  if (request.options.length === 0) {
    throw new Error("rankOptions requires at least one option");
  }

  const topK = request.topK ?? 5;
  const concurrency = request.concurrency ?? DEFAULT_CONCURRENCY;
  const seenIds = new Set<string>();
  for (const option of request.options) {
    if (seenIds.has(option.id)) {
      throw new Error(`duplicate option id: ${option.id}`);
    }
    seenIds.add(option.id);
  }

  const stateTokens = estimateTokens(packingState(request.need));
  const batches = packBatches(request.options, stateTokens, TOKEN_BUDGET);
  const client = createJudgeClient();

  // Each batch is an independent systemOne call. Scores are merged by option
  // id, then sorted so the caller sees one ranking.
  const failed = new AbortController();
  const signal = request.signal ? AbortSignal.any([request.signal, failed.signal]) : failed.signal;
  const batchResults = await mapPool(batches, concurrency, async (batch) => {
    signal.throwIfAborted();
    try {
      return await judgeBatch(client, request.need, batch, signal);
    } catch (error) {
      failed.abort(error);
      throw error;
    }
  });

  const judgments: Judgment[] = batchResults.flatMap((result) => result.judgments);
  const byId = new Map(judgments.map((judgment) => [judgment.id, judgment]));
  const ordered = request.options
    .map((option) => {
      const judgment = byId.get(option.id);
      if (!judgment) {
        throw new Error(`missing score for ${option.id}`);
      }
      return { option, judgment };
    })
    .sort((left, right) => right.judgment.score - left.judgment.score);

  const matches = ordered.slice(0, topK).map(({ option, judgment }, index) => {
    const match: RankedOption = {
      rank: index + 1,
      id: judgment.id,
      score: judgment.score,
    };
    if (option.contract !== undefined) {
      match.contract = option.contract;
    }
    return match;
  });

  const best = matches[0]?.score ?? 0;
  const inputTokens = batchResults.reduce(
    (sum, result) => sum + result.inputTokens,
    0,
  );
  return {
    need: request.need,
    model: batchResults[0]?.model ?? "unknown",
    status: best >= 0.5 ? "matches" : "no_confident_match",
    matches,
    usage: {
      jevRequests: batchResults.length,
      inputTokens,
      costUsd: inputCostUsd(inputTokens),
    },
  };
}

export function validateRankSettings(need: string, topK = 5, concurrency = DEFAULT_CONCURRENCY): void {
  if (need.trim() === "") {
    throw new Error("provide a non-empty capability need");
  }
  for (const [name, value] of [["topK", topK], ["concurrency", concurrency]] as const) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(`${name} must be a positive integer`);
    }
  }
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workerCount = Math.min(limit, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await fn(items[index]);
      }
    }),
  );
  return results;
}
