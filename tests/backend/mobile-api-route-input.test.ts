import { expect, it } from "bun:test";

import { Schema } from "effect";

import type { RouteDefinition } from "../../src/mobile-api/route-definition";
import { runEffectResult } from "../../src/server/core/action-result";

const createThing = {
  body: Schema.Struct({
    title: Schema.String.check(Schema.isMinLength(1)),
  }),
  data: Schema.Struct({ id: Schema.String }),
  method: "post",
  operationId: "createThing",
  params: Schema.Struct({ projectId: Schema.String }),
  path: "/api/v1/projects/{projectId}/things",
  query: Schema.Struct({ limit: Schema.optional(Schema.FiniteFromString) }),
  summary: "A write used to exercise input decoding.",
} as const satisfies RouteDefinition;

const listThings = {
  data: Schema.Struct({ id: Schema.String }),
  method: "get",
  operationId: "listThings",
  path: "/api/v1/things",
  query: Schema.Struct({ limit: Schema.optional(Schema.FiniteFromString) }),
  summary: "A read used to exercise input decoding.",
} as const satisfies RouteDefinition;

const post = (body: string, headers: Record<string, string> = {}, query = "") =>
  new Request(`http://localhost:3000/api/v1/projects/p1/things${query}`, {
    body,
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  });

const readCreate = async (request: Request) => {
  const { readRouteInput } = await import("../../src/server/api/route-input");
  return runEffectResult(
    readRouteInput(createThing, request, { projectId: "p1" }),
    "req-route-input"
  );
};

it("decodes the path, query, body and key of a write", async () => {
  const result = await readCreate(
    post(
      JSON.stringify({ title: "Fix login" }),
      { "idempotency-key": "retry-key-0001" },
      "?limit=5"
    )
  );

  expect(result).toEqual({
    data: {
      body: { title: "Fix login" },
      idempotencyKey: "retry-key-0001",
      params: { projectId: "p1" },
      query: { limit: 5 },
    },
    ok: true,
    requestId: "req-route-input",
  });
});

it("reads a GET without a body or key", async () => {
  const { readRouteInput } = await import("../../src/server/api/route-input");
  const result = await runEffectResult(
    readRouteInput(
      listThings,
      new Request("http://localhost:3000/api/v1/things?limit=2")
    ),
    "req-route-input-get"
  );

  expect(result).toMatchObject({ data: { query: { limit: 2 } }, ok: true });
});

it("names the body field that is wrong", async () => {
  const result = await readCreate(
    post(JSON.stringify({ title: "" }), { "idempotency-key": "retry-key-0001" })
  );

  expect(result).toMatchObject({
    error: {
      code: "VALIDATION_FAILED",
      fieldErrors: { title: expect.any(String) },
    },
    ok: false,
  });
});

it("refuses a body that is not JSON", async () => {
  const result = await readCreate(
    post("{not json", { "idempotency-key": "retry-key-0001" })
  );

  expect(result).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
});

it("names the query field that is wrong", async () => {
  const result = await readCreate(
    post(
      JSON.stringify({ title: "Fix login" }),
      { "idempotency-key": "retry-key-0001" },
      "?limit=many"
    )
  );

  expect(result).toMatchObject({
    error: { fieldErrors: { limit: expect.any(String) } },
    ok: false,
  });
});

it("refuses a write that has no key", async () => {
  const result = await readCreate(post(JSON.stringify({ title: "Fix login" })));

  expect(result).toMatchObject({
    error: { fieldErrors: { "Idempotency-Key": expect.any(String) } },
    ok: false,
  });
});
