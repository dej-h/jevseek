# Public MCP discovery evidence

JevSeek discovered the expected capability in three public remote MCP servers on September 20, 2026. These were live catalog and TypeSafe ranking runs from the CLI. JevSeek did not call any selected MCP tool.

## Test conditions

- Command: local TypeScript checkout through `node --import tsx src/cli/index.ts`
- Node.js: `v24.14.0`
- Parent commit: `8b4f21dece0ed325349a93d347c8ebe1750fadba`
- Implementation snapshot: the remote MCP changes and this evidence were committed together as `102d72c83e2a59aa4a7a9dd628ae49dbda7f7166` after the runs
- Ranking model returned by TypeSafe: `jev-1.13.0`
- Result limit: `--top 1`
- Transport detected for all three sources: `streamable-http`
- Target-server credentials: none

Public catalogs change independently of this repository. The hashes, tool counts, scores, usage, and timing below are observations from these runs, not stable fixtures.

## 1. Oxford Ledge

Input:

```bash
node --import tsx src/cli/index.ts discover \
  "I need to find the institutional holders of a public company" \
  https://www.oxfordledge.com/mcp \
  --top 1
```

Result:

```json
{
  "status": "matches",
  "source": {
    "kind": "mcp",
    "location": "https://www.oxfordledge.com/mcp",
    "transport": "streamable-http",
    "server": { "name": "oxford-ledge", "version": "1.0.0" },
    "sha256": "a2f52458353a41bd0a0b6beb0b2aa8290f7203525ce2daa1427963ed9c49cdb0",
    "bytes": 120954
  },
  "scan": {
    "totalOperations": 62,
    "examinedOperations": 62,
    "complete": true,
    "warnings": []
  },
  "match": {
    "id": "get_institutional_holders",
    "score": 0.94,
    "inputSchema": {
      "type": "object",
      "properties": {
        "ticker": {
          "type": "string",
          "description": "Stock ticker symbol (e.g. AAPL)"
        }
      },
      "required": ["ticker"]
    },
    "invocation": {
      "endpoint": "https://www.oxfordledge.com/mcp",
      "transport": "streamable-http",
      "method": "tools/call",
      "tool": "get_institutional_holders"
    }
  },
  "usage": {
    "jevRequests": 2,
    "inputTokens": 36139,
    "costUsd": 0.001517838,
    "loadMs": 1371.077917,
    "scoreMs": 1503.368898
  },
  "contextAccounting": {
    "source": 120954,
    "descriptors": 120893,
    "returnedMatches": 2076,
    "unit": "utf8_bytes"
  }
}
```

The returned contract preserved the full source description and marked the tool read-only. The description states that execution data comes from SEC EDGAR 13F-HR filings with an approximately 45-day quarterly delay. Two Jev requests were needed because the 62 descriptors were split across ranking batches.

## 2. CoinGecko

Input:

```bash
node --import tsx src/cli/index.ts discover \
  "I need historical Bitcoin prices and market capitalization between two dates" \
  https://mcp.api.coingecko.com/mcp \
  --top 1
```

Result:

```json
{
  "status": "matches",
  "source": {
    "kind": "mcp",
    "location": "https://mcp.api.coingecko.com/mcp",
    "transport": "streamable-http",
    "server": {
      "name": "coingecko_coingecko_typescript_api",
      "version": "8.0.0"
    },
    "sha256": "5dd8709282cbdaedfaee42e2b0426f508f3ba23ed5f3a8b77209da5df50ae117",
    "bytes": 2134
  },
  "scan": {
    "totalOperations": 2,
    "examinedOperations": 2,
    "complete": true,
    "warnings": []
  },
  "match": {
    "id": "execute",
    "score": 0.61,
    "inputSchema": {
      "type": "object",
      "properties": {
        "code": { "type": "string", "description": "Code to execute." },
        "intent": {
          "type": "string",
          "description": "Task you are trying to perform. Used for improving the service."
        }
      },
      "required": ["code"]
    },
    "invocation": {
      "endpoint": "https://mcp.api.coingecko.com/mcp",
      "transport": "streamable-http",
      "method": "tools/call",
      "tool": "execute"
    }
  },
  "usage": {
    "jevRequests": 1,
    "inputTokens": 938,
    "costUsd": 0.000039396,
    "loadMs": 1131.542371,
    "scoreMs": 801.518603
  },
  "contextAccounting": {
    "source": 2134,
    "descriptors": 2051,
    "returnedMatches": 1872,
    "unit": "utf8_bytes"
  }
}
```

CoinGecko exposes two meta-tools rather than one tool per API operation: `execute` and `search_docs`. JevSeek correctly selected `execute`, but the score was 0.61 because the catalog only describes a generic code-execution capability, not the requested historical-price operation directly.

The CLI exited successfully after discovery. It also wrote this cleanup warning to stderr:

```text
jevseek: could not terminate remote MCP session; closing local connection
```

The warning concerns remote session deletion after the complete result was collected. It did not change the returned match, but it is a compatibility issue to investigate.

## 3. Cloudflare Docs

Input:

```bash
node --import tsx src/cli/index.ts discover \
  "I need a migration guide for moving a Cloudflare Pages project to Workers" \
  https://docs.mcp.cloudflare.com/mcp \
  --top 1
```

Result:

```json
{
  "status": "matches",
  "source": {
    "kind": "mcp",
    "location": "https://docs.mcp.cloudflare.com/mcp",
    "transport": "streamable-http",
    "server": { "name": "docs-ai-search", "version": "0.4.13" },
    "sha256": "b4c7e9848cfb310e5a9b65a11a440ac98024e4774fd63887456613f37d6c7814",
    "bytes": 1857
  },
  "scan": {
    "totalOperations": 2,
    "examinedOperations": 2,
    "complete": true,
    "warnings": []
  },
  "match": {
    "id": "migrate_pages_to_workers_guide",
    "score": 0.75,
    "inputSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {}
    },
    "invocation": {
      "endpoint": "https://docs.mcp.cloudflare.com/mcp",
      "transport": "streamable-http",
      "method": "tools/call",
      "tool": "migrate_pages_to_workers_guide"
    }
  },
  "usage": {
    "jevRequests": 1,
    "inputTokens": 1002,
    "costUsd": 0.000042084,
    "loadMs": 179.870775,
    "scoreMs": 773.401467
  },
  "contextAccounting": {
    "source": 1857,
    "descriptors": 1793,
    "returnedMatches": 874,
    "unit": "utf8_bytes"
  }
}
```

The server exposed two tools. JevSeek selected the dedicated migration guide instead of the generic Cloudflare documentation search tool.

## Aggregate

| Server | Tools scanned | Selected tool | Score | Jev requests | Input tokens | Cost |
|---|---:|---|---:|---:|---:|---:|
| Oxford Ledge | 62 | `get_institutional_holders` | 0.94 | 2 | 36,139 | $0.001517838 |
| CoinGecko | 2 | `execute` | 0.61 | 1 | 938 | $0.000039396 |
| Cloudflare Docs | 2 | `migrate_pages_to_workers_guide` | 0.75 | 1 | 1,002 | $0.000042084 |
| **Total** | **66** |  |  | **4** | **38,079** | **$0.001599318** |

All three sources were detected as MCP without a source-type flag. Every result included the original tool schema and an invocation breadcrumb. This proves public remote catalog loading and ranking for these three endpoints at the recorded time. It does not prove target tool execution, authenticated access, local stdio support, resources, or prompts.
