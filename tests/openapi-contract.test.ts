import assert from "node:assert/strict";
import test from "node:test";
import { operationsFromOpenApi } from "../src/sources/openapi.js";

test("keeps the source operation, inherited fields, and local reference closure", () => {
  const options = operationsFromOpenApi(
    {
      openapi: "3.1.0",
      security: [{ bearer: [] }],
      paths: {
        "/widgets/{widget_id}": {
          servers: [{ url: "https://api.example.test" }],
          parameters: [{ $ref: "#/components/parameters/WidgetId" }],
          get: {
            operationId: "getWidget",
            responses: {
              "200": { $ref: "#/components/responses/Widget" },
            },
          },
        },
      },
      components: {
        parameters: {
          WidgetId: {
            name: "widget_id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        },
        responses: {
          Widget: {
            description: "A widget",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Widget" },
              },
            },
          },
        },
        schemas: {
          Widget: {
            type: "object",
            required: ["id"],
            properties: { id: { type: "string" } },
          },
        },
      },
    },
    undefined,
    "fixture.json",
  );

  assert.equal(options.length, 1);
  const contract = options[0]?.contract;
  assert.ok(contract && typeof contract === "object" && !Array.isArray(contract));
  assert.equal(contract.source, "fixture.json");
  assert.equal(
    contract.sourcePointer,
    "#/paths/~1widgets~1{widget_id}/get",
  );
  assert.deepEqual(contract.inherited, {
    parameters: [{ $ref: "#/components/parameters/WidgetId" }],
    security: [{ bearer: [] }],
    servers: [{ url: "https://api.example.test" }],
  });
  assert.deepEqual(Object.keys(contract.references as object).sort(), [
    "#/components/parameters/WidgetId",
    "#/components/responses/Widget",
    "#/components/schemas/Widget",
  ]);
  assert.equal(contract.contractComplete, true);
});

test("marks a contract incomplete when a reference cannot be resolved locally", () => {
  const [option] = operationsFromOpenApi({
    openapi: "3.1.0",
    paths: {
      "/widgets": {
        post: {
          requestBody: { $ref: "https://example.test/request.yaml#/Widget" },
          responses: { "204": { description: "Created" } },
        },
      },
    },
  });

  const contract = option?.contract;
  assert.ok(contract && typeof contract === "object" && !Array.isArray(contract));
  assert.equal(contract.contractComplete, false);
  assert.deepEqual(contract.warnings, [
    "external reference is not resolved: https://example.test/request.yaml#/Widget",
  ]);
});
