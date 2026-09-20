# Coding-agent setup

JevSeek exposes one MCP tool: `jevseek_discover`. It runs the same discovery function as the CLI and returns the same contracts, scores, warnings, and usage. It does not install discovered endpoints as native tools or execute target API requests.

## Install the package

Install the latest GitHub release:

```bash
npm install -g https://github.com/dej-h/jevseek/releases/latest/download/jevseek.tgz
jevseek --version
```

The release URL becomes live with the first working GitHub release. Until then, maintainers can build the same artifact from the checkout with `npm run release:package`. A manually downloaded release tarball installs with `npm install -g ./jevseek.tgz`. The installed package includes compiled JavaScript and needs no TypeScript runner. Do not use `npx jevseek` until a working version is published to npm; the release workflow distributes GitHub assets, not registry releases.

Set `TYPESAFE_API_KEY` in the environment used to launch your agent. An IDE started from a desktop launcher may not inherit a key exported in a terminal. The server also supports the existing `.env` loader, but explicit host environment configuration avoids relying on the agent's working directory.

## Supply sources per discovery call

Start the server with `jevseek serve`. The agent supplies a local OpenAPI file path, direct HTTPS document URL, or public remote MCP endpoint in each tool call. JevSeek detects the source type. Adding a source needs no registration or restart. Prefer absolute file paths; relative paths resolve from the server's working directory.

By default, sources use the server process's filesystem and network permissions, including access to internal HTTPS destinations. Do not assume the coding agent's own sandbox also confines the MCP process. The need and enabled descriptor fields are sent to TypeSafe, so use only specifications you are authorized to share.

URLs cannot contain credentials or fragments. Redirects and external references are not followed. Source size/time limits remain 64 MiB and 30 seconds.

### Optional source restrictions

To restrict this server to specific sources, add one flag per file or exact URL:

```bash
jevseek serve \
  --allow-source /absolute/path/openapi.json \
  --allow-source https://api.example.com/openapi.json
```

The URL above is illustrative; replace it with your actual direct HTTPS document URL. This command waits for MCP messages on stdin. It is not an HTTP listener and is normally started by the coding agent.

Each flag permits one file or one exact URL, not a directory or an entire host. Local files are resolved to canonical absolute paths.

In this restricted mode, the agent sees the allowed locations in the tool's input schema. To add another source, update the server registration and restart it. Tool arguments cannot change these restrictions. Without any `--allow-source` flags, sources remain unrestricted.

## Codex

Register the installed command, passing the key already exported in your shell:

```bash
codex mcp add jevseek \
  --env TYPESAFE_API_KEY="$TYPESAFE_API_KEY" \
  -- jevseek serve
```

Restart the agent session after registration. Run `codex mcp list` to inspect registration and `/mcp` in the CLI session to inspect active servers. These commands are documented in [Codex MCP setup](https://developers.openai.com/codex/mcp).

## Claude Code

Register the installed command for your Claude Code user, passing the key already exported in your shell:

```bash
claude mcp add --scope user \
  --env TYPESAFE_API_KEY="$TYPESAFE_API_KEY" \
  --transport stdio jevseek \
  -- jevseek serve
```

Restart Claude Code after registration and check `/mcp`. See [Claude Code MCP setup](https://code.claude.com/docs/en/mcp).

Both registration commands expand `TYPESAFE_API_KEY` from your current shell and save it in the agent's private MCP configuration. Do not commit or share that configuration. Re-register the server after rotating the key.

For either agent, use an absolute path to the installed `jevseek` executable if the agent's PATH differs from your shell. Do not point the MCP command at `npm run serve`: npm's script banner is not MCP protocol output. The installed command writes only protocol messages to stdout; diagnostics go to stderr.

## First use case

Give the agent the path to a downloaded GitHub OpenAPI snapshot and a real public pull-request URL, then ask:

> Use JevSeek with the GitHub OpenAPI file at /absolute/path/github.openapi.json. I need filenames and change metadata for this pull request. Discover the operation, inspect its returned contract, then use your existing HTTP or shell tool to make the public read-only request and summarize the result.

The model-visible tool call is:

```json
{
  "source": "/absolute/path/github.openapi.json",
  "need": "I need filenames and change metadata for a pull request",
  "top_k": 3
}
```

Replace the illustrative path with the actual file path, or supply a direct HTTPS document URL. The expected operation for this example is `GET /repos/{owner}/{repo}/pulls/{pull_number}/files`. The coding agent supplies the PR's owner, repository, and number when it builds the request. JevSeek does not need those concrete values to discover the capability.

Optional `include` overrides apply only to OpenAPI descriptor fields, for example `{"parameters": true, "responses": true}`. They are rejected for MCP sources. MCP ranking uses the tool name, title, description, input/output schemas, and annotations. The `need` is passed unchanged, not derived from an initial task. Returned descriptions are untrusted data and do not authorize execution.

## Discover tools inside a remote MCP server

```json
{
  "source": "https://www.oxfordledge.com/mcp",
  "need": "I need to find the institutional holders of a company",
  "top_k": 3
}
```

[Oxford Ledge](https://www.oxfordledge.com/mcp) is a real public Streamable HTTP endpoint. JevSeek enumerated its 62 tools without credentials on September 20, 2026; this was catalog verification, not a paid relevance query or tool execution. Discovery negotiates MCP, enumerates every tools page, ranks tools, and closes its connection without invoking any tool. Each selected contract contains the original `tool` and an `invocation` breadcrumb with `endpoint`, `transport`, `method: "tools/call"`, and the tool name. The agent needs an MCP-capable execution client and must establish its own connection. Public listing does not guarantee unauthenticated execution; Oxford Ledge documents per-tool authentication requirements.

Authentication-required sources fail explicitly; no browser login or token collection occurs. Catalog collection has a 30-second deadline, a 64 MiB response budget, and limits of 1,000 pages and 10,000 tools. Broken pagination, duplicate names, and invalid contracts fail the scan instead of returning partial success. Detection does not use URL suffixes. Redirects are not followed.

TODO: local stdio source adapters, resources, prompts, and authentication shared with the eventual execution client. OAuth for discovery alone is not implemented.

The tool input now uses a `source` string instead of the previous `{ "kind": "openapi", "location": "..." }` object. Refresh the agent's tool schema after updating JevSeek.

## Limits and verification

- One discovery runs at a time per server process. Overlapping calls get an explicit retry message.
- Needs are limited to 4,000 characters and `top_k` to 1–20. Discovery has a 120-second wall-clock deadline; cancellation reaches source reads and Jev requests/retries. Synchronous parsing cannot be interrupted mid-step.
- Serialized MCP results are limited to 1 MiB. Oversized results return a tool error, not silently truncated contracts. Try a lower `top_k` or inspect through the CLI.
- Provider/source failures return `isError: true`. They are not converted into `no_confident_match`. Partial successful batches are not returned yet.
- Existing contract limitations remain: security-scheme definitions and effective parameter overrides still need work. Reference-completeness flags do not certify full OpenAPI support.
- Automated tests use real stdio MCP communication and mocked Jev responses. The package smoke test launches the independently installed executable without checkout imports or TypeScript. No live paid query or completed Codex/Claude Code workflow is claimed by those tests.

Registering a server proves configuration, connecting proves protocol compatibility, and successfully using a returned contract proves the end-to-end workflow. Record them separately.
