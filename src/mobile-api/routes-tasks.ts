import type { RouteDefinition } from "./route-definition";

// Task actions: context, quick updates, discussions, subtasks, own timer.
// Owned by one branch, so adding routes here never conflicts with the others.
export const taskRoutes = [] as const satisfies readonly RouteDefinition[];
