import { Effect, Layer, Schema } from "effect";

import { clientRoutes } from "@/api/routes-for-client";
import type { RouteDefinition } from "@api/route-definition";
import type { AppErrorCode } from "@api/route-definition";
import { makeMobileApiLayer, type MobileApi, type TokenSource } from "@/services/mobile-api";

export interface MockFailure {
  readonly code: AppErrorCode;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly message?: string;
  readonly status: number;
}

export interface MockFixture {
  /** The matched route's data, encoded through the route's own schema. */
  readonly data?: unknown;
  readonly error?: MockFailure;
  readonly operationId: string;
  readonly requestId?: string;
}

export interface RegisteredFixture {
  readonly failure?: MockFailure;
  readonly requestId: string;
  readonly response: unknown;
  readonly route: RouteDefinition;
}

/**
 * Validates every fixture against its route's schema up front, so a fixture
 * that drifts from the live contract fails loudly instead of serving stale
 * shapes to screens.
 */
export const registerFixtures = (
  fixtures: readonly MockFixture[],
): Effect.Effect<ReadonlyMap<string, RegisteredFixture>> =>
  Effect.forEach(fixtures, (fixture) =>
    Effect.gen(function* () {
      const route = clientRoutes.find((candidate) => candidate.operationId === fixture.operationId);
      if (route === undefined) {
        return yield* Effect.die(new Error(`Mock fixture for unknown operationId ${fixture.operationId}`));
      }
      const requestId = fixture.requestId ?? "mock-request";
      const response =
        fixture.error !== undefined
          ? {
              error: {
                code: fixture.error.code,
                message: fixture.error.message ?? fixture.error.code,
                requestId,
                ...(fixture.error.fieldErrors === undefined
                  ? {}
                  : { fieldErrors: fixture.error.fieldErrors }),
              },
              ok: false,
              requestId,
            }
          : {
              data: yield* Effect.orDie(
          Schema.encodeUnknownEffect(route.data as unknown as Schema.Codec<unknown, unknown, never, never>)(
            fixture.data ?? {},
          ),
        ),
              ok: true,
              requestId,
            };
      return [
        `${fixture.operationId}`,
        {
          ...(fixture.error === undefined ? {} : { failure: fixture.error }),
          requestId,
          response,
          route,
        },
      ] as const;
    }),
  ).pipe(Effect.map((entries) => new Map(entries)));

const pathMatches = (pattern: string, pathname: string): boolean => {
  const patternSegments = pattern.split("/").filter((segment) => segment.length > 0);
  const pathSegments = pathname.split("/").filter((segment) => segment.length > 0);
  if (patternSegments.length !== pathSegments.length) {
    return false;
  }
  return patternSegments.every(
    (segment, index) =>
      (segment.startsWith("{") && segment.endsWith("}")) || segment === pathSegments[index],
  );
};

export const domainOfPath = (pathname: string): string => {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  // /api/v1/me is account; /api/v1/{workspace|portal}/<domain>/... names the domain.
  if (segments[2] === "workspace" || segments[2] === "portal") {
    return segments[3] ?? "unknown";
  }
  return segments[2] ?? "unknown";
};

export interface HybridFetchOptions {
  /** OperationId prefixes (lowercase) routed to fixtures; everything else goes live. */
  readonly liveFetch: typeof fetch;
  readonly mockedDomains: ReadonlySet<string>;
  /** Operations answered from fixtures wherever their domain is otherwise live. */
  readonly mockedOperations?: ReadonlySet<string>;
  readonly registered: ReadonlyMap<string, RegisteredFixture>;
}

/** Builds a fetch that serves mocked domains from fixtures and passes the rest through. */
export const createHybridFetch = (options: HybridFetchOptions): typeof fetch => {
  const registeredByPath = new Map(
    [...options.registered.values()].map((fixture) => [
      `${fixture.route.method.toUpperCase()} ${fixture.route.path}`,
      fixture,
    ]),
  );
  return (input, init) => {
    const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
    const { pathname } = new URL(request.url);
    const match = [...registeredByPath].find(
      ([key]) =>
        key.startsWith(`${request.method.toUpperCase()} `) &&
        pathMatches(key.slice(request.method.length + 1), pathname),
    );
    const mockedByOperation =
      match !== undefined && options.mockedOperations?.has(match[1].route.operationId) === true;
    if (!options.mockedDomains.has(domainOfPath(pathname)) && !mockedByOperation) {
      return options.liveFetch(request);
    }
    const status = match === undefined ? 404 : match[1].failure === undefined ? 200 : match[1].failure.status;
    const body = match === undefined ? { ok: false, requestId: "mock-miss" } : match[1].response;
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json", "x-request-id": "mock-request" },
        status,
      }),
    );
  };
};

export const MOCK_BASE_URL = "https://mock.metsys.invalid";

/** Assembles the MobileApi layer whose mocked domains answer from fixtures. */
export const makeMockMobileApiLayer = (
  fixtures: readonly MockFixture[],
  mockedDomains: ReadonlySet<string>,
  liveFetch: typeof fetch = fetch,
  mockedOperations: ReadonlySet<string> = new Set(),
  baseUrl: string = MOCK_BASE_URL,
): Effect.Effect<Layer.Layer<MobileApi, never, TokenSource>> =>
  Effect.map(registerFixtures(fixtures), (registered) =>
    makeMobileApiLayer({
      baseUrl,
      fetchImpl: createHybridFetch({ liveFetch, mockedDomains, mockedOperations, registered }),
    }),
  );
