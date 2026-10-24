import { Schema } from "effect";

import type { RouteDefinition } from "./route-definition";

// Notifications: inbox, read state, preferences, targets.
// Owned by one branch, so adding routes here never conflicts with the others.

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

export const NotificationPageQuerySchema = Schema.Struct({
  cursor: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
  limit: Schema.optional(
    Schema.FiniteFromString.check(
      Schema.isInt(),
      Schema.isBetween({ maximum: MAX_PAGE_SIZE, minimum: 1 })
    )
  ),
  unreadOnly: Schema.optional(Schema.Literals(["true", "false"])),
});

export const NOTIFICATION_PAGE_DEFAULT_SIZE = DEFAULT_PAGE_SIZE;

export const WorkspaceNotificationSchema = Schema.Struct({
  actorId: Schema.NullOr(Schema.String),
  actorName: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  id: Schema.String,
  projectId: Schema.NullOr(Schema.String),
  projectName: Schema.NullOr(Schema.String),
  readAt: Schema.NullOr(Schema.String),
  snippet: Schema.NullOr(Schema.String),
  taskId: Schema.NullOr(Schema.String),
  text: Schema.String,
  type: Schema.String,
});

export const WorkspaceInboxSchema = Schema.Struct({
  items: Schema.Array(WorkspaceNotificationSchema),
  nextCursor: Schema.NullOr(Schema.String),
  unreadCount: Schema.Number,
  unreadInboxCount: Schema.Number,
});

export const listWorkspaceNotificationsRoute = {
  data: WorkspaceInboxSchema,
  method: "get",
  operationId: "listWorkspaceNotifications",
  path: "/api/v1/workspace/notifications",
  query: NotificationPageQuerySchema,
  summary:
    "The caller's notifications, newest first, one page at a time, with the unread counts.",
} as const satisfies RouteDefinition;

const NotificationIdParamsSchema = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
});

const DoneSchema = Schema.Struct({ done: Schema.Literal(true) });
const CountSchema = Schema.Struct({ count: Schema.Number });

export const markWorkspaceNotificationReadRoute = {
  data: DoneSchema,
  method: "post",
  operationId: "markWorkspaceNotificationRead",
  params: NotificationIdParamsSchema,
  path: "/api/v1/workspace/notifications/{id}/read",
  summary:
    "Mark one of the caller's notifications read. Repeating it changes nothing.",
} as const satisfies RouteDefinition;

export const markAllWorkspaceNotificationsReadRoute = {
  data: CountSchema,
  method: "post",
  operationId: "markAllWorkspaceNotificationsRead",
  path: "/api/v1/workspace/notifications/read-all",
  summary:
    "Mark every unread notification of the caller read; answers how many changed.",
} as const satisfies RouteDefinition;

export const NotificationPreferenceSchema = Schema.Struct({
  channel: Schema.Literals(["in-app", "web-push", "email"]),
  enabled: Schema.Boolean,
  eventType: Schema.Literals([
    "mention",
    "assignment",
    "comment",
    "update",
    "due",
    "status",
  ]),
});

export const getWorkspaceNotificationPreferencesRoute = {
  data: Schema.Struct({
    preferences: Schema.Array(NotificationPreferenceSchema),
  }),
  method: "get",
  operationId: "getWorkspaceNotificationPreferences",
  path: "/api/v1/workspace/notifications/preferences",
  summary:
    "The kinds of notification the caller switched on or off, per channel.",
} as const satisfies RouteDefinition;

export const setWorkspaceNotificationPreferenceRoute = {
  body: NotificationPreferenceSchema,
  data: DoneSchema,
  method: "patch",
  operationId: "setWorkspaceNotificationPreference",
  path: "/api/v1/workspace/notifications/preferences",
  summary:
    "Switch one kind of notification on or off for one channel; email exists only for some kinds.",
} as const satisfies RouteDefinition;

export const notificationRoutes = [
  listWorkspaceNotificationsRoute,
  markWorkspaceNotificationReadRoute,
  markAllWorkspaceNotificationsReadRoute,
  getWorkspaceNotificationPreferencesRoute,
  setWorkspaceNotificationPreferenceRoute,
] as const satisfies readonly RouteDefinition[];
