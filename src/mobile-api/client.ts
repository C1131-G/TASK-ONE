import { Schema } from "effect";

import { mobileRoutes } from "./routes";
import type { AppErrorCode, RouteDefinition } from "./routes";

type Route = (typeof mobileRoutes)[number];

// One method per operation, typed from the route list: renaming or reshaping
// a route breaks the app's build instead of its users.
export type MobileClient = {
  readonly [R in Route as R["operationId"]]: () => Promise<R["data"]["Type"]>;
};

export class MobileApiError extends Error {
  readonly code: AppErrorCode;
  readonly requestId: string;
  readonly status: number;
  readonly fieldErrors: Readonly<Record<string, string>> | undefined;

  constructor(
    status: number,
    failure: {
      readonly code: AppErrorCode;
      readonly message: string;
      readonly requestId: string;
      readonly fieldErrors?: Readonly<Record<string, string>> | undefined;
    }
  ) {
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

const UNAVAILABLE_FAILURE = {
  code: "UNAVAILABLE",
  message: "The server sent an answer the app cannot read.",
  requestId: "",
} as const;

export const createMobileClient = (options: ClientOptions): MobileClient => {
  const send = options.fetch ?? fetch;

  const call = async (route: RouteDefinition): Promise<unknown> => {
    const response = await send(new URL(route.path, options.baseUrl), {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${options.token}`,
      },
      method: route.method.toUpperCase(),
    });
    const body = (await response.json().catch(() => null)) as {
      readonly data?: unknown;
      readonly error?: ConstructorParameters<typeof MobileApiError>[1];
      readonly ok?: boolean;
    } | null;

    if (!response.ok || !body?.ok) {
      throw new MobileApiError(
        response.status,
        body?.error ?? {
          ...UNAVAILABLE_FAILURE,
          requestId: response.headers.get("x-request-id") ?? "",
        }
      );
    }
    return Schema.decodeUnknownSync(
      route.data as Schema.ConstraintDecoder<unknown>
    )(body.data);
  };

  return Object.fromEntries(
    mobileRoutes.map((route) => [route.operationId, () => call(route)])
  ) as unknown as MobileClient;
};
