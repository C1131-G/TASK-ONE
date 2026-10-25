import { Schema } from "effect";

import type { MobileRouteDefinition } from "./route-definition";

export const ApprovalItemSchema = Schema.Struct({
  id: Schema.String,
  projectName: Schema.String,
  requestedBy: Schema.String,
  status: Schema.Literals(["pending", "approved", "rejected"]),
  title: Schema.String,
});

export const PortalNotificationSchema = Schema.Struct({
  createdAt: Schema.String,
  id: Schema.String,
  readAt: Schema.NullOr(Schema.String),
  title: Schema.String,
});

export const portalMoreRoutes = [
  {
    data: Schema.Struct({ items: Schema.Array(ApprovalItemSchema) }),
    method: "get",
    operationId: "listPortalApprovals",
    path: "/api/v1/portal/approvals",
    summary: "Lists the client's pending and decided approvals.",
  },
  {
    data: Schema.Struct({ items: Schema.Array(PortalNotificationSchema) }),
    method: "get",
    operationId: "listPortalNotifications",
    path: "/api/v1/portal/notifications",
    summary: "Lists the client's portal notifications.",
  },
] as const satisfies readonly MobileRouteDefinition[];
