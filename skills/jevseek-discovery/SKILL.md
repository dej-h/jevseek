---
name: jevseek-discovery
description: Find an API operation or MCP tool for a capability in a large or unfamiliar OpenAPI document or public MCP catalog. Use when a source path or URL is available or can be located; skip when the exact target is already known.
---

# JevSeek discovery

Use JevSeek to select a source-backed operation or tool when the user describes a capability rather than naming its target.

1. Locate the actual OpenAPI JSON/YAML file, direct HTTPS OpenAPI document URL, or public Streamable HTTP MCP endpoint. Search the repository or web if needed to find the source. Do not invent a source from the service name.
2. For an unfamiliar or large catalog, call `jevseek_discover` with that source and the user's capability need. The top match includes a compact contract preview read from the current source. Use it when it supplies the method, path, and inputs the task needs. If details are missing, inspect the exact target with `jevseek_inspect`, passing the same source and target name. First inspect without `part`; the response names fields that can be opened with `part` and provides offsets for large values. Follow those names only when the contract needs more detail. Rediscover if the target has disappeared from the current source.
3. If the exact target is already known, inspect it directly when current contract details are needed. Use ordinary tools for tasks that do not require catalog selection.

Discovery sends the need and source descriptors to TypeSafe Jev. Use only sources authorized for that transfer. Discovery and inspection do not execute the target API operation or MCP tool; use the inspected contract and the agent's normal tools for any authorized follow-up request. If JevSeek is unavailable, inspect the source with ordinary tools and do not claim a JevSeek result.
