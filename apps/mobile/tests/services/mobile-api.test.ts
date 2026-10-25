import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { expect } from "vitest";

import { MobileApi, makeMobileApiLayer, TokenSource } from "@/services/mobile-api";

const stubState = { authorization: null as string | null, unauthenticatedCalls: 0 };

const stubTokenSource = (token: string | null): Layer.Layer<TokenSource> =>
  Layer.succeed(
    TokenSource,
    TokenSource.of({
      currentToken: Effect.succeed(token),
      onUnauthenticated: Effect.sync(() => {
        stubState.unauthenticatedCalls += 1;
      }),
    }),
  );

const respondWith = (status: number, body: unknown) => (): Promise<Response> =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json", "x-request-id": "req-x" },
      status,
    }),
  );

const apiLayer = (token: string | null, respond: () => Promise<Response>) =>
  Layer.provide(
    makeMobileApiLayer({
      baseUrl: "https://unit.test",
      fetchImpl: (input, init) => {
        const request = new Request(input, init);
        stubState.authorization = request.headers.get("authorization");
        return respond();
      },
    }),
    stubTokenSource(token),
  );

const resetStub = (): void => {
  stubState.authorization = null;
  stubState.unauthenticatedCalls = 0;
};

it.effect("decodes a response through the shared client with the bearer token", () =>
  Effect.gen(function* () {
    resetStub();
    const api = yield* Effect.service(MobileApi);

    const me = yield* api.call((client) => client.getMe());

    expect(me.name).toBe("Ada Lovelace");
    expect(stubState.authorization).toBe("Bearer token-1");
  }).pipe(
    Effect.provide(
      apiLayer("token-1", respondWith(200, {
        ok: true,
        data: {
          clientCompanyId: null,
          id: "user-1",
          mustChangePassword: false,
          name: "Ada Lovelace",
          role: "employee",
          timeZone: "Asia/Kolkata",
        },
        requestId: "req-1",
      })),
    ),
  ),
);

it.effect("fails Unauthenticated without any request when signed out", () =>
  Effect.gen(function* () {
    resetStub();
    const api = yield* Effect.service(MobileApi);
    const exit = yield* Effect.exit(api.call((client) => client.getMe()));

    expect(exit._tag).toBe("Failure");
    expect(stubState.unauthenticatedCalls).toBe(0);
  }).pipe(
    Effect.provide(
      apiLayer(null, respondWith(200, { ok: true, data: {}, requestId: "req-1" })),
    ),
  ),
);

it.effect("clears the session when the server answers 401", () =>
  Effect.gen(function* () {
    resetStub();
    const api = yield* Effect.service(MobileApi);
    const exit = yield* Effect.exit(api.call((client) => client.getMe()));

    expect(exit._tag).toBe("Failure");
    expect(stubState.unauthenticatedCalls).toBe(1);
  }).pipe(
    Effect.provide(
      apiLayer("token-1", respondWith(401, {
        error: { code: "UNAUTHENTICATED", message: "gone", requestId: "req-2" },
        ok: false,
        requestId: "req-2",
      })),
    ),
  ),
);

it.effect("maps other failure codes through the shared mapper", () =>
  Effect.gen(function* () {
    resetStub();
    const api = yield* Effect.service(MobileApi);
    const exit = yield* Effect.exit(api.call((client) => client.getMe()));

    expect(exit._tag).toBe("Failure");
  }).pipe(
    Effect.provide(
      apiLayer("token-1", respondWith(403, {
        error: { code: "FORBIDDEN", message: "no", requestId: "req-3" },
        ok: false,
        requestId: "req-3",
      })),
    ),
  ),
);
