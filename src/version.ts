import { readFile } from "node:fs/promises";

export async function readPackageVersion(): Promise<string> {
  const manifest: { version: string } = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  return manifest.version;
}
