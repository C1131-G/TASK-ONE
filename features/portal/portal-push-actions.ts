"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import { Effect, Schema, Layer } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  PushNotifications,
  PushNotificationsLive,
} from "@/src/server/notifications/push";
import { PushTransportLive } from "@/src/server/notifications/push-transport";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function registerPortalPushAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({
      endpoint: Schema.String,
      idempotencyKey: IdempotencyKeySchema,
      keys: Schema.Struct({ auth: Schema.String, p256dh: Schema.String }),
      userAgent: Schema.NullOr(Schema.String),
    }),
    (validated) =>
      Effect.gen(function* registerPortalPush() {
        const sessions = yield* AuthSession;
        const user = yield* sessions.requirePortalAccess(
          yield* requestHeadersOrFail
        );
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
          operation: "portal.push.register",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(Layer.provide(PushNotificationsLive, PushTransportLive)),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    DoneResultSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function removePortalPushAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({
      endpoint: Schema.String,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* removePortalPush() {
        const sessions = yield* AuthSession;
        const user = yield* sessions.requirePortalAccess(
          yield* requestHeadersOrFail
        );
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
          operation: "portal.push.unregister",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(Layer.provide(PushNotificationsLive, PushTransportLive)),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    DoneResultSchema
  );
}
