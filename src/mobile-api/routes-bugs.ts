import type { RouteDefinition } from "./route-definition";

// Bug actions: staff and client context, pickup, information, evidence, verification, approvals.
// Owned by one branch, so adding routes here never conflicts with the others.
export const bugRoutes = [] as const satisfies readonly RouteDefinition[];
