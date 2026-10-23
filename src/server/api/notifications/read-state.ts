import { Effect } from "effect";

import type { AppError } from "../../core/action-result";
import {
  CountResultSchema,
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "../../core/idempotency";
import { Notifications, NotificationsLive } from "../../notifications/service";

// Read state is shared by both audiences: it only ever touches rows of the
// person the bearer token names.
export const markNotificationRead = (
  userId: string,
  notificationId: string,
  idempotencyKey: string
): Effect.Effect<typeof DoneResultSchema.Type, AppError> =>
  Effect.gen(function* markRead() {
    const notifications = yield* Notifications;
    const idempotency = yield* Idempotency;
    return yield* idempotency.run({
      actorId: userId,
      execute: () =>
        notifications
          .markRead(userId, notificationId)
          .pipe(Effect.map(() => ({ done: true as const }))),
      input: { notificationId },
      key: idempotencyKey,
      operation: "notification.markRead",
      resultSchema: DoneResultSchema,
    });
  }).pipe(Effect.provide(NotificationsLive), Effect.provide(IdempotencyLive));

export const markAllNotificationsRead = (
  userId: string,
  idempotencyKey: string
): Effect.Effect<typeof CountResultSchema.Type, AppError> =>
  Effect.gen(function* markAllRead() {
    const notifications = yield* Notifications;
    const idempotency = yield* Idempotency;
    return yield* idempotency.run({
      actorId: userId,
      execute: () =>
        notifications
          .markAllRead(userId)
          .pipe(Effect.map((count) => ({ count }))),
      input: {},
      key: idempotencyKey,
      operation: "notification.markAllRead",
      resultSchema: CountResultSchema,
    });
  }).pipe(Effect.provide(NotificationsLive), Effect.provide(IdempotencyLive));
