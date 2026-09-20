// Preload only in CLI tests. Every network call is intercepted.
import { readFile } from "node:fs/promises";

process.env.TYPESAFE_API_KEY = "test-key";
process.env.TYPESAFE_BASE_URL = "https://provider.test";
process.env.TYPESAFE_LOG_LEVEL ??= "warn";
globalThis.fetch = async (url, init) => {
  if (String(url) === "https://catalog.test/mcp") {
    if (!init?.body) return new Response(null, { status: 405 });
    const request = JSON.parse(init.body);
    const reply = (result) => Response.json({ jsonrpc: "2.0", id: request.id, result });
    if (request.method === "server/discover") return Response.json({ jsonrpc: "2.0", id: request.id,
      error: { code: -32601, message: "Unknown method" } });
    if (request.method === "initialize") return reply({ protocolVersion: "2025-11-25",
      serverInfo: { name: "fixture", version: "1" }, capabilities: { tools: {} } });
    if (request.method === "notifications/initialized") return new Response(null, { status: 202 });
    if (request.method === "tools/list") return reply({ tools: [{ name: "list_files",
      description: "List filenames and change metadata for a pull request", inputSchema: {
        type: "object", properties: { number: { type: "integer" } }, required: ["number"],
      } }] });
    throw new Error(`Unexpected MCP method: ${request.method}`);
  }
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
  if (request.state.need === "I need a slow discovery for cancellation testing") {
    console.error("fixture request started");
    await new Promise((resolve, reject) => {
      const abort = () => {
        console.error("fixture request aborted");
        reject(init.signal.reason);
      };
      if (init.signal.aborted) abort();
      else init.signal.addEventListener("abort", abort, { once: true });
    });
  }
  const answers = Object.fromEntries(Object.entries(request.questions).map(([key, question]) => [
    key,
    { type: "noul", noul: request.state.need.includes("not provide") ? 0.05 : (question.instructions.path?.endsWith("/files") || question.instructions.name === "list_files") ? 0.96 : 0.05 },
  ]));
  return Response.json({ model: "fixture-model", answers, usage: { input_tokens: 100, output_tokens: 0 } });
};
