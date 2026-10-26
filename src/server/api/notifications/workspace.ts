import { Effect } from "effect";

import type { RouteInput } from "../../../mobile-api/route-definition";
import type {
  listWorkspaceNotificationsRoute,
  markAllWorkspaceNotificationsReadRoute,
  markWorkspaceNotificationReadRoute,
  setWorkspaceNotificationPreferenceRoute,
} from "../../../mobile-api/routes-notifications";
import {
  getWorkspaceNotificationTargetRoute,
  NOTIFICATION_PAGE_DEFAULT_SIZE,
} from "../../../mobile-api/routes-notifications";
import { AuthSession } from "../../auth/session";
import type { AppError } from "../../core/action-result";
import type { InboxPage } from "../../notifications/contracts";
import { Notifications, NotificationsLive } from "../../notifications/service";
import { asStaffCaller } from "../bugs/caller";
import type { PathParams } from "../bugs/caller";
import {
  readNotificationPreferences,
  writeNotificationPreference,
} from "./preferences";
import { markAllNotificationsRead, markNotificationRead } from "./read-state";
import { openWorkspaceTarget } from "./target";

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

export const readWorkspacePreferences = (headers: Headers) =>
  Effect.gen(function* readPreferences() {
    const sessions = yield* AuthSession;
    const user = yield* sessions.requireWorkspaceAccess(headers);
    return yield* readNotificationPreferences(user.id);
  });

export const writeWorkspacePreference = (
  headers: Headers,
  input: RouteInput<typeof setWorkspaceNotificationPreferenceRoute>
) =>
  Effect.gen(function* writePreference() {
    const sessions = yield* AuthSession;
    const user = yield* sessions.requireWorkspaceAccess(headers);
    return yield* writeNotificationPreference(
      user.id,
      input.body,
      input.idempotencyKey
    );
  });

// Where a notification leads, checked against what the staff member may open now.
export const openWorkspaceNotificationTarget = (
  request: Request,
  params: PathParams
) =>
  asStaffCaller(
    getWorkspaceNotificationTargetRoute,
    request,
    params,
    ({ input, user }) => openWorkspaceTarget(user, input.params.id)
  );
