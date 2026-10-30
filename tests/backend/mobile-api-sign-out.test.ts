import { afterAll, beforeAll, expect, it } from "bun:test";

import { auth } from "../../src/server/auth/auth";
import { withResolvedClientIp } from "../../src/server/core/client-ip";
import {
  authPool,
  createPersona,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

beforeAll(setupHarness);
afterAll(teardownHarness);

const meStatus = async (token: string): Promise<number> => {
  const { GET } = await import("../../apps/web/app/api/v1/me/route");
  const response = await GET(
    new Request("http://localhost:3000/api/v1/me", {
      headers: { authorization: `Bearer ${token}` },
    })
  );
  return response.status;
};

const signOut = (token: string): Promise<Response> =>
  auth.handler(
    withResolvedClientIp(
      new Request("http://localhost:3000/api/auth/sign-out", {
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.200",
        },
        method: "POST",
      })
    )
  );

const sessionCount = async (userId: string): Promise<number> => {
  const result = await authPool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM session WHERE "userId" = $1',
    [userId]
  );
  return result.rows[0]?.count ?? 0;
};

it("ends the session that signed out, and its token then answers 401", async () => {
  const persona = await createPersona("employee", "signout");

  expect(await meStatus(persona.bearerToken)).toBe(200);
  expect(await sessionCount(persona.id)).toBe(1);

  const response = await signOut(persona.bearerToken);

  expect(response.status).toBe(200);
  expect(await sessionCount(persona.id)).toBe(0);
  expect(await meStatus(persona.bearerToken)).toBe(401);
});

it("leaves the account's other sessions signed in", async () => {
  const persona = await createPersona("employee", "signout-other");
  const other = await createPersona("employee", "signout-bystander");

  await signOut(persona.bearerToken);

  expect(await meStatus(other.bearerToken)).toBe(200);
});
