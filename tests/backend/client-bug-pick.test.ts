import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "../../src/prisma/db";
import {
  BugWorkflowManagement,
  BugWorkflowManagementLive,
} from "../../src/server/work/bug-workflow-management";
import { remindUnpickedClientBug } from "../../src/server/work/bug-workflow-pick";
import {
  authPool,
  callAs,
  ids,
  nextKey,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const portal = await import("../../features/portal/portal-actions");
const bugActions = await import("../../features/bugs/bugs-actions");
const bugClientActions =
  await import("../../features/bugs/bugs-client-actions");
const comments = await import("../../features/tasks/actions/task-comments");
const taskEditing = await import("../../features/tasks/actions/task-editing");
const portalQueries = await import("../../features/portal/portal-queries");

beforeAll(async () => {
  await setupHarness();
  for (const companyId of [ids.clientCompanyId, ids.otherClientCompanyId]) {
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(
      'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
      [randomUUID(), companyId, ids.projectId]
    );
  }
});
afterAll(teardownHarness);

const setHandlers = async (
  companyId: string,
  employeeIds: readonly string[]
): Promise<void> => {
  await authPool.query(
    'DELETE FROM client_company_handler WHERE "companyId" = $1',
    [companyId]
  );
  for (const employeeId of employeeIds) {
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(
      'INSERT INTO client_company_handler (id, "companyId", "employeeId", "assignedById") VALUES ($1, $2, $3, $4)',
      [randomUUID(), companyId, employeeId, personaId("admin")]
    );
  }
};

const submit = async (
  persona: "client" | "otherClient" = "client",
  title = "Queue test"
) => {
  const result = await callAs(persona, portal.submitClientBugAction, {
    actualBehavior: "Broken",
    browser: null,
    description: null,
    device: null,
    expectedBehavior: "Works",
    idempotencyKey: nextKey(),
    impact: "medium",
    os: null,
    pageUrl: "/page",
    projectId: ids.projectId,
    reproductionSteps: ["Open it"],
    title,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data as { bugId: string; version: number };
};

const service = <Value>(
  run: (
    management: typeof BugWorkflowManagement.Service
  ) => Effect.Effect<Value, unknown>
) =>
  Effect.runPromiseExit(
    Effect.provide(
      Effect.gen(function* withManagement() {
        const management = yield* BugWorkflowManagement;
        return yield* run(management);
      }),
      BugWorkflowManagementLive
    )
  );

const pick = (actor: "owner" | "outsider", bugId: string, version: number) =>
  service((management) =>
    management.pick(personaId(actor), {
      bugId,
      expectedVersion: version,
      priority: "high",
      severity: "major",
    })
  );

const listed = async (persona: "admin" | "owner" | "outsider") => {
  const result = await callAs(persona, bugActions.listBugsAction, {
    view: "client_queue",
  });
  return result.ok
    ? (result.data as readonly { bug: { id: string } }[]).map(
        ({ bug }) => bug.id
      )
    : [];
};

const failureMessage = (exit: Awaited<ReturnType<typeof pick>>): string => {
  if (exit._tag !== "Failure") {
    return "";
  }
  return JSON.stringify(exit.cause);
};

const bugRow = async (bugId: string) => {
  const row = await authPool.query<{
    needsReassignment: boolean;
    pickedAt: Date | null;
    pickedById: string | null;
    status: string;
    taskId: string;
    version: number;
  }>(
    'SELECT "needsReassignment", "pickedAt", "pickedById", status, "taskId", version FROM bug_report WHERE id = $1',
    [bugId]
  );
  const [bug] = row.rows;
  if (!bug) {
    throw new Error("bug missing");
  }
  return bug;
};

const notificationsFor = async (userId: string, taskId: string) => {
  const rows = await authPool.query<{ text: string; type: string }>(
    'SELECT text, type FROM notification WHERE "userId" = $1 AND "taskId" = $2 ORDER BY "createdAt"',
    [userId, taskId]
  );
  return rows.rows;
};

it("tells every handler about a new client bug and schedules the 24-hour reminder", async () => {
  await setHandlers(ids.clientCompanyId, [
    personaId("owner"),
    personaId("outsider"),
  ]);
  const { bugId } = await submit();
  const { taskId } = await bugRow(bugId);
  for (const handler of ["owner", "outsider"] as const) {
    // eslint-disable-next-line no-await-in-loop
    const notices = await notificationsFor(personaId(handler), taskId);
    expect(notices.map(({ type }) => type)).toEqual(["client_bug"]);
  }
  // Admins hear nothing while the company has handlers.
  expect(await notificationsFor(personaId("admin"), taskId)).toEqual([]);
  const job = await authPool.query<{ availableAt: Date; createdAt: Date }>(
    "SELECT \"availableAt\", \"createdAt\" FROM job WHERE kind = 'bug.client_unpicked_reminder' AND payload->>'bugId' = $1",
    [bugId]
  );
  expect(job.rows).toHaveLength(1);
  const [scheduled] = job.rows;
  const delay =
    (scheduled?.availableAt.getTime() ?? 0) -
    (scheduled?.createdAt.getTime() ?? 0);
  expect(delay).toBe(24 * 60 * 60 * 1000);
});

it("tells the admins directly when the company has no handlers", async () => {
  await setHandlers(ids.otherClientCompanyId, []);
  const { bugId } = await submit("otherClient", "No handlers");
  const { taskId } = await bugRow(bugId);
  const notices = await notificationsFor(personaId("admin"), taskId);
  expect(notices).toEqual([expect.objectContaining({ type: "client_bug" })]);
});

it("lets one of two racing handlers win and tells the admins", async () => {
  await setHandlers(ids.clientCompanyId, [
    personaId("owner"),
    personaId("outsider"),
  ]);
  const { bugId, version } = await submit("client", "Race");
  const [first, second] = await Promise.all([
    pick("owner", bugId, version),
    pick("outsider", bugId, version),
  ]);
  const outcomes = [first, second];
  expect(outcomes.filter(({ _tag }) => _tag === "Success")).toHaveLength(1);
  const winner = first._tag === "Success" ? "owner" : "outsider";
  const loser = winner === "owner" ? "outsider" : "owner";
  const lost = outcomes.find(({ _tag }) => _tag === "Failure");
  expect(failureMessage(lost as typeof first)).toContain("Already picked by");

  const row = await bugRow(bugId);
  expect(row).toMatchObject({
    pickedById: personaId(winner),
    status: "triaged",
  });
  expect(row.pickedAt).not.toBeNull();
  const assignees = await authPool.query<{ userId: string }>(
    'SELECT "userId" FROM task_assignee WHERE "taskId" = $1',
    [row.taskId]
  );
  expect(assignees.rows).toEqual([{ userId: personaId(winner) }]);
  const adminNotices = await notificationsFor(personaId("admin"), row.taskId);
  expect(adminNotices.map(({ text }) => text)).toEqual([
    expect.stringContaining("picked"),
  ]);
  const activity = await authPool.query<{ action: string }>(
    "SELECT action FROM activity WHERE \"taskId\" = $1 AND action = 'bug.picked'",
    [row.taskId]
  );
  expect(activity.rows).toHaveLength(1);

  // The client now sees the bug as acknowledged.
  const seen = await callAs("client", portalQueries.getPortalBug, { bugId });
  expect(seen).toMatchObject({ data: { status: "acknowledged" }, ok: true });

  // The loser, like everyone but the assignee and admins, is view-only.
  const comment = await callAs(loser, comments.createCommentAction, {
    body: "Let me weigh in",
    idempotencyKey: nextKey(),
    taskId: row.taskId,
  });
  expect(comment).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const fix = await callAs(loser, bugActions.addBugFixAttemptAction, {
    affectedVersion: null,
    bugId,
    commitUrl: null,
    expectedVersion: row.version,
    fixSummary: "Fix",
    fixedVersion: null,
    pullRequestUrl: null,
    rootCause: "Cause",
    verificationSteps: ["Retest"],
  });
  expect(fix).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const ownComment = await callAs(winner, comments.createCommentAction, {
    body: "On it",
    idempotencyKey: nextKey(),
    taskId: row.taskId,
  });
  expect(ownComment).toMatchObject({ ok: true });

  // Nobody un-picks: a second pick by the winner is refused too.
  const again = await pick(winner, bugId, row.version);
  expect(failureMessage(again)).toContain("Already picked by");
});

it("refuses a pick from someone who is not a handler of the company", async () => {
  await setHandlers(ids.clientCompanyId, [personaId("owner")]);
  const { bugId, version } = await submit("client", "Not your bug");
  const outsiderPick = await pick("outsider", bugId, version);
  expect(outsiderPick._tag).toBe("Failure");
  expect(failureMessage(outsiderPick)).toContain("handler");
  const untouched = await bugRow(bugId);
  expect(untouched.pickedById).toBeNull();
  const adminPick = await callAs(
    "admin",
    bugClientActions.pickClientBugAction,
    {
      bugId,
      expectedVersion: version,
      priority: "high",
      severity: "major",
    }
  );
  expect(adminPick).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const ordinary = await callAs("owner", bugClientActions.pickClientBugAction, {
    bugId: ids.random,
    expectedVersion: 1,
    priority: "high",
    severity: "major",
  });
  expect(ordinary).toMatchObject({ ok: false });
});

it("shows the queue to handlers of that company and to admins only", async () => {
  await setHandlers(ids.clientCompanyId, [personaId("owner")]);
  const { bugId, version } = await submit("client", "Queue visibility");
  expect(await listed("owner")).toContain(bugId);
  expect(await listed("admin")).toContain(bugId);
  expect(await listed("outsider")).not.toContain(bugId);
  const picked = await pick("owner", bugId, version);
  expect(picked._tag).toBe("Success");
  expect(await listed("owner")).not.toContain(bugId);
  expect(await listed("admin")).not.toContain(bugId);
});

it("does not let the picker unpick or hand the bug back", async () => {
  await setHandlers(ids.clientCompanyId, [personaId("owner")]);
  const { bugId, version } = await submit("client", "No unpick");
  const first = await pick("owner", bugId, version);
  expect(first._tag).toBe("Success");
  const row = await bugRow(bugId);

  // Picking again is refused: the bug is no longer waiting in the queue.
  const again = await pick("owner", bugId, row.version);
  expect(again._tag).toBe("Failure");

  // The generic task editor cannot clear the assignee of a bug either.
  const cleared = await callAs("owner", taskEditing.updateTaskAction, {
    assigneeIds: [],
    description: null,
    dueDate: null,
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    priority: "high",
    status: "progress",
    taskId: row.taskId,
    title: "No unpick",
  });
  expect(cleared).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  expect(await bugRow(bugId)).toMatchObject({ pickedById: personaId("owner") });
  const assignees = await authPool.query<{ userId: string }>(
    'SELECT "userId" FROM task_assignee WHERE "taskId" = $1',
    [row.taskId]
  );
  expect(assignees.rows).toEqual([{ userId: personaId("owner") }]);
});

it("marks an unpicked client bug as picked when an admin triages it directly", async () => {
  await setHandlers(ids.clientCompanyId, [personaId("owner")]);
  const { bugId, version } = await submit("client", "Direct triage");
  const triaged = await callAs("admin", bugActions.triageBugAction, {
    assigneeIds: [personaId("outsider")],
    bugId,
    expectedVersion: version,
    priority: "high",
    severity: "major",
  });
  expect(triaged).toMatchObject({ ok: true });
  expect(await bugRow(bugId)).toMatchObject({
    pickedById: personaId("outsider"),
    status: "triaged",
  });
});

it("lets only an admin reassign a picked bug, to any employee", async () => {
  await setHandlers(ids.clientCompanyId, [personaId("owner")]);
  const { bugId, version } = await submit("client", "Reassign me");
  const picked = await pick("owner", bugId, version);
  expect(picked._tag).toBe("Success");
  const row = await bugRow(bugId);
  await authPool.query(
    'UPDATE bug_report SET "needsReassignment" = true WHERE id = $1',
    [bugId]
  );

  const byHandler = await callAs(
    "owner",
    bugClientActions.reassignClientBugAction,
    {
      bugId,
      employeeId: personaId("outsider"),
      expectedVersion: row.version,
    }
  );
  expect(byHandler).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const stale = await callAs(
    "admin",
    bugClientActions.reassignClientBugAction,
    {
      bugId,
      employeeId: personaId("outsider"),
      expectedVersion: row.version + 4,
    }
  );
  expect(stale).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
  const toClient = await callAs(
    "admin",
    bugClientActions.reassignClientBugAction,
    {
      bugId,
      employeeId: personaId("client"),
      expectedVersion: row.version,
    }
  );
  expect(toClient).toMatchObject({ ok: false });

  // outsider is not a handler of the company; an admin may still choose them.
  const reassigned = await callAs(
    "admin",
    bugClientActions.reassignClientBugAction,
    {
      bugId,
      employeeId: personaId("outsider"),
      expectedVersion: row.version,
    }
  );
  expect(reassigned).toMatchObject({ ok: true });
  const after = await bugRow(bugId);
  expect(after.needsReassignment).toBe(false);
  expect(after.version).toBe(row.version + 1);
  const assignees = await authPool.query<{ userId: string }>(
    'SELECT "userId" FROM task_assignee WHERE "taskId" = $1',
    [row.taskId]
  );
  expect(assignees.rows).toEqual([{ userId: personaId("outsider") }]);
  const picker = await authPool.query<{ pickedById: string }>(
    'SELECT "pickedById" FROM bug_report WHERE id = $1',
    [bugId]
  );
  expect(picker.rows[0]?.pickedById).toBe(personaId("outsider"));
  const newAssigneeNotices = await notificationsFor(
    personaId("outsider"),
    row.taskId
  );
  expect(newAssigneeNotices.map(({ type }) => type)).toContain("assignment");
  const formerNotices = await notificationsFor(personaId("owner"), row.taskId);
  expect(formerNotices.map(({ text }) => text)).toContainEqual(
    expect.stringContaining("was reassigned to")
  );
  // The new assignee can now work the bug; the former handler cannot.
  const comment = await callAs("outsider", comments.createCommentAction, {
    body: "Picking this up",
    idempotencyKey: nextKey(),
    taskId: row.taskId,
  });
  expect(comment).toMatchObject({ ok: true });
  const oldComment = await callAs("owner", comments.createCommentAction, {
    body: "Still here",
    idempotencyKey: nextKey(),
    taskId: row.taskId,
  });
  expect(oldComment).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });

  // An unpicked bug is assigned through triage, not reassignment.
  const fresh = await submit("client", "Unpicked reassign");
  const unpicked = await callAs(
    "admin",
    bugClientActions.reassignClientBugAction,
    {
      bugId: fresh.bugId,
      employeeId: personaId("outsider"),
      expectedVersion: fresh.version,
    }
  );
  expect(unpicked).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
});

it("sends the 24-hour reminder only while the bug is still unpicked", async () => {
  await setHandlers(ids.clientCompanyId, [personaId("owner")]);
  const waiting = await submit("client", "Still waiting");
  const reminded = await db.transaction((transaction) =>
    remindUnpickedClientBug(transaction, waiting.bugId)
  );
  expect(reminded).toBe(true);
  const waitingRow = await bugRow(waiting.bugId);
  const notices = await notificationsFor(personaId("admin"), waitingRow.taskId);
  expect(notices.map(({ text }) => text)).toEqual([
    expect.stringContaining("in 24 hours"),
  ]);

  const taken = await submit("client", "Already taken");
  const picked = await pick("owner", taken.bugId, taken.version);
  expect(picked._tag).toBe("Success");
  const takenRow = await bugRow(taken.bugId);
  const skipped = await db.transaction((transaction) =>
    remindUnpickedClientBug(transaction, taken.bugId)
  );
  expect(skipped).toBe(false);
  const takenNotices = await notificationsFor(
    personaId("admin"),
    takenRow.taskId
  );
  expect(takenNotices.map(({ text }) => text)).toEqual([
    expect.stringContaining("picked"),
  ]);
  const missing = await db.transaction((transaction) =>
    remindUnpickedClientBug(transaction, randomUUID())
  );
  expect(missing).toBe(false);
});
