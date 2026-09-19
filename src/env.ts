import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Load `.env` into `process.env` without overwriting variables already set. */
export function loadLocalEnv(): void {
  for (const path of envFilePaths()) {
    if (!existsSync(path)) {
      continue;
    }
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(path);
      return;
    }
    applyEnvFile(readFileSync(path, "utf8"));
    return;
  }
}

function envFilePaths(): string[] {
  const fromCwd = resolve(process.cwd(), ".env");
  const fromPackage = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
  return [...new Set([fromCwd, fromPackage])];
}

function applyEnvFile(contents: string): void {
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    const assignment = trimmed.startsWith("export ") ? trimmed.slice(7) : trimmed;
    const eq = assignment.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = assignment.slice(0, eq).trim();
    let value = assignment.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
