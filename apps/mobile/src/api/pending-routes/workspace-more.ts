import { Schema } from "effect";

import type { MobileRouteDefinition } from "./route-definition";

export const ApprovalRequestSchema = Schema.Struct({
  bugTitle: Schema.String,
  id: Schema.String,
  projectName: Schema.String,
  reportedBy: Schema.String,
  status: Schema.Literals(["pending", "approved", "rejected"]),
});

export const WorkspaceNotificationSchema = Schema.Struct({
  createdAt: Schema.String,
  id: Schema.String,
  kind: Schema.Literals(["assignment", "comment", "mention", "update"]),
  readAt: Schema.NullOr(Schema.String),
  title: Schema.String,
});

export const workspaceMoreRoutes = [
  {
    data: Schema.Struct({ items: Schema.Array(ApprovalRequestSchema) }),
    method: "get",
    operationId: "listBugApprovals",
    path: "/api/v1/workspace/bug-approvals",
    summary: "Lists the bug approval requests with their status.",
  },
  {
    data: Schema.Struct({ items: Schema.Array(WorkspaceNotificationSchema) }),
    method: "get",
    operationId: "listNotifications",
    path: "/api/v1/workspace/notifications",
    summary: "Lists the user's notifications page items.",
  },
] as const satisfies readonly MobileRouteDefinition[];
