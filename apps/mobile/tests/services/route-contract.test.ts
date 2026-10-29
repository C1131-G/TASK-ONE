import { describe, expect, it } from "vitest";

import { mobileRoutes } from "@api/routes";
import { pendingRoutes } from "@/api/pending-routes";
import { TaskPrioritySchema, TaskStatusSchema } from "@/api/pending-routes/tasks";
import {
  TaskPrioritySchema as LiveTaskPrioritySchema,
  TaskStatusSchema as LiveTaskStatusSchema,
} from "@api/routes-tasks";

describe("the mobile route contract", () => {
  it("keeps every operationId unique across live and pending routes", () => {
    const all = [...mobileRoutes, ...pendingRoutes].map((route) => route.operationId);

    expect(new Set(all).size).toBe(all.length);
  });

  it("never shadows a live route with a pending one", () => {
    const liveIds: ReadonlySet<string> = new Set(mobileRoutes.map((route) => route.operationId));
    const shadowed = pendingRoutes
      .map((route) => route.operationId)
      .filter((id) => liveIds.has(id));

    expect(shadowed).toEqual([]);
  });

  it("keeps every route under the versioned API prefix", () => {
    for (const route of [...mobileRoutes, ...pendingRoutes]) {
      expect(route.path.startsWith("/api/v1/")).toBe(true);
    }
  });

  it("gives every live route a summary for the OpenAPI document", () => {
    for (const route of mobileRoutes) {
      expect(route.summary.length).toBeGreaterThan(4);
    }
  });

  it("keeps the pending task literals equal to the live ones", () => {
    expect(TaskStatusSchema.literals).toEqual(LiveTaskStatusSchema.literals);
    expect(TaskPrioritySchema.literals).toEqual(LiveTaskPrioritySchema.literals);
  });
});