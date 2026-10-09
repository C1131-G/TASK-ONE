import type { Schema } from "effect";
import { Effect, Layer } from "effect";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import type { ActionResult } from "@/src/server/core/action-result";
import type { Idempotency } from "@/src/server/core/idempotency";
import { IdempotencyLive } from "@/src/server/core/idempotency";
import { runServerAction } from "@/src/server/core/server-action";
import { StorageLive } from "@/src/server/storage/storage";
import { UploadsLive } from "@/src/server/storage/uploads";
import type { Uploads } from "@/src/server/storage/uploads-contracts";

export const runUploadAction = <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
  OutputSchema extends Schema.Codec<unknown, unknown, never, never>,
>(
  input: unknown,
  schema: InputSchema,
  execute: (
    userId: string,
    validated: InputSchema["Type"]
  ) => Effect.Effect<OutputSchema["Type"], AppError, Uploads | Idempotency>,
  outputSchema: OutputSchema
): Promise<ActionResult<OutputSchema["Type"]>> =>
  runServerAction(
    input,
    schema,
    (validated) =>
      Effect.gen(function* authorizeUploadAction() {
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        return yield* execute(user.id, validated).pipe(
          Effect.provide(Layer.provide(UploadsLive, StorageLive)),
          Effect.provide(IdempotencyLive)
        );
      }).pipe(Effect.provide(AuthSessionLive)),
    undefined,
    outputSchema
  );

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
