#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
curl -fsSL -o openapi.yaml \
  "https://api-engineering.nyc3.digitaloceanspaces.com/spec-ci/DigitalOcean-public.v2.yaml"
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
const doc = parse(readFileSync("openapi.yaml", "utf8"));
writeFileSync("openapi.json", JSON.stringify(doc));
'
rm -f openapi.yaml
echo "wrote $(wc -c < openapi.json) bytes to openapi.json"
