import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";

import { createMobileClient } from "@api/client";

const meResponse = (): Promise<Response> =>
  Promise.resolve(
    new Response(
      JSON.stringify({
        ok: true,
        data: {
          clientCompanyId: null,
          id: "user-1",
          mustChangePassword: false,
          name: "Studio Admin",
          role: "admin",
          timeZone: "Asia/Kolkata",
        },
        requestId: "smoke-request",
      }),
      { headers: { "content-type": "application/json" }, status: 200 },
    ),
  );

it.effect("the shared mobile client decodes /api/v1/me", () =>
  Effect.gen(function* () {
    const client = createMobileClient({
      baseUrl: "https://unit.test",
      fetch: meResponse,
      token: "smoke-token",
    });

    const me = yield* Effect.promise(() => client.getMe());

    expect(me.id).toBe("user-1");
    expect(me.role).toBe("admin");
    expect(me.timeZone).toBe("Asia/Kolkata");
  }),
);
