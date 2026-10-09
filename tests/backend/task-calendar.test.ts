import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  TaskCalendar,
  TaskCalendarLive,
} from "../../src/server/work/task-calendar";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

it("filters, sorts, and groups active tasks in a calendar range", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Calendar Employee", `${actorId}@task-calendar.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `K${suffix.slice(0, 5)}`, "Calendar project"]
  );

  try {
    const tasks = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* createTasks() {
          const work = yield* WorkManagement;
          const first = yield* work.createTask(actorId, {
            assigneeIds: [actorId],
            description: null,
            dueDate: "2026-10-10",
            priority: "medium",
            projectId,
            startDate: "2026-10-05",
            title: "First dated task",
          });
          const second = yield* work.createTask(actorId, {
            assigneeIds: [actorId],
            description: null,
            dueDate: "2026-11-05",
            priority: "high",
            projectId,
            title: "Second dated task",
          });
          yield* work.createTask(actorId, {
            assigneeIds: [],
            description: null,
            dueDate: "2027-01-05",
            priority: "medium",
            projectId,
            title: "Outside range",
          });
          return [first, second] as const;
        }),
        WorkManagementLive
      )
    );
    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* listCalendar() {
          const calendar = yield* TaskCalendar;
          return yield* calendar.list(actorId, {
            assigneeIds: [actorId],
            from: "2026-10-01",
            groupBy: "project",
            limit: 100,
            priorities: [],
            sortBy: "dueDate",
            sortDirection: "asc",
            statuses: ["todo"],
            to: "2026-11-30",
          });
        }),
        TaskCalendarLive
      )
    );

    expect(result.map(({ id }) => id)).toEqual(tasks.map(({ id }) => id));
    expect(result.map(({ dueDate }) => dueDate)).toEqual([
      "2026-10-10",
      "2026-11-05",
    ]);
    expect(
      result.every(({ groupKey }) => groupKey === "Calendar project")
    ).toBe(true);
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
