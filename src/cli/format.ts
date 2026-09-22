import type { JsonValue } from "@typesafe-ai/sdk";
import type { RankResult, RankedOption } from "../core/rank.js";
import type { DiscoverResult } from "../index.js";

const IDENTITY_LIMIT = 240;
const DESCRIPTION_LIMIT = 120;

type JsonObject = { [key: string]: JsonValue };

function asObject(value: JsonValue | undefined): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : undefined;
}

function asString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function boundedText(value: string | undefined, limit: number): string | undefined {
  if (value === undefined) return undefined;
  const singleLine = value
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, " ")
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (singleLine.length === 0) return undefined;
  return singleLine.length <= limit
    ? singleLine
    : `${singleLine.slice(0, limit - 1)}…`;
}

function formatMatch(match: RankedOption): string {
  const contract = asObject(match.contract);
  const operation = asObject(contract?.operation);
  const method = asString(contract?.method);
  const path = asString(contract?.path);
  const tool = asObject(contract?.tool);

  let identity = match.id;
  let description: string | undefined;
  if (method !== undefined && path !== undefined) {
    const operationId = asString(operation?.operationId);
    identity = `${method} ${path}${operationId === undefined ? "" : ` (${operationId})`}`;
    description = asString(operation?.summary);
  } else {
    const toolName = asString(tool?.name);
    if (toolName !== undefined) {
      identity = `MCP tool ${toolName}`;
      description = asString(tool?.description);
    }
  }

  const boundedIdentity = boundedText(identity, IDENTITY_LIMIT) ?? "(unnamed match)";
  const summary = boundedText(description, DESCRIPTION_LIMIT);
  return `[${match.score.toFixed(2)}] ${boundedIdentity}${summary === undefined ? "" : `: ${summary}`}`;
}

function isDiscoverResult(result: RankResult | DiscoverResult): result is DiscoverResult {
  return "scan" in result;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

function formatCost(costUsd: number): string {
  if (costUsd === 0) return "0";
  return costUsd.toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
}

/** Format ranked matches for humans without printing their complete source contracts. */
export function formatShortResult(result: RankResult | DiscoverResult): string {
  const lines = [`Status: ${result.status}`];
  if (isDiscoverResult(result)) {
    const noun = result.source.kind === "mcp" ? "tool" : "operation";
    lines.push(`Scanned: ${result.scan.totalOperations} ${plural(result.scan.totalOperations, noun)}`);
  }

  if (result.matches.length === 0) {
    lines.push("Matches: none");
  } else {
    lines.push("Matches:");
    for (const match of result.matches) {
      lines.push(`  ${match.rank}. ${formatMatch(match)}`);
    }
  }

  const { jevRequests, inputTokens, costUsd } = result.usage;
  lines.push(
    `Usage: ${jevRequests} Jev ${plural(jevRequests, "request")}, ${inputTokens} input ${plural(inputTokens, "token")}, $${formatCost(costUsd)}`,
  );
  return lines.join("\n");
}
