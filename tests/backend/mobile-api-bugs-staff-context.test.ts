import { afterAll, beforeAll, expect, it } from "bun:test";

import { Effect, Schema } from "effect";

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

const submitRoute = () => import("../../apps/web/app/api/v1/portal/bugs/route");
const detailRoute = () =>
  import("../../apps/web/app/api/v1/workspace/bugs/[bugId]/route");
const pickRoute = () =>
  import("../../apps/web/app/api/v1/workspace/bugs/[bugId]/pick/route");

const submit = async (title: string): Promise<string> => {
  const { POST } = await submitRoute();
  const reply = await send(POST, "POST", "client", { body: reportBody(title) });
  return reply.body.data.bugId as string;
};

const reportInternalBug = async (): Promise<{
  readonly id: string;
  readonly title: string;
}> => {
  const { BugManagement, BugManagementLive } =
    await import("../../src/server/work/bug-management");
  return await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* reportInternal() {
        const bugs = yield* BugManagement;
        return yield* bugs.reportBug(personaId("owner"), {
          actualBehavior: "The dialog hangs.",
          appVersion: null,
          browser: null,
          component: "SettingsDialog",
          description: null,
          device: null,
          discoverySource: "internal_qa",
          environment: "staging",
          expectedBehavior: "The dialog closes.",
          os: null,
          projectId: ids.projectId,
          reproductionSteps: ["Open settings"],
          route: "/settings",
          severity: "minor",
          title: "Internal bug context",
        });
      }),
      BugManagementLive
    )
  );
};

it("shows an admin a client report with its staff-only context", async () => {
  const bugId = await submit("Context for admin");
  const { GET } = await detailRoute();

  const reply = await send(GET, "GET", "admin", { params: { bugId } });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toMatchObject({
    archived: false,
    assignees: [],
    bug: { id: bugId, status: "reported", title: "Context for admin" },
    clientReport: {
      canPick: false,
      companyName: expect.stringContaining("Harness client"),
    },
    priority: "none",
  });
  expect(reply.body.data.bug.projectKey).toMatch(/^PM/u);
  expect(
    `${reply.body.data.bug.projectKey}-${reply.body.data.bug.projectTaskNumber}`
  ).toMatch(/^PM\w+-\d+$/u);
  for (const field of [
    "bug.severity",
    "bug.component",
    "bug.reproductionSteps",
    "clientContext",
    "attempts",
    "approvals",
    "evidence",
    "releases",
    "relations",
  ]) {
    expect(reply.body.data).toHaveProperty(field);
  }
});

it("lets the company's handler see the report can be picked, then the result of picking it", async () => {
  const bugId = await submit("Context for handler");
  const { GET } = await detailRoute();

  const before = await send(GET, "GET", "owner", { params: { bugId } });
  expect(before.status).toBe(200);
  expect(before.body.data.clientReport.canPick).toBe(true);

  const { POST } = await pickRoute();
  const picked = await send(POST, "POST", "owner", {
    body: {
      expectedVersion: before.body.data.bug.version,
      priority: "high",
      severity: "major",
    },
    params: { bugId },
  });
  expect(picked.status).toBe(200);

  const after = await send(GET, "GET", "owner", { params: { bugId } });
  expect(after.body.data).toMatchObject({
    assignees: [{ id: personaId("owner"), name: "Harness owner" }],
    bug: { status: "triaged" },
    clientReport: { canPick: false, pickedByName: "Harness owner" },
    priority: "high",
  });
});

it("reads an internal bug without a client report or a company", async () => {
  const report = await reportInternalBug();
  const { GET } = await detailRoute();

  const reply = await send(GET, "GET", "admin", {
    params: { bugId: report.id },
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toMatchObject({
    archived: false,
    clientReport: null,
    priority: "none",
  });
  expect(reply.body.data.bug).toMatchObject({
    clientCompanyId: null,
    id: report.id,
    status: "reported",
    title: "Internal bug context",
  });
  expect(JSON.stringify(reply.body.data)).not.toContain("Harness client");
});

it("answers 404 for a missing bug and 422 for a malformed id", async () => {
  const { GET } = await detailRoute();

  const missing = await send(GET, "GET", "admin", {
    params: { bugId: "00000000-0000-4000-8000-000000000000" },
  });
  const malformed = await send(GET, "GET", "admin", {
    params: { bugId: "not-a-uuid" },
  });

  expect(missing.status).toBe(404);
  expect(malformed.status).toBe(422);
});

it("refuses clients and unauthenticated callers", async () => {
  const bugId = await submit("Staff only");
  const { GET } = await detailRoute();

  const anonymous = await send(GET, "GET", "anonymous", {
    params: { bugId },
  });
  const revoked = await send(GET, "GET", "admin", {
    params: { bugId },
    token: "revoked-token",
  });
  const client = await send(GET, "GET", "client", { params: { bugId } });

  expect(anonymous.status).toBe(401);
  expect(revoked.status).toBe(401);
  expect(client.status).toBe(403);
});

it("answers in exactly the shape the route list declares", async () => {
  const bugId = await submit("Context shape check");
  const { GET } = await detailRoute();
  const { staffBugContextRoute } =
    await import("../../src/mobile-api/routes-bugs");

  const clientReply = await send(GET, "GET", "admin", { params: { bugId } });
  const internalReport = await reportInternalBug();
  const internalReply = await send(GET, "GET", "admin", {
    params: { bugId: internalReport.id },
  });

  for (const reply of [clientReply, internalReply]) {
    expect(() =>
      Schema.decodeUnknownSync(staffBugContextRoute.data)(reply.body.data)
    ).not.toThrow();
  }
});
