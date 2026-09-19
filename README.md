# jevseek

Give your agent a new API. JevSeek finds the operations it needs, not the whole spec.

Point it at an OpenAPI document and state what capability you need. It enumerates operations, uses [Jev](https://docs.typesafe.ai) to judge relevance, and returns ranked source contracts. The need is passed directly to Jev; JevSeek does not derive it from an agent's original task.

Requires Node.js 20+ and npm. Set `TYPESAFE_API_KEY` in the environment or a `.env` file in the working directory.

## Install the client

[Download the latest client](https://github.com/dej-h/jevseek/releases/latest/download/jevseek.tgz) · [Release assets and checksums](https://github.com/dej-h/jevseek/releases/latest)

The download link becomes available after the first release using the new packaging workflow. Download `jevseek.tgz`, then install it from your Downloads directory:

```bash
npm install -g ./jevseek.tgz
jevseek --version
jevseek discover "I need filenames and change metadata for a pull request" ./openapi.json --top 3
```

Once a release is available, installation also works directly from its asset URL:

```bash
npm install -g https://github.com/dej-h/jevseek/releases/latest/download/jevseek.tgz
```

This installs a package independently of the source checkout. It requires no TypeScript compiler or `npm link`. Installation downloads runtime dependencies from npm. The registry's `jevseek` 0.0.1 package was a name reservation; this workflow distributes the working client through GitHub Releases and does not publish to npm.

## Develop and package locally

Run from the checkout:

```bash
npm ci
npm run cli -- discover "I need filenames and change metadata for a pull request" \
  ./openapi.json --top 3
```

Build the same downloadable artifact locally:

```bash
npm run release:package
npm run test:package
npm install -g ./artifacts/jevseek.tgz
```

`release:package` builds the TypeScript and writes `artifacts/jevseek.tgz` plus `artifacts/SHA256SUMS`. `test:package` installs the tarball into a temporary prefix outside the checkout, then checks the installed command and library with mocked provider responses. It uses the registry for dependencies, but makes no paid Jev calls.

## Commands

- `discover "<need>" <source>`: load a local JSON/YAML file or direct HTTPS URL and return ranked OpenAPI contracts as JSON. `--json` is accepted explicitly too.
- `rank "<need>" --file options.json`: score supplied options. `--openapi spec.json` and stdin remain supported.
- `serve`: planned stdio MCP discovery server, not implemented yet.

`--top` sets the number of returned candidates. `--parameters`, `--request-body`, and `--responses` add those fields to Jev's descriptors. Returned contracts preserve the original operation regardless of descriptor flags. Run `npm run cli -- --help` for all field switches.

Discovery reports the canonical source location, SHA-256, operation counts, reference warnings, provider usage, phase timings, and byte counts. A fully scored catalog has `scan.complete: true`; individual contracts can still have `contractComplete: false`. A `no_confident_match` result retains the highest-ranked candidates for inspection. Provider failures exit with an error instead of returning an apparently complete result.

Source reads are limited to 64 MiB and 30 seconds. HTTPS redirects and credential-bearing URLs are rejected. Only OpenAPI 3.0/3.1 are accepted; referenced Path Items must be bundled inline. External `$ref`s are retained with warnings and are never fetched. Contract traversal is limited to 128 local references per operation; returned contract size is not yet capped. The supplied need and enabled descriptor fields are sent to TypeSafe. JevSeek does not execute the selected API operations.

For development, run `npm run cli -- discover "<need>" <source>` directly from TypeScript, or build with `npm run build` and run `node dist/cli/index.js discover "<need>" <source>`. `npm link` is also available after building; use the tarball for an independent installation.

The source can be a direct HTTPS URL to an OpenAPI JSON or YAML document:

```bash
jevseek discover "I need filenames and change metadata for a pull request" \
  "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json" \
  --top 3
```

The TypeScript API keeps its source-first signature:

```ts
import { discover } from "jevseek";

const result = await discover(
  "./openapi.json",
  "I need filenames and change metadata for a pull request",
  { topK: 3 },
);
```

Install `jevseek.tgz` as a project dependency to use that import.

## Releases

Publishing a GitHub release triggers [Release client](.github/workflows/release.yml). It checks types and tests, builds the tarball, verifies installation on Linux with Node.js 20/22/24, then attaches `jevseek.tgz` and `SHA256SUMS`. The tag must match the package version, for example `v0.0.2`. A manual workflow run produces an Actions artifact without publishing a release.

Release procedure and current verification limits: [releasing.md](docs/releasing.md). Next implementation priorities: [next-steps.md](docs/next-steps.md).

Docs: [design spec](docs/JevSeek_Design_Spec.md), [P0 OpenAPI research](docs/p0-openapi-core.md). GitHub snapshot: [examples/github](examples/github).
