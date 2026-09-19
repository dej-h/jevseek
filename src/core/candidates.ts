import type { JsonValue } from "@typesafe-ai/sdk";
import { QUESTION_OVERHEAD_TOKENS } from "./packing.js";

/** One option Jev can score: a string, a list of strings, or a JSON object. */
export type OptionContent = string | string[] | { [key: string]: JsonValue };

export interface RankOption {
  id: string;
  content: OptionContent;
  /** Source-backed data returned to the caller, but never sent to Jev. */
  contract?: JsonValue;
}

/**
 * Jev has not published its tokenizer. English is often ~4 chars/token;
 * the JSON we send (paths, punctuation, keys) is denser, typically 2–3.
 * 2.5 overestimates slightly so packing stays under TypeSafe's 64k/32k.
 */
const CHARS_PER_TOKEN = 2.5;

export function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / CHARS_PER_TOKEN);
}

export function estimateQuestionTokens(option: RankOption): number {
  return estimateTokens(option.content) + QUESTION_OVERHEAD_TOKENS;
}

function isPlainObject(value: unknown): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionContent(value: unknown): value is OptionContent {
  if (typeof value === "string") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === "string");
  }
  return isPlainObject(value);
}

function isRankOption(value: unknown): value is RankOption {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    isOptionContent(value.content)
  );
}

/** Accept a list of strings, JSON values, or `{ id, content }` objects. */
export function normalizeOptions(input: unknown): RankOption[] {
  const list = unwrapOptions(input);
  return list.map((item, index) => {
    if (isRankOption(item)) {
      return item;
    }
    if (!isOptionContent(item)) {
      throw new Error(
        `option ${String(index)} must be a string, a list of strings, or a JSON object`,
      );
    }
    return { id: `opt_${String(index)}`, content: item };
  });
}

function unwrapOptions(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }
  if (isPlainObject(input) && Array.isArray(input.options)) {
    return input.options;
  }
  throw new Error("options must be a JSON array, or an object with an options array");
}

export function packBatches(
  options: RankOption[],
  stateTokens: number,
  budget: { total: number; statePlusLongest: number },
): RankOption[][] {
  const batches: RankOption[][] = [];
  let current: RankOption[] = [];
  let currentTotal = stateTokens;

  const flush = (): void => {
    if (current.length > 0) {
      batches.push(current);
      current = [];
      currentTotal = stateTokens;
    }
  };

  for (const option of options) {
    const questionTokens = estimateQuestionTokens(option);
    if (stateTokens + questionTokens > budget.statePlusLongest) {
      throw new Error(
        `option ${option.id} exceeds Jev's state-plus-longest budget on its own`,
      );
    }

    const longest = Math.max(
      ...current.map((item) => estimateQuestionTokens(item)),
      questionTokens,
    );
    const nextTotal = currentTotal + questionTokens;
    const fits =
      current.length === 0 ||
      (nextTotal <= budget.total &&
        stateTokens + longest <= budget.statePlusLongest);

    if (!fits) {
      flush();
    }
    current.push(option);
    currentTotal += questionTokens;
  }
  flush();
  return batches;
}
