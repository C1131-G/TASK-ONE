import type { MobileRouteDefinition } from "./route-definition";

// Every workspace route the app reads is live on the server now.
export const workspaceRoutes = [] as const satisfies readonly MobileRouteDefinition[];
