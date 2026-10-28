import { afterAll, beforeAll, expect, it } from "bun:test";

import { Schema } from "effect";

import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  forceStatus,
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

const walk = async (
  limit: number,
  query: Record<string, string> = {}
): Promise<readonly (readonly string[])[]> => {
  const pages: string[][] = [];
  let cursor: string | null = null;
  do {
    // oxlint-disable-next-line no-await-in-loop
    const reply: Awaited<ReturnType<typeof listAs>> = await listAs("admin", {
      ...query,
      ...(cursor ? { cursor } : {}),
      limit: String(limit),
    });
    expect(reply.status).toBe(200);
    pages.push(
      (reply.body.data.items as readonly { readonly id: string }[]).map(
        ({ id }) => id
      )
    );
    cursor = reply.body.data.nextCursor as string | null;
  } while (cursor);
  return pages;
};

it("pages through the list in a stable order without repeats or gaps, even when rows share a timestamp", async () => {
  const created: string[] = [];
  for (let index = 0; index < 5; index += 1) {
    // oxlint-disable-next-line no-await-in-loop
    created.push(await submit("client", `Paging ${index}`));
  }
  await authPool.query(
    "UPDATE bug_report SET \"updatedAt\" = '2026-01-01T00:00:00Z' WHERE id = ANY($1::uuid[])",
    [created.slice(0, 4)]
  );

  const pages = await walk(2);
  const again = await walk(2);

  for (const page of pages) {
    expect(page.length).toBeLessThanOrEqual(2);
  }
  const flat = pages.flat();
  expect(new Set(flat).size).toBe(flat.length);
  expect(flat).toEqual(expect.arrayContaining(created));
  expect(again).toEqual(pages);
  const single = await walk(100);
  expect(single.flat()).toEqual(flat);
});

it("refuses a page size outside 1 to 100 and a cursor it did not issue", async () => {
  const tooBig = await listAs("admin", { limit: "101" });
  const zero = await listAs("admin", { limit: "0" });
  const fractional = await listAs("admin", { limit: "1.5" });
  const garbage = await listAs("admin", { cursor: "not-a-cursor" });

  expect(tooBig.status).toBe(422);
  expect(tooBig.body.error.fieldErrors).toHaveProperty("limit");
  expect(zero.status).toBe(422);
  expect(fractional.status).toBe(422);
  expect(garbage.status).toBe(422);
});

it("filters by status and leaves out archived bugs", async () => {
  const open = await submit("client", "Filter: open");
  const closed = await submit("client", "Filter: closed");
  const archived = await submit("client", "Filter: archived");
  await forceStatus(closed, "closed");
  await authPool.query(
    'UPDATE task SET "archivedAt" = now(), "archivedById" = "createdById" WHERE id = (SELECT "taskId" FROM bug_report WHERE id = $1)',
    [archived]
  );

  const closedOnly = await listAs("admin", { status: "closed" });
  const reported = await listAs("admin", { status: "reported" });
  const all = await listAs("admin", { limit: "100" });
  const invalid = await listAs("admin", { status: "sleeping" });

  expect(titlesOf(closedOnly)).toContain("Filter: closed");
  expect(titlesOf(closedOnly)).not.toContain("Filter: open");
  expect(titlesOf(reported)).toContain("Filter: open");
  expect(titlesOf(reported)).not.toContain("Filter: closed");
  expect(titlesOf(all)).not.toContain("Filter: archived");
  expect([open, closed]).toHaveLength(2);
  expect(invalid.status).toBe(422);
  expect(invalid.body.error.fieldErrors).toHaveProperty("status");
});

const itemFor = (
  reply: Awaited<ReturnType<typeof listAs>>,
  bugId: string
): { readonly permittedActions: readonly string[] } | undefined =>
  (
    reply.body.data.items as readonly {
      readonly id: string;
      readonly permittedActions: readonly string[];
    }[]
  ).find(({ id }) => id === bugId);

it("tells each caller what they may do with a bug, as the services will accept it", async () => {
  const bugId = await submit("client", "Actions: unpicked");

  const handlerBefore = itemFor(await listAs("owner"), bugId);
  const adminBefore = itemFor(await listAs("admin"), bugId);
  expect(handlerBefore?.permittedActions).toEqual(["pick"]);
  expect(adminBefore?.permittedActions).toEqual(["comment", "reply_to_client"]);

  const { POST: pick } =
    await import("../../app/api/v1/workspace/bugs/[bugId]/pick/route");
  const picked = await send(pick, "POST", "owner", {
    body: { expectedVersion: 1, priority: "high", severity: "major" },
    params: { bugId },
  });
  expect(picked.status).toBe(200);

  const handlerAfter = itemFor(await listAs("owner"), bugId);
  expect(handlerAfter?.permittedActions).toEqual([
    "comment",
    "reply_to_client",
    "request_info",
  ]);
});

it("offers only an internal note on a bug that has no client", async () => {
  const { BugManagement, BugManagementLive } =
    await import("../../src/server/work/bug-management");
  const { Effect } = await import("effect");
  const report = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* reportInternal() {
        const bugs = yield* BugManagement;
        return yield* bugs.reportBug(personaId("admin"), {
          actualBehavior: "Hangs.",
          appVersion: null,
          browser: null,
          component: "Dialog",
          description: null,
          device: null,
          discoverySource: "internal_qa",
          environment: "staging",
          expectedBehavior: "Closes.",
          os: null,
          projectId: ids.projectId,
          reproductionSteps: ["Open"],
          route: "/x",
          severity: "minor",
          title: "Actions: internal",
        });
      }),
      BugManagementLive
    )
  );

  const item = itemFor(await listAs("admin"), report.id);

  expect(item?.permittedActions).toEqual(["comment"]);
});
