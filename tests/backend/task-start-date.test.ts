import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const seedFixture = async () => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 5).toUpperCase();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Start Date Owner", `${actorId}@start-date.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `S${suffix}`, "Start date project"]
  );
  return { actorId, projectId };
};

const removeFixture = async ({
  actorId,
  projectId,
}: {
  readonly actorId: string;
  readonly projectId: string;
}) => {
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

const failureCode = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      return error.code;
    }
    return String(error);
  }
  return "succeeded";
};

const taskStartDate = async (taskId: string) => {
  const rows = await authPool.query(
    'SELECT "startDate"::text AS start FROM task WHERE id = $1',
    [taskId]
  );
  return rows.rows[0]?.start ?? null;
};

it("rejects creating a task whose start date is after its due date", async () => {
  const fixture = await seedFixture();
  try {
    const code = await failureCode(
      runWork(
        Effect.gen(function* create() {
          const work = yield* WorkManagement;
          return yield* work.createTask(fixture.actorId, {
            assigneeIds: [fixture.actorId],
            description: null,
            dueDate: "2026-03-01",
            priority: "medium",
            projectId: fixture.projectId,
            startDate: "2026-03-10",
            title: "Reversed range",
          });
        })
      )
    );
    expect(code).toBe("VALIDATION_FAILED");
  } finally {
    await removeFixture(fixture);
  }
});

it("clears a start date when the update sends null, and rejects a start after due", async () => {
  const fixture = await seedFixture();
  try {
    const created = await runWork(
      Effect.gen(function* create() {
        const work = yield* WorkManagement;
        return yield* work.createTask(fixture.actorId, {
          assigneeIds: [fixture.actorId],
          description: null,
          dueDate: "2026-03-20",
          priority: "medium",
          projectId: fixture.projectId,
          startDate: "2026-03-05",
          title: "Ranged task",
        });
      })
    );
    expect(await taskStartDate(created.id)).toBe("2026-03-05");

    const reversed = await failureCode(
      runWork(
        Effect.gen(function* update() {
          const work = yield* WorkManagement;
          return yield* work.updateTask(
            fixture.actorId,
            created.id,
            created.version,
            {
              assigneeIds: [fixture.actorId],
              description: null,
              dueDate: "2026-03-01",
              priority: "medium",
              startDate: "2026-03-05",
              status: "todo",
              title: "Ranged task",
            }
          );
        })
      )
    );
    expect(reversed).toBe("VALIDATION_FAILED");

    const cleared = await runWork(
      Effect.gen(function* update() {
        const work = yield* WorkManagement;
        return yield* work.updateTask(
          fixture.actorId,
          created.id,
          created.version,
          {
            assigneeIds: [fixture.actorId],
            description: null,
            dueDate: "2026-03-20",
            priority: "medium",
            startDate: null,
            status: "todo",
            title: "Ranged task",
          }
        );
      })
    );
    expect(await taskStartDate(cleared.id)).toBeNull();
  } finally {
    await removeFixture(fixture);
  }
});
