#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
curl -fsSL -o openapi.yaml \
  "https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml"
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
const doc = parse(readFileSync("openapi.yaml", "utf8"));
writeFileSync("openapi.json", JSON.stringify(doc));
'
rm -f openapi.yaml
echo "wrote $(wc -c < openapi.json) bytes to openapi.json"
