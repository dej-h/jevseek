import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status ?? result.signal}):\n${result.stderr}\n${result.stdout}`);
  }
  return result.stdout;
}

export function npm(args, options = {}) {
  if (!process.env.npm_execpath) {
    throw new Error("run this script through npm run");
  }
  return run(process.execPath, [process.env.npm_execpath, ...args], options);
}
