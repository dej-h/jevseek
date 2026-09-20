import { createHash } from "node:crypto";
import { Client, StreamableHTTPClientTransport, type Tool } from "@modelcontextprotocol/client";
import type { JsonValue } from "@typesafe-ai/sdk";
import type { RankOption } from "../core/candidates.js";

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_PAGES = 1000;
const MAX_TOOLS = 10_000;

export class AuthenticationRequiredError extends Error {
  readonly code = "authentication_required";
  constructor() {
    super("Authentication required by source; only public unauthenticated discovery is supported.");
  }
}

export interface McpCatalog {
  source: {
    kind: "mcp";
    location: string;
    sha256: string;
    bytes: number;
    transport: "streamable-http";
    server: { name: string; version: string };
  };
  options: RankOption[];
  timings: { loadMs: number; parseMs: number };
}

/** Enumerate metadata only. Never register handlers for sampling or call target tools. */
export async function loadMcpCatalog(location: string, signal: AbortSignal): Promise<McpCatalog> {
  const started = performance.now();
  const url = new URL(location);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error("MCP URLs must use HTTPS without credentials or a fragment");
  }
  let receivedBytes = 0;
  let authenticationRequired = false;
  let cleanupSignal: AbortSignal | undefined;
  const transport = new StreamableHTTPClientTransport(url, {
    reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 1000, maxReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 },
    fetch: async (input, init) => {
      const requestSignal = cleanupSignal ?? signal;
      const response = await fetch(input, { ...init, redirect: "manual", signal: init?.signal
        ? AbortSignal.any([requestSignal, init.signal]) : requestSignal });
      if (response.status === 401 || response.status === 403) {
        authenticationRequired = true;
        await response.body?.cancel();
        throw new AuthenticationRequiredError();
      }
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        throw new Error("MCP source redirects are not followed; supply the direct endpoint URL");
      }
      if (Number(response.headers.get("content-length")) > MAX_BYTES) {
        await response.body?.cancel();
        throw new Error("MCP source exceeds the 64 MiB limit");
      }
      if (!response.body) return response;
      const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          receivedBytes += chunk.byteLength;
          if (receivedBytes > MAX_BYTES) throw new Error("MCP source exceeds the 64 MiB limit");
          controller.enqueue(chunk);
        },
      }));
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    },
  });
  const client = new Client({ name: "jevseek-discovery", version: "1.0.0" }, {
    versionNegotiation: { mode: "auto" },
  });
  try {
    await client.connect(transport, { signal });
    if (!client.getServerCapabilities()?.tools) throw new Error("MCP server does not advertise tools");
    const tools: Tool[] = [];
    const names = new Set<string>();
    const cursors = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; ; page++) {
      signal.throwIfAborted();
      if (page >= MAX_PAGES) throw new Error("MCP tool listing exceeds the 1000-page limit");
      // listTools() auto-aggregates and silently stops on repeated cursors in SDK v2.
      // Request raw validated pages so a partial catalog cannot look complete.
      const result = await client.request({ method: "tools/list", params: cursor === undefined ? {} : { cursor } }, { signal });
      for (const tool of result.tools) {
        if (names.has(tool.name)) throw new Error(`Duplicate MCP tool name: ${tool.name}`);
        names.add(tool.name);
        tools.push(tool);
        if (tools.length > MAX_TOOLS) throw new Error("MCP tool listing exceeds the 10000-tool limit");
      }
      cursor = result.nextCursor;
      if (cursor === undefined) break;
      if (cursors.has(cursor)) throw new Error("MCP tool listing repeated a pagination cursor");
      cursors.add(cursor);
    }
    const server = client.getServerVersion();
    if (!server) throw new Error("MCP server did not provide its identity");
    const loaded = performance.now();
    const snapshot = JSON.stringify({ server, tools });
    return {
      source: { kind: "mcp", location: url.href, transport: "streamable-http", server,
        sha256: createHash("sha256").update(url.href).update("\n").update(snapshot).digest("hex"),
        bytes: Buffer.byteLength(snapshot) },
      options: tools.map((tool) => ({
        id: tool.name,
        content: JSON.parse(JSON.stringify({ name: tool.name, title: tool.title, description: tool.description,
          inputSchema: tool.inputSchema, outputSchema: tool.outputSchema, annotations: tool.annotations })) as Record<string, JsonValue>,
        contract: JSON.parse(JSON.stringify({ tool, invocation: {
          endpoint: url.href, transport: "streamable-http", method: "tools/call", tool: tool.name,
          instructions: "Connect with an MCP client and construct arguments from inputSchema. Establish your own connection; discovery does not grant execution access or share a session. Execution may require authentication.",
        } })) as JsonValue,
      })),
      timings: { loadMs: loaded - started, parseMs: performance.now() - loaded },
    };
  } catch (error) {
    if (authenticationRequired) throw new AuthenticationRequiredError();
    throw error;
  } finally {
    if (transport.sessionId) {
      cleanupSignal = AbortSignal.timeout(1000);
      try {
        await transport.terminateSession();
      } catch {
        // Cleanup cannot replace the original discovery error or invalidate collected metadata.
        console.error("jevseek: could not terminate remote MCP session; closing local connection");
      }
    }
    // Closing aborts background streams and releases the local transport, including on cancellation.
    await client.close();
  }
}
