import type { MobileRouteDefinition } from "./route-definition";

import { notificationRoutes } from "./notifications";
import { taskRoutes } from "./tasks";
import { portalMoreRoutes } from "./portal-more";
import { portalRoutes } from "./portal";
import { workspaceMoreRoutes } from "./workspace-more";
import { workspaceRoutes } from "./workspace";

/**
 * Routes a screen needs before its domain's live list lands on main. Each
 * entry mirrors the RouteDefinition shape so the swap to live is: merge
 * main, delete the pending file, flip the domain's mode to live.
 */
export const pendingRoutes: readonly MobileRouteDefinition[] = [
  ...notificationRoutes,
  ...taskRoutes,
  ...workspaceRoutes,
  ...workspaceMoreRoutes,
  ...portalRoutes,
  ...portalMoreRoutes,
];
