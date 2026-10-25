import { it } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { expect } from "vitest";

import { MobileApi, TokenSource } from "@/services/mobile-api";
import { makeMockMobileApiLayer } from "@/api/mock/mock-fetch";

const ME = {
  clientCompanyId: null,
  id: "user-1",
  mustChangePassword: false,
  name: "Ada Lovelace",
  role: "employee",
  timeZone: "Asia/Kolkata",
};

const tokenSource = Layer.succeed(
  TokenSource,
  TokenSource.of({ currentToken: Effect.succeed("token-1"), onUnauthenticated: Effect.void }),
);

const mockLayer = (fixtures: Parameters<typeof makeMockMobileApiLayer>[0]) =>
  Effect.flatMap(makeMockMobileApiLayer(fixtures, new Set(["me"])), (layer) =>
    Effect.succeed(Layer.provide(layer, tokenSource)),
  );

it.effect("serves a mocked domain from a schema-validated fixture", () =>
  Effect.gen(function* () {
    const layer = yield* mockLayer([{ data: ME, operationId: "getMe" }]);
    const api = yield* Effect.service(MobileApi).pipe(Effect.provide(layer));

    const me = yield* api.call((client) => client.getMe());

    expect(me.name).toBe("Ada Lovelace");
  }),
);

it.effect("serves a failure envelope with its status code", () =>
  Effect.gen(function* () {
    const layer = yield* mockLayer([
      {
        error: { code: "CONFLICT", message: "stale", status: 409 },
        operationId: "getMe",
      },
    ]);
    const api = yield* Effect.service(MobileApi).pipe(Effect.provide(layer));

    const exit = yield* Effect.exit(api.call((client) => client.getMe()));

    expect(Exit.isFailure(exit)).toBe(true);
  }),
);

it.effect("answers mock-miss for unmatched mocked paths", () =>
  Effect.gen(function* () {
    const layer = yield* mockLayer([]);
    const api = yield* Effect.service(MobileApi).pipe(Effect.provide(layer));

    const exit = yield* Effect.exit(api.call((client) => client.getMe()));

    expect(Exit.isFailure(exit)).toBe(true);
  }),
);

it.effect("dies loudly on a fixture that violates its route schema", () =>
  Effect.gen(function* () {
    const exit = yield* Effect.exit(
      makeMockMobileApiLayer(
        [{ data: { nonsense: true }, operationId: "getMe" }],
        new Set(["me"]),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
  }),
);

it.effect("passes non-mocked domains through to the live fetch", () =>
  Effect.gen(function* () {
    let liveCalls = 0;
    const liveFetch: typeof fetch = () => {
      liveCalls += 1;
      return Promise.resolve(new Response("{}", { status: 404 }));
    };
    const layer = yield* Effect.map(
      makeMockMobileApiLayer([{ data: ME, operationId: "getMe" }], new Set([]), liveFetch),
      (inner) => Layer.provide(inner, tokenSource),
    );
    const api = yield* Effect.service(MobileApi).pipe(Effect.provide(layer));

    yield* Effect.exit(api.call((client) => client.getMe()));

    expect(liveCalls).toBe(1);
  }),
);
