import { Schema } from "effect";

import type { MobileRouteDefinition } from "./route-definition";

export const NotificationKindSchema = Schema.Literals([
  "assignment",
  "comment",
  "mention",
  "update",
]);

export const InboxItemSchema = Schema.Struct({
  createdAt: Schema.String,
  id: Schema.String,
  kind: NotificationKindSchema,
  readAt: Schema.NullOr(Schema.String),
  taskId: Schema.NullOr(Schema.String),
  taskTitle: Schema.NullOr(Schema.String),
  title: Schema.String,
});

export const InboxPageSchema = Schema.Struct({
  items: Schema.Array(InboxItemSchema),
  unread: Schema.Number,
});

export const notificationRoutes = [
  {
    data: InboxPageSchema,
    method: "get",
    operationId: "listInbox",
    path: "/api/v1/workspace/inbox",
    query: Schema.Struct({
      unreadOnly: Schema.optional(Schema.String),
    }),
    summary: "Lists the signed-in user's inbox with the unread count.",
  },
  {
    data: Schema.Struct({ id: Schema.String, readAt: Schema.String }),
    method: "post",
    operationId: "markInboxItemRead",
    params: Schema.Struct({ id: Schema.String }),
    path: "/api/v1/workspace/inbox/{id}/read",
    summary: "Marks one inbox item read; requires an idempotency key.",
  },
  {
    data: Schema.Struct({ unread: Schema.Number }),
    method: "post",
    operationId: "markAllInboxRead",
    path: "/api/v1/workspace/inbox/read-all",
    summary: "Marks every inbox item read; requires an idempotency key.",
  },
] as const satisfies readonly MobileRouteDefinition[];
