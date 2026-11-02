import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { openApiCatalogFromDocument, previewOpenApiDocument } from "../src/sources/openapi.js";
import { previewTarget } from "../src/sources/preview.js";

test("previews required parameters and request-body fields from the source", () => {
  const text = JSON.stringify({
    openapi: "3.1.0",
    paths: {
      "/load_balancers/{lb_id}/droplets": {
        parameters: [{ $ref: "#/components/parameters/LoadBalancerId" }],
        post: {
          operationId: "addDroplets",
          summary: "Add Droplets to a Load Balancer",
          requestBody: {
            required: true,
            content: { "application/json": { schema: {
              type: "object", required: ["droplet_ids"],
              properties: { droplet_ids: { type: "array", items: { type: "integer" } } },
            } } },
          },
        },
      },
    },
    components: {
      parameters: { LoadBalancerId: {
        name: "lb_id", in: "path", required: true, schema: { type: "string" },
      } },
    },
  });
  const preview = previewOpenApiDocument({
    location: "fixture.json",
    text,
    bytes: Buffer.byteLength(text),
    sha256: createHash("sha256").update(text).digest("hex"),
  }, "POST /load_balancers/{lb_id}/droplets");

  assert.ok(preview && typeof preview === "object" && !Array.isArray(preview));
  assert.equal(preview.operationId, "addDroplets");
  assert.deepEqual(preview.parameters, [{
    name: "lb_id", in: "path", required: true, type: "string",
  }]);
  assert.match(JSON.stringify(preview.requestBody), /droplet_ids/);
});

test("oversized source text yields an inspection hint within the preview budget", () => {
  const text = JSON.stringify({
    openapi: "3.1.0",
    paths: { "/reports": { get: { summary: "x".repeat(32 * 1024) } } },
  });
  const catalog = openApiCatalogFromDocument({
    location: "fixture.json",
    text,
    bytes: Buffer.byteLength(text),
    sha256: createHash("sha256").update(text).digest("hex"),
  });

  const preview = previewTarget(catalog, "GET /reports");

  assert.ok(preview && typeof preview === "object" && !Array.isArray(preview));
  assert.deepEqual(preview.inspectPart, []);
  assert.match(String(preview.reason), /inspect the selected target/);
  assert.ok(Buffer.byteLength(JSON.stringify(preview)) < 16 * 1024);
});
