import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  TaskRelations,
  TaskRelationsLive,
} from "../../src/server/tasks/task-relations";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

it("saves labels and dependencies while rejecting dependency cycles", async () => {
  const suffix = randomUUID();
  const adminId = randomUUID();
  const projectId = randomUUID();
  const labelId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false)',
    [adminId, "Relation Admin", `${adminId}@relations-test.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `L${suffix.slice(0, 5)}`, "Relation project"]
  );
  await authPool.query(
    "INSERT INTO label (id, name, color) VALUES ($1, $2, $3)",
    [labelId, `Important-${suffix.slice(0, 5)}`, "#ff7755"]
  );

  try {
    const createTasks = Effect.gen(function* createTasks() {
      const work = yield* WorkManagement;
      const first = yield* work.createTask(adminId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        projectId,
        title: "First relation task",
      });
      const second = yield* work.createTask(adminId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        projectId,
        title: "Second relation task",
      });
      return { first, second };
    });
    const tasks = await Effect.runPromise(
      Effect.provide(createTasks, WorkManagementLive)
    );
    const saveFirst = Effect.gen(function* saveFirstRelations() {
      const relations = yield* TaskRelations;
      return yield* relations.setTaskRelations(
        adminId,
        tasks.first.id,
        tasks.first.version,
        { dependencyTaskIds: [tasks.second.id], labelIds: [labelId] }
      );
    });
    const firstRelations = await Effect.runPromise(
      Effect.provide(saveFirst, TaskRelationsLive)
    );
    const cycle = Effect.gen(function* createCycle() {
      const relations = yield* TaskRelations;
      return yield* relations.setTaskRelations(
        adminId,
        tasks.second.id,
        tasks.second.version,
        { dependencyTaskIds: [tasks.first.id], labelIds: [] }
      );
    });
    const cycleResult = await runEffectResult(
      Effect.provide(cycle, TaskRelationsLive)
    );

    expect(firstRelations.labelIds).toEqual([labelId]);
    expect(firstRelations.dependencyTaskIds).toEqual([tasks.second.id]);
    expect(firstRelations.version).toBe(2);
    expect(cycleResult).toMatchObject({
      error: { code: "CONFLICT" },
      ok: false,
    });
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      adminId,
    ]);
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM label WHERE id = $1", [labelId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [adminId]);
  }
});
