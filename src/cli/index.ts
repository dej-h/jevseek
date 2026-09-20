#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { normalizeOptions } from "../core/candidates.js";
import { rankOptions } from "../core/rank.js";
import { discover } from "../index.js";
import { readPackageVersion } from "../version.js";
import {
  loadOpenApiOperations,
  openApiDescriptorIncludeChanged,
  type OpenApiDescriptorInclude,
} from "../sources/openapi.js";

async function readStdin(): Promise<string> {
  const chunks: string[] = [];
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return chunks.join("");
}

async function readJson(path: string | undefined): Promise<unknown> {
  const raw = path ? await readFile(path, "utf8") : await readStdin();
  if (raw.trim() === "") {
    throw new Error("provide options as a JSON file or on stdin");
  }
  return JSON.parse(raw) as unknown;
}

function printHelp(): void {
  console.log(`jevseek: discover API operations for a capability need

State what capability you need. Jev evaluates that need as supplied.

Usage:
  jevseek --version
  jevseek serve [--allow-source <file-or-https-url> ...]
  jevseek discover "<need>" <source> [--top 5] [--json]
  jevseek rank "<need>" --file options.json [--top 5]
  jevseek rank "<need>" --openapi spec.json [--top 5]
  jevseek rank "<need>" [--top 5] < options.json

discover detects local OpenAPI JSON/YAML, HTTPS OpenAPI documents, and public remote MCP endpoints.
Results are JSON and include selected source contracts, scan metadata, and usage.
Descriptor content and the need are sent to TypeSafe. No API operation is executed.
serve exposes jevseek_discover over stdio MCP and accepts sources per tool call.
Optional --allow-source flags restrict access to those exact files or URLs.
--transport stdio is optional; other transports are unsupported.

OpenAPI descriptor fields (on by default; --no-<field> hides that part from Jev):
  --method / --no-method
  --path / --no-path
  --operation-id / --no-operation-id
  --summary / --no-summary
  --tags / --no-tags

Opt-in fields (off by default; local $refs are resolved):
  --description / --no-description
  --parameters / --no-parameters
  --request-body / --no-request-body
  --responses / --no-responses
  --deprecated / --no-deprecated
  --security / --no-security
  --servers / --no-servers

Example:
  jevseek discover "I need filenames and change metadata for a pull request" \\
    examples/github/api.github.com.json --top 3
`);
}

async function runSelection(command: "rank" | "discover", args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    allowNegative: true,
    options: {
      file: { type: "string", short: "f" },
      openapi: { type: "string" },
      help: { type: "boolean", short: "h" },
      json: { type: "boolean" },
      top: { type: "string", default: "5" },
      method: { type: "boolean", default: true },
      path: { type: "boolean", default: true },
      "operation-id": { type: "boolean", default: true },
      summary: { type: "boolean", default: true },
      tags: { type: "boolean", default: true },
      description: { type: "boolean", default: false },
      parameters: { type: "boolean", default: false },
      "request-body": { type: "boolean", default: false },
      responses: { type: "boolean", default: false },
      deprecated: { type: "boolean", default: false },
      security: { type: "boolean", default: false },
      servers: { type: "boolean", default: false },
    },
  });
  if (parsed.values.help) {
    printHelp();
    return;
  }
  const need = parsed.positionals[0];
  if (!need || parsed.positionals.length !== (command === "discover" ? 2 : 1)) {
    throw new Error(command === "discover"
      ? 'usage: jevseek discover "<need>" <source> [--top 5]'
      : 'usage: jevseek rank "<need>" --file options.json [--top 5]');
  }
  const topK = Number(parsed.values.top);
  if (!Number.isSafeInteger(topK) || topK < 1) {
    throw new Error("--top must be a positive integer");
  }
  if (parsed.values.file && parsed.values.openapi) {
    throw new Error("use --file or --openapi, not both");
  }
  if (command === "discover" && (parsed.values.file || parsed.values.openapi)) {
    throw new Error("discover takes its source after the capability need");
  }
  const include: OpenApiDescriptorInclude = {
    method: parsed.values.method,
    path: parsed.values.path,
    operationId: parsed.values["operation-id"],
    summary: parsed.values.summary,
    tags: parsed.values.tags,
    description: parsed.values.description,
    parameters: parsed.values.parameters,
    requestBody: parsed.values["request-body"],
    responses: parsed.values.responses,
    deprecated: parsed.values.deprecated,
    security: parsed.values.security,
    servers: parsed.values.servers,
  };
  if (command === "discover") {
    const result = await discover(parsed.positionals[1], need, {
      topK, include: openApiDescriptorIncludeChanged(include) ? include : undefined,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (openApiDescriptorIncludeChanged(include) && !parsed.values.openapi) {
    console.error("descriptor field flags require --openapi");
    process.exit(2);
  }
  let options;
  try {
    options = parsed.values.openapi
      ? await loadOpenApiOperations(parsed.values.openapi, include)
      : normalizeOptions(await readJson(parsed.values.file));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  }
  console.error(`ranking ${String(options.length)} operations`);
  const result = await rankOptions({
    need,
    options,
    topK,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case "-v":
    case "--version": {
      if (rest.length > 0) {
        throw new Error("usage: jevseek --version");
      }
      console.log(await readPackageVersion());
      break;
    }
    case "rank":
    case "discover":
      await runSelection(command, rest);
      break;
    case "serve": {
      const { values } = parseArgs({ args: rest, options: {
        "allow-source": { type: "string", multiple: true },
        transport: { type: "string", default: "stdio" },
        help: { type: "boolean", short: "h" },
      } });
      if (values.help) {
        printHelp();
        break;
      }
      if (values.transport !== "stdio") throw new Error("serve supports only --transport stdio");
      const { startStdioServer } = await import("../mcp/server.js");
      await startStdioServer(values["allow-source"] ?? []);
      break;
    }
    case "-h":
    case "--help":
    case "help":
    case undefined:
      printHelp();
      break;
    default:
      console.error(`unknown command: ${command}`);
      printHelp();
      process.exit(2);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
