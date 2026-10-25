import { describe, expect, it } from "vitest";

import { routeFor } from "@/features/auth/route-for";
import type { SessionState } from "@/services/session";

const authenticated = (
  overrides: Partial<Extract<SessionState, { kind: "authenticated" }>["me"]> = {},
): SessionState => ({
  kind: "authenticated",
  me: {
    clientCompanyId: null,
    id: "user-1",
    mustChangePassword: false,
    name: "Ada",
    role: "employee",
    timeZone: "Asia/Kolkata",
    ...overrides,
  },
  token: "t",
});

describe("the route decision", () => {
  it("sends anonymous visitors to sign-in", () => {
    expect(routeFor({ kind: "anonymous" })).toBe("login");
  });

  it("sends a pending password change to the change screen", () => {
    expect(routeFor(authenticated({ mustChangePassword: true }))).toBe("change-password");
  });

  it("sends clients to the portal and staff to the workspace", () => {
    expect(routeFor(authenticated({ role: "client" }))).toBe("portal");
    expect(routeFor(authenticated({ role: "admin" }))).toBe("workspace");
    expect(routeFor(authenticated({ role: "employee" }))).toBe("workspace");
  });
});
