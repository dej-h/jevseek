import type { JsonValue } from "@typesafe-ai/sdk";

/** Copy source data into the JSON shape returned to callers. */
export function toJsonValue(value: Record<string, unknown>, origin?: string): Record<string, JsonValue>;
export function toJsonValue(value: unknown, origin?: string): JsonValue;
export function toJsonValue(value: unknown, origin = "OpenAPI"): JsonValue {
  return copy(value, new Set<object>(), origin);
}

function copy(value: unknown, ancestors: Set<object>, origin: string): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value !== "object") {
    throw new Error(`${origin} value is not JSON-compatible: ${typeof value}`);
  }
  if (ancestors.has(value)) {
    throw new Error(`${origin} document contains a cyclic object value`);
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => copy(item, ancestors, origin));
    }
    const result: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) result[key] = copy(child, ancestors, origin);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}
