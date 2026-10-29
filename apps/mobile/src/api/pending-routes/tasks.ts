import { Schema } from "effect";

import type { MobileRouteDefinition } from "./route-definition";

// Every task route is live on the server now. The literals stay here so a test
// can pin them against the live task routes.

export const TaskStatusSchema = Schema.Literals(["backlog", "todo", "progress", "review", "done"]);
export const TaskPrioritySchema = Schema.Literals(["urgent", "high", "medium", "low", "none"]);

export const taskRoutes = [] as const satisfies readonly MobileRouteDefinition[];
