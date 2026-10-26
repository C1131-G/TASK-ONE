import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { afterEach, expect, vi } from "vitest";

import { ALL_FIXTURES } from "@/api/mocks/all-fixtures";
import { makeMockMobileApiLayer } from "@/api/mock/mock-fetch";
import { makeApiLayer, pendingOperationIds, resolveApiMode } from "@/api/api-mode";
import { pendingRoutes } from "@/api/pending-routes";
import { MobileApi, TokenSource } from "@/services/mobile-api";

const tokenSource = Layer.succeed(
  TokenSource,
  TokenSource.of({ currentToken: Effect.succeed("token-1"), onUnauthenticated: Effect.void }),
);

it("defaults to live and only trusts the exact hybrid value", () => {
  expect(resolveApiMode(undefined)).toBe("live");
  expect(resolveApiMode("")).toBe("live");
  expect(resolveApiMode("mock")).toBe("live");
  expect(resolveApiMode("hybrid")).toBe("hybrid");
});

it("lists every pending operation and nothing else as mockable", () => {
  expect([...pendingOperationIds].toSorted()).toEqual(
    pendingRoutes.map((route) => route.operationId).toSorted(),
  );
});

it("has a schema-checked fixture for every pending operation", () => {
  const fixtureIds = new Set(ALL_FIXTURES.map((fixture) => fixture.operationId));

  expect([...pendingOperationIds].filter((id) => !fixtureIds.has(id))).toEqual([]);
});

it.effect("answers a pending operation from its fixture and sends live ones to the server", () =>
  Effect.gen(function* () {
    const liveUrls: string[] = [];
    const liveFetch: typeof fetch = (input) => {
      liveUrls.push(input instanceof Request ? input.url : String(input));
      return Promise.resolve(new Response("{}", { status: 404 }));
    };
    const layer = yield* Effect.map(
      makeMockMobileApiLayer(ALL_FIXTURES, new Set(), liveFetch, pendingOperationIds),
      (inner) => Layer.provide(inner, tokenSource),
    );
    const api = yield* Effect.service(MobileApi).pipe(Effect.provide(layer));

    const tasks = yield* api.call((client) =>
      (client as unknown as { listTasks: (input: object) => Promise<{ tasks: unknown[] }> }).listTasks({}),
    );
    yield* Effect.exit(api.call((client) => client.getMe()));

    expect(tasks.tasks.length).toBeGreaterThan(0);
    expect(liveUrls).toEqual(["https://mock.metsys.invalid/api/v1/me"]);
  }),
);

afterEach(() => {
  vi.unstubAllGlobals();
});

const recordFetch = (urls: string[]): void => {
  vi.stubGlobal("fetch", (input: Request | string | URL) => {
    urls.push(input instanceof Request ? input.url : String(input));
    return Promise.resolve(new Response("{}", { status: 404 }));
  });
};

const listTasksOn = (layer: Layer.Layer<MobileApi>) =>
  Effect.service(MobileApi).pipe(
    Effect.flatMap((api) =>
      api.call((client) =>
        (client as unknown as { listTasks: (input: object) => Promise<unknown> }).listTasks({}),
      ),
    ),
    Effect.exit,
    Effect.provide(layer),
  );

it.effect("live mode sends even pending operations to the server", () =>
  Effect.gen(function* () {
    const urls: string[] = [];
    recordFetch(urls);

    yield* listTasksOn(Layer.provide(makeApiLayer("live", "https://api.example.test"), tokenSource));

    expect(urls).toEqual(["https://api.example.test/api/v1/workspace/tasks"]);
  }),
);

it.effect("hybrid mode answers pending operations itself and sends the rest to the server", () =>
  Effect.gen(function* () {
    const urls: string[] = [];
    recordFetch(urls);
    const layer = Layer.provide(makeApiLayer("hybrid", "https://api.example.test"), tokenSource);

    const pending = yield* listTasksOn(layer);
    yield* Effect.exit(
      Effect.service(MobileApi).pipe(
        Effect.flatMap((api) => api.call((client) => client.getMe())),
        Effect.provide(layer),
      ),
    );

    expect(pending._tag).toBe("Success");
    expect(urls).toEqual(["https://api.example.test/api/v1/me"]);
  }),
);