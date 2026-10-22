import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { parseRetentionEnv } from "../../src/server/core/env";
import {
  DEFAULT_RETENTION_POLICY,
  purgeExpiredData,
  retentionPolicyFromEnv,
} from "../../src/server/jobs/data-retention";
import {
  createAutomationWorld,
  createTaskRow,
  destroyAutomationWorld,
  insertRule,
} from "./support/automation-fixtures";
import type { AutomationWorld } from "./support/automation-fixtures";

const DAY_MS = 86_400_000;
const now = new Date();
const daysAgo = (days: number): Date => new Date(now.getTime() - days * DAY_MS);

let world: AutomationWorld;
let ruleId = "";
let taskId = "";
const runs = { fresh: randomUUID(), old: randomUUID(), older: randomUUID() };

const insertRun = (id: string, createdAt: Date) =>
  authPool.query(
    'INSERT INTO automation_run (id, "ruleId", "projectId", "taskId", "eventId", trigger, outcome, "createdAt") VALUES ($1, $2, $3, $4, $5, \'task_created\', \'matched\', $6)',
    [id, ruleId, world.projectId, taskId, randomUUID(), createdAt]
  );

beforeAll(async () => {
  world = await createAutomationWorld("automation-retention.example");
  ruleId = await insertRule(world, {
    actions: [{ body: "x", type: "post_comment" }],
    trigger: "task_created",
  });
  taskId = await createTaskRow(world);
  await insertRun(runs.old, daysAgo(31));
  await insertRun(runs.older, daysAgo(120));
  await insertRun(runs.fresh, daysAgo(29));
});

afterAll(async () => {
  await authPool.query('DELETE FROM automation_rule WHERE "projectId" = $1', [
    world.projectId,
  ]);
  await destroyAutomationWorld(world);
});

it("keeps run logs for 30 days by default and accepts an override", () => {
  expect(DEFAULT_RETENTION_POLICY.automationRunDays).toBe(30);
  expect(
    retentionPolicyFromEnv({ RETENTION_AUTOMATION_RUN_DAYS: "7" })
      .automationRunDays
  ).toBe(7);
  expect(() =>
    parseRetentionEnv({ RETENTION_AUTOMATION_RUN_DAYS: "0" })
  ).toThrow();
});

it("purges run log rows past the window and keeps the rest", async () => {
  const report = await Effect.runPromise(
    purgeExpiredData({ batchSize: 1, now })
  );
  expect(report.automationRuns).toBeGreaterThanOrEqual(2);
  const remaining = await authPool.query<{ id: string }>(
    'SELECT id FROM automation_run WHERE "ruleId" = $1',
    [ruleId]
  );
  expect(remaining.rows.map(({ id }) => id)).toEqual([runs.fresh]);
});
