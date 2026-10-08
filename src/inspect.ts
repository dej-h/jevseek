import type { JsonValue } from "@typesafe-ai/sdk";
import { readSourceDocument, SourceHttpError, StreamingSourceError } from "./sources/document.js";
import { inspectOpenApiDocument, NotOpenApiError } from "./sources/openapi.js";
import { AuthenticationRequiredError, loadMcpCatalog } from "./sources/mcp.js";

const VALUE_BUDGET_BYTES = 48 * 1024;
const CHILD_BUDGET_BYTES = 16 * 1024;

export interface InspectOptions {
  signal?: AbortSignal;
  part?: string[];
  offset?: number;
}

export interface InspectResult {
  source: string;
  target: string;
  part: string[];
  value?: JsonValue;
  children?: string[];
  totalChildren?: number;
  nextOffset?: number;
  textLength?: number;
  textChunk?: string;
  hint?: string;
}

/** Read the current source and retrieve one exact operation or MCP tool. */
export async function inspect(source: string, target: string, options: InspectOptions = {}): Promise<InspectResult> {
  const signal = AbortSignal.any([AbortSignal.timeout(30_000), ...(options.signal ? [options.signal] : [])]);
  signal.throwIfAborted();
  let value: JsonValue;
  let documentError: unknown;
  try {
    const document = await readSourceDocument(source, signal);
    value = inspectOpenApiDocument(document, target, options.part);
    return project(document.location, target, value, options);
  } catch (error) {
    if (error instanceof SourceHttpError && [401, 403].includes(error.status)) {
      throw new AuthenticationRequiredError();
    }
    const probeMcp = source.startsWith("https://") && (error instanceof NotOpenApiError
      || error instanceof StreamingSourceError
      || (error instanceof SourceHttpError && [404, 405, 406, 415].includes(error.status)));
    if (!probeMcp) throw error;
    documentError = error;
  }
  signal.throwIfAborted();
  let catalog;
  try {
    catalog = await loadMcpCatalog(source, signal, target);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError || signal.aborted) throw error;
    throw new Error(`Source detection failed: ${documentError instanceof Error ? documentError.message : "not OpenAPI"}; MCP: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  const tool = catalog.options.find((option) => option.id === target);
  if (!tool?.contract) throw new Error(`target not found in current source: ${target}; rediscover the source`);
  return project(catalog.source.location, target, tool.contract, options);
}

function project(source: string, target: string, contract: JsonValue, options: InspectOptions): InspectResult {
  const part = options.part ?? [];
  const offset = options.offset ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("offset must be a non-negative integer");

  let selected: JsonValue = contract;
  for (const key of part) {
    if (Array.isArray(selected) && /^(0|[1-9]\d*)$/.test(key)) {
      selected = selected[Number(key)] as JsonValue;
    } else if (typeof selected === "object" && selected !== null && !Array.isArray(selected)
      && Object.hasOwn(selected, key)) {
      selected = selected[key] as JsonValue;
    } else {
      throw new Error(`part not found in current target: ${[...part].join(" / ")}`);
    }
    if (selected === undefined) throw new Error(`part not found in current target: ${part.join(" / ")}`);
  }

  // The first inspection shows the operation and source reference names, not every definition.
  if (part.length === 0 && typeof selected === "object" && selected !== null && !Array.isArray(selected)
    && typeof selected.references === "object" && selected.references !== null && !Array.isArray(selected.references)) {
    const { references, ...rest } = selected;
    const names = Object.keys(references);
    selected = { ...rest, references: {
      count: names.length,
      names: names.slice(0, 50),
      ...(names.length > 50 ? { nextOffset: 50 } : {}),
    } };
  }

  const base: InspectResult = { source, target, part };
  if (Buffer.byteLength(JSON.stringify(selected)) <= VALUE_BUDGET_BYTES) {
    return { ...base, value: selected };
  }
  if (typeof selected === "string") {
    if (offset >= selected.length) throw new Error("offset exceeds text length");
    if (offset > 0 && /[\uDC00-\uDFFF]/.test(selected[offset])) {
      throw new Error("offset must start at a complete Unicode character");
    }
    let end = Math.min(selected.length, offset + 8000);
    while (Buffer.byteLength(selected.slice(offset, end)) > CHILD_BUDGET_BYTES) end -= 1;
    if (end < selected.length && /[\uD800-\uDBFF]/.test(selected[end - 1])) end -= 1;
    return { ...base, textLength: selected.length, textChunk: selected.slice(offset, end),
      ...(end < selected.length ? { nextOffset: end } : {}),
      hint: "Repeat inspect with the same part and nextOffset." };
  }
  const keys = Array.isArray(selected) ? selected.map((_, index) => String(index))
    : typeof selected === "object" && selected !== null ? Object.keys(selected) : [];
  const children: string[] = [];
  for (let index = offset; index < keys.length && children.length < 100; index++) {
    if (Buffer.byteLength(JSON.stringify([...children, keys[index]])) > CHILD_BUDGET_BYTES) break;
    children.push(keys[index]);
  }
  if (children.length === 0 && offset < keys.length) {
    throw new Error("source field name is too large to inspect within the response budget");
  }
  return { ...base, children, totalChildren: keys.length,
    ...(offset + children.length < keys.length ? { nextOffset: offset + children.length } : {}),
    hint: "Repeat inspect with part extended by a child name; use nextOffset to list more children." };
}
