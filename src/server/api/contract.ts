import { Schema } from "effect";

import { IDEMPOTENCY_KEY_HEADER } from "../../mobile-api/idempotency";
import { FailureSchema } from "../../mobile-api/route-definition";
import type { RouteDefinition } from "../../mobile-api/route-definition";
import { mobileRoutes } from "../../mobile-api/routes";

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

const idempotencyKeyParameter: JsonObject = {
  in: "header",
  name: IDEMPOTENCY_KEY_HEADER,
  required: true,
  schema: { maxLength: 128, minLength: 8, type: "string" },
};

// One parameter per field of the route's path or query schema.
const parametersOf = (
  schema: Schema.Constraint,
  location: "path" | "query",
  schemas: JsonObject
): JsonObject[] => {
  const { definitions, root } = documentOf(schema);
  Object.assign(schemas, definitions);
  const properties = (root["properties"] ?? {}) as JsonObject;
  const required = new Set(root["required"] as string[] | undefined);
  return Object.entries(properties).map(([name, fieldSchema]) => ({
    in: location,
    name,
    required: location === "path" || required.has(name),
    schema: fieldSchema,
  }));
};

const operationOf = (
  route: RouteDefinition,
  schemas: JsonObject
): JsonObject => {
  const data = documentOf(route.data);
  Object.assign(schemas, data.definitions);
  const isWrite = route.method !== "get";
  const parameters = [
    ...(route.params ? parametersOf(route.params, "path", schemas) : []),
    ...(route.query ? parametersOf(route.query, "query", schemas) : []),
    ...(isWrite && route.idempotency !== "none"
      ? [idempotencyKeyParameter]
      : []),
  ];
  const body = route.body ? documentOf(route.body) : null;
  if (body) {
    Object.assign(schemas, body.definitions);
  }

  return {
    // A route is retired by starting its summary with "Deprecated:", so the
    // wording and the flag cannot disagree.
    ...(route.summary.startsWith("Deprecated:") ? { deprecated: true } : {}),
    operationId: route.operationId,
    ...(parameters.length ? { parameters } : {}),
    ...(body
      ? {
          requestBody: {
            content: { "application/json": { schema: body.root } },
            required: true,
          },
        }
      : {}),
    responses: {
      200: {
        content: {
          "application/json": { schema: successEnvelope(data.root) },
        },
        description: "The request succeeded.",
      },
      401: failureResponse(
        "No usable session. `error.reason` is `session_ended` (missing, expired or revoked token), `deactivated` or `inactivity`."
      ),
      403: failureResponse("The account may not do this."),
      429: failureResponse(
        "Too many requests. Wait `error.retryAfterSeconds` (also the Retry-After header)."
      ),
      ...(route.params
        ? { 404: failureResponse("Nothing matches the path.") }
        : {}),
      ...(isWrite
        ? {
            409: failureResponse(
              "A stale version, a reused key, or the same request still running."
            ),
          }
        : {}),
      ...(route.params || route.query || route.body
        ? { 422: failureResponse("The path, query or body is invalid.") }
        : {}),
    },
    security: [{ bearerAuth: [] }],
    summary: route.summary,
  };
};

export const buildOpenApiDocument = (
  routes: readonly RouteDefinition[] = mobileRoutes
): JsonObject => {
  const failure = documentOf(FailureSchema);
  const schemas: JsonObject = { ...failure.definitions, Failure: failure.root };
  const paths: Record<string, JsonObject> = {};

  for (const route of routes) {
    paths[route.path] = {
      ...paths[route.path],
      [route.method]: operationOf(route, schemas),
    };
  }

  return {
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: { scheme: "bearer", type: "http" },
      },
    },
    info: { title: "Metsys mobile API", version: "1.9.0" },
    openapi: "3.1.0",
    paths,
  };
};
