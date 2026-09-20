import { parse as parseYaml } from "yaml";
import type { JsonValue } from "@typesafe-ai/sdk";
import type { RankOption } from "../core/candidates.js";
import { readSourceDocument, type SourceDocument } from "./document.js";

const HTTP_METHODS = new Set([
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
]);

const DESCRIPTION_MAX = 400;
const SCHEMA_DEPTH = 2;
const CONTRACT_REFERENCE_LIMIT = 128;

export const OPENAPI_DESCRIPTOR_FIELDS = [
  "method",
  "path",
  "operationId",
  "summary",
  "tags",
  "description",
  "parameters",
  "requestBody",
  "responses",
  "deprecated",
  "security",
  "servers",
] as const;

export type OpenApiDescriptorField = (typeof OPENAPI_DESCRIPTOR_FIELDS)[number];

/** Which compact descriptor fields to send to Jev. */
export type OpenApiDescriptorInclude = {
  [Field in OpenApiDescriptorField]: boolean;
};

export const DEFAULT_OPENAPI_DESCRIPTOR_INCLUDE: OpenApiDescriptorInclude = {
  method: true,
  path: true,
  operationId: true,
  summary: true,
  tags: true,
  description: false,
  parameters: false,
  requestBody: false,
  responses: false,
  deprecated: false,
  security: false,
  servers: false,
};

export function resolveOpenApiDescriptorInclude(
  include: Partial<OpenApiDescriptorInclude> = {},
): OpenApiDescriptorInclude {
  const resolved = { ...DEFAULT_OPENAPI_DESCRIPTOR_INCLUDE, ...include };
  if (!OPENAPI_DESCRIPTOR_FIELDS.some((field) => resolved[field])) {
    throw new Error("at least one OpenAPI descriptor field must be included");
  }
  return resolved;
}

export function openApiDescriptorIncludeChanged(
  include: OpenApiDescriptorInclude,
): boolean {
  return OPENAPI_DESCRIPTOR_FIELDS.some(
    (field) => include[field] !== DEFAULT_OPENAPI_DESCRIPTOR_INCLUDE[field],
  );
}

export async function loadOpenApiOperations(
  path: string,
  include?: Partial<OpenApiDescriptorInclude>,
): Promise<RankOption[]> {
  return (await loadOpenApiCatalog(path, include)).options;
}

export interface OpenApiCatalog {
  source: {
    kind: "openapi";
    location: string;
    sha256: string;
    bytes: number;
    format: "json" | "yaml";
    openapi: string;
  };
  options: RankOption[];
  timings: { loadMs: number; parseMs: number };
}

export async function loadOpenApiCatalog(
  location: string,
  include?: Partial<OpenApiDescriptorInclude>,
  signal?: AbortSignal,
): Promise<OpenApiCatalog> {
  const start = performance.now();
  const document = await readSourceDocument(location, signal);
  const loaded = performance.now();
  return openApiCatalogFromDocument(document, include, loaded - start, signal);
}

export class NotOpenApiError extends Error {}

export function openApiCatalogFromDocument(
  document: SourceDocument,
  include?: Partial<OpenApiDescriptorInclude>,
  loadMs = 0,
  signal?: AbortSignal,
): OpenApiCatalog {
  const started = performance.now();
  let doc: unknown;
  try {
    doc = parseOpenApiDocument(document.text);
  } catch (cause) {
    throw new NotOpenApiError("Source is not a valid OpenAPI document", { cause });
  }
  if (!isPlainObject(doc) || typeof doc.openapi !== "string") {
    throw new NotOpenApiError("not an OpenAPI document");
  }
  const options = operationsFromOpenApi(doc, include, document.location);
  signal?.throwIfAborted();
  if (!isPlainObject(doc) || typeof doc.openapi !== "string") {
    throw new Error("not an OpenAPI document");
  }
  return {
    source: {
      kind: "openapi",
      location: document.location,
      sha256: document.sha256,
      bytes: document.bytes,
      format: /^[\s]*[\[{]/.test(document.text) ? "json" : "yaml",
      openapi: doc.openapi,
    },
    options,
    timings: { loadMs, parseMs: performance.now() - started },
  };
}

function parseOpenApiDocument(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(raw) as unknown;
  }
  return parseYaml(raw);
}

/** Compact descriptors. Local `#/` $refs are resolved with a depth cap. */
export function operationsFromOpenApi(
  doc: unknown,
  include?: Partial<OpenApiDescriptorInclude>,
  source = "inline",
): RankOption[] {
  if (!isPlainObject(doc) || !isPlainObject(doc.paths)) {
    throw new Error("not an OpenAPI document with paths");
  }
  const version = typeof doc.openapi === "string" ? doc.openapi : "";
  if (!/^3\.[01]\.\d+$/.test(version)) {
    throw new Error("only OpenAPI 3.0 and 3.1 are supported");
  }
  const fields = resolveOpenApiDescriptorInclude(include);

  const options: RankOption[] = [];
  for (const [path, item] of Object.entries(doc.paths)) {
    if (path.startsWith("x-")) {
      continue;
    }
    if (!isPlainObject(item)) {
      throw new Error(`invalid Path Item at ${path}`);
    }
    if (typeof item.$ref === "string") {
      throw new Error(`referenced Path Item at ${path} is not supported; bundle it inline before discovery`);
    }
    for (const [method, operation] of Object.entries(item)) {
      if (!HTTP_METHODS.has(method)) {
        continue;
      }
      if (!isPlainObject(operation)) {
        throw new Error(`invalid operation at ${method.toUpperCase()} ${path}`);
      }
      const methodUpper = method.toUpperCase();
      const content: { [key: string]: JsonValue } = {};
      if (fields.method) {
        content.method = methodUpper;
      }
      if (fields.path) {
        content.path = path;
      }
      if (fields.operationId && typeof operation.operationId === "string") {
        content.operationId = operation.operationId;
      }
      if (fields.summary && typeof operation.summary === "string") {
        content.summary = operation.summary;
      }
      if (
        fields.tags &&
        Array.isArray(operation.tags) &&
        operation.tags.every((tag) => typeof tag === "string")
      ) {
        content.tags = operation.tags;
      }
      if (fields.description && typeof operation.description === "string") {
        content.description = truncate(operation.description, DESCRIPTION_MAX);
      }
      if (fields.parameters) {
        const parameters = compactParameters(doc, item, operation);
        if (parameters) {
          content.parameters = parameters;
        }
      }
      if (fields.requestBody && operation.requestBody !== undefined) {
        const requestBody = compactRequestBody(doc, operation.requestBody);
        if (requestBody) {
          content.requestBody = requestBody;
        }
      }
      if (fields.responses && isPlainObject(operation.responses)) {
        const responses = compactResponses(doc, operation.responses);
        if (responses) {
          content.responses = responses;
        }
      }
      if (fields.deprecated && operation.deprecated === true) {
        content.deprecated = true;
      }
      if (fields.security) {
        const security = compactSecurity(
          operation.security !== undefined ? operation.security : doc.security,
        );
        if (security) {
          content.security = security;
        }
      }
      if (fields.servers) {
        const servers = compactServers(operation.servers, item.servers, doc.servers);
        if (servers) {
          content.servers = servers;
        }
      }
      options.push({
        id: `${methodUpper} ${path}`,
        content,
        contract: buildOperationContract(doc, source, path, method, item, operation),
      });
    }
  }
  if (options.length === 0) {
    throw new Error("OpenAPI document has no operations");
  }
  return options;
}

function buildOperationContract(
  doc: { [key: string]: unknown },
  source: string,
  path: string,
  method: string,
  pathItem: { [key: string]: unknown },
  operation: { [key: string]: unknown },
): JsonValue {
  const inherited: { [key: string]: JsonValue } = {};
  const referenceRoots: unknown[] = [operation];

  if (Array.isArray(pathItem.parameters)) {
    inherited.parameters = toJsonValue(pathItem.parameters);
    referenceRoots.push(pathItem.parameters);
  }
  if (operation.security === undefined && doc.security !== undefined) {
    inherited.security = toJsonValue(doc.security);
    referenceRoots.push(doc.security);
  }
  if (operation.servers === undefined) {
    const servers = pathItem.servers ?? doc.servers;
    if (servers !== undefined) {
      inherited.servers = toJsonValue(servers);
      referenceRoots.push(servers);
    }
  }

  const closure = collectLocalReferenceClosure(doc, referenceRoots);
  const contract: { [key: string]: JsonValue } = {
    source,
    sourcePointer: `#/paths/${escapeJsonPointer(path)}/${method}`,
    method: method.toUpperCase(),
    path,
    operation: toJsonValue(operation),
    references: closure.references,
    contractComplete: closure.warnings.length === 0,
  };
  if (Object.keys(inherited).length > 0) {
    contract.inherited = inherited;
  }
  if (closure.warnings.length > 0) {
    contract.warnings = closure.warnings;
  }
  return contract;
}

function collectLocalReferenceClosure(
  doc: unknown,
  roots: unknown[],
): {
  references: { [key: string]: JsonValue };
  warnings: string[];
} {
  const references: { [key: string]: JsonValue } = {};
  const warnings: string[] = [];
  const seenRefs = new Set<string>();
  const seenObjects = new WeakSet<object>();
  let limitReported = false;

  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null) {
      return;
    }
    if (seenObjects.has(value)) {
      return;
    }
    seenObjects.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    if (isPlainObject(value) && typeof value.$ref === "string") {
      const ref = value.$ref;
      if (!ref.startsWith("#/")) {
        warnings.push(`external reference is not resolved: ${ref}`);
      } else if (!seenRefs.has(ref)) {
        if (seenRefs.size >= CONTRACT_REFERENCE_LIMIT) {
          if (!limitReported) {
            warnings.push(
              `local reference closure exceeds ${String(CONTRACT_REFERENCE_LIMIT)} entries`,
            );
            limitReported = true;
          }
        } else {
          seenRefs.add(ref);
          const resolved = getJsonPointer(doc, ref);
          if (resolved === undefined) {
            warnings.push(`local reference could not be resolved: ${ref}`);
          } else {
            references[ref] = toJsonValue(resolved);
            visit(resolved);
          }
        }
      }
    }

    for (const child of Object.values(value)) {
      visit(child);
    }
  };

  for (const root of roots) {
    visit(root);
  }
  return { references, warnings: [...new Set(warnings)] };
}

function toJsonValue(value: unknown, ancestors = new Set<object>()): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }
  if (typeof value !== "object") {
    throw new Error(`OpenAPI value is not JSON-compatible: ${typeof value}`);
  }
  if (ancestors.has(value)) {
    throw new Error("OpenAPI document contains a cyclic object value");
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item, nextAncestors));
  }

  const result: { [key: string]: JsonValue } = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) {
      result[key] = toJsonValue(child, nextAncestors);
    }
  }
  return result;
}

function escapeJsonPointer(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function compactParameters(
  doc: unknown,
  pathItem: { [key: string]: unknown },
  operation: { [key: string]: unknown },
): JsonValue[] | undefined {
  const byKey = new Map<string, JsonValue>();
  for (const list of [pathItem.parameters, operation.parameters]) {
    if (!Array.isArray(list)) {
      continue;
    }
    for (const item of list) {
      const parameter = compactParameter(doc, item);
      if (!parameter || !isPlainObject(parameter)) {
        continue;
      }
      const name = typeof parameter.name === "string" ? parameter.name : "";
      const location = typeof parameter.in === "string" ? parameter.in : "";
      byKey.set(`${location}:${name}`, parameter);
    }
  }
  return byKey.size > 0 ? [...byKey.values()] : undefined;
}

function compactParameter(doc: unknown, value: unknown): JsonValue | undefined {
  const resolved = resolveLocalRef(doc, value);
  if (!isPlainObject(resolved) || typeof resolved.name !== "string") {
    if (isPlainObject(value) && typeof value.$ref === "string") {
      return { $ref: value.$ref };
    }
    return undefined;
  }
  const parameter: { [key: string]: JsonValue } = { name: resolved.name };
  if (typeof resolved.in === "string") {
    parameter.in = resolved.in;
  }
  if (resolved.required === true || resolved.in === "path") {
    parameter.required = true;
  }
  const schema = compactSchema(doc, resolved.schema, 0);
  if (isPlainObject(schema)) {
    if (schema.type !== undefined) {
      parameter.type = schema.type;
    }
    if (schema.format !== undefined) {
      parameter.format = schema.format;
    }
    if (schema.enum !== undefined) {
      parameter.enum = schema.enum;
    }
    if (schema.items !== undefined) {
      parameter.items = schema.items;
    }
  }
  return parameter;
}

function compactRequestBody(doc: unknown, value: unknown): JsonValue | undefined {
  const resolved = resolveLocalRef(doc, value);
  if (!isPlainObject(resolved)) {
    return undefined;
  }
  const body: { [key: string]: JsonValue } = {};
  if (resolved.required === true) {
    body.required = true;
  }
  if (typeof resolved.description === "string") {
    body.description = truncate(resolved.description, DESCRIPTION_MAX);
  }
  const content = compactMediaContent(doc, resolved.content);
  if (content) {
    body.content = content;
  }
  return Object.keys(body).length > 0 ? body : undefined;
}

function compactResponses(
  doc: unknown,
  responses: { [key: string]: unknown },
): JsonValue | undefined {
  const out: { [key: string]: JsonValue } = {};
  for (const [code, value] of Object.entries(responses)) {
    const resolved = resolveLocalRef(doc, value);
    if (!isPlainObject(resolved)) {
      if (isPlainObject(value) && typeof value.$ref === "string") {
        out[code] = { $ref: value.$ref };
      }
      continue;
    }
    const response: { [key: string]: JsonValue } = {};
    if (typeof resolved.description === "string") {
      response.description = truncate(resolved.description, DESCRIPTION_MAX);
    }
    const content = compactMediaContent(doc, resolved.content);
    if (content) {
      response.content = content;
    }
    out[code] = Object.keys(response).length > 0 ? response : { description: code };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function compactMediaContent(doc: unknown, value: unknown): JsonValue | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const content: { [key: string]: JsonValue } = {};
  for (const [mediaType, media] of Object.entries(value)) {
    if (!isPlainObject(media)) {
      continue;
    }
    const schema = compactSchema(doc, media.schema, 0);
    content[mediaType] = schema ?? true;
  }
  return Object.keys(content).length > 0 ? content : undefined;
}

function compactSchema(doc: unknown, value: unknown, depth: number): JsonValue | undefined {
  if (value === undefined || depth > SCHEMA_DEPTH) {
    return undefined;
  }
  const resolved = resolveLocalRef(doc, value);
  if (!isPlainObject(resolved)) {
    return undefined;
  }
  const schema: { [key: string]: JsonValue } = {};
  if (typeof resolved.type === "string") {
    schema.type = resolved.type;
  } else {
    const types = stringArray(resolved.type);
    if (types) {
      schema.type = types;
    }
  }
  if (typeof resolved.format === "string") {
    schema.format = resolved.format;
  }
  const enums = jsonScalarArray(resolved.enum);
  if (enums && enums.length <= 24) {
    schema.enum = enums;
  }
  const required = stringArray(resolved.required);
  if (required) {
    schema.required = required;
  }
  if (isPlainObject(resolved.properties)) {
    if (depth === 0) {
      const properties: { [key: string]: JsonValue } = {};
      for (const [name, property] of Object.entries(resolved.properties)) {
        properties[name] = compactProperty(doc, property);
      }
      schema.properties = properties;
    } else {
      schema.properties = Object.keys(resolved.properties);
    }
  }
  if (resolved.items !== undefined) {
    const items = compactSchema(doc, resolved.items, depth + 1);
    if (items) {
      schema.items = items;
    }
  }
  return Object.keys(schema).length > 0 ? schema : undefined;
}

function compactProperty(doc: unknown, value: unknown): JsonValue {
  const resolved = resolveLocalRef(doc, value);
  if (!isPlainObject(resolved)) {
    return true;
  }
  const property: { [key: string]: JsonValue } = {};
  if (typeof resolved.type === "string") {
    property.type = resolved.type;
  }
  const enums = jsonScalarArray(resolved.enum);
  if (enums && enums.length <= 24) {
    property.enum = enums;
  }
  return Object.keys(property).length > 0 ? property : true;
}

function compactSecurity(value: unknown): JsonValue | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const schemes: string[] = [];
  for (const requirement of value) {
    if (!isPlainObject(requirement)) {
      continue;
    }
    for (const [name, scopes] of Object.entries(requirement)) {
      const scopeList = stringArray(scopes);
      schemes.push(scopeList && scopeList.length > 0 ? `${name}:${scopeList.join(",")}` : name);
    }
  }
  return schemes;
}

function compactServers(
  operationServers: unknown,
  pathServers: unknown,
  docServers: unknown,
): JsonValue | undefined {
  for (const candidate of [operationServers, pathServers, docServers]) {
    if (!Array.isArray(candidate)) {
      continue;
    }
    const urls = candidate.flatMap((server) =>
      isPlainObject(server) && typeof server.url === "string" ? [server.url] : [],
    );
    if (urls.length > 0) {
      return urls;
    }
  }
  return undefined;
}

function resolveLocalRef(doc: unknown, value: unknown): unknown {
  const seen = new Set<string>();
  let current = value;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!isPlainObject(current) || typeof current.$ref !== "string") {
      return current;
    }
    const ref = current.$ref;
    if (!ref.startsWith("#/") || seen.has(ref)) {
      return current;
    }
    seen.add(ref);
    const next = getJsonPointer(doc, ref);
    if (next === undefined) {
      return current;
    }
    current = next;
  }
  return current;
}

function getJsonPointer(doc: unknown, ref: string): unknown {
  const parts = ref
    .slice(2)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current: unknown = doc;
  for (const part of parts) {
    if (Array.isArray(current) && /^\d+$/.test(part)) {
      current = current[Number(part)];
      continue;
    }
    if (!isPlainObject(current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return undefined;
  }
  return value;
}

function jsonScalarArray(value: unknown): JsonValue[] | undefined {
  if (
    !Array.isArray(value) ||
    !value.every(
      (item) =>
        item === null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean",
    )
  ) {
    return undefined;
  }
  return value;
}

function isPlainObject(value: unknown): value is { [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
