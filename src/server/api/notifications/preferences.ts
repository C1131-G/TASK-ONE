import { Effect } from "effect";

import type { AppError } from "../../core/action-result";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "../../core/idempotency";
import type {
  NotificationChannel,
  NotificationPreferenceEvent,
  NotificationPreferenceValue,
} from "../../notifications/contracts";
import { Notifications, NotificationsLive } from "../../notifications/service";

export const readNotificationPreferences = (
  userId: string
): Effect.Effect<
  { readonly preferences: readonly NotificationPreferenceValue[] },
  AppError
> =>
  Effect.gen(function* readPreferences() {
    const notifications = yield* Notifications;
    const preferences = yield* notifications.listPreferences(userId);
    return { preferences };
  }).pipe(Effect.provide(NotificationsLive));

export const writeNotificationPreference = (
  userId: string,
  preference: {
    readonly channel: NotificationChannel;
    readonly enabled: boolean;
    readonly eventType: NotificationPreferenceEvent;
  },
  idempotencyKey: string
): Effect.Effect<typeof DoneResultSchema.Type, AppError> =>
  Effect.gen(function* writePreference() {
    const notifications = yield* Notifications;
    const idempotency = yield* Idempotency;
    return yield* idempotency.run({
      actorId: userId,
      execute: () =>
        notifications
          .setPreference(
            userId,
            preference.channel,
            preference.eventType,
            preference.enabled
          )
          .pipe(Effect.map(() => ({ done: true as const }))),
      input: {
        channel: preference.channel,
        enabled: preference.enabled,
        eventType: preference.eventType,
      },
      key: idempotencyKey,
      operation: "notification.setPreference",
      resultSchema: DoneResultSchema,
    });
  }).pipe(Effect.provide(NotificationsLive), Effect.provide(IdempotencyLive));
