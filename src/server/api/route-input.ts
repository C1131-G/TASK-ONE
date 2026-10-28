import { Effect, Schema } from "effect";

import type {
  RouteDefinition,
  RouteInput,
} from "../../mobile-api/route-definition";
import { AuthSession, AuthSessionLive } from "../auth/session";
import { AppError } from "../core/action-result";
import { invalidInput } from "../core/server-action";
import { readIdempotencyKey } from "./idempotency-key";

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

const readJsonBody = (request: Request): Effect.Effect<unknown, AppError> =>
  Effect.tryPromise({
    catch: () =>
      new AppError({
        code: "VALIDATION_FAILED",
        message: "The request body must be valid JSON.",
      }),
    try: () => request.json(),
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
  path: string,
  headers: Headers
): Effect.Effect<void, AppError> => {
  const isWorkspace = path.startsWith(WORKSPACE_PREFIX);
  const isPortal = path.startsWith(PORTAL_PREFIX);
  // /me routes are for any signed-in account, including one that still has to
  // change its password.
  if (!isWorkspace && !isPortal && !path.startsWith(ME_PREFIX)) {
    return Effect.void;
  }
  return Effect.gen(function* gate() {
    const session = yield* AuthSession;
    if (isWorkspace) {
      yield* session.requireWorkspaceAccess(headers);
    } else if (isPortal) {
      yield* session.requirePortalAccess(headers);
    } else {
      yield* session.requireAuthenticated(headers);
    }
  }).pipe(Effect.provide(AuthSessionLive));
};

export const readRouteInput = <Route extends RouteDefinition>(
  route: Route,
  request: Request,
  params: Readonly<Record<string, string>> = {}
): Effect.Effect<RouteInput<Route>, AppError> =>
  Effect.gen(function* readInput() {
    yield* requireAudience(route.path, request.headers);
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
