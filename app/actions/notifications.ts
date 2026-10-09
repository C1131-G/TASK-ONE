"use server";

import { Effect, Layer, Schema } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import type { ActionResult } from "@/src/server/core/action-result";
import {
  CountResultSchema,
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";
import {
  PushNotifications,
  PushNotificationsLive,
} from "@/src/server/notifications/push";
import { PushTransportLive } from "@/src/server/notifications/push-transport";
import {
  Notifications,
  NotificationsLive,
} from "@/src/server/notifications/service";

const runNotificationAction = <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
  Result,
>(
  input: unknown,
  schema: InputSchema,
  execute: (
    userId: string,
    validated: InputSchema["Type"]
  ) => Effect.Effect<Result, AppError, Notifications | Idempotency>
): Promise<ActionResult<Result>> =>
  runServerAction(input, schema, (validated) =>
    Effect.gen(function* authorizeNotificationAction() {
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
        Effect.provide(NotificationsLive),
        Effect.provide(IdempotencyLive)
      );
    }).pipe(Effect.provide(AuthSessionLive))
  );

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function markNotificationReadAction(input: unknown) {
  const result = await runNotificationAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      notificationId: Schema.String,
    }),
    (userId, validated) =>
      Effect.gen(function* markNotificationRead() {
        const notifications = yield* Notifications;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: userId,
          execute: () =>
            notifications
              .markRead(userId, validated.notificationId)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { notificationId: validated.notificationId },
          key: validated.idempotencyKey,
          operation: "notification.markRead",
          resultSchema: DoneResultSchema,
        });
      })
  );
  if (result.ok) {
    revalidatePath("/notifications");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function markAllNotificationsReadAction(input: unknown) {
  const result = await runNotificationAction(
    input,
    Schema.Struct({ idempotencyKey: IdempotencyKeySchema }),
    (userId, validated) =>
      Effect.gen(function* markAllNotificationsRead() {
        const notifications = yield* Notifications;
        const idempotency = yield* Idempotency;
        const count = yield* idempotency.run({
          actorId: userId,
          execute: () =>
            notifications
              .markAllRead(userId)
              .pipe(Effect.map((updated) => ({ count: updated }))),
          input: {},
          key: validated.idempotencyKey,
          operation: "notification.markAllRead",
          resultSchema: CountResultSchema,
        });
        return count.count;
      })
  );
  if (result.ok) {
    revalidatePath("/notifications");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function setNotificationPreferenceAction(input: unknown) {
  const result = await runNotificationAction(
    input,
    Schema.Struct({
      channel: Schema.Literals(["in-app", "web-push"]),
      enabled: Schema.Boolean,
      eventType: Schema.Literals([
        "mention",
        "assignment",
        "comment",
        "update",
        "due",
      ]),
      idempotencyKey: IdempotencyKeySchema,
    }),
    (userId, validated) =>
      Effect.gen(function* setNotificationPreference() {
        const notifications = yield* Notifications;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: userId,
          execute: () =>
            notifications
              .setPreference(
                userId,
                validated.channel,
                validated.eventType,
                validated.enabled
              )
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: {
            channel: validated.channel,
            enabled: validated.enabled,
            eventType: validated.eventType,
          },
          key: validated.idempotencyKey,
          operation: "notification.setPreference",
          resultSchema: DoneResultSchema,
        });
      })
  );
  if (result.ok) {
    revalidatePath("/settings/notifications");
  }
  return result;
}

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
      )
  );
  if (result.ok) {
    revalidatePath("/settings/notifications");
  }
  return result;
}

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
      )
  );
  if (result.ok) {
    revalidatePath("/settings/notifications");
  }
  return result;
}
