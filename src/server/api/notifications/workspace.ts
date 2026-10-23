import { Effect } from "effect";

import type { RouteInput } from "../../../mobile-api/route-definition";
import type {
  listWorkspaceNotificationsRoute,
  markAllWorkspaceNotificationsReadRoute,
  markWorkspaceNotificationReadRoute,
} from "../../../mobile-api/routes-notifications";
import { NOTIFICATION_PAGE_DEFAULT_SIZE } from "../../../mobile-api/routes-notifications";
import { AuthSession } from "../../auth/session";
import type { AppError } from "../../core/action-result";
import type { InboxPage } from "../../notifications/contracts";
import { Notifications, NotificationsLive } from "../../notifications/service";
import { markAllNotificationsRead, markNotificationRead } from "./read-state";

// A staff member's inbox. The person is the one the bearer token names.
export const listWorkspaceInbox = (
  headers: Headers,
  input: RouteInput<typeof listWorkspaceNotificationsRoute>
): Effect.Effect<InboxPage, AppError, AuthSession> =>
  Effect.gen(function* listInbox() {
    const sessions = yield* AuthSession;
    const user = yield* sessions.requireWorkspaceAccess(headers);
    const notifications = yield* Notifications;
    return yield* notifications.listInbox(user.id, {
      cursor: input.query.cursor ?? null,
      limit: input.query.limit ?? NOTIFICATION_PAGE_DEFAULT_SIZE,
      unreadOnly: input.query.unreadOnly === "true",
    });
  }).pipe(Effect.provide(NotificationsLive));

export const markWorkspaceNotificationRead = (
  headers: Headers,
  input: RouteInput<typeof markWorkspaceNotificationReadRoute>
) =>
  Effect.gen(function* markRead() {
    const sessions = yield* AuthSession;
    const user = yield* sessions.requireWorkspaceAccess(headers);
    return yield* markNotificationRead(
      user.id,
      input.params.id,
      input.idempotencyKey
    );
  });

export const markAllWorkspaceNotificationsRead = (
  headers: Headers,
  input: RouteInput<typeof markAllWorkspaceNotificationsReadRoute>
) =>
  Effect.gen(function* markAllRead() {
    const sessions = yield* AuthSession;
    const user = yield* sessions.requireWorkspaceAccess(headers);
    return yield* markAllNotificationsRead(user.id, input.idempotencyKey);
  });
