import type { JsonValue } from "@typesafe-ai/sdk";
import type { McpCatalog } from "./mcp.js";
import type { OpenApiCatalog } from "./openapi.js";
import { previewOpenApiDocument } from "./openapi.js";

const MAX_MCP_SCHEMA_BYTES = 12 * 1024;
const MAX_PREVIEW_BYTES = 16 * 1024;

/** Preview from the source snapshot just ranked, without a second read or connection. */
export function previewTarget(catalog: OpenApiCatalog | McpCatalog, target: string): JsonValue {
  const preview = "document" in catalog
    ? previewOpenApiDocument(catalog.document, target)
    : previewMcpTarget(catalog, target);
  if (Buffer.byteLength(JSON.stringify(preview)) > MAX_PREVIEW_BYTES) {
    return {
      inspectPart: [],
      reason: "Contract preview exceeds 16 KiB; inspect the selected target for details.",
    };
  }
  return preview;
}

function previewMcpTarget(catalog: McpCatalog, target: string): JsonValue {
  const selected = catalog.options.find((option) => option.id === target);
  if (!selected || typeof selected.content !== "object" || Array.isArray(selected.content)) {
    throw new Error(`target not found in current source: ${target}; rediscover the source`);
  }
  const content = selected.content;
  const preview: { [key: string]: JsonValue } = { name: target };
  if (typeof content.title === "string") preview.title = content.title;
  if (typeof content.description === "string") preview.description = content.description.slice(0, 400);
  const schema = content.inputSchema;
  if (schema !== undefined) {
    preview.inputSchema = Buffer.byteLength(JSON.stringify(schema)) <= MAX_MCP_SCHEMA_BYTES
      ? schema
      : compactSchemaOutline(schema);
  }
  return preview;
}

function compactSchemaOutline(schema: JsonValue): JsonValue {
  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    return { inspectPart: ["tool", "inputSchema"], reason: "input schema exceeds compact preview" };
  }
  const required = Array.isArray(schema.required)
    ? schema.required.filter((name): name is string => typeof name === "string")
    : [];
  const properties = typeof schema.properties === "object" && schema.properties !== null
    && !Array.isArray(schema.properties) ? Object.keys(schema.properties) : [];
  return {
    required,
    propertyNames: properties,
    inspectPart: ["tool", "inputSchema"],
    reason: "input schema exceeds compact preview",
  };
}
