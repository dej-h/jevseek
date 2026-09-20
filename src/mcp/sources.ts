import { realpath, stat } from "node:fs/promises";

/** Optional exact-source restrictions supplied by the operator, never by a tool call. */
export class SourcePolicy {
  private constructor(readonly locations: string[] | undefined) {}

  static async create(sources: string[] = []): Promise<SourcePolicy> {
    if (sources.length === 0) {
      return new SourcePolicy(undefined);
    }
    const locations = await Promise.all(sources.map(canonicalSource));
    return new SourcePolicy([...new Set(locations)]);
  }

  async resolve(source: string): Promise<string> {
    const location = await canonicalSource(source);
    if (this.locations && !this.locations.includes(location)) {
      throw new Error("source is not approved; add it to the server's --allow-source configuration");
    }
    return location;
  }
}

async function canonicalSource(source: string): Promise<string> {
  if (!source.trim()) {
    throw new Error("OpenAPI source must not be blank");
  }
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(source)) {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) {
      throw new Error("OpenAPI URLs must use HTTPS without credentials or a fragment");
    }
    return url.href;
  }
  const path = await realpath(source);
  if (!(await stat(path)).isFile()) {
    throw new Error("OpenAPI source must identify a regular file, not a directory");
  }
  return path;
}
