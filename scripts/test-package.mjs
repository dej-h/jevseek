import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { npm, root, run } from "./process.mjs";

const tarball = join(root, "artifacts/jevseek.tgz");
const expectedDigest = (await readFile(join(root, "artifacts/SHA256SUMS"), "utf8")).split(/\s+/)[0];
assert.equal(createHash("sha256").update(await readFile(tarball)).digest("hex"), expectedDigest);
const temp = await mkdtemp(join(tmpdir(), "jevseek-install-"));
try {
  const prefix = join(temp, "install");
  const work = join(temp, "work");
  await mkdir(work);
  const env = { ...process.env, NODE_PATH: "", NODE_OPTIONS: "", TYPESAFE_API_KEY: "", TYPESAFE_LOG_LEVEL: "warn" };
  process.stdout.write(npm([
    "install", "--global", "--prefix", prefix, "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", tarball,
  ], { cwd: work, env }));
  const installed = join(prefix, process.platform === "win32" ? "node_modules/jevseek" : "lib/node_modules/jevseek");
  assert.equal(await realpath(installed), installed, "installed client must not be a link to the checkout");
  const manifest = JSON.parse(await readFile(join(installed, "package.json"), "utf8"));
  const expected = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(manifest.version, expected.version);
  assert.equal(manifest.bin.jevseek, "dist/cli/index.js");
  const entry = join(installed, manifest.bin.jevseek);
  const command = join(prefix, process.platform === "win32" ? "jevseek.cmd" : "bin/jevseek");
  await access(command);
  assert.equal(run(process.execPath, [entry, "--version"], { cwd: work, env }).trim(), expected.version);
  const help = run(process.execPath, [entry, "--help"], { cwd: work, env });
  assert.match(help, /discover "<need>" <source>/);
  if (process.platform !== "win32") {
    assert.equal(await realpath(command), entry, "command must point directly to the compiled CLI");
    assert.equal(run(command, ["--version"], { cwd: work, env }).trim(), expected.version);
  }

  await copyFile(join(root, "tests/fixtures/discover.json"), join(work, "discover.json"));
  await copyFile(join(root, "tests/fixtures/mock-provider.mjs"), join(work, "mock-provider.mjs"));
  const need = "I need filenames and change metadata for a pull request";
  const result = JSON.parse(run(process.execPath, [
    "--import", join(work, "mock-provider.mjs"), entry,
    "discover", need, join(work, "discover.json"), "--top", "1",
  ], { cwd: work, env }));
  assert.equal(result.need, need);
  assert.equal(result.matches[0].id, "GET /pulls/{number}/files");
  assert.equal(result.matches[0].contract.operation.operationId, "listFiles");
  assert.equal(result.scan.examinedOperations, 2);

  // Import the installed library from an external consumer, with no tsx or checkout imports.
  const consumer = join(prefix, process.platform === "win32" ? "consumer.mjs" : "lib/consumer.mjs");
  await writeFile(consumer, 'import { discover } from "jevseek";\nif (typeof discover !== "function") throw new Error("missing discover export");\n');
  run(process.execPath, [consumer], { cwd: work, env });
  console.log(`Installed package smoke test passed: jevseek ${expected.version}, ${process.platform}, ${process.version}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
