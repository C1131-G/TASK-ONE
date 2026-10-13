import "server-only";
import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  InboxSchema,
  NotificationPreferencesSchema,
  Notifications,
  NotificationsLive,
} from "@/src/server/notifications/service";

export const listNotificationInbox = async (input: unknown) =>
  await runServerAction(
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
      Effect.gen(function* listNotificationInboxProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
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

export const getNotificationPreferences = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* getNotificationPreferencesProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const notifications = yield* Notifications;
        return yield* notifications.listPreferences(user.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(NotificationsLive)
      ),
    undefined,
    NotificationPreferencesSchema
  );
