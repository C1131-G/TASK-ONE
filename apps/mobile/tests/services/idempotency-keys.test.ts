import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";

import { Conflict, Offline, RateLimited, Unavailable, type AppFailure, Forbidden } from "@/errors";
import {
  IdempotencyKeys,
  makeIdempotencyKeys,
} from "@/services/idempotency-keys";

const service = makeIdempotencyKeys();

it.live("reuses one key per intent across retries", () =>
  Effect.gen(function* () {
    const keys = yield* Effect.service(IdempotencyKeys);
    const seenKeys: string[] = [];
    let attempts = 0;

    const result = yield* keys.run("create-task", (key) =>
      Effect.suspend(() => {
        seenKeys.push(key);
        attempts += 1;
        return attempts < 3
          ? (Effect.fail(new Unavailable({ requestId: "r" })) as Effect.Effect<string, AppFailure>)
          : Effect.succeed("done");
      }),
    );

    expect(result).toBe("done");
    expect(attempts).toBe(3);
    expect(new Set(seenKeys).size).toBe(1);
    expect(seenKeys[0]?.length).toBeGreaterThanOrEqual(8);
  }).pipe(Effect.provide(service)),
);

it.effect("issues different keys for different intents", () =>
  Effect.gen(function* () {
    const keys = yield* Effect.service(IdempotencyKeys);
    const first = yield* keys.run("intent-a", (key) => Effect.succeed(key));
    const second = yield* keys.run("intent-b", (key) => Effect.succeed(key));

    expect(first).not.toBe(second);
  }).pipe(Effect.provide(service)),
);

it.effect("surfaces non-retryable failures immediately", () =>
  Effect.gen(function* () {
    const keys = yield* Effect.service(IdempotencyKeys);
    let attempts = 0;

    const exit = yield* Effect.exit(
      keys.run("blocked", () =>
        Effect.suspend(() => {
          attempts += 1;
          return Effect.fail(new Forbidden()) as Effect.Effect<never, AppFailure>;
        }),
      ),
    );

    expect(exit._tag).toBe("Failure");
    expect(attempts).toBe(1);
  }).pipe(Effect.provide(service)),
);

it.live("retries only Offline, RateLimited and Unavailable", () =>
  Effect.gen(function* () {
    const keys = yield* Effect.service(IdempotencyKeys);
    const cases: readonly [string, AppFailure, number][] = [
      ["offline", new Offline(), 4],
      ["limited", new RateLimited({}), 4],
      ["conflict", new Conflict({}), 1],
    ];

    for (const [intent, failure, expectedAttempts] of cases) {
      let attempts = 0;
      yield* Effect.exit(
        keys.run(intent, () =>
          Effect.suspend(() => {
            attempts += 1;
            return Effect.fail(failure) as Effect.Effect<never, AppFailure>;
          }),
        ),
      );
      expect(attempts).toBe(expectedAttempts);
    }
  }).pipe(Effect.provide(service)),
);

it.effect("forgets an intent so the next run uses a fresh key", () =>
  Effect.gen(function* () {
    const keys = yield* Effect.service(IdempotencyKeys);
    const first = yield* keys.run("intent", (key) => Effect.succeed(key));
    yield* keys.forget("intent");
    const second = yield* keys.run("intent", (key) => Effect.succeed(key));

    expect(first).not.toBe(second);
  }).pipe(Effect.provide(service)),
);

it.live("exhausts retries and returns the last failure", () =>
  Effect.gen(function* () {
    const keys = yield* Effect.service(IdempotencyKeys);
    let attempts = 0;

    const exit = yield* Effect.exit(
      keys.run("always-offline", () =>
        Effect.suspend(() => {
          attempts += 1;
          return Effect.fail(new Offline()) as Effect.Effect<never, AppFailure>;
        }),
      ),
    );

    expect(attempts).toBe(4);
    expect(exit._tag).toBe("Failure");
  }).pipe(Effect.provide(service)),
);
