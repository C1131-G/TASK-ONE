"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import { Effect, Schema } from "effect";
import { refresh, revalidatePath } from "next/cache";

import { runPortalAction } from "@/features/portal/portal-action-runner";
import { DoneResultSchema } from "@/src/server/core/idempotency";
import { UUIDSchema } from "@/src/server/core/input-schemas";
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
