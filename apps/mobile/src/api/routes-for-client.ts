import { pendingRoutes } from "./pending-routes/index";
import type { RouteDefinition } from "@api/route-definition";
import { mobileRoutes } from "@api/routes";

/**
 * The routes the typed client speaks: everything live on the server plus
 * the pending definitions screens still consume through mocks. When a
 * domain's routes land on main, its pending file shrinks and this list
 * follows.
 */
export const clientRoutes = [
  ...mobileRoutes,
  ...(pendingRoutes as unknown as readonly RouteDefinition[]),
];
