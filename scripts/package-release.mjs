import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { npm, root } from "./process.mjs";

const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
assert.equal(lock.version, manifest.version, "lockfile version differs from package.json");
assert.equal(lock.packages[""].version, manifest.version, "lockfile root version differs");
if (process.env.RELEASE_TAG) {
  assert.equal(process.env.RELEASE_TAG, `v${manifest.version}`, "release tag must match package version");
}

process.stdout.write(npm(["run", "build"]));
const staging = await mkdtemp(join(tmpdir(), "jevseek-pack-"));
try {
  // Build above, then pack without lifecycle log output mixed into the JSON manifest.
  const [packed] = JSON.parse(npm(["pack", "--ignore-scripts", "--json", "--pack-destination", staging]));
  const files = new Set(packed.files.map((file) => file.path));
  for (const required of ["dist/cli/index.js", "dist/index.js", "dist/index.d.ts", "package.json", "README.md", "LICENSE"]) {
    assert.ok(files.has(required), `package missing ${required}`);
  }
  for (const file of files) {
    assert.ok(!/(^|\/)\.env($|\.)/.test(file), `environment file in package: ${file}`);
    assert.ok(!file.startsWith("node_modules/") && !file.startsWith("tests/") && !file.startsWith("examples/"), `unexpected package file: ${file}`);
  }
  const artifactDir = join(root, "artifacts");
  await mkdir(artifactDir, { recursive: true });
  const tarball = join(artifactDir, "jevseek.tgz");
  await copyFile(join(staging, packed.filename), tarball);
  const digest = createHash("sha256").update(await readFile(tarball)).digest("hex");
  await writeFile(join(artifactDir, "SHA256SUMS"), `${digest}  jevseek.tgz\n`);
  console.log(`Built jevseek ${manifest.version}: ${tarball}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
