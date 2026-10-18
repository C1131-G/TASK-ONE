import { expect, it } from "bun:test";

import { db } from "../../src/prisma/db";
import {
  autoCloseAwaitingClient,
  autoCloseNeedsInfo,
  remindNeedsInfo,
} from "../../src/server/work/bug-workflow-client-jobs";
import { authPool, callAs, nextKey, personaId } from "./support/action-harness";
import {
  portal,
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
  const unpicked = await callAs(
    "owner",
    bugClientActions.requestClientInfoAction,
    {
      bugId,
      expectedVersion: await stateField(bugId, "version"),
      question: "Which browser?",
    }
  );
  expect(unpicked).toMatchObject({ ok: false });
  await pick(bugId);
  const before = await state(bugId);
  const outsider = await callAs(
    "outsider",
    bugClientActions.requestClientInfoAction,
    {
      bugId,
      expectedVersion: before.version,
      question: "Not my bug",
    }
  );
  expect(outsider).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const empty = await callAs(
    "owner",
    bugClientActions.requestClientInfoAction,
    {
      bugId,
      expectedVersion: before.version,
      question: "   ",
    }
  );
  expect(empty).toMatchObject({ ok: false });

  const asked = await callAs(
    "owner",
    bugClientActions.requestClientInfoAction,
    {
      bugId,
      expectedVersion: before.version,
      question: "Which browser were you using?",
    }
  );
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
