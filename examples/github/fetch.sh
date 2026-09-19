#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
curl -fsSL -o api.github.com.json \
  "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json"
echo "wrote $(wc -c < api.github.com.json) bytes to api.github.com.json"
