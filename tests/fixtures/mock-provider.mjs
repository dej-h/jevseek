// Preload only in CLI tests. Every network call is intercepted.
import { readFile } from "node:fs/promises";

process.env.TYPESAFE_API_KEY = "test-key";
process.env.TYPESAFE_BASE_URL = "https://provider.test";
process.env.TYPESAFE_LOG_LEVEL = "warn";
globalThis.fetch = async (url, init) => {
  if (String(url) === "https://catalog.test/openapi.json") {
    return new Response(await readFile(new URL("./discover.json", import.meta.url), "utf8"));
  }
  if (String(url) !== "https://provider.test/v1/systemone") {
    throw new Error("unexpected test request");
  }
  if (process.env.JEVSEEK_TEST_PROVIDER_FAILURE === "1") {
    return Response.json({ message: "fixture authentication failure" }, { status: 401 });
  }
  const request = JSON.parse(init.body);
  const answers = Object.fromEntries(Object.entries(request.questions).map(([key, question]) => [
    key,
    { type: "noul", noul: question.instructions.path.endsWith("/files") ? 0.96 : 0.05 },
  ]));
  return Response.json({ model: "fixture-model", answers, usage: { input_tokens: 100, output_tokens: 0 } });
};
