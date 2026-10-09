"use server";

import { Effect, Schema } from "effect";
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
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import {
  Notifications,
  NotificationsLive,
  InboxSchema,
} from "@/src/server/notifications/service";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listNotificationInboxAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({
      limit: Schema.Number.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(1),
        Schema.isLessThanOrEqualTo(100)
      ),
      unreadOnly: Schema.Boolean,
    }),
    (validated) =>
      Effect.gen(function* listNotificationInbox() {
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
        const notifications = yield* Notifications;
        return yield* notifications.listInbox(user.id, validated);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(NotificationsLive)
      ),
    undefined,
    InboxSchema
  );
}

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
  runServerAction(
    input,
    schema,
    (validated) =>
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
      }).pipe(Effect.provide(AuthSessionLive)),
    undefined,
    ServerActionOutputSchema
  );

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

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
