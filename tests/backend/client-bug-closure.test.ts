import { expect, it } from "bun:test";

import {
  authPool,
  callAs,
  ids,
  nextKey,
  personaId,
} from "./support/action-harness";
import {
  portal,
  portalQueries,
  bugActions,
  bugClientActions,
  state,
  stateField,
  submit,
  pick,
  portalView,
  installHooks,
} from "./support/client-lifecycle-fixtures";

installHooks();

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
    bugClientActions.closeClientBugNotABugAction,
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
    bugClientActions.closeClientBugNotABugAction,
    {
      bugId,
      expectedVersion: row.version,
      reason: "Not a bug",
    }
  );
  expect(outsider).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const noReason = await callAs(
    "owner",
    bugClientActions.closeClientBugNotABugAction,
    {
      bugId,
      expectedVersion: row.version,
      reason: "  ",
    }
  );
  expect(noReason).toMatchObject({ ok: false });

  const closed = await callAs(
    "owner",
    bugClientActions.closeClientBugNotABugAction,
    {
      bugId,
      expectedVersion: row.version,
      reason: "This is how exports are meant to behave.",
    }
  );
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
  const asked = await callAs(
    "owner",
    bugClientActions.requestClientInfoAction,
    {
      bugId,
      expectedVersion: before.version,
      question: "Any more detail?",
    }
  );
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
    bugClientActions.closeClientBugNotABugAction,
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
