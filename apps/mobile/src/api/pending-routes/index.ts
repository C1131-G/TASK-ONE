import type { RouteDefinition } from "@api/route-definition";

/**
 * Routes a screen needs before its domain's live list lands on main. Each
 * entry mirrors the RouteDefinition shape so the swap to live is: merge
 * main, delete the pending file, flip the domain's mode to live.
 */
export const pendingRoutes: readonly RouteDefinition[] = [];
