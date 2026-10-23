import { Schema } from "effect";

import { IDEMPOTENCY_KEY_HEADER } from "./idempotency";
import type {
  AppErrorCode,
  RouteDefinition,
  RouteInput,
} from "./route-definition";
import { mobileRoutes } from "./routes";

// One method per operation, typed from the route list: renaming or reshaping
// a route breaks the app's build instead of its users. A route with nothing to
// send takes no argument.
export type MobileClientFor<Routes extends readonly RouteDefinition[]> = {
  readonly [
    Route in Routes[number] as Route["operationId"]
  ]: keyof RouteInput<Route> extends never
    ? () => Promise<Route["data"]["Type"]>
    : (input: RouteInput<Route>) => Promise<Route["data"]["Type"]>;
};

export type MobileClient = MobileClientFor<typeof mobileRoutes>;

interface Failure {
  readonly code: AppErrorCode;
  readonly message: string;
  readonly requestId: string;
  readonly fieldErrors?: Readonly<Record<string, string>> | undefined;
}

export class MobileApiError extends Error {
  readonly code: AppErrorCode;
  readonly requestId: string;
  readonly status: number;
  readonly fieldErrors: Readonly<Record<string, string>> | undefined;

  constructor(status: number, failure: Failure) {
    super(failure.message);
    this.name = "MobileApiError";
    this.code = failure.code;
    this.requestId = failure.requestId;
    this.status = status;
    this.fieldErrors = failure.fieldErrors;
  }
}

interface ClientOptions {
  readonly baseUrl: string;
  readonly token: string;
  // Replaceable so tests (and the app's own networking layer) can route calls.
  readonly fetch?: (
    input: Request | string | URL,
    init?: RequestInit
  ) => Promise<Response>;
}

interface CallInput {
  readonly params?: unknown;
  readonly query?: unknown;
  readonly body?: unknown;
  readonly idempotencyKey?: string;
}

const UNAVAILABLE_FAILURE = {
  code: "UNAVAILABLE",
  message: "The server sent an answer the app cannot read.",
  requestId: "",
} as const;

type Encoder = Schema.Codec<unknown, unknown, never, never>;

// The route's own schema turns typed values into the text or JSON that goes on
// the wire, so the client and server cannot disagree about the format.
const encode = (schema: Schema.Constraint, value: unknown): unknown =>
  Schema.encodeUnknownSync(schema as Encoder)(value);

const fillPath = (route: RouteDefinition, params: unknown): string => {
  const encoded = (route.params ? encode(route.params, params) : {}) as Record<
    string,
    unknown
  >;
  return route.path.replaceAll(/\{(?<name>[^}]+)\}/gu, (_match, name: string) =>
    encodeURIComponent(String(encoded[name]))
  );
};

const buildUrl = (
  route: RouteDefinition,
  options: ClientOptions,
  input: CallInput
): URL => {
  const url = new URL(fillPath(route, input.params), options.baseUrl);
  if (route.query) {
    const encoded = encode(route.query, input.query ?? {}) as Record<
      string,
      unknown
    >;
    for (const [name, value] of Object.entries(encoded)) {
      if (value !== undefined) {
        url.searchParams.set(name, String(value));
      }
    }
  }
  return url;
};

export const buildClient = <const Routes extends readonly RouteDefinition[]>(
  routes: Routes,
  options: ClientOptions
): MobileClientFor<Routes> => {
  const send = options.fetch ?? fetch;

  const call = async (
    route: RouteDefinition,
    input: CallInput
  ): Promise<unknown> => {
    const headers: Record<string, string> = {
      accept: "application/json",
      authorization: `Bearer ${options.token}`,
    };
    if (input.idempotencyKey) {
      headers[IDEMPOTENCY_KEY_HEADER] = input.idempotencyKey;
    }
    let body: string | undefined;
    if (route.body) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(encode(route.body, input.body));
    }

    const response = await send(buildUrl(route, options, input), {
      ...(body === undefined ? {} : { body }),
      headers,
      method: route.method.toUpperCase(),
    });
    const answer = (await response.json().catch(() => null)) as {
      readonly data?: unknown;
      readonly error?: Failure;
      readonly ok?: boolean;
    } | null;

    if (!response.ok || !answer?.ok) {
      throw new MobileApiError(
        response.status,
        answer?.error ?? {
          ...UNAVAILABLE_FAILURE,
          requestId: response.headers.get("x-request-id") ?? "",
        }
      );
    }
    return Schema.decodeUnknownSync(
      route.data as Schema.ConstraintDecoder<unknown>
    )(answer.data);
  };

  return Object.fromEntries(
    routes.map((route) => [
      route.operationId,
      (input: CallInput = {}) => call(route, input),
    ])
  ) as unknown as MobileClientFor<Routes>;
};

export const createMobileClient = (options: ClientOptions): MobileClient =>
  buildClient(mobileRoutes, options);
