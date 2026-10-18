import { expect, it } from "bun:test";

import { db } from "../../src/prisma/db";
import {
  autoCloseAwaitingClient,
  autoCloseNeedsInfo,
} from "../../src/server/work/bug-workflow-client-jobs";
import { authPool, callAs, nextKey, personaId } from "./support/action-harness";
import {
  portal,
  bugActions,
  bugClientActions,
  DAY_MS,
  state,
  stateField,
  submit,
  pick,
  force,
  portalView,
  noticesFor,
  releaseThroughAdmin,
  installHooks,
} from "./support/client-lifecycle-fixtures";

installHooks();

it("closes a bug that the client never answered", async () => {
  const bugId = await submit("No response");
  await pick(bugId);
  const before = await state(bugId);
  const asked = await callAs(
    "owner",
    bugClientActions.requestClientInfoAction,
    {
      bugId,
      expectedVersion: before.version,
      question: "Can you share a screenshot?",
    }
  );
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
