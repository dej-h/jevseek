import { noul } from "@typesafe-ai/sdk";
import type { EntryType } from "@typesafe-ai/sdk";

/** jev-1.13.0 list price, 19 September 2026. Output tokens are free. */
export const INPUT_USD_PER_MILLION = 0.042;

export const RUBRIC =
  "Does the operation in this question directly provide the capability in need? Related subject matter alone is not a match.";

export const MATCH_YES = "Direct match for the requested capability";
export const MATCH_NO = "Not a direct match";

/**
 * Tokens for `{"type":"noul","instructions":...}` beyond the option JSON.
 * Compact noul envelope is ~30 tokens at 2.5 chars/token, plus a little headroom.
 */
export const QUESTION_OVERHEAD_TOKENS = 30;

export function packingState(need: string): { [key: string]: string } {
  return {
    need,
    rubric: RUBRIC,
    yes: MATCH_YES,
    no: MATCH_NO,
  };
}

export function packingQuestion(content: EntryType): ReturnType<typeof noul> {
  return noul(content);
}

export function inputCostUsd(inputTokens: number): number {
  return (inputTokens / 1_000_000) * INPUT_USD_PER_MILLION;
}
