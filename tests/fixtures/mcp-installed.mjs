import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [installed, command, fixture, preload] = process.argv.slice(2);
const require = createRequire(join(installed, "package.json"));
const { Client } = await import(pathToFileURL(require.resolve("@modelcontextprotocol/client")).href);
const { StdioClientTransport, getDefaultEnvironment } = await import(pathToFileURL(require.resolve("@modelcontextprotocol/client/stdio")).href);
const client = new Client({ name: "installed-package-check", version: "1.0.0" });
const errors = [];
client.onerror = (error) => errors.push(error.message);
const transport = new StdioClientTransport({
  command: process.platform === "win32" ? process.execPath : command,
  args: [
    ...(process.platform === "win32" ? [join(installed, "dist/cli/index.js")] : []),
    "serve",
  ],
  cwd: process.cwd(),
  env: { ...getDefaultEnvironment(), NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`, TYPESAFE_LOG_LEVEL: "info" },
  stderr: "pipe",
});
let diagnostics = "";
transport.stderr.on("data", (chunk) => { diagnostics += chunk.toString(); });
try {
  await client.connect(transport);
  assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name), ["jevseek_discover"]);
  const result = await client.callTool({
    name: "jevseek_discover",
    arguments: {
      source: fixture,
      need: "I need filenames and change metadata for a pull request",
      top_k: 1,
    },
  });
  assert.ok(!result.isError, JSON.stringify(result));
  assert.equal(result.structuredContent.matches[0].id, "GET /pulls/{number}/files");
  assert.equal(result.structuredContent.matches[0].contract.operation.operationId, "listFiles");
  assert.equal(result.structuredContent.scan.examinedOperations, 2);
  const remote = await client.callTool({ name: "jevseek_discover", arguments: {
    source: "https://catalog.test/mcp", need: "I need filenames and change metadata for a pull request", top_k: 1,
  } });
  assert.ok(!remote.isError, JSON.stringify(remote));
  assert.equal(remote.structuredContent.matches[0].contract.tool.name, "list_files");
  assert.match(diagnostics, /200/);
  assert.deepEqual(errors, []);
  console.log("Installed MCP server: tool listing and discovery passed");
} finally {
  await client.close();
}
