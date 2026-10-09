"use server";

import { Effect, Layer, Schema } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import {
  PushNotifications,
  PushNotificationsLive,
} from "@/src/server/notifications/push";
import { PushTransportLive } from "@/src/server/notifications/push-transport";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function registerPushSubscriptionAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      endpoint: Schema.String,
      idempotencyKey: IdempotencyKeySchema,
      keys: Schema.Struct({ auth: Schema.String, p256dh: Schema.String }),
      userAgent: Schema.NullOr(Schema.String),
    }),
    (validated) =>
      Effect.gen(function* registerPushSubscription() {
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
        const push = yield* PushNotifications;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...subscription } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            push
              .register(user.id, subscription)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: subscription,
          key: idempotencyKey,
          operation: "push.register",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(Layer.provide(PushNotificationsLive, PushTransportLive)),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (result.ok) {
    revalidatePath("/settings/notifications");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function removePushSubscriptionAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      endpoint: Schema.String,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* removePushSubscription() {
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
        const push = yield* PushNotifications;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            push
              .unregister(user.id, validated.endpoint)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { endpoint: validated.endpoint },
          key: validated.idempotencyKey,
          operation: "push.unregister",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(Layer.provide(PushNotificationsLive, PushTransportLive)),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (result.ok) {
    revalidatePath("/settings/notifications");
  }
  return result;
}
