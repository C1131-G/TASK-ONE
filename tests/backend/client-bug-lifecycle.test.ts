import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { db } from "../../src/prisma/db";
import {
  autoCloseAwaitingClient,
  autoCloseNeedsInfo,
  remindNeedsInfo,
} from "../../src/server/work/bug-workflow-client";
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
const portalQueries = await import("../../features/portal/portal-queries");
const bugActions = await import("../../features/bugs/bugs-actions");

const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  await setupHarness();
  for (const companyId of [ids.clientCompanyId, ids.otherClientCompanyId]) {
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(
      'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
      [randomUUID(), companyId, ids.projectId]
    );
  }
  await authPool.query(
    'INSERT INTO client_company_handler (id, "companyId", "employeeId", "assignedById") VALUES ($1, $2, $3, $4)',
    [randomUUID(), ids.clientCompanyId, personaId("owner"), personaId("admin")]
  );
});
afterAll(teardownHarness);

interface BugState {
  awaitingClientSince: Date | null;
  clientReopenCount: number;
  needsInfoSince: Date | null;
  pickedById: string | null;
  resolution: string | null;
  satisfaction: string | null;
  status: string;
  statusBeforeNeedsInfo: string | null;
  taskId: string;
  version: number;
}

const state = async (bugId: string): Promise<BugState> => {
  const result = await authPool.query<BugState>(
    'SELECT "awaitingClientSince", "clientReopenCount", "needsInfoSince", "pickedById", resolution, satisfaction, status, "statusBeforeNeedsInfo", "taskId", version FROM bug_report WHERE id = $1',
    [bugId]
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error("bug missing");
  }
  return row;
};

const stateField = async <Key extends keyof BugState>(
  bugId: string,
  key: Key
): Promise<BugState[Key]> => {
  const row = await state(bugId);
  return row[key];
};

const submit = async (
  title: string,
  persona: "client" | "otherClient" = "client",
  extra: Record<string, unknown> = {}
): Promise<string> => {
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
    ...extra,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return (result.data as { bugId: string }).bugId;
};

const pick = async (bugId: string): Promise<void> => {
  const row = await state(bugId);
  const result = await callAs("owner", bugActions.pickClientBugAction, {
    bugId,
    expectedVersion: row.version,
    priority: "high",
    severity: "major",
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
};

// Moves a bug straight to a status, the way earlier workflow steps would.
const force = async (
  bugId: string,
  status: string,
  columns: Record<string, string | null> = {}
): Promise<void> => {
  const set = Object.keys(columns).map(
    (name, index) => `"${name}" = $${index + 3}`
  );
  await authPool.query(
    `UPDATE bug_report SET status = $2, version = version + 1${set.length ? `, ${set.join(", ")}` : ""} WHERE id = $1`,
    [bugId, status, ...Object.values(columns)]
  );
};

const portalView = async (
  persona: "client" | "coworker" | "otherClient",
  bugId: string
) => {
  const result = await callAs(persona, portalQueries.getPortalBug, { bugId });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data as unknown as {
    comments: { body: string; isTeam: boolean }[];
    lifecycle: {
      canRate: boolean;
      canReportAgain: boolean;
      closedReason: string | null;
      duplicateOf: {
        key: string | null;
        status: string;
        title: string | null;
      } | null;
      question: { text: string | null } | null;
      rating: { satisfaction: string } | null;
      verification: {
        canReopen: boolean;
        canRespond: boolean;
        reopensLeft: number;
      } | null;
    };
    canAttach: boolean;
    canComment: boolean;
    readOnlyReason: string | null;
    status: string;
    timeline: { status: string }[];
    version: number;
  };
};

const noticesFor = async (
  userId: string,
  taskId: string
): Promise<string[]> => {
  const rows = await authPool.query<{ text: string }>(
    'SELECT text FROM notification WHERE "userId" = $1 AND "taskId" = $2 ORDER BY "createdAt"',
    [userId, taskId]
  );
  return rows.rows.map(({ text }) => text);
};

// Takes a picked bug through approval and release so the real release branch
// runs: it ends waiting on the client instead of closed.
const releaseThroughAdmin = async (bugId: string): Promise<void> => {
  const row = await state(bugId);
  const attemptId = randomUUID();
  await authPool.query(
    'INSERT INTO bug_fix_attempt (id, "bugReportId", "authorId", "rootCause", "fixSummary", "verificationSteps") VALUES ($1, $2, $3, \'Cause\', \'Fix\', ARRAY[\'Retest\'])',
    [attemptId, bugId, personaId("owner")]
  );
  const approvalId = randomUUID();
  await authPool.query(
    'INSERT INTO bug_approval (id, "bugReportId", "fixAttemptId", "submittedById", "decidedById", status, snapshot, "decidedAt") VALUES ($1, $2, $3, $4, $5, \'approved\', \'{}\', now())',
    [approvalId, bugId, attemptId, personaId("owner"), personaId("admin")]
  );
  await force(bugId, "approved_for_release");
  const released = await callAs("admin", bugActions.recordBugReleaseAction, {
    approvalId,
    bugId,
    environment: "production",
    expectedVersion: row.version + 1,
    notes: null,
    version: "1.0.0",
  });
  if (!released.ok) {
    throw new Error(released.error.message);
  }
  const release = await authPool.query<{ id: string }>(
    'SELECT id FROM bug_release WHERE "bugReportId" = $1',
    [bugId]
  );
  const checked = await callAs(
    "admin",
    bugActions.recordBugPostReleaseCheckAction,
    {
      bugId,
      expectedVersion: await stateField(bugId, "version"),
      notes: "Verified in production",
      passed: true,
      releaseId: release.rows[0]?.id,
    }
  );
  if (!checked.ok) {
    throw new Error(checked.error.message);
  }
};

it("hands a released client bug to the client, who confirms it and rates it", async () => {
  const bugId = await submit("Happy path");
  await pick(bugId);
  await releaseThroughAdmin(bugId);

  const waiting = await state(bugId);
  expect(waiting.status).toBe("awaiting_client");
  expect(waiting.awaitingClientSince).not.toBeNull();
  const view = await portalView("coworker", bugId);
  expect(view.status).toBe("fix_ready");
  expect(view.lifecycle.verification).toMatchObject({
    canReopen: true,
    reopensLeft: 3,
  });
  const clientNotices = await noticesFor(personaId("client"), waiting.taskId);
  expect(clientNotices).toContainEqual(expect.stringContaining("fix is ready"));
  const job = await authPool.query<{ availableAt: Date; createdAt: Date }>(
    "SELECT \"availableAt\", \"createdAt\" FROM job WHERE kind = 'bug.awaiting_client_autoclose' AND payload->>'bugId' = $1",
    [bugId]
  );
  expect(job.rows).toHaveLength(1);
  expect(
    (job.rows[0]?.availableAt.getTime() ?? 0) -
      (job.rows[0]?.createdAt.getTime() ?? 0)
  ).toBe(7 * DAY_MS);

  // A colleague, not only the reporter, can confirm the fix.
  const confirmed = await callAs("coworker", portal.confirmClientFixAction, {
    bugId,
    comment: "Works for us",
    expectedVersion: waiting.version,
    idempotencyKey: nextKey(),
    satisfaction: "up",
  });
  expect(confirmed).toMatchObject({ ok: true });
  expect(await state(bugId)).toMatchObject({
    awaitingClientSince: null,
    resolution: "confirmed",
    satisfaction: "up",
    status: "closed",
  });
  const owner = await noticesFor(personaId("owner"), waiting.taskId);
  expect(owner).toContainEqual(expect.stringContaining("confirmed the fix"));
  const closed = await portalView("client", bugId);
  expect(closed.lifecycle).toMatchObject({
    canRate: false,
    canReportAgain: true,
    closedReason: "confirmed",
    rating: { satisfaction: "up" },
  });
  // The job that would auto-close it later finds nothing to do.
  const stale = await db.transaction((transaction) =>
    autoCloseAwaitingClient(
      transaction,
      bugId,
      waiting.awaitingClientSince ?? new Date()
    )
  );
  expect(stale).toBe(false);
});

it("rates a confirmed bug once, after the fact", async () => {
  const bugId = await submit("Rate later");
  await pick(bugId);
  await force(bugId, "awaiting_client", {
    awaitingClientSince: new Date().toISOString(),
  });
  const waiting = await state(bugId);
  const early = await callAs("client", portal.rateClientBugAction, {
    bugId,
    idempotencyKey: nextKey(),
    satisfaction: "down",
  });
  expect(early).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const confirmed = await callAs("client", portal.confirmClientFixAction, {
    bugId,
    expectedVersion: waiting.version,
    idempotencyKey: nextKey(),
  });
  expect(confirmed).toMatchObject({ ok: true });
  const confirmedView = await portalView("client", bugId);
  expect(confirmedView.lifecycle.canRate).toBe(true);
  const rated = await callAs("coworker", portal.rateClientBugAction, {
    bugId,
    comment: "Took a while",
    idempotencyKey: nextKey(),
    satisfaction: "down",
  });
  expect(rated).toMatchObject({ ok: true });
  expect(await state(bugId)).toMatchObject({ satisfaction: "down" });
  const again = await callAs("client", portal.rateClientBugAction, {
    bugId,
    idempotencyKey: nextKey(),
    satisfaction: "up",
  });
  expect(again).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const otherCompany = await callAs("otherClient", portal.rateClientBugAction, {
    bugId,
    idempotencyKey: nextKey(),
    satisfaction: "up",
  });
  expect(otherCompany).toMatchObject({
    error: { code: "NOT_FOUND" },
    ok: false,
  });
});

it("asks the client a question and resumes the work when they answer", async () => {
  const bugId = await submit("Needs info");
  const unpicked = await callAs("owner", bugActions.requestClientInfoAction, {
    bugId,
    expectedVersion: await stateField(bugId, "version"),
    question: "Which browser?",
  });
  expect(unpicked).toMatchObject({ ok: false });
  await pick(bugId);
  const before = await state(bugId);
  const outsider = await callAs(
    "outsider",
    bugActions.requestClientInfoAction,
    {
      bugId,
      expectedVersion: before.version,
      question: "Not my bug",
    }
  );
  expect(outsider).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const empty = await callAs("owner", bugActions.requestClientInfoAction, {
    bugId,
    expectedVersion: before.version,
    question: "   ",
  });
  expect(empty).toMatchObject({ ok: false });

  const asked = await callAs("owner", bugActions.requestClientInfoAction, {
    bugId,
    expectedVersion: before.version,
    question: "Which browser were you using?",
  });
  expect(asked).toMatchObject({ ok: true });
  const waiting = await state(bugId);
  expect(waiting).toMatchObject({
    status: "needs_info",
    statusBeforeNeedsInfo: "triaged",
  });
  expect(waiting.needsInfoSince).not.toBeNull();
  const view = await portalView("client", bugId);
  expect(view.status).toBe("waiting_for_reply");
  expect(view.lifecycle.question?.text).toBe("Which browser were you using?");
  expect(view.comments.at(-1)).toMatchObject({
    body: "Which browser were you using?",
    isTeam: true,
  });
  const jobs = await authPool.query<{
    availableAt: Date;
    createdAt: Date;
    kind: string;
  }>(
    "SELECT kind, \"availableAt\", \"createdAt\" FROM job WHERE payload->>'bugId' = $1 AND kind LIKE 'bug.needs_info_%' ORDER BY kind",
    [bugId]
  );
  expect(
    jobs.rows.map(
      ({ availableAt, createdAt, kind }) =>
        `${kind}:${(availableAt.getTime() - createdAt.getTime()) / DAY_MS}`
    )
  ).toEqual(["bug.needs_info_autoclose:14", "bug.needs_info_reminder:3"]);
  expect(await noticesFor(personaId("client"), waiting.taskId)).toContainEqual(
    expect.stringContaining("needs more information")
  );

  const since = waiting.needsInfoSince ?? new Date();
  const reminded = await db.transaction((transaction) =>
    remindNeedsInfo(transaction, bugId, since)
  );
  expect(reminded).toBe(true);
  expect(await noticesFor(personaId("client"), waiting.taskId)).toContainEqual(
    expect.stringContaining("still waiting for your reply")
  );

  // A colleague's plain comment is an answer too.
  const answered = await callAs("coworker", portal.addClientCommentAction, {
    body: "Firefox 140",
    bugId,
    idempotencyKey: nextKey(),
  });
  expect(answered).toMatchObject({ ok: true });
  expect(await state(bugId)).toMatchObject({
    needsInfoSince: null,
    status: "triaged",
    statusBeforeNeedsInfo: null,
  });
  expect(await noticesFor(personaId("owner"), waiting.taskId)).toContainEqual(
    expect.stringContaining("client answered")
  );
  // The old reminder and auto-close now do nothing.
  const [staleReminder, staleClose] = await Promise.all([
    db.transaction((transaction) => remindNeedsInfo(transaction, bugId, since)),
    db.transaction((transaction) =>
      autoCloseNeedsInfo(transaction, bugId, since)
    ),
  ]);
  expect([staleReminder, staleClose]).toEqual([false, false]);
});

it("closes a bug that the client never answered", async () => {
  const bugId = await submit("No response");
  await pick(bugId);
  const before = await state(bugId);
  const asked = await callAs("owner", bugActions.requestClientInfoAction, {
    bugId,
    expectedVersion: before.version,
    question: "Can you share a screenshot?",
  });
  expect(asked).toMatchObject({ ok: true });
  const waiting = await state(bugId);
  const closed = await db.transaction((transaction) =>
    autoCloseNeedsInfo(transaction, bugId, waiting.needsInfoSince ?? new Date())
  );
  expect(closed).toBe(true);
  expect(await state(bugId)).toMatchObject({
    resolution: "no_response",
    status: "closed",
  });
  const activity = await authPool.query<{ details: Record<string, unknown> }>(
    'SELECT details FROM activity WHERE "taskId" = $1 AND action = \'bug.status_changed\' ORDER BY "createdAt" DESC LIMIT 1',
    [waiting.taskId]
  );
  expect(activity.rows[0]?.details).toMatchObject({
    automatic: true,
    reason: "no_response",
    to: "closed",
  });
  const noResponseView = await portalView("client", bugId);
  expect(noResponseView.lifecycle.closedReason).toBe("no_response");
});

it("closes a fix the client never verified after a week", async () => {
  const bugId = await submit("Never verified");
  await pick(bugId);
  const since = new Date(Date.now() - 7 * DAY_MS);
  await force(bugId, "awaiting_client", {
    awaitingClientSince: since.toISOString(),
  });
  const closed = await db.transaction((transaction) =>
    autoCloseAwaitingClient(transaction, bugId, since)
  );
  expect(closed).toBe(true);
  expect(await state(bugId)).toMatchObject({
    resolution: "unconfirmed",
    status: "closed",
  });
  const unverifiedView = await portalView("client", bugId);
  expect(unverifiedView.lifecycle).toMatchObject({
    canRate: false,
    closedReason: "unconfirmed",
  });
});

it("lets a client reopen a fix three times, then only an admin can", async () => {
  const bugId = await submit("Stubborn bug");
  await pick(bugId);
  for (let round = 1; round <= 3; round += 1) {
    // eslint-disable-next-line no-await-in-loop
    await force(bugId, "awaiting_client", {
      awaitingClientSince: new Date().toISOString(),
    });
    // eslint-disable-next-line no-await-in-loop
    const waiting = await state(bugId);
    // eslint-disable-next-line no-await-in-loop
    const reopened = await callAs("coworker", portal.reopenClientFixAction, {
      bugId,
      expectedVersion: waiting.version,
      idempotencyKey: nextKey(),
      reason: `Still broken, round ${round}`,
    });
    expect(reopened).toMatchObject({ ok: true });
    // eslint-disable-next-line no-await-in-loop
    expect(await state(bugId)).toMatchObject({
      awaitingClientSince: null,
      clientReopenCount: round,
      status: "triaged",
    });
  }
  const { taskId } = await state(bugId);
  const owner = await noticesFor(personaId("owner"), taskId);
  expect(owner.filter((text) => text.includes("still broken"))).toHaveLength(3);
  const view = await portalView("client", bugId);
  expect(view.comments.map(({ body }) => body)).toContain(
    "Still broken, round 3"
  );

  await force(bugId, "awaiting_client", {
    awaitingClientSince: new Date().toISOString(),
  });
  const limited = await portalView("client", bugId);
  expect(limited.lifecycle.verification).toMatchObject({
    canReopen: false,
    reopensLeft: 0,
  });
  const fourth = await callAs("client", portal.reopenClientFixAction, {
    bugId,
    expectedVersion: limited.version,
    idempotencyKey: nextKey(),
    reason: "One more time",
  });
  expect(fourth).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  expect(JSON.stringify(fourth)).toContain("account manager");

  const adminReopened = await callAs("admin", bugActions.reopenBugAction, {
    bugId,
    expectedVersion: limited.version,
  });
  expect(adminReopened).toMatchObject({ ok: true });
  expect(await state(bugId)).toMatchObject({
    awaitingClientSince: null,
    status: "in_progress",
  });
});

it("requires a reason and a current version to reopen", async () => {
  const bugId = await submit("Reopen validation");
  await pick(bugId);
  await force(bugId, "awaiting_client", {
    awaitingClientSince: new Date().toISOString(),
  });
  const waiting = await state(bugId);
  const noReason = await callAs("client", portal.reopenClientFixAction, {
    bugId,
    expectedVersion: waiting.version,
    idempotencyKey: nextKey(),
    reason: "   ",
  });
  expect(noReason).toMatchObject({ ok: false });
  const stale = await callAs("client", portal.reopenClientFixAction, {
    bugId,
    expectedVersion: waiting.version + 3,
    idempotencyKey: nextKey(),
    reason: "Broken",
  });
  expect(stale).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
  const otherCompany = await callAs(
    "otherClient",
    portal.reopenClientFixAction,
    {
      bugId,
      expectedVersion: waiting.version,
      idempotencyKey: nextKey(),
      reason: "Not mine",
    }
  );
  expect(otherCompany).toMatchObject({
    error: { code: "NOT_FOUND" },
    ok: false,
  });
  expect(await stateField(bugId, "status")).toBe("awaiting_client");
});

it("shows merged duplicates the original's status and hands them over when it ships", async () => {
  const originalId = await submit("Original bug");
  const duplicateId = await submit("Duplicate bug");
  const foreignId = await submit("Foreign duplicate", "otherClient");
  await pick(originalId);
  const duplicate = await state(duplicateId);
  const merged = await callAs("admin", bugActions.relateBugAction, {
    bugId: duplicateId,
    expectedVersion: duplicate.version,
    relatedBugId: originalId,
    type: "duplicate",
  });
  expect(merged).toMatchObject({ ok: true });
  const mergedView = await portalView("client", duplicateId);
  expect(mergedView.status).toBe("merged");
  expect(mergedView.lifecycle.duplicateOf).toMatchObject({
    status: "acknowledged",
    title: "Original bug",
  });

  // Another company's duplicate sees the original's status only.
  const foreign = await state(foreignId);
  const foreignMerge = await callAs("admin", bugActions.relateBugAction, {
    bugId: foreignId,
    expectedVersion: foreign.version,
    relatedBugId: originalId,
    type: "duplicate",
  });
  expect(foreignMerge).toMatchObject({ ok: true });
  const foreignView = await portalView("otherClient", foreignId);
  expect(foreignView.lifecycle.duplicateOf).toEqual({
    key: null,
    status: "acknowledged",
    title: null,
  });

  await releaseThroughAdmin(originalId);
  expect(await stateField(originalId, "status")).toBe("awaiting_client");
  expect(await stateField(duplicateId, "status")).toBe("awaiting_client");
  expect(await stateField(foreignId, "status")).toBe("awaiting_client");
  const handedOverView = await portalView("coworker", duplicateId);
  expect(handedOverView.status).toBe("fix_ready");

  // Reopening the duplicate sends it back on its own, link intact; nobody had
  // picked it, so it rejoins the queue.
  const waiting = await state(duplicateId);
  const reopened = await callAs("client", portal.reopenClientFixAction, {
    bugId: duplicateId,
    expectedVersion: waiting.version,
    idempotencyKey: nextKey(),
    reason: "Still happens for us",
  });
  expect(reopened).toMatchObject({ ok: true });
  expect(await state(duplicateId)).toMatchObject({
    clientReopenCount: 1,
    status: "reported",
  });
  const relation = await authPool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM bug_relation WHERE "fromBugReportId" = $1 AND "toBugReportId" = $2 AND type = \'duplicate\'',
    [duplicateId, originalId]
  );
  expect(relation.rows[0]?.count).toBe(1);
});

// The client's company list, filtered by one client status label.
const listIds = async (status: string) => {
  const listed = await callAs("client", portalQueries.listPortalBugs, {
    status,
  });
  return listed.ok
    ? (listed.data as readonly { id: string }[]).map(({ id }) => id)
    : [];
};

it("closes a client bug as not a bug with a reason the client can read", async () => {
  const bugId = await submit("Works as designed");
  const unpicked = await callAs(
    "owner",
    bugActions.closeClientBugNotABugAction,
    {
      bugId,
      expectedVersion: await stateField(bugId, "version"),
      reason: "Not a bug",
    }
  );
  expect(unpicked).toMatchObject({ ok: false });
  await pick(bugId);
  const row = await state(bugId);
  const outsider = await callAs(
    "outsider",
    bugActions.closeClientBugNotABugAction,
    {
      bugId,
      expectedVersion: row.version,
      reason: "Not a bug",
    }
  );
  expect(outsider).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const noReason = await callAs(
    "owner",
    bugActions.closeClientBugNotABugAction,
    {
      bugId,
      expectedVersion: row.version,
      reason: "  ",
    }
  );
  expect(noReason).toMatchObject({ ok: false });

  const closed = await callAs("owner", bugActions.closeClientBugNotABugAction, {
    bugId,
    expectedVersion: row.version,
    reason: "This is how exports are meant to behave.",
  });
  expect(closed).toMatchObject({ ok: true });
  expect(await state(bugId)).toMatchObject({
    resolution: "not_a_bug",
    status: "closed",
  });
  const view = await portalView("client", bugId);
  expect(view.status).toBe("not_a_bug");
  expect(view.lifecycle.closedReason).toBe("not_a_bug");
  expect(view.comments.at(-1)?.body).toBe(
    "This is how exports are meant to behave."
  );
  expect(view.timeline.at(-1)?.status).toBe("not_a_bug");
  expect(await listIds("not_a_bug")).toContain(bugId);
  expect(await listIds("closed")).not.toContain(bugId);

  const reopened = await callAs("admin", bugActions.reopenBugAction, {
    bugId,
    expectedVersion: await stateField(bugId, "version"),
  });
  expect(reopened).toMatchObject({ ok: true });
  expect(await state(bugId)).toMatchObject({
    resolution: null,
    status: "in_progress",
  });
});

it("lets an admin reopen a bug stuck waiting on the client", async () => {
  const bugId = await submit("Admin override");
  await pick(bugId);
  const before = await state(bugId);
  const asked = await callAs("owner", bugActions.requestClientInfoAction, {
    bugId,
    expectedVersion: before.version,
    question: "Any more detail?",
  });
  expect(asked).toMatchObject({ ok: true });
  const waiting = await state(bugId);
  const reopened = await callAs("admin", bugActions.reopenBugAction, {
    bugId,
    expectedVersion: waiting.version,
  });
  expect(reopened).toMatchObject({ ok: true });
  expect(await state(bugId)).toMatchObject({
    needsInfoSince: null,
    status: "in_progress",
    statusBeforeNeedsInfo: null,
  });
  const byHandler = await callAs("owner", bugActions.reopenBugAction, {
    bugId,
    expectedVersion: await stateField(bugId, "version"),
  });
  expect(byHandler).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
});

it("reports a closed bug again as a linked recurrence", async () => {
  const originalId = await submit("Came back");
  await pick(originalId);
  const waiting = await state(originalId);
  const closedBy = await callAs(
    "owner",
    bugActions.closeClientBugNotABugAction,
    {
      bugId: originalId,
      expectedVersion: waiting.version,
      reason: "Cannot reproduce",
    }
  );
  expect(closedBy).toMatchObject({ ok: true });

  const again = await submit("Came back (again)", "client", {
    recurrenceOfBugId: originalId,
  });
  const relation = await authPool.query<{
    createdById: string;
    fromBugReportId: string;
    toBugReportId: string;
    type: string;
  }>(
    'SELECT "createdById", "fromBugReportId", "toBugReportId", type FROM bug_relation WHERE "fromBugReportId" = $1',
    [again]
  );
  expect(relation.rows).toEqual([
    {
      createdById: personaId("client"),
      fromBugReportId: again,
      toBugReportId: originalId,
      type: "recurrence",
    },
  ]);
  expect(await stateField(again, "status")).toBe("reported");

  // Only a closed bug of your own company can be reported again.
  const open = await submit("Still open");
  const notClosed = await callAs("client", portal.submitClientBugAction, {
    actualBehavior: "Broken",
    browser: null,
    description: null,
    device: null,
    expectedBehavior: "Works",
    idempotencyKey: nextKey(),
    impact: "low",
    os: null,
    pageUrl: "/page",
    projectId: ids.projectId,
    recurrenceOfBugId: open,
    reproductionSteps: ["Open it"],
    title: "Not closed",
  });
  expect(notClosed).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
  const foreign = await callAs("otherClient", portal.submitClientBugAction, {
    actualBehavior: "Broken",
    browser: null,
    description: null,
    device: null,
    expectedBehavior: "Works",
    idempotencyKey: nextKey(),
    impact: "low",
    os: null,
    pageUrl: "/page",
    projectId: ids.projectId,
    recurrenceOfBugId: originalId,
    reproductionSteps: ["Open it"],
    title: "Someone else's bug",
  });
  expect(foreign).toMatchObject({ error: { code: "NOT_FOUND" }, ok: false });
});
