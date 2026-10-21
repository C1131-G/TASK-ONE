"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import { Effect, Schema } from "effect";
import { refresh, revalidatePath } from "next/cache";

import { runPortalAction } from "@/features/portal/portal-action-runner";
import { DoneResultSchema, Idempotency } from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { Notifications } from "@/src/server/notifications/service";

export async function markPortalNotificationReadAction(input: unknown) {
  const result = await runPortalAction(
    input,
    Schema.Struct({ notificationId: UUIDSchema }),
    (user, validated) =>
      Effect.gen(function* markPortalNotificationRead() {
        const notifications = yield* Notifications;
        yield* notifications.markRead(user.id, validated.notificationId);
        return { done: true as const };
      }),
    DoneResultSchema
  );
  if (result.ok) {
    revalidatePath("/portal/notifications");
    refresh();
  }
  return result;
}

export async function markAllPortalNotificationsReadAction(input: unknown) {
  const result = await runPortalAction(
    input,
    Schema.Struct({}),
    (user) =>
      Effect.gen(function* markAllPortalNotificationsRead() {
        const notifications = yield* Notifications;
        yield* notifications.markAllRead(user.id);
        return { done: true as const };
      }),
    DoneResultSchema
  );
  if (result.ok) {
    revalidatePath("/portal/notifications");
    refresh();
  }
  return result;
}

export async function setPortalEmailUpdatesAction(input: unknown) {
  const result = await runPortalAction(
    input,
    Schema.Struct({
      enabled: Schema.Boolean,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (user, validated) =>
      Effect.gen(function* setPortalEmailUpdates() {
        const notifications = yield* Notifications;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            notifications
              .setPreference(user.id, "email", "status", validated.enabled)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { enabled: validated.enabled },
          key: validated.idempotencyKey,
          operation: "portal.setEmailUpdates",
          resultSchema: DoneResultSchema,
        });
      }),
    DoneResultSchema
  );
  if (result.ok) {
    revalidatePath("/portal/account");
    refresh();
  }
  return result;
}
