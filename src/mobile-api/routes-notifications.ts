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

export const notificationRoutes = [
  listWorkspaceNotificationsRoute,
] as const satisfies readonly RouteDefinition[];
