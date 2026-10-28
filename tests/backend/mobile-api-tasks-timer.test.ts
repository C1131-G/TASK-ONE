import { afterAll, beforeAll, beforeEach, expect, it } from "bun:test";

import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { Persona } from "./support/action-harness";
import { newKey, seedTask, send } from "./support/mobile-tasks-fixtures";

interface RunningTimer {
  readonly billable: boolean;
  readonly note: string | null;
  readonly startedAt: string;
  readonly taskId: string;
  readonly taskReference: string;
  readonly taskTitle: string;
}

interface TimeEntryView {
  readonly billable: boolean;
  readonly id: string;
  readonly minutes: number;
  readonly note: string | null;
  readonly taskId: string;
  readonly taskReference: string;
  readonly taskTitle: string;
  readonly userId: string;
  readonly userName: string;
  readonly workDate: string;
}

interface StartedTimer {
  readonly stopped: TimeEntryView | null;
  readonly timer: RunningTimer;
}

const TIMER_PATH = "/api/v1/workspace/me/timer";

const readTimer = (options: { as?: Persona; token?: string } = {}) =>
  send<{ timer: RunningTimer | null }>("GET", TIMER_PATH, {
    ...options,
    as: options.as ?? "owner",
  });

const startTimer = (
  body: unknown,
  options: { as?: Persona; key?: string } = {}
) =>
  send<StartedTimer>("POST", `${TIMER_PATH}/start`, {
    as: options.as ?? "owner",
    body,
    key: options.key ?? newKey(),
  });

const stopTimer = (options: { as?: Persona; key?: string } = {}) =>
  send<TimeEntryView>("POST", `${TIMER_PATH}/stop`, {
    as: options.as ?? "owner",
    key: options.key ?? newKey(),
  });

const ownerTimers = async () => {
  const result = await authPool.query(
    'SELECT * FROM time_timer WHERE "userId" = $1',
    [personaId("owner")]
  );
  return result.rows;
};

const entriesFor = async (taskId: string) => {
  const result = await authPool.query(
    'SELECT * FROM time_entry WHERE "taskId" = $1 ORDER BY "createdAt"',
    [taskId]
  );
  return result.rows;
};

// Every test starts with no timer, so one test cannot leak a running timer
// into the next one.
beforeEach(async () => {
  await authPool.query('DELETE FROM time_timer WHERE "userId" = $1', [
    personaId("owner"),
  ]);
});
beforeAll(setupHarness);
afterAll(teardownHarness);

it("starts, reads back and stops the caller's timer", async () => {
  const title = "Timer lifecycle task";
  const taskId = await seedTask({ assignees: [personaId("owner")], title });

  const empty = await readTimer();
  expect(empty.status).toBe(200);
  expect(empty.body.data).toEqual({ timer: null });

  const started = await startTimer({
    billable: true,
    note: "Reading the brief",
    taskId,
  });
  expect(started.status).toBe(200);
  expect(started.body.data.stopped).toBeNull();
  expect(started.body.data.timer).toMatchObject({
    billable: true,
    note: "Reading the brief",
    taskId,
    taskTitle: title,
  });
  expect(typeof started.body.data.timer.startedAt).toBe("string");
  expect(started.body.data.timer.taskReference).not.toBe("");
  expect(await ownerTimers()).toHaveLength(1);

  const running = await readTimer();
  expect(running.status).toBe(200);
  expect(running.body.data.timer).toEqual(started.body.data.timer);

  const stopped = await stopTimer();
  expect(stopped.status).toBe(200);
  expect(stopped.body.data).toMatchObject({
    billable: true,
    minutes: 1,
    note: "Reading the brief",
    taskId,
    taskTitle: title,
    userId: personaId("owner"),
  });
  expect(stopped.body.data.taskReference).not.toBe("");
  expect(stopped.body.data.workDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  expect(await entriesFor(taskId)).toHaveLength(1);
  expect(await ownerTimers()).toHaveLength(0);

  const cleared = await readTimer();
  expect(cleared.status).toBe(200);
  expect(cleared.body.data).toEqual({ timer: null });
});

it("keeps the running timer when the same task is started again", async () => {
  const taskId = await seedTask({ assignees: [personaId("owner")] });
  const first = await startTimer({ billable: true, taskId });

  const again = await startTimer({
    billable: false,
    note: "Changed my mind",
    taskId,
  });

  expect(again.status).toBe(200);
  expect(again.body.data.stopped).toBeNull();
  expect(again.body.data.timer).toEqual(first.body.data.timer);
  expect(await ownerTimers()).toHaveLength(1);
});

it("saves the previous task's time when the caller starts another task", async () => {
  const firstTaskId = await seedTask({ assignees: [personaId("owner")] });
  const secondTaskId = await seedTask({ assignees: [personaId("owner")] });
  await startTimer({
    billable: false,
    note: "First task",
    taskId: firstTaskId,
  });

  const switched = await startTimer({
    billable: true,
    note: "Second task",
    taskId: secondTaskId,
  });

  expect(switched.status).toBe(200);
  expect(switched.body.data.stopped).toMatchObject({
    billable: false,
    minutes: 1,
    note: "First task",
    taskId: firstTaskId,
  });
  expect(switched.body.data.timer).toMatchObject({
    billable: true,
    note: "Second task",
    taskId: secondTaskId,
  });
  const timers = await ownerTimers();
  expect(timers).toHaveLength(1);
  expect(timers[0].taskId).toBe(secondTaskId);
  expect(await entriesFor(firstTaskId)).toHaveLength(1);
  expect(await entriesFor(secondTaskId)).toHaveLength(0);
});

it("answers 404 when there is no timer to stop", async () => {
  const response = await stopTimer();

  expect(response.status).toBe(404);
  expect(response.body.error.code).toBe("NOT_FOUND");
});

it("refuses archived tasks and archived projects without writing", async () => {
  const archivedTaskId = await seedTask({
    archived: true,
    assignees: [personaId("owner")],
  });
  const archivedProjectTaskId = await seedTask({
    assignees: [personaId("owner")],
    projectId: ids.archivedProjectId,
  });

  const archivedTask = await startTimer({
    billable: true,
    taskId: archivedTaskId,
  });
  const archivedProject = await startTimer({
    billable: true,
    taskId: archivedProjectTaskId,
  });

  expect(archivedTask.status).toBe(403);
  expect(archivedProject.status).toBe(403);
  expect(await ownerTimers()).toHaveLength(0);
  expect(await entriesFor(archivedTaskId)).toHaveLength(0);
  expect(await entriesFor(archivedProjectTaskId)).toHaveLength(0);
});

it("keeps each caller's timer private and refuses clients and bad tokens", async () => {
  const taskId = await seedTask({ assignees: [personaId("owner")] });
  await startTimer({ billable: true, taskId });

  const coworkerTimer = await readTimer({ as: "outsider" });
  expect(coworkerTimer.status).toBe(200);
  expect(coworkerTimer.body.data).toEqual({ timer: null });
  const coworkerStop = await stopTimer({ as: "outsider" });
  expect(coworkerStop.status).toBe(404);

  const clientRead = await readTimer({ as: "client" });
  const clientStart = await startTimer(
    { billable: true, taskId },
    { as: "client" }
  );
  const clientStop = await stopTimer({ as: "client" });
  expect(clientRead.status).toBe(403);
  expect(clientStart.status).toBe(403);
  expect(clientStop.status).toBe(403);

  const anonymousRead = await send("GET", TIMER_PATH);
  const anonymousStop = await send("POST", `${TIMER_PATH}/stop`, {
    key: newKey(),
  });
  const forgedRead = await readTimer({ token: "not-a-real-token" });
  const forgedStart = await send("POST", `${TIMER_PATH}/start`, {
    body: { billable: true, taskId },
    key: newKey(),
    token: "not-a-real-token",
  });
  expect(anonymousRead.status).toBe(401);
  expect(anonymousStop.status).toBe(401);
  expect(forgedRead.status).toBe(401);
  expect(forgedStart.status).toBe(401);

  expect(await ownerTimers()).toHaveLength(1);
  expect(await entriesFor(taskId)).toHaveLength(0);
});

it("replays a start and a stop with the same key and writes once", async () => {
  const firstTaskId = await seedTask({ assignees: [personaId("owner")] });
  const secondTaskId = await seedTask({ assignees: [personaId("owner")] });
  const startKey = newKey();
  const startBody = { billable: true, note: "Retry me", taskId: firstTaskId };

  const started = await startTimer(startBody, { key: startKey });
  const startedAgain = await startTimer(startBody, { key: startKey });

  expect(started.status).toBe(200);
  expect(startedAgain.status).toBe(200);
  expect(startedAgain.body.data).toEqual(started.body.data);
  expect(await ownerTimers()).toHaveLength(1);

  const reused = await startTimer(
    { billable: true, note: "Another task", taskId: secondTaskId },
    { key: startKey }
  );
  expect(reused.status).toBe(409);
  expect(reused.body.error.code).toBe("CONFLICT");
  const timers = await ownerTimers();
  expect(timers).toHaveLength(1);
  expect(timers[0].taskId).toBe(firstTaskId);
  expect(await entriesFor(firstTaskId)).toHaveLength(0);

  const stopKey = newKey();
  const stopped = await stopTimer({ key: stopKey });
  const stoppedAgain = await stopTimer({ key: stopKey });
  expect(stopped.status).toBe(200);
  expect(stoppedAgain.status).toBe(200);
  expect(stoppedAgain.body.data).toEqual(stopped.body.data);
  expect(await entriesFor(firstTaskId)).toHaveLength(1);
  expect(await ownerTimers()).toHaveLength(0);
});

it("refuses a note over 500 characters and writes nothing", async () => {
  const taskId = await seedTask({ assignees: [personaId("owner")] });

  const response = await startTimer({
    billable: true,
    note: "x".repeat(501),
    taskId,
  });

  expect(response.status).toBe(422);
  expect(response.body.error.code).toBe("VALIDATION_FAILED");
  expect(await ownerTimers()).toHaveLength(0);
  expect(await entriesFor(taskId)).toHaveLength(0);
});

// Time already worked is not lost because someone archived the task while the
// timer ran: starting on archived work is refused, but stopping is not.
it("still saves the time when the task was archived while the timer ran", async () => {
  const taskId = await seedTask({ assignees: [personaId("owner")] });
  const started = await startTimer({ billable: true, taskId });
  expect(started.status).toBe(200);
  await authPool.query(
    'UPDATE task SET "archivedAt" = now(), "archivedById" = $2 WHERE id = $1',
    [taskId, personaId("admin")]
  );

  const stopped = await stopTimer();

  expect(stopped.status).toBe(200);
  expect(stopped.body.data).toMatchObject({ taskId });
  expect(await entriesFor(taskId)).toHaveLength(1);
  expect(await ownerTimers()).toHaveLength(0);
});
