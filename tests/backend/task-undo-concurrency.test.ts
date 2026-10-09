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

interface Fixture {
  readonly actorId: string;
  readonly projectId: string;
}

const seedFixture = async (role: "admin" | "employee"): Promise<Fixture> => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Task Undo Owner", `${actorId}@task-undo-conc.example`, role]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [
      projectId,
      `TU${projectId.replaceAll("-", "").slice(0, 5).toUpperCase()}`,
      "Task undo concurrency",
    ]
  );
  return { actorId, projectId };
};

const removeFixture = async ({ actorId, projectId }: Fixture) => {
  await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
    actorId,
  ]);
  await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [actorId]);
  await authPool.query('DELETE FROM task WHERE "projectId" = $1', [projectId]);
  await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
};

const runWork = <Value>(
  program: Effect.Effect<Value, unknown, WorkManagement>
) => Effect.runPromise(Effect.provide(program, WorkManagementLive));

const createTask = (fixture: Fixture) =>
  runWork(
    Effect.gen(function* createFixtureTask() {
      const work = yield* WorkManagement;
      return yield* work.createTask(fixture.actorId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "medium",
        projectId: fixture.projectId,
        title: "Competing undo task",
      });
    })
  );

it("lets exactly one of several competing task-archive undos succeed", async () => {
  const fixture = await seedFixture("admin");
  try {
    const task = await createTask(fixture);
    const receipt = await runWork(
      Effect.gen(function* archive() {
        const work = yield* WorkManagement;
        return yield* work.archiveTask(fixture.actorId, task.id, task.version);
      })
    );
    const undo = () =>
      runEffectResult(
        Effect.provide(
          Effect.gen(function* undoArchive() {
            const work = yield* WorkManagement;
            yield* work.undoTaskArchive(fixture.actorId, receipt.undoId);
          }),
          WorkManagementLive
        )
      );
    const outcomes = await Promise.all([undo(), undo(), undo()]);

    const succeeded = outcomes.filter((outcome) => outcome.ok);
    const rejected = outcomes.filter((outcome) => !outcome.ok);
    expect(succeeded).toHaveLength(1);
    for (const outcome of rejected) {
      expect(outcome).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
    }
    const stored = await authPool.query(
      'SELECT "archivedAt" FROM task WHERE id = $1',
      [task.id]
    );
    expect(stored.rows[0]?.archivedAt).toBeNull();
  } finally {
    await removeFixture(fixture);
  }
});

it("lets exactly one of several competing task-completion undos succeed", async () => {
  const fixture = await seedFixture("employee");
  try {
    const task = await createTask(fixture);
    const completed = await runWork(
      Effect.gen(function* complete() {
        const work = yield* WorkManagement;
        return yield* work.updateTask(fixture.actorId, task.id, task.version, {
          assigneeIds: [],
          description: null,
          dueDate: null,
          priority: "medium",
          status: "done",
          title: "Competing undo task",
        });
      })
    );
    const { completionUndo } = completed;
    if (!completionUndo) {
      throw new Error("Completing a task should return an Undo receipt.");
    }
    const undo = () =>
      runEffectResult(
        Effect.provide(
          Effect.gen(function* undoCompletion() {
            const work = yield* WorkManagement;
            yield* work.undoTaskCompletion(
              fixture.actorId,
              completionUndo.undoId
            );
          }),
          WorkManagementLive
        )
      );
    const outcomes = await Promise.all([undo(), undo(), undo()]);

    const succeeded = outcomes.filter((outcome) => outcome.ok);
    const rejected = outcomes.filter((outcome) => !outcome.ok);
    expect(succeeded).toHaveLength(1);
    for (const outcome of rejected) {
      expect(outcome).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
    }
    const stored = await authPool.query(
      "SELECT status, version FROM task WHERE id = $1",
      [task.id]
    );
    expect(stored.rows[0]?.status).toBe("todo");
    expect(stored.rows[0]?.version).toBe(completed.version + 1);
  } finally {
    await removeFixture(fixture);
  }
});
