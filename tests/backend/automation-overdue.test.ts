import { afterAll, afterEach, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer, Schema } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  OVERDUE_LOOKBACK_DAYS,
  overdueEventId,
  sweepOverdueTasks,
} from "../../src/server/automation/automation-overdue";
import { JobHandlers } from "../../src/server/jobs/job-handlers";
import {
  JobProcessor,
  JobProcessorLive,
} from "../../src/server/jobs/processor";
import {
  createAutomationWorld,
  createTaskRow,
  destroyAutomationWorld,
  insertRule,
} from "./support/automation-fixtures";
import type { AutomationWorld } from "./support/automation-fixtures";

let world: AutomationWorld;
beforeAll(async () => {
  world = await createAutomationWorld("automation-overdue.example");
});
afterEach(async () => {
  await authPool.query('DELETE FROM automation_rule WHERE "projectId" = $1', [
    world.projectId,
  ]);
  await authPool.query("DELETE FROM job WHERE kind = 'automation.run-event'");
});
afterAll(async () => {
  await destroyAutomationWorld(world);
});

const TODAY = "2026-10-22";
const NOW = new Date("2026-10-22T09:00:00.000Z");

const queuedTaskIds = async (): Promise<string[]> => {
  const rows = await authPool.query<{ taskId: string }>(
    "SELECT payload->>'taskId' AS \"taskId\" FROM job WHERE kind = 'automation.run-event' AND payload->>'trigger' = 'task_overdue'"
  );
  return rows.rows.map(({ taskId }) => taskId).toSorted();
};

it("derives a stable event id per task and due date", () => {
  const taskId = randomUUID();
  expect(overdueEventId(taskId, "2026-10-01")).toBe(
    overdueEventId(taskId, "2026-10-01")
  );
  expect(overdueEventId(taskId, "2026-10-01")).not.toBe(
    overdueEventId(taskId, "2026-10-02")
  );
  expect(() =>
    Schema.decodeUnknownSync(Schema.String.check(Schema.isUUID()))(
      overdueEventId(taskId, "2026-10-01")
    )
  ).not.toThrow();
});

it("queues each newly overdue open task once, however often it sweeps", async () => {
  await insertRule(world, {
    actions: [{ body: "Overdue", type: "post_comment" }],
    trigger: "task_overdue",
  });
  const overdue = await createTaskRow(world, { dueDate: "2026-10-20" });
  await createTaskRow(world, { dueDate: "2026-10-22" });
  await createTaskRow(world, { dueDate: "2026-10-30" });
  await createTaskRow(world, { dueDate: "2026-10-20", status: "done" });
  await createTaskRow(world, { dueDate: null });
  await createTaskRow(world, { dueDate: "2026-09-01" });
  const archived = await createTaskRow(world, { dueDate: "2026-10-19" });
  await authPool.query(
    'UPDATE task SET "archivedAt" = now(), "archivedById" = $2 WHERE id = $1',
    [archived, world.adminId]
  );
  const otherProject = await createTaskRow(world, {
    dueDate: "2026-10-20",
    projectId: world.otherProjectId,
  });

  expect(OVERDUE_LOOKBACK_DAYS).toBeGreaterThan(0);
  expect(await sweepOverdueTasks(TODAY, NOW)).toBe(1);
  expect(await queuedTaskIds()).toEqual([overdue]);
  expect(await queuedTaskIds()).not.toContain(otherProject);

  expect(await sweepOverdueTasks(TODAY, NOW)).toBe(0);
  expect(await queuedTaskIds()).toEqual([overdue]);
});

it("queues nothing for projects without an enabled overdue rule", async () => {
  await createTaskRow(world, { dueDate: "2026-10-20" });
  await insertRule(world, {
    actions: [{ body: "Overdue", type: "post_comment" }],
    enabled: false,
    trigger: "task_overdue",
  });
  expect(await sweepOverdueTasks(TODAY, NOW)).toBe(0);
});

it("is scheduled hourly by the maintenance job", async () => {
  const scheduledAt = new Date("2099-04-01T09:00:00.000Z");
  const handlerLayer = Layer.succeed(
    JobHandlers,
    JobHandlers.of({ handle: () => Effect.void })
  );
  const enqueue = (at: Date) =>
    Effect.runPromise(
      Effect.provide(
        Effect.gen(function* schedule() {
          const processor = yield* JobProcessor;
          return yield* processor.enqueueMaintenance(at);
        }),
        Layer.provide(JobProcessorLive, handlerLayer)
      )
    );
  try {
    await enqueue(scheduledAt);
    await enqueue(scheduledAt);
    const jobs = await authPool.query<{ payload: { scheduledAt: string } }>(
      "SELECT payload FROM job WHERE kind = 'automation.overdue-sweep' AND \"dedupeKey\" LIKE '%2099-04-01%'"
    );
    expect(jobs.rows).toHaveLength(1);
    expect(jobs.rows[0]?.payload.scheduledAt).toBe(scheduledAt.toISOString());
  } finally {
    // Maintenance also queues the SLA sweep, keyed by interval, not date.
    await authPool.query(
      'DELETE FROM job WHERE "dedupeKey" LIKE $1 OR ("dedupeKey" LIKE \'bug.sla_sweep:%\' AND "availableAt" = $2)',
      ["%2099-04-01%", scheduledAt]
    );
  }
});
