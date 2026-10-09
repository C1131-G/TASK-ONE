import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  TaskOrdering,
  TaskOrderingLive,
} from "../../src/server/tasks/task-ordering";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

it("reorders editable tasks atomically and returns their saved positions", async () => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Ordering Admin", `${actorId}@ordering-test.example`, "admin"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `O${actorId.slice(0, 5)}`, "Ordering project"]
  );

  try {
    const create = Effect.gen(function* createTasks() {
      const work = yield* WorkManagement;
      const first = yield* work.createTask(actorId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        projectId,
        title: "First ordered task",
      });
      const second = yield* work.createTask(actorId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        projectId,
        title: "Second ordered task",
      });
      return { first, second };
    });
    const { first, second } = await Effect.runPromise(
      Effect.provide(create, WorkManagementLive)
    );
    const reorder = Effect.gen(function* reorderTasks() {
      const ordering = yield* TaskOrdering;
      return yield* ordering.reorderTasks(actorId, [
        { expectedVersion: first.version, position: 20, taskId: first.id },
        { expectedVersion: second.version, position: 10, taskId: second.id },
      ]);
    });
    const result = await Effect.runPromise(
      Effect.provide(reorder, TaskOrderingLive)
    );

    expect(result).toEqual([
      { position: 10, taskId: second.id, version: 2 },
      { position: 20, taskId: first.id, version: 2 },
    ]);
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
