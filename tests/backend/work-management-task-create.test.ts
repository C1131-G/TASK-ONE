import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  Notifications,
  NotificationsLive,
} from "../../src/server/notifications/service";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("creates a numbered task with multiple active assignees in one transaction", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const firstAssigneeId = randomUUID();
  const secondAssigneeId = randomUUID();
  const projectId = randomUUID();
  const emails = [actorId, firstAssigneeId, secondAssigneeId].map(
    (id) => `${id}@work-test.example`
  );
  const users = [actorId, firstAssigneeId, secondAssigneeId];

  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") SELECT id, name, email, email, $1, false FROM unnest($2::text[], $3::text[]) AS rows(id, email) CROSS JOIN LATERAL (SELECT email AS name) AS names',
    ["employee", users, emails]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `P${suffix.slice(0, 6)}`, "Task test project"]
  );

  try {
    const program = Effect.gen(function* program() {
      const work = yield* WorkManagement;
      const task = yield* work.createTask(actorId, {
        assigneeIds: [firstAssigneeId, secondAssigneeId],
        description: null,
        dueDate: null,
        estimate: "4 hours",
        priority: "high",
        projectId,
        startDate: "2026-10-10",
        title: "Review mobile layout",
      });
      const tasks = yield* work.listProjectTasks(actorId, projectId, {
        limit: 50,
        offset: 0,
      });
      return { task, tasks };
    });
    const result = await Effect.runPromise(
      Effect.provide(program, WorkManagementLive)
    );

    expect(result.task.projectTaskNumber).toBe(1);
    expect(result.task.title).toBe("Review mobile layout");
    expect(result.task.assigneeIds).toEqual([
      firstAssigneeId,
      secondAssigneeId,
    ]);
    expect(result.tasks).toMatchObject([
      {
        assignees: [{ id: firstAssigneeId }, { id: secondAssigneeId }],
        estimate: "4 hours",
        id: result.task.id,
        projectTaskNumber: 1,
        startDate: "2026-10-10",
        title: "Review mobile layout",
      },
    ]);
  } finally {
    await authPool.query(
      "DELETE FROM job WHERE payload->>'actorId' = ANY($1::text[])",
      [users]
    );
    await authPool.query(
      'DELETE FROM notification WHERE "userId" = ANY($1::text[])',
      [users]
    );
    await authPool.query(
      'DELETE FROM activity WHERE "actorId" = ANY($1::text[])',
      [users]
    );
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      users,
    ]);
  }
});

it("notifies new assignees and existing stakeholders about task updates", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const assigneeId = randomUUID();
  const projectId = randomUUID();
  const users = [actorId, assigneeId];
  const emails = users.map((id) => `${id}@assignment-test.example`);
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") SELECT id, name, email, email, $1, false FROM unnest($2::text[], $3::text[]) AS rows(id, email) CROSS JOIN LATERAL (SELECT email AS name) AS names',
    ["employee", users, emails]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `A${suffix.slice(0, 6)}`, "Assignment notification project"]
  );

  try {
    const createProgram = Effect.gen(function* createTask() {
      const work = yield* WorkManagement;
      const created = yield* work.createTask(actorId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "medium",
        projectId,
        title: "Notify assignee",
      });
      const assigned = yield* work.updateTask(
        actorId,
        created.id,
        created.version,
        {
          assigneeIds: [assigneeId],
          description: created.description,
          dueDate: created.dueDate,
          priority: created.priority,
          status: created.status,
          title: created.title,
        }
      );
      return yield* work.updateTask(actorId, assigned.id, assigned.version, {
        assigneeIds: assigned.assigneeIds,
        description: assigned.description,
        dueDate: assigned.dueDate,
        priority: assigned.priority,
        status: assigned.status,
        title: "Notify assignee about changes",
      });
    });
    const task = await Effect.runPromise(
      Effect.provide(createProgram, WorkManagementLive)
    );
    const inboxProgram = Effect.gen(function* listInbox() {
      const notifications = yield* Notifications;
      return yield* notifications.listInbox(assigneeId, {
        limit: 10,
        unreadOnly: false,
      });
    });
    const inbox = await Effect.runPromise(
      Effect.provide(inboxProgram, NotificationsLive)
    );

    expect(inbox.items).toHaveLength(2);
    expect(inbox.items.map(({ type }) => type).toSorted()).toEqual([
      "assignment",
      "update",
    ]);
    expect(
      inbox.items.every(
        ({ actorId: notificationActor, taskId }) =>
          notificationActor === actorId && taskId === task.id
      )
    ).toBe(true);
  } finally {
    await authPool.query("DELETE FROM job WHERE payload->>'actorId' = $1", [
      actorId,
    ]);
    await authPool.query('DELETE FROM notification WHERE "userId" = $1', [
      assigneeId,
    ]);
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      users,
    ]);
  }
});
