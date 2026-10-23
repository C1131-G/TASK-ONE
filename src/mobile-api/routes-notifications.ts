import type { RouteDefinition } from "./route-definition";

// Notifications: inbox, read state, preferences, targets.
// Owned by one branch, so adding routes here never conflicts with the others.
export const notificationRoutes =
  [] as const satisfies readonly RouteDefinition[];
