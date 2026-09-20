import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { RankOption } from "./candidates.js";
import { loadLocalEnv } from "../env.js";
import { packingQuestion, packingState } from "./packing.js";

export interface Judgment {
  id: string;
  score: number;
  model: string;
  inputTokens: number;
}

export interface JudgeBatchResult {
  judgments: Judgment[];
  model: string;
  inputTokens: number;
}

export function createJudgeClient(): TypeSafeClient {
  loadLocalEnv();
  return new TypeSafeClient({ logger: {
    debug: (message, ...args) => console.error(message, ...args),
    info: (message, ...args) => console.error(message, ...args),
    warn: (message, ...args) => console.error(message, ...args),
    error: (message, ...args) => console.error(message, ...args),
  } });
}

export async function judgeBatch(
  client: TypeSafeClient,
  need: string,
  options: RankOption[],
  signal?: AbortSignal,
): Promise<JudgeBatchResult> {
  if (options.length === 0) {
    throw new Error("judgeBatch requires at least one option");
  }

  const questions: Record<string, ReturnType<typeof packingQuestion>> = {};
  for (const [index, option] of options.entries()) {
    questions[`opt_${String(index)}`] = packingQuestion(option.content);
  }

  const response = await client.systemOne(
    {
      state: packingState(need),
      questions,
    },
    { timeout: 60_000, signal },
  );

  const perQuestion = Math.ceil(response.usage.input_tokens / options.length);
  const judgments = options.map((option, index) => {
    const answer = response.answers[`opt_${String(index)}`];
    if (answer.type !== "noul") {
      throw new Error(`expected noul for ${option.id}, got ${answer.type}`);
    }
    return {
      id: option.id,
      score: answer.noul,
      model: response.model,
      inputTokens: perQuestion,
    };
  });

  return {
    judgments,
    model: response.model,
    inputTokens: response.usage.input_tokens,
  };
}
