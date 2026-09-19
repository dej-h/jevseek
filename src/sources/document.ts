import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createHash } from "node:crypto";

const MAX_SOURCE_BYTES = 64 * 1024 * 1024;
const SOURCE_TIMEOUT_MS = 30_000;

export interface SourceDocument {
  location: string;
  sha256: string;
  bytes: number;
  text: string;
}

export async function readSourceDocument(source: string): Promise<SourceDocument> {
  if (source.trim() === "") {
    throw new Error("provide an OpenAPI file path or HTTPS URL");
  }
  const signal = AbortSignal.timeout(SOURCE_TIMEOUT_MS);
  let location: string;
  let chunks: AsyncIterable<Uint8Array>;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(source)) {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) {
      throw new Error("OpenAPI URLs must use HTTPS without credentials or a fragment");
    }
    location = url.href;
    const response = await fetch(url, { signal, redirect: "manual" });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error(
        `OpenAPI source returned HTTP ${String(response.status)}; supply a direct HTTPS document URL (redirects are not followed)`,
      );
    }
    if (Number(response.headers.get("content-length")) > MAX_SOURCE_BYTES) {
      await response.body.cancel();
      throw new Error("OpenAPI source exceeds the 64 MiB limit");
    }
    chunks = response.body;
  } else {
    location = await realpath(source);
    const info = await stat(location);
    if (!info.isFile()) {
      throw new Error("OpenAPI source must be a regular file");
    }
    if (info.size > MAX_SOURCE_BYTES) {
      throw new Error("OpenAPI source exceeds the 64 MiB limit");
    }
    chunks = createReadStream(location, { signal });
  }

  const buffers: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of chunks) {
    bytes += chunk.byteLength;
    if (bytes > MAX_SOURCE_BYTES) {
      throw new Error("OpenAPI source exceeds the 64 MiB limit");
    }
    buffers.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(buffers);
  return {
    location,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    bytes,
    text: buffer.toString("utf8"),
  };
}
