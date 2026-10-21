import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  callAs,
  ids,
  nextKey,
  personaId,
  replay,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { refreshes, revalidatedPaths } from "./support/next-cache-mock";

const timeActions = await import("../../features/time/time-actions");
const timeQueries = await import("../../features/time/time-queries");

beforeAll(setupHarness);
afterAll(async () => {
  await authPool.query('DELETE FROM time_entry WHERE "taskId" = $1', [
    ids.taskId,
  ]);
  await authPool.query('DELETE FROM time_timer WHERE "taskId" = $1', [
    ids.taskId,
  ]);
  await teardownHarness();
});

const entryCount = async (): Promise<number> => {
  const rows = await authPool.query(
    'SELECT count(*)::int AS count FROM time_entry WHERE "taskId" = $1',
    [ids.taskId]
  );
  return rows.rows[0]?.count ?? 0;
};

it("replays every time mutation without logging twice and asks the page to refresh", async () => {
  const refreshesBefore = refreshes.count;
  const added = await replay(
    "addTimeEntryAction",
    "owner",
    timeActions.addTimeEntryAction,
    {
      billable: true,
      minutes: 40,
      note: "Replay entry",
      taskId: ids.taskId,
      workDate: "2026-10-20",
    }
  );
  expect(await entryCount()).toBe(1);
  expect(refreshes.count).toBeGreaterThan(refreshesBefore);
  expect(revalidatedPaths).toContain("/my-time");

  const updated = await replay(
    "updateTimeEntryAction",
    "owner",
    timeActions.updateTimeEntryAction,
    {
      billable: false,
      entryId: added.id,
      minutes: 50,
      note: null,
      workDate: "2026-10-21",
    }
  );
  expect(updated).toMatchObject({ billable: false, minutes: 50 });

  await replay("startTimerAction", "owner", timeActions.startTimerAction, {
    billable: false,
    note: null,
    taskId: ids.taskId,
  });
  const running = await callAs("owner", timeQueries.getRunningTimer, {});
  expect(running).toMatchObject({ data: { taskId: ids.taskId }, ok: true });
  const stopped = await replay(
    "stopTimerAction",
    "owner",
    timeActions.stopTimerAction,
    {}
  );
  expect(stopped.minutes).toBeGreaterThanOrEqual(1);
  expect(await entryCount()).toBe(2);

  await replay(
    "deleteTimeEntryAction",
    "owner",
    timeActions.deleteTimeEntryAction,
    { entryId: added.id }
  );
  expect(await entryCount()).toBe(1);
});

it("reads the owner's own time and refuses another person's edits", async () => {
  const owner = await callAs("owner", timeQueries.getTaskTime, {
    taskId: ids.taskId,
  });
  expect(owner).toMatchObject({ ok: true });
  if (!owner.ok) {
    throw new Error("The owner could not read task time.");
  }
  const [entry] = owner.data.entries;
  expect(entry?.userId).toBe(personaId("owner"));

  const foreignEdit = await callAs(
    "coworker",
    timeActions.deleteTimeEntryAction,
    {
      entryId: entry?.id,
      idempotencyKey: nextKey(),
    }
  );
  expect(foreignEdit).toMatchObject({
    error: { code: "FORBIDDEN" },
    ok: false,
  });
  const adminDelete = await callAs("admin", timeActions.deleteTimeEntryAction, {
    entryId: entry?.id,
    idempotencyKey: nextKey(),
  });
  expect(adminDelete).toMatchObject({ ok: true });
});
