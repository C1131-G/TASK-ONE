import { Effect } from "effect";

import type { RouteInput } from "../../../mobile-api/route-definition";
import type { listWorkspaceNotificationsRoute } from "../../../mobile-api/routes-notifications";
import { NOTIFICATION_PAGE_DEFAULT_SIZE } from "../../../mobile-api/routes-notifications";
import { AuthSession } from "../../auth/session";
import type { AppError } from "../../core/action-result";
import type { InboxPage } from "../../notifications/contracts";
import { Notifications, NotificationsLive } from "../../notifications/service";

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
