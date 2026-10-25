import { Context, Effect, Layer, Random } from "effect";

import {
  Conflict,
  Forbidden,
  NotFound,
  Offline,
  RateLimited,
  Unauthenticated,
  Unavailable,
  type AppFailure,
} from "@/errors";

const RETRYABLE_TAGS: ReadonlySet<AppFailure["_tag"]> = new Set([
  "Offline",
  "RateLimited",
  "Unavailable",
]);

const isRetryable = (error: AppFailure): boolean => RETRYABLE_TAGS.has(error._tag);

const KEY_MAX_ATTEMPTS = 3;

const RETRY_DELAY_MS = 150;

/** Exponential backoff with jitter for the nth retry (0-based). */
const retryDelay = (attempt: number): Effect.Effect<void> =>
  Effect.flatMap(
    Random.nextIntBetween(0, Math.floor(RETRY_DELAY_MS * 2 ** attempt * 0.3)),
    (jitter) => Effect.sleep(`${RETRY_DELAY_MS * 2 ** attempt + jitter} millis`),
  );

export class IdempotencyKeys extends Context.Service<
  IdempotencyKeys,
  {
    /**
     * Runs one write under one user intent: the key is created once, reused
     * across retries, and only Offline, RateLimited and Unavailable trigger
     * a retry. Conflict, Forbidden, NotFound and Unauthenticated surface
     * immediately.
     */
    readonly run: <A>(
      intent: string,
      program: (key: string) => Effect.Effect<A, AppFailure>,
    ) => Effect.Effect<A, AppFailure>;
    /** Drops the stored key for an intent (used when a screen abandons it). */
    readonly forget: (intent: string) => Effect.Effect<void>;
  }
>()("metsys/mobile/IdempotencyKeys") {}

const newKey = Effect.map(
  Effect.all([Random.nextIntBetween(0x10000, 0xfffff), Random.nextIntBetween(0x10000, 0xfffff)]),
  ([first, second]) => `m${first.toString(16)}${second.toString(16)}`,
);

const withRetries = <A>(
  program: Effect.Effect<A, AppFailure>,
  attemptsLeft: number,
): Effect.Effect<A, AppFailure> =>
  Effect.catchIf(program, isRetryable, (cause) =>
    attemptsLeft <= 0
      ? Effect.fail(cause)
      : Effect.flatMap(retryDelay(KEY_MAX_ATTEMPTS - attemptsLeft), () =>
          withRetries(program, attemptsLeft - 1),
        ),
  );

export const makeIdempotencyKeys = (): Layer.Layer<IdempotencyKeys> =>
  Layer.effect(
    IdempotencyKeys,
    Effect.sync(() => {
      const keys = new Map<string, string>();
      return IdempotencyKeys.of({
        forget: (intent) =>
          Effect.sync(() => {
            keys.delete(intent);
          }),
        run: (intent, program) =>
          Effect.flatMap(
            Effect.flatMap(
              Effect.sync(() => keys.get(intent)),
              (existing) =>
                existing === undefined
                  ? Effect.map(newKey, (key) => {
                      keys.set(intent, key);
                      return key;
                    })
                  : Effect.succeed(existing),
            ),
            (key) => withRetries(program(key), KEY_MAX_ATTEMPTS),
          ),
      });
    }),
  );

// Pinned by the retry contract tests; kept importable for screens matching on tags.
export const NON_RETRYABLE = { Conflict, Forbidden, NotFound, Unauthenticated };

