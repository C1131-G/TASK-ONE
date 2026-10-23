import { Schema } from "effect";

import { MeSchema } from "./me";

export type HttpMethod = "get" | "post" | "patch" | "delete";

// One entry per route file under app/api/v1. The OpenAPI document and the
// typed client are both read from this list, and a test fails when a route
// file and its entry drift apart.
export interface RouteDefinition {
  readonly operationId: string;
  readonly method: HttpMethod;
  // The public path, with `{name}` for dynamic segments.
  readonly path: string;
  readonly summary: string;
  // Shape of `data` in a successful response.
  readonly data: Schema.Constraint;
}

export const mobileRoutes = [
  {
    data: MeSchema,
    method: "get",
    operationId: "getMe",
    path: "/api/v1/me",
    summary: "Who the bearer token belongs to.",
  },
] as const satisfies readonly RouteDefinition[];

const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "CONFLICT",
  "RATE_LIMITED",
  "UNAVAILABLE",
] as const;

const FailureSchema = Schema.Struct({
  error: Schema.Struct({
    code: Schema.Literals(ERROR_CODES),
    fieldErrors: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    message: Schema.String,
    requestId: Schema.String,
  }),
  ok: Schema.Literal(false),
});

type JsonObject = Record<string, unknown>;

const SCHEMA_REF_PREFIX = "#/$defs/";
const COMPONENT_REF_PREFIX = "#/components/schemas/";

// Effect emits `#/$defs/Name` references; OpenAPI keeps them under
// `#/components/schemas`.
const documentOf = (schema: Schema.Constraint) => {
  const { definitions, schema: root } = Schema.toJsonSchemaDocument(schema);
  const rewritten = JSON.parse(
    JSON.stringify(root).replaceAll(SCHEMA_REF_PREFIX, COMPONENT_REF_PREFIX)
  ) as JsonObject;
  return { definitions: definitions as JsonObject, root: rewritten };
};

const successEnvelope = (data: JsonObject): JsonObject => ({
  properties: {
    data,
    ok: { const: true },
    requestId: { type: "string" },
  },
  required: ["ok", "data", "requestId"],
  type: "object",
});

const failureResponse = (description: string): JsonObject => ({
  content: {
    "application/json": { schema: { $ref: `${COMPONENT_REF_PREFIX}Failure` } },
  },
  description,
});

export const buildOpenApiDocument = (): JsonObject => {
  const failure = documentOf(FailureSchema);
  const schemas: JsonObject = { ...failure.definitions, Failure: failure.root };
  const paths: Record<string, JsonObject> = {};

  for (const route of mobileRoutes) {
    const data = documentOf(route.data);
    Object.assign(schemas, data.definitions);
    paths[route.path] = {
      ...paths[route.path],
      [route.method]: {
        operationId: route.operationId,
        responses: {
          200: {
            content: {
              "application/json": { schema: successEnvelope(data.root) },
            },
            description: "The request succeeded.",
          },
          401: failureResponse("Missing, expired or revoked bearer token."),
          403: failureResponse("The account may not do this."),
        },
        security: [{ bearerAuth: [] }],
        summary: route.summary,
      },
    };
  }

  return {
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: { scheme: "bearer", type: "http" },
      },
    },
    info: { title: "Metsys mobile API", version: "1.0.0" },
    openapi: "3.1.0",
    paths,
  };
};
