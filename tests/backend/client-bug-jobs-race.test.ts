import { expect, it } from "bun:test";

import { db } from "../../src/prisma/db";
import {
  autoCloseAwaitingClient,
  autoCloseNeedsInfo,
} from "../../src/server/work/bug-workflow-client-jobs";
import type { Transaction } from "../../src/server/work/work-internal";
import { callAs } from "./support/action-harness";
import {
  bugClientActions,
  DAY_MS,
  force,
  installHooks,
  pick,
  state,
  submit,
} from "./support/client-lifecycle-fixtures";

installHooks();

// The jobs decide from one read of the bug and then change it. A client who
// answers in between is the case that matters, and it cannot be timed from a
// test, so this hands the job the row as it was before the client answered
// while the database already holds the answer. The job must notice.
const withStaleFirstRead = (
  transaction: Transaction,
  stale: object
): Transaction => {
  let served = false;
  const bugReport = transaction.orm.public.BugReport;
  const patchedBugReport = new Proxy(bugReport, {
    get(target, property) {
      if (property === "where") {
        return (filter: unknown) => {
          if (!served) {
            served = true;
            return { first: () => Promise.resolve(stale) };
          }
          return target.where(filter as never);
        };
      }
      const value = Reflect.get(target, property) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const publicSchema = new Proxy(transaction.orm.public, {
    get: (target, property) =>
      property === "BugReport"
        ? patchedBugReport
        : Reflect.get(target, property),
  });
  const orm = new Proxy(transaction.orm, {
    get: (target, property) =>
      property === "public" ? publicSchema : Reflect.get(target, property),
  });
  return new Proxy(transaction, {
    get: (target, property) =>
      property === "orm" ? orm : Reflect.get(target, property),
  });
};

const readBug = async (bugId: string): Promise<object> => {
  const row = await db.orm.public.BugReport.where({ id: bugId }).first();
  if (!row) {
    throw new Error("bug missing");
  }
  return row;
};

it("leaves a fix alone that the client confirmed while the auto-close was deciding", async () => {
  const bugId = await submit("Confirmed in time");
  await pick(bugId);
  const since = new Date(Date.now() - 7 * DAY_MS);
  await force(bugId, "awaiting_client", {
    awaitingClientSince: since.toISOString(),
  });
  const beforeConfirm = await readBug(bugId);
  // The client confirms the fix.
  await force(bugId, "closed", {
    awaitingClientSince: null,
    resolution: "fixed",
  });

  const closed = await db.transaction((transaction) =>
    autoCloseAwaitingClient(
      withStaleFirstRead(transaction, beforeConfirm),
      bugId,
      since
    )
  );

  expect(closed).toBe(false);
  expect(await state(bugId)).toMatchObject({
    resolution: "fixed",
    status: "closed",
  });
});

it("leaves a bug alone that the client answered while the auto-close was deciding", async () => {
  const bugId = await submit("Answered in time");
  await pick(bugId);
  const picked = await state(bugId);
  const asked = await callAs(
    "owner",
    bugClientActions.requestClientInfoAction,
    {
      bugId,
      expectedVersion: picked.version,
      question: "Can you share a screenshot?",
    }
  );
  expect(asked).toMatchObject({ ok: true });
  const waiting = await state(bugId);
  const since = waiting.needsInfoSince ?? new Date();
  const returnTo = waiting.statusBeforeNeedsInfo ?? picked.status;
  const beforeAnswer = await readBug(bugId);
  // The client answers, which sends the bug back to the team.
  await force(bugId, returnTo, {
    needsInfoSince: null,
    statusBeforeNeedsInfo: null,
  });

  const closed = await db.transaction((transaction) =>
    autoCloseNeedsInfo(
      withStaleFirstRead(transaction, beforeAnswer),
      bugId,
      since
    )
  );

  expect(closed).toBe(false);
  expect(await state(bugId)).toMatchObject({
    resolution: null,
    status: returnTo,
  });
});
