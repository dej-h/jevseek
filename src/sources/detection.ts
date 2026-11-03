import { SourceHttpError, StreamingSourceError } from "./document.js";
import { NotOpenApiError } from "./openapi.js";

/** An HTTPS endpoint can be a remote MCP catalog when document loading is inconclusive. */
export function shouldProbeMcp(source: string, error: unknown): boolean {
  return source.startsWith("https://") && (error instanceof NotOpenApiError
    || error instanceof StreamingSourceError
    || (error instanceof SourceHttpError && [404, 405, 406, 415].includes(error.status)));
}

export function sourceDetectionError(documentError: unknown, mcpError: unknown): Error {
  const documentMessage = documentError instanceof Error ? documentError.message : "not OpenAPI";
  const mcpMessage = mcpError instanceof Error ? mcpError.message : String(mcpError);
  return new Error(`Source detection failed: ${documentMessage}; MCP: ${mcpMessage}`, { cause: mcpError });
}
