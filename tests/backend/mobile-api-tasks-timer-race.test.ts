import { afterAll, beforeAll, beforeEach, expect, it } from "bun:test";

import {
  authPool,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { newKey, seedTask, send } from "./support/mobile-tasks-fixtures";

const TIMER_PATH = "/api/v1/workspace/me/timer";
const PARALLEL_STOPS = 5;

const entryCount = async (taskId: string): Promise<number> => {
  const result = await authPool.query(
    'SELECT count(*)::int AS count FROM time_entry WHERE "taskId" = $1',
    [taskId]
  );
  return result.rows[0]?.count ?? 0;
};

const timerCount = async (): Promise<number> => {
  const result = await authPool.query(
    'SELECT count(*)::int AS count FROM time_timer WHERE "userId" = $1',
    [personaId("owner")]
  );
  return result.rows[0]?.count ?? 0;
};

beforeAll(setupHarness);
afterAll(teardownHarness);
beforeEach(async () => {
  await authPool.query('DELETE FROM time_timer WHERE "userId" = $1', [
    personaId("owner"),
  ]);
});

it("saves one entry when the same timer is stopped several times at once", async () => {
  const taskId = await seedTask({ assignees: [personaId("owner")] });
  const started = await send("POST", `${TIMER_PATH}/start`, {
    as: "owner",
    body: { billable: false, note: null, taskId },
    key: newKey(),
  });
  expect(started.status).toBe(200);

  const stops = await Promise.all(
    Array.from({ length: PARALLEL_STOPS }, () =>
      send("POST", `${TIMER_PATH}/stop`, { as: "owner", key: newKey() })
    )
  );

  const statuses = stops.map(({ status }) => status).toSorted();
  expect(statuses.filter((status) => status === 200)).toHaveLength(1);
  expect(await entryCount(taskId)).toBe(1);
  expect(await timerCount()).toBe(0);
});

it("answers one start with success and the other with a conflict when none was running", async () => {
  const first = await seedTask({ assignees: [personaId("owner")] });
  const second = await seedTask({ assignees: [personaId("owner")] });

  const starts = await Promise.all(
    [first, second].map((taskId) =>
      send("POST", `${TIMER_PATH}/start`, {
        as: "owner",
        body: { billable: false, note: null, taskId },
        key: newKey(),
      })
    )
  );

  const statuses = starts.map(({ status }) => status).toSorted();
  expect(statuses).toEqual([200, 409]);
  expect(await timerCount()).toBe(1);
});
