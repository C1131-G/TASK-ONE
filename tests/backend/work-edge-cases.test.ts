import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";
import type { TaskRecurrenceInput } from "../../src/server/work/work-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

interface Fixture {
  readonly actorId: string;
  readonly projectIds: readonly string[];
}

const seedFixture = async (projectCount: number): Promise<Fixture> => {
  const actorId = randomUUID();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 5).toUpperCase();
  const projectIds = Array.from({ length: projectCount }, () => randomUUID());
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Edge Case Owner", `${actorId}@work-edge.example`]
  );
  await Promise.all(
    projectIds.map((projectId, index) =>
      authPool.query(
        "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
        [projectId, `E${index}${suffix}`, `Edge project ${index}`]
      )
    )
  );
  return { actorId, projectIds };
};

const removeFixture = async ({ actorId, projectIds }: Fixture) => {
  await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
    actorId,
  ]);
  await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [actorId]);
  await authPool.query(
    'DELETE FROM file_asset WHERE "projectId" = ANY($1::uuid[])',
    [projectIds]
  );
  await authPool.query(
    'DELETE FROM recurrence_generation WHERE "sourceTaskId" IN (SELECT id FROM task WHERE "projectId" = ANY($1::uuid[])) OR "successorTaskId" IN (SELECT id FROM task WHERE "projectId" = ANY($1::uuid[]))',
    [projectIds]
  );
  await authPool.query('DELETE FROM task WHERE "projectId" = ANY($1::uuid[])', [
    projectIds,
  ]);
  await authPool.query("DELETE FROM project WHERE id = ANY($1::uuid[])", [
    projectIds,
  ]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
};

const runWork = <Value>(
  program: Effect.Effect<Value, unknown, WorkManagement>
) => Effect.runPromise(Effect.provide(program, WorkManagementLive));

const createRecurringTask = (
  fixture: Fixture,
  dueDate: string,
  recurrence: TaskRecurrenceInput
) =>
  runWork(
    Effect.gen(function* createAndConfigure() {
      const work = yield* WorkManagement;
      const task = yield* work.createTask(fixture.actorId, {
        assigneeIds: [fixture.actorId],
        description: null,
        dueDate,
        priority: "medium",
        projectId: fixture.projectIds[0] ?? "",
        title: "Recurring edge task",
      });
      const configured = yield* work.setTaskRecurrence(
        fixture.actorId,
        task.id,
        task.version,
        recurrence
      );
      return { dueDate, task, version: configured.version };
    })
  );

const completeTask = (
  fixture: Fixture,
  recurring: { dueDate: string; task: { id: string }; version: number }
) =>
  runWork(
    Effect.gen(function* complete() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(
        fixture.actorId,
        recurring.task.id,
        recurring.version,
        {
          assigneeIds: [fixture.actorId],
          description: null,
          dueDate: recurring.dueDate,
          priority: "medium",
          status: "done",
          title: "Recurring edge task",
        }
      );
    })
  );

const successorDueDate = async (successorId: string | undefined) => {
  if (!successorId) {
    return null;
  }
  const rows = await authPool.query(
    'SELECT "dueDate"::text AS due FROM task WHERE id = $1',
    [successorId]
  );
  return rows.rows[0]?.due ?? null;
};

it("moves a weekly successor to the first selected weekday", async () => {
  const fixture = await seedFixture(1);
  try {
    // 2026-01-07 is a Wednesday. One week later is Wednesday 2026-01-14, and
    // the first Monday on or after that date is 2026-01-19.
    const recurring = await createRecurringTask(fixture, "2026-01-07", {
      endsOn: null,
      frequency: "weekly",
      interval: 1,
      weekDays: [1],
    });
    const completed = await completeTask(fixture, recurring);

    expect(await successorDueDate(completed.recurrenceSuccessorId)).toBe(
      "2026-01-19"
    );
  } finally {
    await removeFixture(fixture);
  }
});

it("applies the biweekly interval before choosing the selected weekday", async () => {
  const fixture = await seedFixture(1);
  try {
    // Two weeks after Wednesday 2026-01-07 is Wednesday 2026-01-21. The first
    // Friday on or after that date is 2026-01-23.
    const recurring = await createRecurringTask(fixture, "2026-01-07", {
      endsOn: null,
      frequency: "biweekly",
      interval: 1,
      weekDays: [5],
    });
    const completed = await completeTask(fixture, recurring);

    expect(await successorDueDate(completed.recurrenceSuccessorId)).toBe(
      "2026-01-23"
    );
  } finally {
    await removeFixture(fixture);
  }
});

it("creates a successor exactly on the end date and none after it", async () => {
  const fixture = await seedFixture(1);
  try {
    // A monthly task due 2026-01-31 recurs on 2026-02-28.
    const onEndDate = await createRecurringTask(fixture, "2026-01-31", {
      endsOn: "2026-02-28",
      frequency: "monthly",
      interval: 1,
      weekDays: [],
    });
    const completedOnEndDate = await completeTask(fixture, onEndDate);
    expect(
      await successorDueDate(completedOnEndDate.recurrenceSuccessorId)
    ).toBe("2026-02-28");

    const pastEndDate = await createRecurringTask(fixture, "2026-01-31", {
      endsOn: "2026-02-27",
      frequency: "monthly",
      interval: 1,
      weekDays: [],
    });
    const completedPastEndDate = await completeTask(fixture, pastEndDate);
    expect(completedPastEndDate.recurrenceSuccessorId).toBeUndefined();
  } finally {
    await removeFixture(fixture);
  }
});

it("creates one successor when the same recurring task is completed concurrently", async () => {
  const fixture = await seedFixture(1);
  try {
    const recurring = await createRecurringTask(fixture, "2026-03-02", {
      endsOn: null,
      frequency: "daily",
      interval: 1,
      weekDays: [],
    });
    const outcomes = await Promise.all(
      [0, 1, 2].map(() =>
        runEffectResult(
          Effect.provide(
            Effect.gen(function* completeConcurrently() {
              const work = yield* WorkManagement;
              return yield* work.updateTask(
                fixture.actorId,
                recurring.task.id,
                recurring.version,
                {
                  assigneeIds: [fixture.actorId],
                  description: null,
                  dueDate: recurring.dueDate,
                  priority: "medium",
                  status: "done",
                  title: "Recurring edge task",
                }
              );
            }),
            WorkManagementLive
          )
        )
      )
    );

    const succeeded = outcomes.filter((outcome) => outcome.ok);
    const rejected = outcomes.filter((outcome) => !outcome.ok);
    expect(succeeded).toHaveLength(1);
    for (const outcome of rejected) {
      expect(outcome).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
    }
    const tasks = await authPool.query(
      'SELECT id FROM task WHERE "projectId" = $1',
      [fixture.projectIds[0]]
    );
    expect(tasks.rows).toHaveLength(2);
  } finally {
    await removeFixture(fixture);
  }
});

it("lets exactly one of two concurrent moves of the same task win", async () => {
  const fixture = await seedFixture(3);
  const [sourceId, firstDestination, secondDestination] = fixture.projectIds;
  try {
    const task = await runWork(
      Effect.gen(function* createTaskToMove() {
        const work = yield* WorkManagement;
        return yield* work.createTask(fixture.actorId, {
          assigneeIds: [],
          description: null,
          dueDate: null,
          priority: "medium",
          projectId: sourceId ?? "",
          title: "Moved concurrently",
        });
      })
    );
    const move = (destinationId: string | undefined) =>
      runEffectResult(
        Effect.provide(
          Effect.gen(function* moveConcurrently() {
            const work = yield* WorkManagement;
            return yield* work.moveTask(
              fixture.actorId,
              task.id,
              destinationId ?? "",
              task.version
            );
          }),
          WorkManagementLive
        )
      );
    const outcomes = await Promise.all([
      move(firstDestination),
      move(secondDestination),
    ]);

    const succeeded = outcomes.filter((outcome) => outcome.ok);
    const rejected = outcomes.filter((outcome) => !outcome.ok);
    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      error: { code: "CONFLICT" },
      ok: false,
    });
    const stored = await authPool.query(
      'SELECT "projectId", "projectTaskNumber" FROM task WHERE id = $1',
      [task.id]
    );
    const [winner] = succeeded;
    expect(winner?.ok && winner.data.projectId).toBe(stored.rows[0]?.projectId);
    expect(stored.rows[0]?.projectTaskNumber).toBe(1);
  } finally {
    await removeFixture(fixture);
  }
});

it("keeps file links attached to a task when it moves to another project", async () => {
  const fixture = await seedFixture(2);
  const [sourceId, destinationId] = fixture.projectIds;
  const fileId = randomUUID();
  try {
    const task = await runWork(
      Effect.gen(function* createTaskWithFile() {
        const work = yield* WorkManagement;
        return yield* work.createTask(fixture.actorId, {
          assigneeIds: [],
          description: null,
          dueDate: null,
          priority: "medium",
          projectId: sourceId ?? "",
          title: "Task with a file",
        });
      })
    );
    await authPool.query(
      'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        fileId,
        sourceId,
        task.id,
        fixture.actorId,
        "moved.txt",
        `tasks/${fileId}/moved.txt`,
        "text/plain",
        12,
      ]
    );

    await runWork(
      Effect.gen(function* moveTaskWithFile() {
        const work = yield* WorkManagement;
        return yield* work.moveTask(
          fixture.actorId,
          task.id,
          destinationId ?? "",
          task.version
        );
      })
    );

    const file = await authPool.query(
      'SELECT "projectId", "taskId" FROM file_asset WHERE id = $1',
      [fileId]
    );
    expect(file.rows[0]).toMatchObject({
      projectId: destinationId,
      taskId: task.id,
    });
  } finally {
    await removeFixture(fixture);
  }
});
