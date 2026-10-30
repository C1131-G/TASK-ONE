import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  ids,
  personaBearerToken,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

beforeAll(setupHarness);
afterAll(teardownHarness);

const getMe = async (token?: string): Promise<Response> => {
  const { GET } = await import("../../apps/web/app/api/v1/me/route");
  return GET(
    new Request("http://localhost:3000/api/v1/me", {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  );
};

it("tells a signed-in person who they are from a bearer token alone", async () => {
  const response = await getMe(personaBearerToken("owner"));
  const body = (await response.json()) as {
    data: { id: string; role: string };
    ok: boolean;
    requestId: string;
  };

  expect(response.status).toBe(200);
  expect(response.headers.get("x-request-id")).toBe(body.requestId);
  expect(body.ok).toBe(true);
  expect(body.data).toMatchObject({
    id: personaId("owner"),
    role: "employee",
  });
});

it("tells a client which company they belong to", async () => {
  const response = await getMe(personaBearerToken("client"));
  const body = (await response.json()) as {
    data: { clientCompanyId: string | null; role: string };
  };

  expect(response.status).toBe(200);
  expect(body.data).toMatchObject({
    clientCompanyId: ids.clientCompanyId,
    role: "client",
  });
});

it("refuses a request that carries no token", async () => {
  const response = await getMe();
  const body = (await response.json()) as {
    error: { code: string; requestId: string };
    ok: boolean;
  };

  expect(response.status).toBe(401);
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("UNAUTHENTICATED");
  expect(response.headers.get("x-request-id")).toBe(body.error.requestId);
});

it("refuses a token that was never issued", async () => {
  const response = await getMe("not-a-real-token");

  expect(response.status).toBe(401);
});

it("stops honouring a token once its session is revoked", async () => {
  const token = personaBearerToken("outsider");
  const before = await getMe(token);
  expect(before.status).toBe(200);

  await authPool.query('DELETE FROM session WHERE "userId" = $1', [
    personaId("outsider"),
  ]);
  const response = await getMe(token);

  expect(response.status).toBe(401);
});

it("refuses a token whose account was deactivated", async () => {
  const response = await getMe(personaBearerToken("deactivated"));

  expect(response.status).toBe(401);
});
