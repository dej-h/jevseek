import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio, StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { discover } from "../index.js";
import { inspect } from "../inspect.js";
import { loadLocalEnv } from "../env.js";
import { OPENAPI_DESCRIPTOR_FIELDS } from "../sources/openapi.js";
import { readPackageVersion } from "../version.js";
import { SourcePolicy } from "./sources.js";

const DISCOVERY_TIMEOUT_MS = 120_000;
const MAX_RESULT_BYTES = 256 * 1024;

export function createDiscoveryServer(sources: SourcePolicy, version: string): McpServer {
  const server = new McpServer({ name: "jevseek", version });
  const sourceSchema = sources.locations
    ? z.enum(sources.locations).describe("Source restricted by the operator's --allow-source configuration.")
    : z.string().min(1).max(4096).refine((value) => value.trim().length > 0)
      .describe("Local OpenAPI file path, HTTPS OpenAPI document URL, or public remote MCP endpoint.");
  server.registerTool("jevseek_discover", {
    title: "Discover API operations",
    description: "Find API operations or MCP tools for a capability need. Returns compact ranked source targets. Pass the same source and a target id to jevseek_inspect for current details. The need and descriptor fields are sent to TypeSafe Jev. No target operation or tool is executed.",
    inputSchema: z.strictObject({
      source: sourceSchema,
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
      return toolResult(result);
    } catch (error) {
      return toolError(signal.aborted
        ? "Discovery was cancelled or exceeded its 120-second deadline. No complete result is available."
        : error instanceof Error ? error.message : "Discovery failed.");
    }
  });
  server.registerTool("jevseek_inspect", {
    title: "Inspect an API operation or MCP tool",
    description: "Read the current source and return details for one exact discovery target (METHOD /path or MCP tool name). No Jev call or target execution. For large fields, extend part with a returned child name; offset paginates child names or text.",
    inputSchema: z.strictObject({
      source: sourceSchema,
      target: z.string().min(1).max(4096).describe("Exact target id from discovery, such as POST /v1/invoices/create_preview or an MCP tool name."),
      part: z.array(z.string().max(4096)).max(32).optional()
        .describe("Optional source field names to inspect, such as ['operation','requestBody'] or ['references','#/components/schemas/Invoice']."),
      offset: z.number().int().min(0).optional()
        .describe("For a large field, continue listing children or reading text at this offset."),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  }, async ({ source, target, part, offset }, context) => {
    const signal = AbortSignal.any([context.mcpReq.signal, AbortSignal.timeout(DISCOVERY_TIMEOUT_MS)]);
    try {
      const location = await sources.resolve(source);
      const result = await inspect(location, target, { part, offset, signal });
      signal.throwIfAborted();
      return toolResult(result);
    } catch (error) {
      return toolError(signal.aborted
        ? "Inspection was cancelled or exceeded its 120-second deadline."
        : error instanceof Error ? error.message : "Inspection failed.");
    }
  });
  return server;
}

function toolResult(result: object) {
  const response = {
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
    structuredContent: { ...result },
  };
  if (Buffer.byteLength(JSON.stringify(response)) > MAX_RESULT_BYTES) {
    return toolError("Result exceeds JevSeek's 256 KiB response budget; inspect a narrower part of the current target.");
  }
  return response;
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
