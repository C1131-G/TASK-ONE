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
  const outsiderId = randomUUID();
  const projectId = randomUUID();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 5).toUpperCase();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false), ($4, $5, $6, $6, \'employee\', false)',
    [
      actorId,
      "Reschedule Owner",
      `${actorId}@reschedule.example`,
      outsiderId,
      "Reschedule Outsider",
      `${outsiderId}@reschedule.example`,
    ]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `R${suffix}`, "Reschedule project"]
  );
  return { actorId, outsiderId, projectId };
};

const removeFixture = async ({
  actorId,
  outsiderId,
  projectId,
}: {
  readonly actorId: string;
  readonly outsiderId: string;
  readonly projectId: string;
}) => {
  await authPool.query(
    'DELETE FROM undo_record WHERE "actorId" = ANY($1::text[])',
    [[actorId, outsiderId]]
  );
  await authPool.query(
    'DELETE FROM activity WHERE "actorId" = ANY($1::text[])',
    [[actorId, outsiderId]]
  );
  await authPool.query('DELETE FROM task WHERE "projectId" = $1', [projectId]);
  await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
  await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
    [actorId, outsiderId],
  ]);
};

const runWork = <Value>(
  program: Effect.Effect<Value, unknown, WorkManagement>
) => Effect.runPromise(Effect.provide(program, WorkManagementLive));

const failureCode = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
  return "succeeded";
};

const readDates = async (taskId: string) => {
  const rows = await authPool.query(
    'SELECT "startDate"::text AS start, "dueDate"::text AS due, title FROM task WHERE id = $1',
    [taskId]
  );
  return rows.rows[0] as {
    start: string | null;
    due: string | null;
    title: string;
  };
};

const createTask = (
  fixture: { readonly actorId: string; readonly projectId: string },
  dates: { readonly dueDate: string; readonly startDate: string | null }
) =>
  runWork(
    Effect.gen(function* create() {
      const work = yield* WorkManagement;
      return yield* work.createTask(fixture.actorId, {
        assigneeIds: [fixture.actorId],
        description: null,
        dueDate: dates.dueDate,
        priority: "medium",
        projectId: fixture.projectId,
        startDate: dates.startDate,
        title: "Movable task",
      });
    })
  );

const reschedule = (
  actorId: string,
  taskId: string,
  expectedVersion: number,
  dates: { readonly dueDate: string | null; readonly startDate: string | null }
) =>
  runWork(
    Effect.gen(function* move() {
      const work = yield* WorkManagement;
      return yield* work.rescheduleTask(
        actorId,
        taskId,
        expectedVersion,
        dates
      );
    })
  );

it("moves the start and due dates together and leaves other fields alone", async () => {
  const fixture = await seedFixture();
  try {
    const created = await createTask(fixture, {
      dueDate: "2026-03-20",
      startDate: "2026-03-05",
    });
    const moved = await reschedule(
      fixture.actorId,
      created.id,
      created.version,
      {
        dueDate: "2026-03-25",
        startDate: "2026-03-10",
      }
    );
    expect(moved.version).toBe(created.version + 1);

    const row = await readDates(created.id);
    expect(row).toEqual({
      due: "2026-03-25",
      start: "2026-03-10",
      title: "Movable task",
    });
  } finally {
    await removeFixture(fixture);
  }
});

it("rejects a span whose start falls after its due date", async () => {
  const fixture = await seedFixture();
  try {
    const created = await createTask(fixture, {
      dueDate: "2026-03-20",
      startDate: "2026-03-05",
    });
    const code = await failureCode(
      reschedule(fixture.actorId, created.id, created.version, {
        dueDate: "2026-03-01",
        startDate: "2026-03-05",
      })
    );
    expect(code).toBe("VALIDATION_FAILED");
    const afterRefusal = await readDates(created.id);
    expect(afterRefusal.due).toBe("2026-03-20");
  } finally {
    await removeFixture(fixture);
  }
});

it("refuses a stale version so a move cannot overwrite a newer edit", async () => {
  const fixture = await seedFixture();
  try {
    const created = await createTask(fixture, {
      dueDate: "2026-03-20",
      startDate: null,
    });
    await reschedule(fixture.actorId, created.id, created.version, {
      dueDate: "2026-03-21",
      startDate: null,
    });
    const code = await failureCode(
      reschedule(fixture.actorId, created.id, created.version, {
        dueDate: "2026-03-30",
        startDate: null,
      })
    );
    expect(code).toBe("CONFLICT");
    const afterConflict = await readDates(created.id);
    expect(afterConflict.due).toBe("2026-03-21");
  } finally {
    await removeFixture(fixture);
  }
});

it("refuses an employee who is neither the creator nor an assignee", async () => {
  const fixture = await seedFixture();
  try {
    const created = await createTask(fixture, {
      dueDate: "2026-03-20",
      startDate: null,
    });
    const code = await failureCode(
      reschedule(fixture.outsiderId, created.id, created.version, {
        dueDate: "2026-03-22",
        startDate: null,
      })
    );
    expect(code).toBe("FORBIDDEN");
    const afterRefusal = await readDates(created.id);
    expect(afterRefusal.due).toBe("2026-03-20");
  } finally {
    await removeFixture(fixture);
  }
});

it("does not bump the version when the dates are unchanged", async () => {
  const fixture = await seedFixture();
  try {
    const created = await createTask(fixture, {
      dueDate: "2026-03-20",
      startDate: "2026-03-05",
    });
    const result = await reschedule(
      fixture.actorId,
      created.id,
      created.version,
      { dueDate: "2026-03-20", startDate: "2026-03-05" }
    );
    expect(result.version).toBe(created.version);
  } finally {
    await removeFixture(fixture);
  }
});
