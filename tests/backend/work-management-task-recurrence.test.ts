import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  SubtaskManagement,
  SubtaskManagementLive,
} from "../../src/server/tasks/subtask-management";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("creates one recurrence successor on completion and retains it after undo", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Recurring Task Owner", `${actorId}@recurrence-test.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `R${suffix.slice(0, 5)}`, "Recurrence project"]
  );

  try {
    const task = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* createRecurringTask() {
          const work = yield* WorkManagement;
          return yield* work.createTask(actorId, {
            assigneeIds: [actorId],
            description: "Repeat this work",
            dueDate: "2026-01-31",
            priority: "high",
            projectId,
            title: "Monthly review",
          });
        }),
        WorkManagementLive
      )
    );
    const originalSubtask = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* addRecurringSubtask() {
          const subtasks = yield* SubtaskManagement;
          return yield* subtasks.createSubtask(actorId, task.id, task.version, {
            assigneeId: actorId,
            description: "A repeated checklist item",
            dueDate: "2026-01-30",
            title: "Prepare the review",
          });
        }),
        SubtaskManagementLive
      )
    );
    const recurrence = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* configureRecurrence() {
          const work = yield* WorkManagement;
          return yield* work.setTaskRecurrence(
            actorId,
            task.id,
            originalSubtask.parentVersion,
            {
              endsOn: "2027-01-01",
              frequency: "monthly",
              interval: 1,
              weekDays: [],
            }
          );
        }),
        WorkManagementLive
      )
    );
    const clearingRecurringDueDate = Effect.gen(function* clearDueDate() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(actorId, task.id, recurrence.version, {
        assigneeIds: [actorId],
        description: "Repeat this work",
        dueDate: null,
        priority: "high",
        status: "todo",
        title: "Monthly review",
      });
    });
    const dueDateConflict = await runEffectResult(
      Effect.provide(clearingRecurringDueDate, WorkManagementLive)
    );
    expect(dueDateConflict).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
      ok: false,
    });
    const completed = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* completeRecurringTask() {
          const work = yield* WorkManagement;
          return yield* work.updateTask(actorId, task.id, recurrence.version, {
            assigneeIds: [actorId],
            description: "Repeat this work",
            dueDate: "2026-01-31",
            priority: "high",
            status: "done",
            title: "Monthly review",
          });
        }),
        WorkManagementLive
      )
    );
    if (!completed.recurrenceSuccessorId || !completed.completionUndo) {
      throw new Error(
        "Completing a recurring task should create a successor and return Undo."
      );
    }
    const { recurrenceSuccessorId } = completed;
    const { completionUndo } = completed;
    const undoCompletion = Effect.gen(function* undoCompletion() {
      const work = yield* WorkManagement;
      return yield* work.undoTaskCompletion(actorId, completionUndo.undoId);
    });
    await Effect.runPromise(Effect.provide(undoCompletion, WorkManagementLive));
    const recompleted = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* recompleteOriginal() {
          const work = yield* WorkManagement;
          return yield* work.updateTask(
            actorId,
            task.id,
            completed.version + 1,
            {
              assigneeIds: [actorId],
              description: "Repeat this work",
              dueDate: "2026-01-31",
              priority: "high",
              status: "done",
              title: "Monthly review",
            }
          );
        }),
        WorkManagementLive
      )
    );
    const successor = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* readSuccessorThroughUpdate() {
          const work = yield* WorkManagement;
          return yield* work.updateTask(actorId, recurrenceSuccessorId, 1, {
            assigneeIds: [actorId],
            description: "Repeat this work",
            dueDate: "2026-02-28",
            priority: "high",
            status: "todo",
            title: "Monthly review",
          });
        }),
        WorkManagementLive
      )
    );
    const successorSubtasks = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* listSuccessorSubtasks() {
          const subtasks = yield* SubtaskManagement;
          return yield* subtasks.listSubtasks(actorId, recurrenceSuccessorId);
        }),
        SubtaskManagementLive
      )
    );

    expect(successor.projectTaskNumber).toBe(2);
    expect(successor.dueDate).toBe("2026-02-28");
    expect(recompleted.recurrenceSuccessorId).toBeUndefined();
    expect(successorSubtasks).toMatchObject([
      {
        assigneeId: actorId,
        completed: false,
        description: "A repeated checklist item",
        dueDate: "2026-01-30",
        title: "Prepare the review",
      },
    ]);
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query(
      'DELETE FROM recurrence_generation WHERE "sourceTaskId" IN (SELECT id FROM task WHERE "projectId" = $1) OR "successorTaskId" IN (SELECT id FROM task WHERE "projectId" = $1)',
      [projectId]
    );
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
