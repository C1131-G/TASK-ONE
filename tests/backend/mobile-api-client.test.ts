import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  ids,
  personaBearerToken,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

beforeAll(setupHarness);
afterAll(teardownHarness);

// Stands in for the network: the client's fetch lands on the route handlers.
const routeFetch = async (
  input: Request | string | URL,
  init?: RequestInit
): Promise<Response> => {
  const request = new Request(input, init);
  const { pathname } = new URL(request.url);
  if (pathname === "/api/v1/me") {
    const { GET } = await import("../../app/api/v1/me/route");
    return GET(request);
  }
  return new Response(null, { status: 404 });
};

const clientFor = async (token: string) => {
  const { createMobileClient } = await import("../../src/mobile-api/client");
  return createMobileClient({
    baseUrl: "http://localhost:3000",
    fetch: routeFetch,
    token,
  });
};

it("returns decoded data for a signed-in person", async () => {
  const client = await clientFor(personaBearerToken("client"));
  const me = await client.getMe();

  expect(me).toEqual({
    clientCompanyId: ids.clientCompanyId,
    id: personaId("client"),
    mustChangePassword: false,
    name: expect.any(String),
    role: "client",
    timeZone: null,
  });
});

it("raises an error that carries the code and request ID when the server refuses", async () => {
  const { MobileApiError } = await import("../../src/mobile-api/client");
  const client = await clientFor("not-a-real-token");

  const refusal = await client.getMe().catch((error: unknown) => error);

  expect(refusal).toBeInstanceOf(MobileApiError);
  expect(refusal).toMatchObject({
    code: "UNAUTHENTICATED",
    requestId: expect.any(String),
    status: 401,
  });
});
