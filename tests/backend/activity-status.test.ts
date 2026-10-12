import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import {
  ActivityManagement,
  ActivityManagementLive,
} from "../../src/server/activity/activity-management";
import { authPool } from "../../src/server/auth/database";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("shows a task status transition in the activity query", async () => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  const suffix = randomUUID();
  let taskId: string | null = null;

  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Activity Editor", `${actorId}@activity-status.example`, "admin"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `S${suffix.slice(0, 6)}`, "Status activity project"]
  );

  try {
    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* updateTaskAndReadActivity() {
          const work = yield* WorkManagement;
          const task = yield* work.createTask(actorId, {
            assigneeIds: [],
            description: null,
            dueDate: null,
            priority: "none",
            projectId,
            title: "Review status transition",
          });
          taskId = task.id;
          yield* work.updateTask(actorId, task.id, task.version, {
            assigneeIds: [],
            description: null,
            dueDate: null,
            priority: "none",
            status: "progress",
            title: task.title,
          });
          const activity = yield* ActivityManagement;
          return yield* activity.list(actorId, {}, 100);
        }),
        Layer.mergeAll(WorkManagementLive, ActivityManagementLive)
      )
    );

    expect(result).toContainEqual(
      expect.objectContaining({
        action: "task.status_changed",
        details: { from: "todo", to: "progress" },
        taskId,
      })
    );
  } finally {
    if (taskId) {
      await authPool.query('DELETE FROM activity WHERE "taskId" = $1', [
        taskId,
      ]);
      await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    }
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});

it("filters activity feeds by the selected employee", async () => {
  const actorId = randomUUID();
  const otherActorId = randomUUID();
  const projectId = randomUUID();
  const suffix = randomUUID();
  const taskIds: string[] = [];

  const members: readonly (readonly [string, string])[] = [
    [actorId, "Activity Profile Member"],
    [otherActorId, "Other Activity Member"],
  ];
  await Promise.all(
    members.map(([id, name]) =>
      authPool.query(
        'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
        [id, name, `${id}@activity-profile.example`, "employee"]
      )
    )
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `P${suffix.slice(0, 6)}`, "Member activity project"]
  );

  try {
    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* createMemberActivity() {
          const work = yield* WorkManagement;
          const taskCreators: readonly (readonly [string, string])[] = [
            [actorId, "Member task"],
            [otherActorId, "Other member task"],
          ];
          const createdTasks = yield* Effect.all(
            taskCreators.map(([createdById, title]) =>
              work.createTask(createdById, {
                assigneeIds: [],
                description: null,
                dueDate: null,
                priority: "none",
                projectId,
                title,
              })
            )
          );
          taskIds.push(...createdTasks.map(({ id }) => id));
          const activity = yield* ActivityManagement;
          return yield* activity.list(actorId, { actorId }, 100);
        }),
        Layer.mergeAll(WorkManagementLive, ActivityManagementLive)
      )
    );

    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every(
        ({ actorId: activityActorId }) => activityActorId === actorId
      )
    ).toBe(true);
    expect(result.some(({ taskTitle }) => taskTitle === "Member task")).toBe(
      true
    );
    expect(
      result.some(({ taskTitle }) => taskTitle === "Other member task")
    ).toBe(false);
  } finally {
    await Promise.all(
      taskIds.map((taskId) =>
        authPool.query('DELETE FROM activity WHERE "taskId" = $1', [taskId])
      )
    );
    await Promise.all(
      taskIds.map((taskId) =>
        authPool.query("DELETE FROM task WHERE id = $1", [taskId])
      )
    );
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [actorId, otherActorId],
    ]);
  }
});
