import { expect, it } from "bun:test";

import { Schema } from "effect";

import type { RouteDefinition } from "../../src/mobile-api/route-definition";
import { buildOpenApiDocument } from "../../src/server/api/contract";

const createThing = {
  body: Schema.Struct({ title: Schema.String }),
  data: Schema.Struct({ id: Schema.String }),
  method: "post",
  operationId: "createThing",
  params: Schema.Struct({ projectId: Schema.String }),
  path: "/api/v1/projects/{projectId}/things",
  query: Schema.Struct({ limit: Schema.optional(Schema.FiniteFromString) }),
  summary: "A write used to exercise the document.",
} as const satisfies RouteDefinition;

const listThings = {
  data: Schema.Struct({ id: Schema.String }),
  method: "get",
  operationId: "listThings",
  path: "/api/v1/things",
  summary: "A read used to exercise the document.",
} as const satisfies RouteDefinition;

interface Operation {
  readonly parameters?: readonly {
    readonly in: string;
    readonly name: string;
    readonly required: boolean;
  }[];
  readonly requestBody?: {
    readonly content: Record<string, { readonly schema: unknown }>;
    readonly required: boolean;
  };
  readonly responses: Record<string, unknown>;
}

const operations = () => {
  const document = buildOpenApiDocument([createThing, listThings]) as {
    paths: Record<string, Record<string, Operation>>;
  };
  return {
    read: document.paths["/api/v1/things"]?.["get"],
    write: document.paths["/api/v1/projects/{projectId}/things"]?.["post"],
  };
};

it("describes path, query and key parameters of a write", () => {
  expect(operations().write?.parameters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        in: "path",
        name: "projectId",
        required: true,
      }),
      expect.objectContaining({ in: "query", name: "limit", required: false }),
      expect.objectContaining({
        in: "header",
        name: "Idempotency-Key",
        required: true,
      }),
    ])
  );
});

it("describes the JSON body of a write", () => {
  const body = operations().write?.requestBody;

  expect(body?.required).toBe(true);
  expect(JSON.stringify(body?.content["application/json"])).toContain("title");
});

it("documents the conflict and validation answers a write can give", () => {
  expect(Object.keys(operations().write?.responses ?? {})).toEqual(
    expect.arrayContaining(["200", "401", "403", "409", "422"])
  );
});

it("keeps a plain read free of body, key and conflict", () => {
  const { read } = operations();

  expect(read?.requestBody).toBeUndefined();
  expect(read?.parameters ?? []).toEqual([]);
  expect(Object.keys(read?.responses ?? {})).not.toContain("409");
});

const requestUpload = {
  body: Schema.Struct({ name: Schema.String }),
  data: Schema.Struct({ id: Schema.String }),
  idempotency: "none",
  method: "post",
  operationId: "requestUpload",
  path: "/api/v1/uploads",
  summary: "A write that hands out a signed URL, so it is never replayed.",
} as const satisfies RouteDefinition;

it("documents no key for a write that opts out of idempotency", () => {
  const document = buildOpenApiDocument([requestUpload]) as {
    paths: Record<string, Record<string, Operation>>;
  };
  const operation = document.paths["/api/v1/uploads"]?.["post"];

  expect(operation?.parameters ?? []).toEqual([]);
  expect(operation?.requestBody?.required).toBe(true);
});
