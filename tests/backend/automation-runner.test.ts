import { afterAll, afterEach, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { db } from "../../src/prisma/db";
import { authPool } from "../../src/server/auth/database";
import { enqueueAutomationEvent } from "../../src/server/automation/automation-enqueue";
import { RATE_LIMIT_MAX_RUNS } from "../../src/server/automation/automation-evaluator";
import type { AutomationTrigger } from "../../src/server/automation/automation-model";
import { runAutomationEvent } from "../../src/server/automation/automation-runner";
import { JobHandlersLive } from "../../src/server/jobs/job-handlers-live";
import {
  JobProcessor,
  JobProcessorLive,
} from "../../src/server/jobs/processor";
import { PushTransport } from "../../src/server/notifications/push-transport";
import { Storage } from "../../src/server/storage/storage";
import {
  createAutomationWorld,
  createTaskRow,
  destroyAutomationWorld,
  insertRule,
} from "./support/automation-fixtures";
import type { AutomationWorld } from "./support/automation-fixtures";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const storageLayer = Layer.succeed(
  Storage,
  Storage.of({
    copyObject: () => Effect.void,
    deleteObject: () => Effect.void,
    signDownload: () => Effect.succeed("https://private.example/download"),
    signPreview: () => Effect.succeed("https://private.example/preview"),
    signUpload: () => Effect.succeed("https://private.example/upload"),
    verifyObject: () => Effect.void,
  })
);
const pushLayer = Layer.succeed(
  PushTransport,
  PushTransport.of({ send: () => Effect.succeed("delivered") })
);
const processorLayer = Layer.provide(
  JobProcessorLive,
  Layer.provide(JobHandlersLive, Layer.merge(storageLayer, pushLayer))
);

let world: AutomationWorld;

beforeAll(async () => {
  world = await createAutomationWorld("automation-runner.example");
});
afterEach(async () => {
  await authPool.query(
    'DELETE FROM automation_rule WHERE "projectId" = ANY($1::uuid[])',
    [[world.projectId, world.otherProjectId]]
  );
  await authPool.query("DELETE FROM job WHERE kind = 'automation.run-event'");
});
afterAll(async () => {
  await destroyAutomationWorld(world);
});

const drain = async (): Promise<void> => {
  for (let round = 0; round < 12; round += 1) {
    // eslint-disable-next-line no-await-in-loop
    const batch = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* processBatch() {
          const processor = yield* JobProcessor;
          return yield* processor.processBatch("automation-test", 50);
        }),
        processorLayer
      )
    );
    if (batch.claimed === 0) {
      return;
    }
  }
};

const raise = (
  taskId: string,
  trigger: AutomationTrigger,
  extra: { depth?: number; causedByRuleId?: string; eventId?: string } = {}
) =>
  db.transaction((transaction) =>
    enqueueAutomationEvent(transaction, {
      now: new Date(),
      projectId: world.projectId,
      taskId,
      trigger,
      ...extra,
    })
  );

interface RunRow {
  readonly ruleId: string;
  readonly outcome: string;
  readonly reason: string | null;
  readonly depth: number;
  readonly trigger: string;
}
const runsOf = async (taskId: string): Promise<RunRow[]> => {
  const rows = await authPool.query<RunRow>(
    'SELECT "ruleId", outcome, reason, depth, trigger FROM automation_run WHERE "taskId" = $1 ORDER BY "createdAt", id',
    [taskId]
  );
  return rows.rows;
};
const columnOf = async (
  taskId: string,
  column: "priority" | "status" | "version"
): Promise<string | number | undefined> => {
  const rows = await authPool.query<Record<string, string | number>>(
    `SELECT ${column} AS value FROM task WHERE id = $1`,
    [taskId]
  );
  return rows.rows[0]?.["value"];
};

it("queues an event only when the project has an enabled rule for it", async () => {
  const taskId = await createTaskRow(world);
  await raise(taskId, "task_created");
  const none = await authPool.query(
    "SELECT id FROM job WHERE kind = 'automation.run-event' AND payload->>'taskId' = $1",
    [taskId]
  );
  expect(none.rows).toHaveLength(0);

  await insertRule(world, {
    actions: [{ priority: "low", type: "set_priority" }],
    enabled: false,
    trigger: "task_created",
  });
  await raise(taskId, "task_created");
  const stillNone = await authPool.query(
    "SELECT id FROM job WHERE kind = 'automation.run-event' AND payload->>'taskId' = $1",
    [taskId]
  );
  expect(stillNone.rows).toHaveLength(0);

  await insertRule(world, {
    actions: [{ priority: "low", type: "set_priority" }],
    trigger: "task_created",
  });
  await raise(taskId, "task_created");
  const queued = await authPool.query(
    "SELECT id FROM job WHERE kind = 'automation.run-event' AND payload->>'taskId' = $1",
    [taskId]
  );
  expect(queued.rows).toHaveLength(1);
  await authPool.query("DELETE FROM job WHERE kind = 'automation.run-event'");
  await authPool.query('DELETE FROM automation_rule WHERE "projectId" = $1', [
    world.projectId,
  ]);
});

it("rolls the queued event back with the originating transaction", async () => {
  await insertRule(world, {
    actions: [{ priority: "low", type: "set_priority" }],
    trigger: "task_created",
  });
  const taskId = await createTaskRow(world);
  await expect(
    db.transaction(async (transaction) => {
      await enqueueAutomationEvent(transaction, {
        now: new Date(),
        projectId: world.projectId,
        taskId,
        trigger: "task_created",
      });
      throw new Error("originating write failed");
    })
  ).rejects.toThrow("originating write failed");
  const queued = await authPool.query(
    "SELECT id FROM job WHERE kind = 'automation.run-event' AND payload->>'taskId' = $1",
    [taskId]
  );
  expect(queued.rows).toHaveLength(0);
  await authPool.query('DELETE FROM automation_rule WHERE "projectId" = $1', [
    world.projectId,
  ]);
});

it("runs every action of a matching rule as an automation actor", async () => {
  const taskId = await createTaskRow(world, { priority: "high" });
  const ruleId = await insertRule(world, {
    actions: [
      { priority: "urgent", type: "set_priority" },
      { type: "assign", userId: world.staffId },
      { labelId: world.labelId, type: "add_label" },
      { body: "Escalated automatically", type: "post_comment" },
      { message: "Please look", type: "notify", userId: world.otherStaffId },
    ],
    conditions: [{ field: "priority", op: "in", values: ["high"] }],
    name: "Escalate",
    trigger: "task_created",
  });
  await raise(taskId, "task_created");
  await drain();

  expect(await columnOf(taskId, "priority")).toBe("urgent");
  expect(await columnOf(taskId, "version")).toBe(2);
  const assignees = await authPool.query(
    'SELECT "userId" FROM task_assignee WHERE "taskId" = $1',
    [taskId]
  );
  expect(assignees.rows).toEqual([{ userId: world.staffId }]);
  const labels = await authPool.query(
    'SELECT "labelId" FROM task_label WHERE "taskId" = $1',
    [taskId]
  );
  expect(labels.rows).toEqual([{ labelId: world.labelId }]);

  const comments = await authPool.query<{
    body: string;
    visibility: string;
    authorId: string;
  }>('SELECT body, visibility, "authorId" FROM comment WHERE "taskId" = $1', [
    taskId,
  ]);
  expect(comments.rows).toHaveLength(1);
  expect(comments.rows[0]?.visibility).toBe("internal");
  expect(comments.rows[0]?.body).toContain("Escalated automatically");
  expect(comments.rows[0]?.body).toContain("Escalate");

  const notified = await authPool.query<{ userId: string }>(
    'SELECT "userId" FROM notification WHERE "taskId" = $1 AND text LIKE $2',
    [taskId, "Automation%"]
  );
  expect(notified.rows.map(({ userId }) => userId)).toContain(
    world.otherStaffId
  );

  const activity = await authPool.query<{
    action: string;
    details: Record<string, unknown>;
  }>(
    "SELECT action, details FROM activity WHERE \"taskId\" = $1 AND action LIKE 'automation.%'",
    [taskId]
  );
  expect(activity.rows.length).toBeGreaterThan(0);
  for (const row of activity.rows) {
    expect(row.details["automation"]).toBe(true);
    expect(row.details["ruleId"]).toBe(ruleId);
    expect(row.details["depth"]).toBe(1);
  }
  expect(await runsOf(taskId)).toEqual([
    {
      depth: 0,
      outcome: "matched",
      reason: null,
      ruleId,
      trigger: "task_created",
    },
  ]);
});

it("logs a skipped run with the reason when conditions do not hold", async () => {
  const taskId = await createTaskRow(world, { priority: "low" });
  const ruleId = await insertRule(world, {
    actions: [{ priority: "urgent", type: "set_priority" }],
    conditions: [{ field: "priority", op: "in", values: ["high"] }],
    trigger: "status_changed",
  });
  await raise(taskId, "status_changed");
  await drain();
  expect(await columnOf(taskId, "priority")).toBe("low");
  expect(await runsOf(taskId)).toEqual([
    {
      depth: 0,
      outcome: "skipped",
      reason: "conditions_not_met",
      ruleId,
      trigger: "status_changed",
    },
  ]);
});

it("is idempotent per rule and event", async () => {
  const taskId = await createTaskRow(world);
  await insertRule(world, {
    actions: [{ body: "Only once", type: "post_comment" }],
    trigger: "task_created",
  });
  const eventId = randomUUID();
  const payload = {
    causedByRuleId: null,
    depth: 0,
    eventId,
    projectId: world.projectId,
    taskId,
    trigger: "task_created",
  } as const;
  await runAutomationEvent(payload);
  await runAutomationEvent(payload);
  await Promise.all([runAutomationEvent(payload), runAutomationEvent(payload)]);
  const comments = await authPool.query(
    'SELECT id FROM comment WHERE "taskId" = $1',
    [taskId]
  );
  expect(comments.rows).toHaveLength(1);
  const runs = await runsOf(taskId);
  expect(runs.filter((run) => run.outcome === "matched")).toHaveLength(1);
});

it("never re-triggers a rule from its own change", async () => {
  const taskId = await createTaskRow(world, { status: "todo" });
  const ruleId = await insertRule(world, {
    actions: [{ status: "review", type: "set_status" }],
    trigger: "status_changed",
  });
  await raise(taskId, "status_changed");
  await drain();
  expect(await columnOf(taskId, "status")).toBe("review");
  const runs = await runsOf(taskId);
  expect(
    runs.map(({ outcome, reason, depth }) => [outcome, reason, depth])
  ).toEqual([
    ["matched", null, 0],
    ["skipped", "loop_protection_self", 1],
  ]);
  expect(runs.every((run) => run.ruleId === ruleId)).toBe(true);
});

it("stops a two-rule ping-pong beyond depth one", async () => {
  const taskId = await createTaskRow(world, {
    priority: "none",
    status: "todo",
  });
  const toUrgent = await insertRule(world, {
    actions: [{ priority: "urgent", type: "set_priority" }],
    trigger: "status_changed",
  });
  const toReview = await insertRule(world, {
    actions: [{ status: "progress", type: "set_status" }],
    trigger: "priority_changed",
  });
  await raise(taskId, "status_changed");
  await drain();
  const runs = await runsOf(taskId);
  const ruleNames = new Map([
    [toUrgent, "toUrgent"],
    [toReview, "toReview"],
  ]);
  const summary = runs
    .map(({ ruleId, outcome, reason, depth }) => [
      ruleNames.get(ruleId) ?? "?",
      outcome,
      reason,
      depth,
    ])
    .toSorted((left, right) => Number(left[3]) - Number(right[3]));
  expect(summary).toEqual([
    ["toUrgent", "matched", null, 0],
    ["toReview", "matched", null, 1],
    // The status the second rule set would trigger the first again, but only
    // one automation hop is ever followed.
    ["toUrgent", "skipped", "loop_protection_depth", 2],
  ]);
  const jobs = await authPool.query(
    "SELECT id FROM job WHERE kind = 'automation.run-event' AND \"completedAt\" IS NULL AND payload->>'taskId' = $1",
    [taskId]
  );
  expect(jobs.rows).toHaveLength(0);
});

it("limits how often one rule runs on one task", async () => {
  const taskId = await createTaskRow(world);
  const ruleId = await insertRule(world, {
    actions: [{ body: "Chatty", type: "post_comment" }],
    trigger: "task_created",
  });
  for (let count = 0; count < RATE_LIMIT_MAX_RUNS; count += 1) {
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(
      'INSERT INTO automation_run (id, "ruleId", "projectId", "taskId", "eventId", trigger, outcome) VALUES ($1, $2, $3, $4, $5, \'task_created\', \'matched\')',
      [randomUUID(), ruleId, world.projectId, taskId, randomUUID()]
    );
  }
  await runAutomationEvent({
    causedByRuleId: null,
    depth: 0,
    eventId: randomUUID(),
    projectId: world.projectId,
    taskId,
    trigger: "task_created",
  });
  const comments = await authPool.query(
    'SELECT id FROM comment WHERE "taskId" = $1',
    [taskId]
  );
  expect(comments.rows).toHaveLength(0);
  const runs = await runsOf(taskId);
  expect(runs.filter((run) => run.outcome === "skipped")).toMatchObject([
    { reason: "rate_limited" },
  ]);
});

it("keeps bug tasks on the bug workflow", async () => {
  const taskId = await createTaskRow(world, { type: "bug" });
  await insertRule(world, {
    actions: [{ status: "done", type: "set_status" }],
    trigger: "bug_reported",
  });
  await raise(taskId, "bug_reported");
  await drain();
  expect(await columnOf(taskId, "status")).toBe("todo");
  const [firstRun] = await runsOf(taskId);
  expect(firstRun).toMatchObject({
    outcome: "skipped",
    reason: "action_blocked:set_status",
  });
});

it("records a failure without leaving partial changes or failing the job", async () => {
  const taskId = await createTaskRow(world);
  const ruleId = await insertRule(world, {
    actions: [
      { body: "Should be rolled back", type: "post_comment" },
      { type: "assign", userId: world.clientId },
    ],
    trigger: "task_created",
  });
  await raise(taskId, "task_created");
  await drain();
  const comments = await authPool.query(
    'SELECT id FROM comment WHERE "taskId" = $1',
    [taskId]
  );
  expect(comments.rows).toHaveLength(0);
  const runs = await runsOf(taskId);
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({ outcome: "failed", ruleId });
  expect(runs[0]?.reason).toContain("assign");
  const job = await authPool.query<{
    deadAt: Date | null;
    completedAt: Date | null;
  }>(
    "SELECT \"deadAt\", \"completedAt\" FROM job WHERE kind = 'automation.run-event' AND payload->>'taskId' = $1",
    [taskId]
  );
  expect(job.rows[0]?.completedAt).not.toBeNull();
  expect(job.rows[0]?.deadAt).toBeNull();
});

it("refuses people who cannot be assigned or notified", async () => {
  for (const action of [
    { type: "assign", userId: world.deactivatedId },
    { type: "assign", userId: world.clientId },
    { message: "Hi", type: "notify", userId: world.clientId },
    { message: "Hi", type: "notify", userId: world.deactivatedId },
    { type: "assign", userId: randomUUID() },
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const taskId = await createTaskRow(world);
    // eslint-disable-next-line no-await-in-loop
    await insertRule(world, { actions: [action], trigger: "task_created" });
    // eslint-disable-next-line no-await-in-loop
    await runAutomationEvent({
      causedByRuleId: null,
      depth: 0,
      eventId: randomUUID(),
      projectId: world.projectId,
      taskId,
      trigger: "task_created",
    });
    // eslint-disable-next-line no-await-in-loop
    const runs = await runsOf(taskId);
    expect(runs.map((run) => run.outcome)).toEqual(["failed"]);
    // eslint-disable-next-line no-await-in-loop
    const notifications = await authPool.query(
      'SELECT id FROM notification WHERE "taskId" = $1',
      [taskId]
    );
    expect(notifications.rows).toHaveLength(0);
    // eslint-disable-next-line no-await-in-loop
    await authPool.query('DELETE FROM automation_rule WHERE "projectId" = $1', [
      world.projectId,
    ]);
  }
});

it("only runs rules from the task's own project and skips archived tasks", async () => {
  const taskId = await createTaskRow(world);
  await insertRule(world, {
    actions: [{ body: "Other project", type: "post_comment" }],
    projectId: world.otherProjectId,
    trigger: "task_created",
  });
  await runAutomationEvent({
    causedByRuleId: null,
    depth: 0,
    eventId: randomUUID(),
    projectId: world.projectId,
    taskId,
    trigger: "task_created",
  });
  expect(await runsOf(taskId)).toHaveLength(0);

  await insertRule(world, {
    actions: [{ body: "Archived", type: "post_comment" }],
    trigger: "task_created",
  });
  await authPool.query(
    'UPDATE task SET "archivedAt" = now(), "archivedById" = $2 WHERE id = $1',
    [taskId, world.adminId]
  );
  await runAutomationEvent({
    causedByRuleId: null,
    depth: 0,
    eventId: randomUUID(),
    projectId: world.projectId,
    taskId,
    trigger: "task_created",
  });
  expect(await runsOf(taskId)).toMatchObject([
    { outcome: "skipped", reason: "task_archived" },
  ]);
});
