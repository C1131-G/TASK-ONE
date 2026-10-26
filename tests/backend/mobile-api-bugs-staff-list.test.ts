import { afterAll, beforeAll, expect, it } from "bun:test";

import { Schema } from "effect";

import {
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  linkProjectToCompanies,
  reportBody,
  send,
  setHandlers,
} from "./support/mobile-bugs-fixtures";

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
  await setHandlers(ids.clientCompanyId, ["owner"]);
});
afterAll(teardownHarness);

const submitRoute = () => import("../../app/api/v1/portal/bugs/route");
const listRoute = () => import("../../app/api/v1/workspace/bugs/route");
const triageRoute = () =>
  import("../../app/api/v1/workspace/bugs/[bugId]/triage/route");

const submit = async (
  persona: "client" | "otherClient",
  title: string
): Promise<string> => {
  const { POST } = await submitRoute();
  const reply = await send(POST, "POST", persona, { body: reportBody(title) });
  return reply.body.data.bugId as string;
};

const listAs = async (
  persona: "admin" | "owner" | "outsider" | "client" | "anonymous",
  query: Record<string, string> = {}
) => {
  const { GET } = await listRoute();
  return await send(GET, "GET", persona, { query });
};

const titlesOf = (reply: Awaited<ReturnType<typeof listAs>>): string[] =>
  (reply.body.data.items as readonly { readonly title: string }[]).map(
    ({ title }) => title
  );

it("shows an admin every company's bugs with what the list needs", async () => {
  const mine = await submit("client", "List: company A");
  const theirs = await submit("otherClient", "List: company B");

  const reply = await listAs("admin");

  expect(reply.status).toBe(200);
  const items = reply.body.data.items as readonly {
    readonly id: string;
  }[];
  expect(items.map(({ id }) => id)).toEqual(
    expect.arrayContaining([mine, theirs])
  );
  expect(items.find(({ id }) => id === mine)).toMatchObject({
    clientCompanyName: expect.stringContaining("Harness client"),
    priority: "none",
    reference: expect.stringMatching(/^PM\w+-\d+$/u),
    status: "reported",
    title: "List: company A",
    version: 1,
  });
  expect(reply.body.data).toHaveProperty("nextCursor");
});

it("refuses clients and unauthenticated callers", async () => {
  const client = await listAs("client");
  const anonymous = await listAs("anonymous");
  const { GET } = await listRoute();
  const revoked = await send(GET, "GET", "admin", { token: "revoked-token" });

  expect(client.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(revoked.status).toBe(401);
});

it("answers in exactly the shape the route list declares", async () => {
  await submit("client", "List: shape");
  const { staffBugListRoute } =
    await import("../../src/mobile-api/routes-bugs");

  const reply = await listAs("admin");

  expect(() =>
    Schema.decodeUnknownSync(staffBugListRoute.data)(reply.body.data)
  ).not.toThrow();
});

it("shows a handler their company's bugs and bugs assigned to them, and others nothing", async () => {
  const handled = await submit("client", "Scope: handled");
  const foreign = await submit("otherClient", "Scope: foreign");
  const assigned = await submit("otherClient", "Scope: assigned");
  const { POST: triage } = await triageRoute();
  const triaged = await send(triage, "POST", "admin", {
    body: {
      assigneeIds: [personaId("owner")],
      expectedVersion: 1,
      priority: "low",
      severity: "minor",
    },
    params: { bugId: assigned },
  });
  expect(triaged.status).toBe(200);

  const owner = titlesOf(await listAs("owner"));
  const outsider = titlesOf(await listAs("outsider"));

  expect(owner).toContain("Scope: handled");
  expect(owner).toContain("Scope: assigned");
  expect(owner).not.toContain("Scope: foreign");
  expect(outsider).toEqual([]);
  expect([handled, foreign]).toHaveLength(2);
});
