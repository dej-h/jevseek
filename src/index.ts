import type { JsonValue } from "@typesafe-ai/sdk";
import { rankOptions, validateRankSettings } from "./core/rank.js";
import type { RankedOption, RankResult } from "./core/rank.js";
import { loadOpenApiCatalog } from "./sources/openapi.js";
import type { OpenApiCatalog, OpenApiDescriptorInclude } from "./sources/openapi.js";

export interface DiscoverOptions {
  topK?: number;
  concurrency?: number;
  include?: Partial<OpenApiDescriptorInclude>;
}

export interface DiscoveredOperation extends RankedOption {
  identity: string;
  contract: JsonValue;
}

export interface DiscoverResult {
  need: string;
  model: string;
  source: OpenApiCatalog["source"];
  status: RankResult["status"];
  scan: {
    totalOperations: number;
    examinedOperations: number;
    complete: boolean;
    warnings: string[];
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
  const catalog = await loadOpenApiCatalog(source, options.include);
  const started = performance.now();
  const result = await rankOptions({
    need,
    options: catalog.options,
    topK: options.topK,
    concurrency: options.concurrency,
  });
  const scoreMs = performance.now() - started;
  const matches = result.matches.map((match): DiscoveredOperation => {
    if (match.contract === undefined) {
      throw new Error(`missing source contract for ${match.id}`);
    }
    return {
      ...match,
      identity: `sha256:${catalog.source.sha256}:${match.id}`,
      contract: match.contract,
    };
  });
  const warnings = catalog.options.flatMap((option) => {
    const contract = option.contract;
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
      return [];
    }
    return Array.isArray(contract.warnings)
      ? contract.warnings.filter((warning): warning is string => typeof warning === "string")
        .map((warning) => `${option.id}: ${warning}`)
      : [];
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
      warnings,
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
