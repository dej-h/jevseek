import { rankOptions, validateRankSettings } from "./core/rank.js";
import type { RankResult } from "./core/rank.js";
import { loadCatalog } from "./sources/catalog.js";
import type { McpCatalog } from "./sources/mcp.js";
import type { OpenApiCatalog, OpenApiDescriptorInclude } from "./sources/openapi.js";

export { inspect } from "./inspect.js";
export type { InspectOptions, InspectResult } from "./inspect.js";

export interface DiscoverOptions {
  signal?: AbortSignal;
  topK?: number;
  concurrency?: number;
  include?: Partial<OpenApiDescriptorInclude>;
}

export interface DiscoveredOperation {
  rank: number;
  id: string;
  score: number;
  summary?: string;
  operationId?: string;
}

export interface DiscoverResult {
  need: string;
  model: string;
  source: OpenApiCatalog["source"] | McpCatalog["source"];
  status: RankResult["status"];
  scan: {
    totalOperations: number;
    examinedOperations: number;
    complete: boolean;
    warningCounts: Record<string, number>;
  };
  matches: DiscoveredOperation[];
  usage: RankResult["usage"] & {
    timings: OpenApiCatalog["timings"] & { scoreMs: number };
  };
  contextAccounting: {
    unit: "utf8_bytes";
    source: number;
    descriptors: number;
    returnedMatches: number;
  };
}

/** Discover operations that directly provide the caller's stated capability need. */
export async function discover(
  source: string,
  need: string,
  options: DiscoverOptions = {},
): Promise<DiscoverResult> {
  validateRankSettings(need, options.topK, options.concurrency);
  options.signal?.throwIfAborted();
  const catalog = await loadCatalog(source, options.include, options.signal);
  const started = performance.now();
  const result: RankResult = catalog.options.length === 0 ? {
    need, model: "not_used", status: "no_confident_match", matches: [],
    usage: { jevRequests: 0, inputTokens: 0, costUsd: 0 },
  } : await rankOptions({
    need,
    options: catalog.options,
    topK: options.topK,
    concurrency: options.concurrency,
    signal: options.signal,
  });
  const scoreMs = performance.now() - started;
  const byId = new Map(catalog.options.map((option) => [option.id, option]));
  const matches = result.matches.map((match): DiscoveredOperation => {
    const content = byId.get(match.id)?.content;
    const summary = typeof content === "object" && !Array.isArray(content)
      ? content.summary ?? content.description ?? content.title : undefined;
    const operationId = typeof content === "object" && !Array.isArray(content)
      ? content.operationId : undefined;
    return {
      rank: match.rank, id: match.id, score: match.score,
      ...(typeof summary === "string" ? { summary: summary.slice(0, 240) } : {}),
      ...(typeof operationId === "string" ? { operationId: operationId.slice(0, 120) } : {}),
    };
  });
  return {
    need: result.need,
    model: result.model,
    source: catalog.source,
    status: result.status,
    scan: {
      totalOperations: catalog.options.length,
      examinedOperations: catalog.options.length,
      complete: true,
      warningCounts: catalog.warningCounts,
    },
    matches,
    usage: { ...result.usage, timings: { ...catalog.timings, scoreMs } },
    contextAccounting: {
      unit: "utf8_bytes",
      source: catalog.source.bytes,
      descriptors: Buffer.byteLength(JSON.stringify(catalog.options.map((option) => option.content))),
      returnedMatches: Buffer.byteLength(JSON.stringify(matches)),
    },
  };
}
