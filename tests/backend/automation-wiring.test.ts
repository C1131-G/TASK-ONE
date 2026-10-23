import { afterAll, afterEach, beforeAll, expect, it } from "bun:test";

import { Effect, Layer } from "effect";

import { db } from "../../src/prisma/db";
import { authPool } from "../../src/server/auth/database";
import { JobHandlersLive } from "../../src/server/jobs/job-handlers-live";
import {
  JobProcessor,
  JobProcessorLive,
} from "../../src/server/jobs/processor";
import { PushTransport } from "../../src/server/notifications/push-transport";
import { Storage } from "../../src/server/storage/storage";
import {
  createBugReport,
  BugManagement,
  BugManagementLive,
} from "../../src/server/work/bug-management";
import {
  BugWorkflowManagement,
  BugWorkflowManagementLive,
} from "../../src/server/work/bug-workflow-management";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";
import {
  createAutomationWorld,
  destroyAutomationWorld,
  insertRule,
} from "./support/automation-fixtures";
import type { AutomationWorld } from "./support/automation-fixtures";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const processorLayer = Layer.provide(
  JobProcessorLive,
  Layer.provide(
    JobHandlersLive,
    Layer.merge(
      Layer.succeed(
        Storage,
        Storage.of({
          copyObject: () => Effect.void,
          deleteObject: () => Effect.void,
          signDownload: () => Effect.succeed("https://private.example/d"),
          signPreview: () => Effect.succeed("https://private.example/p"),
          signUpload: () => Effect.succeed("https://private.example/u"),
          verifyObject: () => Effect.void,
        })
      ),
      Layer.succeed(
        PushTransport,
        PushTransport.of({ send: () => Effect.succeed("delivered") })
      )
    )
  )
);

let world: AutomationWorld;
beforeAll(async () => {
  world = await createAutomationWorld("automation-wiring.example");
});
afterEach(async () => {
  await authPool.query('DELETE FROM automation_rule WHERE "projectId" = $1', [
    world.projectId,
  ]);
});
afterAll(async () => {
  await authPool.query(
    'DELETE FROM undo_record WHERE "actorId" IN (SELECT id FROM "user" WHERE email LIKE $1)',
    [`%@${world.domain}`]
  );
  await authPool.query(
    'DELETE FROM bug_sla WHERE "bugId" IN (SELECT id FROM bug_report WHERE "projectId" = $1)',
    [world.projectId]
  );
  await authPool.query('DELETE FROM bug_report WHERE "projectId" = $1', [
    world.projectId,
  ]);
  await destroyAutomationWorld(world);
});

const run = <Value, Failure>(
  program: Effect.Effect<
    Value,
    Failure,
    WorkManagement | BugManagement | BugWorkflowManagement
  >
) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(WorkManagementLive),
      Effect.provide(BugManagementLive),
      Effect.provide(BugWorkflowManagementLive)
    )
  );

const drain = async () => {
  for (let round = 0; round < 10; round += 1) {
    // eslint-disable-next-line no-await-in-loop
    const batch = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* processBatch() {
          const processor = yield* JobProcessor;
          return yield* processor.processBatch("automation-wiring", 50);
        }),
        processorLayer
      )
    );
    if (batch.claimed === 0) {
      return;
    }
  }
};

const runsFor = async (ruleId: string) => {
  const rows = await authPool.query<{ outcome: string; trigger: string }>(
    'SELECT outcome, trigger FROM automation_run WHERE "ruleId" = $1',
    [ruleId]
  );
  return rows.rows;
};

const base = {
  assigneeIds: [] as string[],
  description: null,
  dueDate: null,
};

it("fires task_created for a new task, after the write commits", async () => {
  const ruleId = await insertRule(world, {
    actions: [{ priority: "urgent", type: "set_priority" }],
    trigger: "task_created",
  });
  const created = await run(
    Effect.gen(function* create() {
      const work = yield* WorkManagement;
      return yield* work.createTask(world.adminId, {
        ...base,
        priority: "low",
        projectId: world.projectId,
        title: "Wired creation",
      });
    })
  );
  // Nothing has run yet: the rule runs from the queue, not the write.
  expect(await runsFor(ruleId)).toHaveLength(0);
  await drain();
  expect(await runsFor(ruleId)).toEqual([
    { outcome: "matched", trigger: "task_created" },
  ]);
  const task = await authPool.query<{ priority: string }>(
    "SELECT priority FROM task WHERE id = $1",
    [created.id]
  );
  expect(task.rows[0]?.priority).toBe("urgent");
});

it("fires status, priority and assignee triggers from an edit", async () => {
  const task = await run(
    Effect.gen(function* create() {
      const work = yield* WorkManagement;
      return yield* work.createTask(world.adminId, {
        ...base,
        priority: "low",
        projectId: world.projectId,
        title: "Wired edit",
      });
    })
  );
  const status = await insertRule(world, {
    actions: [{ body: "status", type: "post_comment" }],
    trigger: "status_changed",
  });
  const priority = await insertRule(world, {
    actions: [{ body: "priority", type: "post_comment" }],
    trigger: "priority_changed",
  });
  const assignee = await insertRule(world, {
    actions: [{ body: "assignee", type: "post_comment" }],
    trigger: "assignee_changed",
  });
  const untouched = await insertRule(world, {
    actions: [{ body: "never", type: "post_comment" }],
    trigger: "task_overdue",
  });
  await run(
    Effect.gen(function* update() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(world.adminId, task.id, task.version, {
        assigneeIds: [world.staffId],
        description: null,
        dueDate: null,
        priority: "high",
        status: "progress",
        title: "Wired edit",
      });
    })
  );
  await drain();
  for (const ruleId of [status, priority, assignee]) {
    // eslint-disable-next-line no-await-in-loop
    expect(await runsFor(ruleId)).toHaveLength(1);
  }
  expect(await runsFor(untouched)).toHaveLength(0);
});

it("does not fire for an edit that changes none of the watched fields", async () => {
  const task = await run(
    Effect.gen(function* create() {
      const work = yield* WorkManagement;
      return yield* work.createTask(world.adminId, {
        ...base,
        priority: "low",
        projectId: world.projectId,
        title: "Quiet edit",
      });
    })
  );
  const ruleId = await insertRule(world, {
    actions: [{ body: "no", type: "post_comment" }],
    trigger: "status_changed",
  });
  await run(
    Effect.gen(function* update() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(world.adminId, task.id, task.version, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "low",
        status: "todo",
        title: "Renamed only",
      });
    })
  );
  await drain();
  expect(await runsFor(ruleId)).toHaveLength(0);
});

it("fires from a bulk edit", async () => {
  const task = await run(
    Effect.gen(function* create() {
      const work = yield* WorkManagement;
      return yield* work.createTask(world.adminId, {
        ...base,
        priority: "low",
        projectId: world.projectId,
        title: "Bulk edit",
      });
    })
  );
  const ruleId = await insertRule(world, {
    actions: [{ body: "bulk", type: "post_comment" }],
    trigger: "priority_changed",
  });
  await run(
    Effect.gen(function* bulk() {
      const work = yield* WorkManagement;
      return yield* work.bulkUpdateTasks(
        world.adminId,
        [{ expectedVersion: task.version, taskId: task.id }],
        { assigneeIds: [], dueDate: null, priority: "urgent", status: "todo" }
      );
    })
  );
  await drain();
  expect(await runsFor(ruleId)).toEqual([
    { outcome: "matched", trigger: "priority_changed" },
  ]);
});

it("fires bug_status_changed but not bug_reported for an internal bug, leaving bug status to the workflow", async () => {
  const reported = await insertRule(world, {
    actions: [
      { status: "done", type: "set_status" },
      { priority: "high", type: "set_priority" },
    ],
    trigger: "bug_reported",
  });
  const changed = await insertRule(world, {
    actions: [{ body: "bug moved", type: "post_comment" }],
    trigger: "bug_status_changed",
  });
  const bug = await run(
    Effect.gen(function* reportAndTriage() {
      const bugs = yield* BugManagement;
      const workflow = yield* BugWorkflowManagement;
      const created = yield* bugs.reportBug(world.adminId, {
        actualBehavior: "Blank panel.",
        appVersion: "1.0.0",
        browser: "Firefox",
        component: "Panel",
        description: null,
        device: "Desktop",
        discoverySource: "employee_report",
        environment: "staging",
        expectedBehavior: "Totals show.",
        os: "Windows",
        projectId: world.projectId,
        reproductionSteps: ["Open it"],
        route: "/overview",
        severity: "minor",
        title: "Wired bug",
      });
      yield* workflow.triage(world.adminId, {
        assigneeIds: [],
        bugId: created.id,
        expectedVersion: created.version,
        priority: "high",
        severity: "critical",
      });
      return created;
    })
  );
  await drain();
  expect(await runsFor(reported)).toEqual([]);
  expect(await runsFor(changed)).toEqual([
    { outcome: "matched", trigger: "bug_status_changed" },
  ]);
  const comment = await authPool.query<{ visibility: string }>(
    'SELECT c.visibility FROM comment c JOIN bug_report b ON b."taskId" = c."taskId" WHERE b.id = $1',
    [bug.id]
  );
  expect(comment.rows.map((row) => row.visibility)).toEqual(["internal"]);
});

const clientBugInput = {
  actualBehavior: "Blank panel.",
  appVersion: null,
  browser: null,
  component: "Client report",
  description: null,
  device: null,
  discoverySource: "customer_report",
  environment: "production",
  expectedBehavior: "Totals show.",
  os: null,
  reproductionSteps: ["Open it"],
  route: "/overview",
  severity: "minor",
} as const;

it("fires bug_reported for a client-reported bug", async () => {
  const reported = await insertRule(world, {
    actions: [{ priority: "high", type: "set_priority" }],
    trigger: "bug_reported",
  });
  const bug = await db.transaction((transaction) =>
    createBugReport(
      transaction,
      world.clientId,
      { ...clientBugInput, projectId: world.projectId, title: "Client bug" },
      { clientCompanyId: world.companyId, clientImpact: "medium" }
    )
  );
  await drain();
  expect(await runsFor(reported)).toEqual([
    { outcome: "matched", trigger: "bug_reported" },
  ]);
  const task = await authPool.query<{ priority: string }>(
    "SELECT priority FROM task WHERE id = $1",
    [bug.taskId]
  );
  expect(task.rows[0]?.priority).toBe("high");
});

it("fires due_date_changed when a task is only rescheduled", async () => {
  const task = await run(
    Effect.gen(function* create() {
      const work = yield* WorkManagement;
      return yield* work.createTask(world.adminId, {
        ...base,
        dueDate: "2027-01-10",
        priority: "low",
        projectId: world.projectId,
        title: "Reschedule me",
      });
    })
  );
  const ruleId = await insertRule(world, {
    actions: [{ body: "moved", type: "post_comment" }],
    trigger: "due_date_changed",
  });
  await run(
    Effect.gen(function* reschedule() {
      const work = yield* WorkManagement;
      return yield* work.rescheduleTask(world.adminId, task.id, task.version, {
        dueDate: "2027-01-20",
        startDate: null,
      });
    })
  );
  await drain();
  expect(await runsFor(ruleId)).toEqual([
    { outcome: "matched", trigger: "due_date_changed" },
  ]);
});
