import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("allocates distinct sequential task numbers for concurrent creates", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const email = `${actorId}@concurrent-work-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Concurrent Task Creator", email, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `C${suffix.slice(0, 6)}`, "Concurrent task test project"]
  );

  try {
    const createTask = (title: string) => {
      const program = Effect.gen(function* createProgram() {
        const work = yield* WorkManagement;
        return yield* work.createTask(actorId, {
          assigneeIds: [],
          description: null,
          dueDate: null,
          priority: "none",
          projectId,
          title,
        });
      });
      return Effect.runPromise(Effect.provide(program, WorkManagementLive));
    };

    const tasks = await Promise.all([
      createTask("Concurrent task one"),
      createTask("Concurrent task two"),
    ]);
    expect(
      tasks.map(({ projectTaskNumber }) => projectTaskNumber).toSorted()
    ).toEqual([1, 2]);
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

it("rejects a task edit when its expected version is stale", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const email = `${actorId}@work-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Task Editor", email, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `V${suffix.slice(0, 6)}`, "Version test project"]
  );

  try {
    const createProgram = Effect.gen(function* createProgram() {
      const work = yield* WorkManagement;
      return yield* work.createTask(actorId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        projectId,
        title: "Initial title",
      });
    });
    const task = await Effect.runPromise(
      Effect.provide(createProgram, WorkManagementLive)
    );
    const updateProgram = Effect.gen(function* updateProgram() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(actorId, task.id, 1, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "high",
        status: "progress",
        title: "Updated title",
      });
    });
    const firstUpdate = await Effect.runPromise(
      Effect.provide(updateProgram, WorkManagementLive)
    );
    const staleUpdate = Effect.gen(function* staleUpdate() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(actorId, task.id, 1, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "high",
        status: "progress",
        title: "Stale overwrite",
      });
    });
    const staleResult = await runEffectResult(
      Effect.provide(staleUpdate, WorkManagementLive)
    );

    expect(firstUpdate.version).toBe(2);
    expect(staleResult).toMatchObject({
      error: { code: "CONFLICT" },
      ok: false,
    });
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
