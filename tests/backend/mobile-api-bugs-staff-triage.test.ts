import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  bugRow,
  countRows,
  forceStatus,
  linkProjectToCompanies,
  reportBody,
  send,
  setHandlers,
  statusOf,
  versionOf,
} from "./support/mobile-bugs-fixtures";

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
  await setHandlers(ids.clientCompanyId, ["owner"]);
});
afterAll(teardownHarness);

const submitRoute = () => import("../../app/api/v1/portal/bugs/route");
const triageRoute = () =>
  import("../../app/api/v1/workspace/bugs/[bugId]/triage/route");
const reassignRoute = () =>
  import("../../app/api/v1/workspace/bugs/[bugId]/reassign/route");
const requestInfoRoute = () =>
  import("../../app/api/v1/workspace/bugs/[bugId]/request-info/route");
const pickRoute = () =>
  import("../../app/api/v1/workspace/bugs/[bugId]/pick/route");
const portalDetailRoute = () =>
  import("../../app/api/v1/portal/bugs/[bugId]/route");
const portalCommentRoute = () =>
  import("../../app/api/v1/portal/bugs/[bugId]/comments/route");

const submit = async (title: string): Promise<string> => {
  const { POST } = await submitRoute();
  const reply = await send(POST, "POST", "client", { body: reportBody(title) });
  if (reply.status !== 200) {
    throw new Error(JSON.stringify(reply.body));
  }
  return reply.body.data.bugId as string;
};

const pick = async (bugId: string, version: number): Promise<void> => {
  const { POST } = await pickRoute();
  const reply = await send(POST, "POST", "owner", {
    body: { expectedVersion: version, priority: "medium", severity: "major" },
    params: { bugId },
  });
  if (reply.status !== 200) {
    throw new Error(JSON.stringify(reply.body));
  }
};

const triageBody = (expectedVersion: number) => ({
  assigneeIds: [personaId("owner"), personaId("outsider")],
  expectedVersion,
  priority: "high",
  severity: "critical",
});

const assigneeIdsOf = async (taskId: string): Promise<string[]> => {
  const result = await authPool.query<{ userId: string }>(
    'SELECT "userId" FROM task_assignee WHERE "taskId" = $1 ORDER BY "userId"',
    [taskId]
  );
  return result.rows.map(({ userId }) => userId);
};

const priorityOf = async (taskId: string): Promise<string | undefined> => {
  const result = await authPool.query<{ priority: string }>(
    "SELECT priority FROM task WHERE id = $1",
    [taskId]
  );
  return result.rows[0]?.priority;
};

const severityOf = async (bugId: string): Promise<string | undefined> => {
  const result = await authPool.query<{ severity: string }>(
    "SELECT severity FROM bug_report WHERE id = $1",
    [bugId]
  );
  return result.rows[0]?.severity;
};

it("lets an admin triage a reported client bug once", async () => {
  const bugId = await submit("Triage me");
  const version = await versionOf(bugId);
  const { POST } = await triageRoute();
  const key = "staff-triage-key";

  const first = await send(POST, "POST", "admin", {
    body: triageBody(version),
    key,
    params: { bugId },
  });
  const second = await send(POST, "POST", "admin", {
    body: triageBody(version),
    key,
    params: { bugId },
  });

  expect(first.status).toBe(200);
  expect(first.body.data).toEqual({
    bugId,
    status: "triaged",
    version: version + 1,
  });
  expect(second.body.data).toEqual(first.body.data);
  const row = await bugRow(bugId);
  expect(row.status).toBe("triaged");
  expect(row.version).toBe(version + 1);
  expect(row.pickedById).toBe(personaId("owner"));
  expect(await severityOf(bugId)).toBe("critical");
  expect(await priorityOf(row.taskId)).toBe("high");
  expect(await assigneeIdsOf(row.taskId)).toEqual(
    [personaId("owner"), personaId("outsider")].toSorted()
  );
  expect(await versionOf(bugId)).toBe(version + 1);
});

it("answers a stale triage with a conflict and leaves the bug unchanged", async () => {
  const bugId = await submit("Stale triage");
  const version = await versionOf(bugId);
  const before = await bugRow(bugId);
  const { POST } = await triageRoute();

  const reply = await send(POST, "POST", "admin", {
    body: triageBody(version + 5),
    params: { bugId },
  });

  expect(reply.status).toBe(409);
  expect(await bugRow(bugId)).toEqual(before);
  expect(await assigneeIdsOf(before.taskId)).toEqual([]);
});

it("refuses triage from an employee, a client, a closed bug and an archived bug", async () => {
  const employeeBug = await submit("Employee triage");
  const employeeVersion = await versionOf(employeeBug);
  const closedBug = await submit("Closed triage");
  await forceStatus(closedBug, "closed");
  const archivedBug = await submit("Archived triage");
  const archivedRow = await bugRow(archivedBug);
  const archivedTaskId = archivedRow.taskId;
  await authPool.query(
    'UPDATE task SET "archivedAt" = now(), "archivedById" = "createdById" WHERE id = $1',
    [archivedTaskId]
  );
  const { POST } = await triageRoute();

  const employee = await send(POST, "POST", "owner", {
    body: triageBody(employeeVersion),
    params: { bugId: employeeBug },
  });
  const client = await send(POST, "POST", "client", {
    body: triageBody(employeeVersion),
    params: { bugId: employeeBug },
  });
  const closed = await send(POST, "POST", "admin", {
    body: triageBody(await versionOf(closedBug)),
    params: { bugId: closedBug },
  });
  const archived = await send(POST, "POST", "admin", {
    body: triageBody(await versionOf(archivedBug)),
    params: { bugId: archivedBug },
  });

  expect(employee.status).toBe(403);
  expect(client.status).toBe(403);
  expect(closed.status).toBe(403);
  expect(archived.status).toBe(403);
  expect(await bugRow(employeeBug)).toMatchObject({
    pickedById: null,
    status: "reported",
    version: employeeVersion,
  });
  expect(await statusOf(closedBug)).toBe("closed");
  expect(await statusOf(archivedBug)).toBe("reported");
});

it("lets an admin reassign a picked bug to exactly one employee", async () => {
  const bugId = await submit("Reassign me");
  await pick(bugId, await versionOf(bugId));
  const version = await versionOf(bugId);
  const { POST } = await reassignRoute();

  const reply = await send(POST, "POST", "admin", {
    body: { employeeId: personaId("outsider"), expectedVersion: version },
    params: { bugId },
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toEqual({
    bugId,
    status: "triaged",
    version: version + 1,
  });
  const row = await bugRow(bugId);
  expect(row.pickedById).toBe(personaId("outsider"));
  expect(await assigneeIdsOf(row.taskId)).toEqual([personaId("outsider")]);
});

it("refuses a reassignment by an employee, on a stale version or before a pickup", async () => {
  const pickedBug = await submit("Reassign refusals");
  await pick(pickedBug, await versionOf(pickedBug));
  const pickedVersion = await versionOf(pickedBug);
  const pickedBefore = await bugRow(pickedBug);
  const unpickedBug = await submit("Not picked yet");
  const unpickedBefore = await bugRow(unpickedBug);
  const { POST } = await reassignRoute();

  const employee = await send(POST, "POST", "owner", {
    body: { employeeId: personaId("outsider"), expectedVersion: pickedVersion },
    params: { bugId: pickedBug },
  });
  const stale = await send(POST, "POST", "admin", {
    body: {
      employeeId: personaId("outsider"),
      expectedVersion: pickedVersion + 5,
    },
    params: { bugId: pickedBug },
  });
  const unpicked = await send(POST, "POST", "admin", {
    body: {
      employeeId: personaId("outsider"),
      expectedVersion: unpickedBefore.version,
    },
    params: { bugId: unpickedBug },
  });

  expect(employee.status).toBe(403);
  expect(stale.status).toBe(409);
  expect(unpicked.status).toBe(403);
  expect(await bugRow(pickedBug)).toEqual(pickedBefore);
  expect(await bugRow(unpickedBug)).toEqual(unpickedBefore);
});

it("lets the assignee ask the client a question and the client answer it", async () => {
  const bugId = await submit("Question me");
  await pick(bugId, await versionOf(bugId));
  const version = await versionOf(bugId);
  const { taskId } = await bugRow(bugId);
  const question = "Which page were you on when this happened?";
  const { POST } = await requestInfoRoute();

  const asked = await send(POST, "POST", "owner", {
    body: { expectedVersion: version, question },
    params: { bugId },
  });

  expect(asked.status).toBe(200);
  expect(asked.body.data).toMatchObject({ bugId, status: "needs_info" });
  expect(await statusOf(bugId)).toBe("needs_info");
  expect(
    await countRows(
      "comment",
      "\"taskId\" = $1 AND body = $2 AND visibility = 'public'",
      [taskId, question]
    )
  ).toBe(1);

  const { GET } = await portalDetailRoute();
  const detail = await send(GET, "GET", "client", { params: { bugId } });
  expect(detail.status).toBe(200);
  expect(
    (detail.body.data.comments as { body: string }[]).map(({ body }) => body)
  ).toContain(question);

  const { POST: comment } = await portalCommentRoute();
  const answered = await send(comment, "POST", "client", {
    body: { body: "On the checkout page." },
    params: { bugId },
  });

  expect(answered.status).toBe(200);
  expect(await statusOf(bugId)).toBe("triaged");
});

it("refuses a question from an outsider, allows an admin, and refuses an internal bug", async () => {
  const bugId = await submit("Question permissions");
  await pick(bugId, await versionOf(bugId));
  const version = await versionOf(bugId);
  const before = await bugRow(bugId);
  const { POST } = await requestInfoRoute();

  const outsider = await send(POST, "POST", "outsider", {
    body: { expectedVersion: version, question: "Not mine to ask" },
    params: { bugId },
  });
  expect(outsider.status).toBe(403);
  expect(await bugRow(bugId)).toEqual(before);

  const admin = await send(POST, "POST", "admin", {
    body: { expectedVersion: version, question: "Admin can ask too" },
    params: { bugId },
  });
  expect(admin.status).toBe(200);
  expect(await statusOf(bugId)).toBe("needs_info");

  const { BugManagement, BugManagementLive } =
    await import("../../src/server/work/bug-management");
  const internal = await Effect.runPromise(
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
          title: "Internal question",
        });
      }),
      BugManagementLive
    )
  );
  const internalReply = await send(POST, "POST", "admin", {
    body: { expectedVersion: internal.version, question: "Anyone home?" },
    params: { bugId: internal.id },
  });
  expect(internalReply.status).toBe(403);
  expect(await statusOf(internal.id)).toBe("reported");
});

it("keeps internal notes out of the client's view of the bug", async () => {
  const bugId = await submit("Internal notes stay here");
  await pick(bugId, await versionOf(bugId));
  const { taskId } = await bugRow(bugId);
  const secret = `Internal note ${randomUUID()}`;
  await authPool.query(
    'INSERT INTO comment (id, "taskId", "authorId", body, visibility) VALUES ($1, $2, $3, $4, \'internal\')',
    [randomUUID(), taskId, personaId("owner"), secret]
  );
  const { GET } = await portalDetailRoute();

  const detail = await send(GET, "GET", "client", { params: { bugId } });

  expect(detail.status).toBe(200);
  expect(
    (detail.body.data.comments as { body: string }[]).map(({ body }) => body)
  ).not.toContain(secret);
  expect(JSON.stringify(detail.body.data)).not.toContain(secret);
});

it("answers each write in the shape the route list declares", async () => {
  const bugId = await submit("Triage shape check");
  const version = await versionOf(bugId);
  const { POST } = await triageRoute();
  const { staffBugActionRoutes } =
    await import("../../src/mobile-api/routes-bugs");

  const reply = await send(POST, "POST", "admin", {
    body: triageBody(version),
    params: { bugId },
  });

  expect(() =>
    Schema.decodeUnknownSync(staffBugActionRoutes.triage.data)(reply.body.data)
  ).not.toThrow();
});
