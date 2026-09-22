import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio, StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { discover } from "../index.js";
import { loadLocalEnv } from "../env.js";
import { OPENAPI_DESCRIPTOR_FIELDS } from "../sources/openapi.js";
import { readPackageVersion } from "../version.js";
import { SourcePolicy } from "./sources.js";

const DISCOVERY_TIMEOUT_MS = 120_000;
const MAX_RESULT_BYTES = 1024 * 1024;

export function createDiscoveryServer(sources: SourcePolicy, version: string): McpServer {
  const server = new McpServer({ name: "jevseek", version });
  server.registerTool("jevseek_discover", {
    title: "Discover API operations",
    description: "Find API operations or MCP tools that provide your stated capability need. Supply a local OpenAPI file path or direct HTTPS URL to an OpenAPI document or public MCP endpoint; source type is detected automatically. Do not read or paste the whole catalog. Returns ranked original contracts and MCP invocation breadcrumbs. The need and descriptor fields are sent to TypeSafe Jev model. No target operation or tool is executed. A relevance score does not prove authorization or successful execution.",
    inputSchema: z.strictObject({
      source: sources.locations
          ? z.enum(sources.locations).describe("Source restricted by the operator's --allow-source configuration.")
          : z.string().min(1).max(4096).refine((value) => value.trim().length > 0)
            .describe("Local OpenAPI file path, HTTPS OpenAPI document URL, or public remote MCP endpoint. Prefer absolute paths; relative paths resolve from the server's working directory."),
      need: z.string().min(1).max(4000).refine((value) => value.trim().length > 0)
        .describe("State the capability you need. This text is passed to Jev unchanged."),
      top_k: z.number().int().min(1).max(20).default(5),
      include: z.partialRecord(z.enum(OPENAPI_DESCRIPTOR_FIELDS), z.boolean()).optional()
        .describe("Optional descriptor-field overrides, matching the CLI. Returned contracts are unchanged."),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  }, async ({ source, need, top_k, include }, context) => {
    const signal = AbortSignal.any([context.mcpReq.signal, AbortSignal.timeout(DISCOVERY_TIMEOUT_MS)]);
    try {
      const location = await sources.resolve(source);
      const result = await discover(location, need, { topK: top_k, include, signal });
      signal.throwIfAborted();
      const response = {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
        structuredContent: { ...result },
      };
      if (Buffer.byteLength(JSON.stringify(response)) > MAX_RESULT_BYTES) {
        return toolError("Discovery result exceeds the 1 MiB MCP limit. Retry with a smaller top_k or inspect the source using the CLI; no truncated contract was returned.");
      }
      return response;
    } catch (error) {
      return toolError(signal.aborted
        ? "Discovery was cancelled or exceeded its 120-second deadline. No complete result is available."
        : error instanceof Error ? error.message : "Discovery failed.");
    }
  });
  return server;
}

function toolError(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

export async function startStdioServer(allowedSources: string[] = []): Promise<void> {
  const sources = await SourcePolicy.create(allowedSources);
  loadLocalEnv();
  if (!process.env.TYPESAFE_API_KEY?.trim()) {
    throw new Error("Set TYPESAFE_API_KEY in the server environment before starting jevseek serve.");
  }
  const version = await readPackageVersion();
  const handle = serveStdio(() => createDiscoveryServer(sources, version), {
    transport: new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 64 * 1024 }),
    onerror: (error) => console.error(`jevseek MCP: ${error.message}`),
  });
  const shutdown = () => {
    void handle.close().catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "MCP shutdown failed");
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  process.stdin.once("end", shutdown);
}
