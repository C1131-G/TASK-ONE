import { createHash, randomUUID } from "node:crypto";

import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "./action-result";
import {
  IdempotencyResponseStore,
  IdempotencyResponseStoreLive,
} from "./idempotency-response-store";
import { isUniqueConstraintViolation } from "./prisma-errors";

const KEY_SCHEMA = Schema.String.check(
  Schema.isMinLength(8),
  Schema.isMaxLength(128)
);
export const DoneResultSchema = Schema.Struct({ done: Schema.Literal(true) });

export const CountResultSchema = Schema.Struct({ count: Schema.Number });

const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;

interface IdempotencyRunInput<
  ResultSchema extends Schema.Codec<unknown, unknown, never, never>,
> {
  readonly actorId: string;
  readonly key: string;
  readonly operation: string;
  readonly input: unknown;
  readonly resultSchema: ResultSchema;
  readonly execute: () => Effect.Effect<ResultSchema["Type"], AppError>;
}

export class Idempotency extends Context.Service<
  Idempotency,
  {
    readonly run: <
      ResultSchema extends Schema.Codec<unknown, unknown, never, never>,
    >(
      input: IdempotencyRunInput<ResultSchema>
    ) => Effect.Effect<ResultSchema["Type"], AppError>;
  }
>()("metsys/server/Idempotency") {}

const mapError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (isUniqueConstraintViolation(error)) {
    return new AppError({
      code: "CONFLICT",
      message: "This request is already being processed.",
    });
  }
  return new AppError({
    code: "UNAVAILABLE",
    message: "The request could not be completed.",
  });
};

const hashRequest = (operation: string, input: unknown): string =>
  createHash("sha256")
    .update(JSON.stringify({ input, operation }))
    .digest("hex");

const runInTransaction = <
  ResultSchema extends Schema.Codec<unknown, unknown, never, never>,
>(
  input: IdempotencyRunInput<ResultSchema>,
  responseStore: IdempotencyResponseStore["Service"]
): Effect.Effect<ResultSchema["Type"], AppError> =>
  Effect.gen(function* executeIdempotently() {
    const key = yield* Effect.try({
      catch: () =>
        new AppError({
          code: "VALIDATION_FAILED",
          message: "The idempotency key is invalid.",
        }),
      try: () => Schema.decodeUnknownSync(KEY_SCHEMA)(input.key),
    });
    const requestHash = yield* Effect.try({
      catch: () =>
        new AppError({
          code: "VALIDATION_FAILED",
          message: "This request cannot be safely deduplicated.",
        }),
      try: () => hashRequest(input.operation, input.input),
    });
    const now = new Date();
    const reservation = yield* Effect.tryPromise({
      catch: mapError,
      try: async () => {
        const existing = await db.orm.public.IdempotencyKey.where({
          actorId: input.actorId,
          key,
        }).first();
        if (existing && existing.expiresAt > now) {
          return { created: false as const, record: existing };
        }
        if (existing) {
          await db.orm.public.IdempotencyKey.where({
            id: existing.id,
          }).delete();
        }
        const record = await db.orm.public.IdempotencyKey.create({
          actorId: input.actorId,
          createdAt: now,
          expiresAt: new Date(now.getTime() + KEY_LIFETIME_MS),
          id: randomUUID(),
          key,
          requestHash,
          response: null,
        });
        return { created: true as const, record };
      },
    });

    if (!reservation.created) {
      if (reservation.record.requestHash !== requestHash) {
        return yield* Effect.fail(
          new AppError({
            code: "CONFLICT",
            message: "This idempotency key was used for a different request.",
          })
        );
      }
      if (reservation.record.response === null) {
        return yield* Effect.fail(
          new AppError({
            code: "CONFLICT",
            message: "This request is still being processed.",
          })
        );
      }
      return yield* Effect.try({
        catch: () =>
          new AppError({
            code: "CONFLICT",
            message: "The stored result no longer matches this operation.",
          }),
        try: () =>
          Schema.decodeUnknownSync(input.resultSchema)(
            reservation.record.response
          ),
      });
    }

    const result = yield* input.execute().pipe(
      Effect.tapError(() =>
        Effect.tryPromise({
          catch: mapError,
          try: () =>
            db.orm.public.IdempotencyKey.where({
              id: reservation.record.id,
            }).delete(),
        }).pipe(Effect.ignore)
      )
    );
    const response = yield* Effect.try({
      catch: () =>
        new AppError({
          code: "UNAVAILABLE",
          message: "The request result could not be saved safely.",
        }),
      try: () =>
        Schema.decodeUnknownSync(Schema.Json)(
          Schema.encodeUnknownSync(input.resultSchema)(result)
        ),
    });
    yield* responseStore.persist(reservation.record.id, requestHash, response);
    // Return what a replay would return, so a client never sees a different
    // shape on the first call than on a retry.
    return yield* Effect.try({
      catch: () =>
        new AppError({
          code: "UNAVAILABLE",
          message: "The request result could not be saved safely.",
        }),
      try: () => Schema.decodeUnknownSync(input.resultSchema)(response),
    });
  });

const makeRun =
  (responseStore: IdempotencyResponseStore["Service"]) =>
  <ResultSchema extends Schema.Codec<unknown, unknown, never, never>>(
    input: IdempotencyRunInput<ResultSchema>
  ): Effect.Effect<ResultSchema["Type"], AppError> =>
    Effect.tryPromise({
      catch: mapError,
      try: () =>
        db.transaction(() =>
          Effect.runPromise(runInTransaction(input, responseStore))
        ),
    });

export const IdempotencyServiceLive = Layer.effect(
  Idempotency,
  Effect.map(Effect.service(IdempotencyResponseStore), (responseStore) =>
    Idempotency.of({ run: makeRun(responseStore) })
  )
);

export const IdempotencyLive = Layer.provide(
  IdempotencyServiceLive,
  IdempotencyResponseStoreLive
);
