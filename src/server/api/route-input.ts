import { Effect, Schema } from "effect";

import type {
  RouteDefinition,
  RouteInput,
} from "../../mobile-api/route-definition";
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
// and, for writes, the idempotency key. A route handler runs this first, so a
// bad request is refused before any service work starts.
export const readRouteInput = <Route extends RouteDefinition>(
  route: Route,
  request: Request,
  params: Readonly<Record<string, string>> = {}
): Effect.Effect<RouteInput<Route>, AppError> =>
  Effect.gen(function* readInput() {
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
    if (route.method !== "get") {
      input["idempotencyKey"] = yield* readIdempotencyKey(request.headers);
    }
    return input as RouteInput<Route>;
  });
