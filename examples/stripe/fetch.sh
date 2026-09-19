#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
curl -fsSL -o openapi.json \
  "https://raw.githubusercontent.com/stripe/openapi/master/latest/openapi.spec3.json"
echo "wrote $(wc -c < openapi.json) bytes to openapi.json"
