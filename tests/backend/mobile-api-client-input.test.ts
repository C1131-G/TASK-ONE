import { expect, it } from "bun:test";

import { Schema } from "effect";

import { buildClient } from "../../src/mobile-api/client";
import type { RouteDefinition } from "../../src/mobile-api/route-definition";

const createThing = {
  body: Schema.Struct({ title: Schema.String }),
  data: Schema.Struct({ id: Schema.String }),
  method: "post",
  operationId: "createThing",
  params: Schema.Struct({ projectId: Schema.String }),
  path: "/api/v1/projects/{projectId}/things",
  query: Schema.Struct({ limit: Schema.optional(Schema.FiniteFromString) }),
  summary: "A write used to exercise the client.",
} as const satisfies RouteDefinition;

const listThings = {
  data: Schema.Struct({ id: Schema.String }),
  method: "get",
  operationId: "listThings",
  path: "/api/v1/things",
  query: Schema.Struct({ limit: Schema.optional(Schema.FiniteFromString) }),
  summary: "A read used to exercise the client.",
} as const satisfies RouteDefinition;

const setup = () => {
  const calls: Request[] = [];
  const client = buildClient([createThing, listThings] as const, {
    baseUrl: "http://localhost:3000",
    fetch: (input, init) => {
      calls.push(new Request(input, init));
      return Promise.resolve(
        Response.json({ data: { id: "t1" }, ok: true, requestId: "r1" })
      );
    },
    token: "tok-123",
  });
  return { calls, client };
};

it("puts the path, query, body and key of a write on the request", async () => {
  const { calls, client } = setup();

  const created = await client.createThing({
    body: { title: "Fix login" },
    idempotencyKey: "retry-key-0001",
    params: { projectId: "p 1" },
    query: { limit: 3 },
  });

  const [request] = calls;
  expect(created).toEqual({ id: "t1" });
  expect(request?.method).toBe("POST");
  expect(new URL(request?.url ?? "").pathname).toBe(
    "/api/v1/projects/p%201/things"
  );
  expect(new URL(request?.url ?? "").search).toBe("?limit=3");
  expect(request?.headers.get("authorization")).toBe("Bearer tok-123");
  expect(request?.headers.get("idempotency-key")).toBe("retry-key-0001");
  expect(request?.headers.get("content-type")).toBe("application/json");
  expect(await request?.json()).toEqual({ title: "Fix login" });
});

it("sends a read without a body or a key", async () => {
  const { calls, client } = setup();

  await client.listThings({ query: { limit: 2 } });

  const [request] = calls;
  expect(request?.method).toBe("GET");
  expect(new URL(request?.url ?? "").search).toBe("?limit=2");
  expect(request?.headers.get("idempotency-key")).toBeNull();
  expect(request?.body).toBeNull();
});

it("leaves out query fields the caller did not set", async () => {
  const { calls, client } = setup();

  await client.listThings({ query: {} });

  expect(new URL(calls[0]?.url ?? "").search).toBe("");
});
