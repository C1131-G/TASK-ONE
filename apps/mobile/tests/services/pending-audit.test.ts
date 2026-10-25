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

  it("documents which domains are still pending", () => {
    const pendingDomains = new Set(
      pendingRoutes.map((route) => route.path.split("/")[3] ?? "unknown"),
    );

    // The swap checklist: each pending domain here still needs its live
    // route list on main before its pending file can be deleted.
    for (const domain of pendingDomains) {
      expect(typeof domain).toBe("string");
    }
    expect(pendingDomains.size).toBeGreaterThan(0);
  });
});
