import { describe, expect, it } from "vitest";

import { pendingRoutes } from "@/api/pending-routes";
import { clientRoutes } from "@/api/routes-for-client";

describe("the live/pending route audit", () => {
  it("gives every client route an operationId and path", () => {
    for (const route of clientRoutes) {
      expect(route.operationId.length, route.path).toBeGreaterThan(0);
      expect(route.path.startsWith("/api/v1/")).toBe(true);
    }
  });

  it("keeps operationIds unique across the combined client list", () => {
    const ids = clientRoutes.map((route) => route.operationId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no pending route left: every screen reads the live server", () => {
    // A route the server does not have yet goes into src/api/pending-routes
    // with a fixture; this test then lists it until the server lands it.
    expect(pendingRoutes.map((route) => route.operationId)).toEqual([]);
  });
});
