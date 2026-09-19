# Releasing the CLI

The release artifact is an npm tarball containing compiled JavaScript, type declarations, README, license, and package manifest. npm exposes `jevseek` directly through `dist/cli/index.js`, compiled from the TypeScript CLI entry point. Node.js 20+ and npm are required. Runtime dependencies are installed from npm; the tarball is not a standalone native executable.

## Local build and installation

```bash
npm ci
npm run typecheck
npm test
npm run release:package
npm run test:package
npm install -g ./artifacts/jevseek.tgz
jevseek --version
```

The package script checks required files and excludes environment files, tests, examples, and node_modules. It writes a SHA-256 checksum next to the tarball. The installation test uses a new temporary prefix and working directory, verifies the generated command, imports the installed library, and runs discovery against a fixture with a mocked TypeSafe transport. No TypeSafe key is needed for this check.

## GitHub release

1. Choose a new version with `npm version <version> --no-git-tag-version`. This updates both manifests. Version `0.0.2` is the first working client package; `0.0.1` was the npm name reservation.
2. Review and commit the source, lockfile, and workflows. Push them to the repository.
3. Create and publish a GitHub release from that commit with tag `v<version>`. The tag must match both manifests.
4. Wait for the **Release client** workflow. It checks types and tests, builds once, verifies the same artifact on Node.js 20, 22, and 24 on Linux, then attaches the tarball and checksum to the release.
5. Confirm the download and installation from the release page before announcing it.

The release event checks out the release tag, not the moving main branch. Only the upload job has repository write permission. A published release that fails verification receives no client asset. Rerun a failed workflow after fixing the cause; uploads intentionally fail if an asset of the same name already exists, so successful release assets are not silently replaced.

Manual workflow dispatch builds and tests the selected ref, with the tarball available under the run's **Artifacts**. It does not create or update a release. npm publication is not part of this workflow and requires no npm publishing token.

The README's one-click link targets:

```text
https://github.com/dej-h/jevseek/releases/latest/download/jevseek.tgz
```

That link works once a non-prerelease release containing this asset exists. Use the individual release page for prereleases or pinned versions. Downloading a tarball does not install it; run `npm install -g ./jevseek.tgz` after downloading.

GitHub documents the [published release trigger](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release) and [direct links to release assets](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases).

## Workflow dependencies

Actions are pinned to full commit SHAs with release-version comments. Dependabot checks them every Monday at 06:00 Europe/Amsterdam, groups minor and patch updates, and leaves major updates separate for review. Checkout does not persist GitHub credentials. Build dependencies come from `npm ci` and the committed lockfile; the build uses Node.js 24, while the installation matrix checks the declared older runtimes too.

The action pins were verified against upstream releases: [checkout 7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node 7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0), [upload-artifact 7.0.1](https://github.com/actions/upload-artifact/releases/tag/v7.0.1), and [download-artifact 8.0.1](https://github.com/actions/download-artifact/releases/tag/v8.0.1).

## Verification limits

Local verification covers the installed CLI and library on the local Node/Linux runtime. The Node.js 20/22/24 matrix runs only after this workflow reaches GitHub. Windows/macOS installation and real coding-agent integrations are not yet claimed as tested. The package smoke test checks transport and contract handling; mocked scores are not evidence of model quality.
