import { Schema } from "effect";

import type { MobileRouteDefinition } from "./route-definition";

export const ApprovalRequestSchema = Schema.Struct({
  bugTitle: Schema.String,
  id: Schema.String,
  projectName: Schema.String,
  reportedBy: Schema.String,
  status: Schema.Literals(["pending", "approved", "rejected"]),
});

export const workspaceMoreRoutes = [
  {
    data: Schema.Struct({ items: Schema.Array(ApprovalRequestSchema) }),
    method: "get",
    operationId: "listBugApprovals",
    path: "/api/v1/workspace/bug-approvals",
    summary: "Lists the bug approval requests with their status.",
  },
] as const satisfies readonly MobileRouteDefinition[];
