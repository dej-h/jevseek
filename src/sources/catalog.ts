import { readSourceDocument, SourceHttpError } from "./document.js";
import { shouldProbeMcp, sourceDetectionError } from "./detection.js";
import { openApiCatalogFromDocument, type OpenApiCatalog, type OpenApiDescriptorInclude } from "./openapi.js";
import { AuthenticationRequiredError, loadMcpCatalog, type McpCatalog } from "./mcp.js";

/** Detect by document contents or protocol negotiation, never by URL suffix. */
export async function loadCatalog(
  source: string, include?: Partial<OpenApiDescriptorInclude>, cancellation?: AbortSignal,
): Promise<OpenApiCatalog | McpCatalog> {
  const signal = AbortSignal.any([AbortSignal.timeout(30_000), ...(cancellation ? [cancellation] : [])]);
  const started = performance.now();
  let documentError: unknown;
  try {
    const document = await readSourceDocument(source, signal);
    return openApiCatalogFromDocument(document, include, performance.now() - started, signal, false);
  } catch (error) {
    if (error instanceof SourceHttpError && [401, 403].includes(error.status)) {
      throw new AuthenticationRequiredError();
    }
    if (!shouldProbeMcp(source, error)) throw error;
    documentError = error;
  }
  signal.throwIfAborted();
  try {
    const catalog = await loadMcpCatalog(source, signal);
    if (include && Object.keys(include).length) {
      throw new Error("OpenAPI descriptor overrides cannot be used with an MCP source");
    }
    return catalog;
  } catch (error) {
    if (error instanceof AuthenticationRequiredError || signal.aborted) throw error;
    throw sourceDetectionError(documentError, error);
  }
}
