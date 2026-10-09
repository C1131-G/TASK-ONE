import type { Schema } from "effect";
import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "./action-result";
import { isUniqueConstraintViolation } from "./prisma-errors";

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

export class IdempotencyResponseStore extends Context.Service<
  IdempotencyResponseStore,
  {
    readonly persist: (
      id: string,
      requestHash: string,
      response: typeof Schema.Json.Type
    ) => Effect.Effect<void, AppError>;
  }
>()("metsys/server/IdempotencyResponseStore") {}

export const IdempotencyResponseStoreLive = Layer.succeed(
  IdempotencyResponseStore,
  IdempotencyResponseStore.of({
    persist: (id, requestHash, response) =>
      Effect.tryPromise({
        catch: mapError,
        try: async () => {
          const updated = await db.orm.public.IdempotencyKey.where({
            id,
            requestHash,
          }).updateAndCount({ response });
          if (updated === 0) {
            throw new AppError({
              code: "CONFLICT",
              message: "The request reservation changed before it completed.",
            });
          }
        },
      }),
  })
);
