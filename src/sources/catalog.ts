import { readSourceDocument, SourceHttpError, StreamingSourceError } from "./document.js";
import { openApiCatalogFromDocument, NotOpenApiError, type OpenApiDescriptorInclude } from "./openapi.js";
import { AuthenticationRequiredError, loadMcpCatalog } from "./mcp.js";

/** Detect by document contents or protocol negotiation, never by URL suffix. */
export async function loadCatalog(source: string, include?: Partial<OpenApiDescriptorInclude>, cancellation?: AbortSignal) {
  const signal = AbortSignal.any([AbortSignal.timeout(30_000), ...(cancellation ? [cancellation] : [])]);
  const started = performance.now();
  let documentError: unknown;
  try {
    const document = await readSourceDocument(source, signal);
    return openApiCatalogFromDocument(document, include, performance.now() - started, signal);
  } catch (error) {
    if (error instanceof SourceHttpError && [401, 403].includes(error.status)) {
      throw new AuthenticationRequiredError();
    }
    const probeMcp = source.startsWith("https://") && (error instanceof NotOpenApiError
      || error instanceof StreamingSourceError
      || (error instanceof SourceHttpError && [404, 405, 406, 415].includes(error.status)));
    if (!probeMcp) throw error;
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
    throw new Error(`Source detection failed: ${documentError instanceof Error ? documentError.message : "not OpenAPI"}; MCP: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}
