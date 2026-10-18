import { expect, it } from "bun:test";

import { db } from "../../src/prisma/db";
import { createBugSla, slaOnStatusChange } from "../../src/server/work/bug-sla";
import { businessDeadline } from "../../src/server/work/business-time";
import { authPool, callAs, nextKey } from "./support/action-harness";
import {
  portal,
  bugClientActions,
  comments,
  HOUR_MS,
  at,
  UTC_WEEK,
  submit,
  slaOf,
  slaField,
  taskOf,
  versionOf,
  pick,
  pinClocks,
  installHooks,
} from "./support/bug-sla-fixtures";

installHooks();

it("starts both clocks in business time when a client reports a bug", async () => {
  const bugId = await submit("Clocks");
  const started = await slaOf(bugId);
  expect(started.firstRespondedAt).toBeNull();
  expect(started.resolvedAt).toBeNull();
  expect(started.resolutionStartedAt.getTime()).toBe(
    started.createdAt.getTime()
  );
  expect(started.firstResponseDueAt.getTime()).toBe(
    businessDeadline(started.createdAt, 480, UTC_WEEK).getTime()
  );
  expect(started.resolutionDueAt.getTime()).toBe(
    businessDeadline(started.createdAt, 4800, UTC_WEEK).getTime()
  );

  // With a pinned start the results are exact: urgent on a Monday morning.
  await authPool.query('DELETE FROM bug_sla WHERE "bugId" = $1', [bugId]);
  await db.transaction((transaction) =>
    createBugSla(transaction, {
      bugId,
      impact: "urgent",
      now: at("2026-10-05T10:00:00Z"),
    })
  );
  const urgent = await slaOf(bugId);
  expect(urgent.firstResponseDueAt.toISOString()).toBe(
    "2026-10-05T11:00:00.000Z"
  );
  expect(urgent.resolutionDueAt.toISOString()).toBe("2026-10-05T18:00:00.000Z");

  // A medium bug's 80 business hours skip the weekend.
  await authPool.query('DELETE FROM bug_sla WHERE "bugId" = $1', [bugId]);
  await db.transaction((transaction) =>
    createBugSla(transaction, {
      bugId,
      impact: "medium",
      now: at("2026-10-05T10:00:00Z"),
    })
  );
  const medium = await slaOf(bugId);
  expect(medium.resolutionDueAt.toISOString()).toBe("2026-10-15T18:00:00.000Z");
});

it("counts a pick as the first response, and only the first", async () => {
  const bugId = await submit("First by pick");
  expect(await slaField(bugId, "firstRespondedAt")).toBeNull();
  await pick(bugId);
  const picked = await slaOf(bugId);
  expect(picked.firstRespondedAt).not.toBeNull();
  const taskId = await taskOf(bugId);
  const reply = await callAs("owner", comments.createCommentAction, {
    body: "On it",
    idempotencyKey: nextKey(),
    taskId,
    visibility: "public",
  });
  expect(reply).toMatchObject({ ok: true });
  const after = await slaOf(bugId);
  expect(after.firstRespondedAt?.getTime()).toBe(
    picked.firstRespondedAt?.getTime()
  );
});

it("counts the team's first public reply, but not notes or client comments", async () => {
  const bugId = await submit("First by reply");
  const taskId = await taskOf(bugId);
  const internal = await callAs("admin", comments.createCommentAction, {
    body: "Internal triage note",
    idempotencyKey: nextKey(),
    taskId,
  });
  expect(internal).toMatchObject({ ok: true });
  const fromClient = await callAs("coworker", portal.addClientCommentAction, {
    body: "Any news?",
    bugId,
    idempotencyKey: nextKey(),
  });
  expect(fromClient).toMatchObject({ ok: true });
  expect(await slaField(bugId, "firstRespondedAt")).toBeNull();

  const reply = await callAs("admin", comments.createCommentAction, {
    body: "We are looking",
    idempotencyKey: nextKey(),
    taskId,
    visibility: "public",
  });
  expect(reply).toMatchObject({ ok: true });
  expect(await slaField(bugId, "firstRespondedAt")).not.toBeNull();
});

it("pauses the resolution clock while the client is asked, then resumes it", async () => {
  const bugId = await submit("Pause and resume");
  await pick(bugId);
  const asked = await callAs(
    "owner",
    bugClientActions.requestClientInfoAction,
    {
      bugId,
      expectedVersion: await versionOf(bugId),
      question: "Which browser?",
    }
  );
  expect(asked).toMatchObject({ ok: true });
  expect(await slaField(bugId, "pausedAt")).not.toBeNull();
  const answered = await callAs("client", portal.addClientCommentAction, {
    body: "Firefox",
    bugId,
    idempotencyKey: nextKey(),
  });
  expect(answered).toMatchObject({ ok: true });
  const resumed = await slaOf(bugId);
  expect(resumed.pausedAt).toBeNull();
  expect(resumed.pausedBusinessMs).toBeGreaterThanOrEqual(0);

  // Pinned: paused Monday 10:00, resumed Tuesday 10:00, nine business hours
  // later, so a Monday 17:00 deadline moves to Tuesday 17:00.
  await pinClocks(bugId, {
    pausedAt: "2026-10-05T10:00:00Z",
    resolutionDueAt: "2026-10-05T17:00:00Z",
  });
  await authPool.query(
    'UPDATE bug_sla SET "pausedBusinessMs" = 0 WHERE "bugId" = $1',
    [bugId]
  );
  await db.transaction((transaction) =>
    slaOnStatusChange(transaction, {
      bugId,
      from: "needs_info",
      now: at("2026-10-06T10:00:00Z"),
      to: "triaged",
    })
  );
  const moved = await slaOf(bugId);
  expect(moved.pausedAt).toBeNull();
  expect(moved.pausedBusinessMs).toBe(9 * HOUR_MS);
  expect(moved.resolutionDueAt.toISOString()).toBe("2026-10-06T17:00:00.000Z");
});

it("stops the resolution clock when done and restarts it if the bug returns", async () => {
  const bugId = await submit("Stop and restart");
  const handOver = at("2026-10-05T12:00:00Z");
  await db.transaction((transaction) =>
    slaOnStatusChange(transaction, {
      bugId,
      from: "released",
      now: handOver,
      to: "awaiting_client",
    })
  );
  const handedOverAt = await slaField(bugId, "resolvedAt");
  expect(handedOverAt?.toISOString()).toBe(handOver.toISOString());
  await authPool.query(
    'UPDATE bug_sla SET "breachedResolution" = true, "warnedResolution" = true, "pausedBusinessMs" = 5000 WHERE "bugId" = $1',
    [bugId]
  );

  // Still broken: the clock starts over from the reopen.
  const reopened = at("2026-10-07T15:00:00Z");
  await db.transaction((transaction) =>
    slaOnStatusChange(transaction, {
      bugId,
      from: "awaiting_client",
      now: reopened,
      to: "triaged",
    })
  );
  const restarted = await slaOf(bugId);
  expect(restarted).toMatchObject({
    breachedResolution: false,
    pausedAt: null,
    pausedBusinessMs: 0,
    resolvedAt: null,
    warnedResolution: false,
  });
  expect(restarted.resolutionStartedAt.toISOString()).toBe(
    reopened.toISOString()
  );
  expect(restarted.resolutionDueAt.toISOString()).toBe(
    businessDeadline(reopened, 4800, UTC_WEEK).toISOString()
  );

  // Closing as not a bug through the real workflow also stops it.
  const closing = await submit("Closed early");
  await pick(closing);
  const closed = await callAs(
    "owner",
    bugClientActions.closeClientBugNotABugAction,
    {
      bugId: closing,
      expectedVersion: await versionOf(closing),
      reason: "Works as designed",
    }
  );
  expect(closed).toMatchObject({ ok: true });
  expect(await slaField(closing, "resolvedAt")).not.toBeNull();
});
