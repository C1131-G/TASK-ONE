import { Effect, Schema } from "effect";

import type {
  RouteDefinition,
  RouteInput,
} from "../../mobile-api/route-definition";
import { AuthSession, AuthSessionLive } from "../auth/session";
import type { AuthenticatedUser } from "../auth/session-types";
import { AppError } from "../core/action-result";
import { invalidInput } from "../core/server-action";
import { readIdempotencyKey } from "./idempotency-key";
import { consumeRateLimit } from "./rate-limit";
import { annotateRequest } from "./request-log";

type Decoder = Schema.Codec<unknown, unknown, never, never>;

// Failures name the field the way the web actions do, so the app can show
// them next to the input.
const decode = (
  schema: Schema.Constraint,
  value: unknown
): Effect.Effect<unknown, AppError> =>
  Schema.decodeUnknownEffect(schema as Decoder)(value, {
    errors: "all",
  }).pipe(Effect.mapError(invalidInput));

// About 1 MiB: the largest real request (a bug with 30 long steps) is far below
// it. The reverse proxy should cap bodies too (see docs/mobile-api.md).
const MAX_BODY_CHARACTERS = 1024 * 1024;

const invalidJson = () =>
  new AppError({
    code: "VALIDATION_FAILED",
    message: "The request body must be valid JSON.",
  });

const bodyTooLarge = () =>
  new AppError({
    code: "VALIDATION_FAILED",
    message: "The request body is too large.",
  });

const readJsonBody = (request: Request): Effect.Effect<unknown, AppError> =>
  Effect.gen(function* readBody() {
    // A declared size over the cap is refused without reading anything.
    if (Number(request.headers.get("content-length")) > MAX_BODY_CHARACTERS) {
      return yield* Effect.fail(bodyTooLarge());
    }
    const text = yield* Effect.tryPromise({
      catch: invalidJson,
      try: () => request.text(),
    });
    if (text.length > MAX_BODY_CHARACTERS) {
      return yield* Effect.fail(bodyTooLarge());
    }
    return yield* Effect.try({
      catch: invalidJson,
      try: (): unknown => JSON.parse(text),
    });
  });

// Reads everything a route declares: path parameters, query string, JSON body
// and, for writes that replay, the idempotency key. A route handler runs this first, so a
// bad request is refused before any service work starts.
const WORKSPACE_PREFIX = "/api/v1/workspace/";
const PORTAL_PREFIX = "/api/v1/portal/";
const ME_PREFIX = "/api/v1/me";

// Who may knock on a route is decided by where it lives, before anything the
// caller sent is read, so a bad token or the wrong kind of account is refused
// the same way whatever it put in the body.
const requireAudience = (
  route: RouteDefinition,
  headers: Headers
): Effect.Effect<void, AppError> => {
  const { path } = route;
  const isWorkspace = path.startsWith(WORKSPACE_PREFIX);
  const isPortal = path.startsWith(PORTAL_PREFIX);
  // /me routes are for any signed-in account, including one that still has to
  // change its password.
  if (!isWorkspace && !isPortal && !path.startsWith(ME_PREFIX)) {
    return Effect.void;
  }
  return Effect.gen(function* gate() {
    yield* annotateRequest({
      method: route.method,
      operationId: route.operationId,
    });
    const session = yield* AuthSession;
    let user: AuthenticatedUser;
    if (isWorkspace) {
      user = yield* session.requireWorkspaceAccess(headers);
    } else if (isPortal) {
      user = yield* session.requirePortalAccess(headers);
    } else {
      user = yield* session.requireAuthenticated(headers);
    }
    yield* annotateRequest({ userId: user.id });
    // Counted only for a caller who passed the door.
    yield* consumeRateLimit(user.id);
  }).pipe(Effect.provide(AuthSessionLive));
};

export const readRouteInput = <Route extends RouteDefinition>(
  route: Route,
  request: Request,
  params: Readonly<Record<string, string>> = {}
): Effect.Effect<RouteInput<Route>, AppError> =>
  Effect.gen(function* readInput() {
    yield* requireAudience(route, request.headers);
    const input: Record<string, unknown> = {};
    if (route.params) {
      input["params"] = yield* decode(route.params, params);
    }
    if (route.query) {
      input["query"] = yield* decode(
        route.query,
        Object.fromEntries(new URL(request.url).searchParams)
      );
    }
    if (route.body) {
      input["body"] = yield* decode(route.body, yield* readJsonBody(request));
    }
    if (route.method !== "get" && route.idempotency !== "none") {
      input["idempotencyKey"] = yield* readIdempotencyKey(request.headers);
    }
    return input as RouteInput<Route>;
  });
