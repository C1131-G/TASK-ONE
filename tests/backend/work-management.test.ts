import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  Notifications,
  NotificationsLive,
} from "../../src/server/notifications/service";
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

it("moves a task into an active project with a fresh destination number", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const sourceProjectId = randomUUID();
  const destinationProjectId = randomUUID();
  const email = `${actorId}@move-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Task Mover", email]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3), ($4, $5, $6)",
    [
      sourceProjectId,
      `M${suffix.slice(0, 5)}`,
      "Move source",
      destinationProjectId,
      `N${suffix.slice(0, 5)}`,
      "Move destination",
    ]
  );

  try {
    const create = Effect.gen(function* createTask() {
      const work = yield* WorkManagement;
      return yield* work.createTask(actorId, {
        assigneeIds: [],
        description: "Keep attached file references",
        dueDate: null,
        priority: "medium",
        projectId: sourceProjectId,
        title: "Move this task",
      });
    });
    const sourceTask = await Effect.runPromise(
      Effect.provide(create, WorkManagementLive)
    );
    const move = Effect.gen(function* moveTask() {
      const work = yield* WorkManagement;
      return yield* work.moveTask(
        actorId,
        sourceTask.id,
        destinationProjectId,
        sourceTask.version
      );
    });
    const movedTask = await Effect.runPromise(
      Effect.provide(move, WorkManagementLive)
    );

    expect(movedTask.id).toBe(sourceTask.id);
    expect(movedTask.projectId).toBe(destinationProjectId);
    expect(movedTask.projectTaskNumber).toBe(1);
    expect(movedTask.version).toBe(2);
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query(
      'DELETE FROM task WHERE id IN (SELECT id FROM task WHERE "projectId" = ANY($1::uuid[]))',
      [[sourceProjectId, destinationProjectId]]
    );
    await authPool.query("DELETE FROM project WHERE id = ANY($1::uuid[])", [
      [sourceProjectId, destinationProjectId],
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});

it("blocks task moves while a signed upload is still pending", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const sourceProjectId = randomUUID();
  const destinationProjectId = randomUUID();
  const uploadIntentId = randomUUID();
  const email = `${actorId}@pending-move-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Pending Upload Owner", email]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3), ($4, $5, $6)",
    [
      sourceProjectId,
      `Q${suffix.slice(0, 5)}`,
      "Pending source",
      destinationProjectId,
      `R${suffix.slice(0, 5)}`,
      "Pending destination",
    ]
  );

  try {
    const create = Effect.gen(function* createTask() {
      const work = yield* WorkManagement;
      return yield* work.createTask(actorId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        projectId: sourceProjectId,
        title: "Task with pending upload",
      });
    });
    const task = await Effect.runPromise(
      Effect.provide(create, WorkManagementLive)
    );
    await authPool.query(
      `INSERT INTO upload_intent
         (id, "ownerId", "taskId", "projectId", "objectKey", "fileName",
          "contentType", "sizeBytes", state, "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 128, 'pending', now() + interval '10 minutes')`,
      [
        uploadIntentId,
        actorId,
        task.id,
        sourceProjectId,
        `pending/${uploadIntentId}`,
        "pending.pdf",
        "application/pdf",
      ]
    );
    const blockedMove = Effect.gen(function* moveWithPendingUpload() {
      const work = yield* WorkManagement;
      return yield* work.moveTask(
        actorId,
        task.id,
        destinationProjectId,
        task.version
      );
    });
    const blocked = await runEffectResult(
      Effect.provide(blockedMove, WorkManagementLive)
    );
    expect(blocked).toMatchObject({
      error: { code: "CONFLICT" },
      ok: false,
    });

    await authPool.query("DELETE FROM upload_intent WHERE id = $1", [
      uploadIntentId,
    ]);
    const retryMove = Effect.gen(function* retryMove() {
      const work = yield* WorkManagement;
      return yield* work.moveTask(
        actorId,
        task.id,
        destinationProjectId,
        task.version
      );
    });
    const moved = await Effect.runPromise(
      Effect.provide(retryMove, WorkManagementLive)
    );
    expect(moved.projectId).toBe(destinationProjectId);
    expect(moved.version).toBe(2);
  } finally {
    await authPool.query("DELETE FROM upload_intent WHERE id = $1", [
      uploadIntentId,
    ]);
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query(
      'DELETE FROM task WHERE "projectId" = ANY($1::uuid[])',
      [[sourceProjectId, destinationProjectId]]
    );
    await authPool.query("DELETE FROM project WHERE id = ANY($1::uuid[])", [
      [sourceProjectId, destinationProjectId],
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});

it("duplicates active task structure without carrying comments or completion", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const email = `${actorId}@duplicate-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Task Duplicator", email]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `D${suffix.slice(0, 5)}`, "Duplicate project"]
  );

  try {
    const create = Effect.gen(function* createTask() {
      const work = yield* WorkManagement;
      return yield* work.createTask(actorId, {
        assigneeIds: [actorId],
        description: "Copy this task",
        dueDate: "2026-11-20",
        priority: "high",
        projectId,
        title: "Prepare launch",
      });
    });
    const source = await Effect.runPromise(
      Effect.provide(create, WorkManagementLive)
    );
    await authPool.query(
      `INSERT INTO task_subtask (id, "taskId", title, "isCompleted", position)
       VALUES ($1, $2, 'Confirm copy', true, 0)`,
      [randomUUID(), source.id]
    );
    await authPool.query(
      `UPDATE task SET status = 'done', "completedAt" = now(), version = 2 WHERE id = $1`,
      [source.id]
    );
    const duplicate = Effect.gen(function* duplicateTask() {
      const work = yield* WorkManagement;
      return yield* work.duplicateTask(actorId, source.id, 2);
    });
    const copied = await Effect.runPromise(
      Effect.provide(duplicate, WorkManagementLive)
    );

    expect(copied.id).not.toBe(source.id);
    expect(copied.projectTaskNumber).toBe(2);
    expect(copied.status).toBe("todo");
    expect(copied.title).toBe("Prepare launch (copy)");
    expect(copied.assigneeIds).toEqual([actorId]);
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

it("archives a task and allows only its actor to undo within the window", async () => {
  const suffix = randomUUID();
  const adminId = randomUUID();
  const projectId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false)',
    [adminId, "Archive Admin", `${adminId}@archive-test.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `A${suffix.slice(0, 5)}`, "Archive project"]
  );

  try {
    const create = Effect.gen(function* createTask() {
      const work = yield* WorkManagement;
      return yield* work.createTask(adminId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        projectId,
        title: "Archive me",
      });
    });
    const task = await Effect.runPromise(
      Effect.provide(create, WorkManagementLive)
    );
    const archive = Effect.gen(function* archiveTask() {
      const work = yield* WorkManagement;
      return yield* work.archiveTask(adminId, task.id, task.version);
    });
    const receipt = await Effect.runPromise(
      Effect.provide(archive, WorkManagementLive)
    );
    const activeTasks = Effect.gen(function* listActiveTasks() {
      const work = yield* WorkManagement;
      return yield* work.listProjectTasks(adminId, projectId, {
        limit: 20,
        offset: 0,
      });
    });
    const archivedTasks = Effect.gen(function* listArchivedTasks() {
      const work = yield* WorkManagement;
      return yield* work.listProjectTasks(adminId, projectId, {
        includeArchived: true,
        limit: 20,
        offset: 0,
      });
    });
    expect(
      await Effect.runPromise(Effect.provide(activeTasks, WorkManagementLive))
    ).toHaveLength(0);
    expect(
      await Effect.runPromise(Effect.provide(archivedTasks, WorkManagementLive))
    ).toMatchObject([{ archivedAt: expect.any(String), id: task.id }]);
    const archivedEdit = Effect.gen(function* editArchived() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(adminId, task.id, 2, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        status: "todo",
        title: "No edits while archived",
      });
    });
    const denied = await runEffectResult(
      Effect.provide(archivedEdit, WorkManagementLive)
    );
    expect(denied).toMatchObject({
      error: { code: "FORBIDDEN" },
      ok: false,
    });

    const undo = Effect.gen(function* undoArchive() {
      const work = yield* WorkManagement;
      return yield* work.undoTaskArchive(adminId, receipt.undoId);
    });
    await Effect.runPromise(Effect.provide(undo, WorkManagementLive));
    const update = Effect.gen(function* updateAfterUndo() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(adminId, task.id, 3, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        status: "todo",
        title: "Restored and editable",
      });
    });
    const restoredUpdate = await Effect.runPromise(
      Effect.provide(update, WorkManagementLive)
    );
    const reusedUndo = await runEffectResult(
      Effect.provide(undo, WorkManagementLive)
    );

    expect(receipt.undoId).toBeTruthy();
    expect(restoredUpdate.title).toBe("Restored and editable");
    expect(reusedUndo).toMatchObject({
      error: { code: "CONFLICT" },
      ok: false,
    });
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      adminId,
    ]);
    await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
      adminId,
    ]);
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [adminId]);
  }
});

it("allows the completing actor to undo completion once without overwriting later edits", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Completion Owner", `${actorId}@completion-undo.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `U${suffix.slice(0, 5)}`, "Completion undo project"]
  );

  try {
    const task = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* createTask() {
          const work = yield* WorkManagement;
          return yield* work.createTask(actorId, {
            assigneeIds: [],
            description: null,
            dueDate: null,
            priority: "none",
            projectId,
            title: "Complete this task",
          });
        }),
        WorkManagementLive
      )
    );
    const completed = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* completeTask() {
          const work = yield* WorkManagement;
          return yield* work.updateTask(actorId, task.id, task.version, {
            assigneeIds: [],
            description: null,
            dueDate: null,
            priority: "none",
            status: "done",
            title: task.title,
          });
        }),
        WorkManagementLive
      )
    );

    expect(completed.completionUndo).toBeDefined();
    if (!completed.completionUndo) {
      throw new Error("Completing a task should return its undo receipt.");
    }
    const { completionUndo } = completed;
    const undo = Effect.gen(function* undoCompletion() {
      const work = yield* WorkManagement;
      return yield* work.undoTaskCompletion(actorId, completionUndo.undoId);
    });
    await Effect.runPromise(Effect.provide(undo, WorkManagementLive));
    const reopened = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* verifyReopenedTask() {
          const work = yield* WorkManagement;
          return yield* work.updateTask(
            actorId,
            task.id,
            completed.version + 1,
            {
              assigneeIds: [],
              description: null,
              dueDate: null,
              priority: "none",
              status: "progress",
              title: task.title,
            }
          );
        }),
        WorkManagementLive
      )
    );
    const reusedReceipt = await runEffectResult(
      Effect.provide(undo, WorkManagementLive)
    );

    expect(reopened.status).toBe("progress");
    expect(reusedReceipt).toMatchObject({
      error: { code: "CONFLICT" },
      ok: false,
    });
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

it("applies bulk task changes atomically and enforces edit permission on every task", async () => {
  const suffix = randomUUID();
  const adminId = randomUUID();
  const employeeId = randomUUID();
  const projectId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false), ($4, $5, $6, $6, \'employee\', false)',
    [
      adminId,
      "Bulk Admin",
      `${adminId}@bulk-test.example`,
      employeeId,
      "Bulk Employee",
      `${employeeId}@bulk-test.example`,
    ]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `B${suffix.slice(0, 5)}`, "Bulk project"]
  );

  try {
    const createTasks = Effect.gen(function* createTasks() {
      const work = yield* WorkManagement;
      const employeeTask = yield* work.createTask(employeeId, {
        assigneeIds: [],
        description: null,
        dueDate: "2026-10-10",
        priority: "none",
        projectId,
        title: "Employee task",
      });
      const adminTask = yield* work.createTask(adminId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        projectId,
        title: "Admin task",
      });
      return { adminTask, employeeTask };
    });
    const { adminTask, employeeTask } = await Effect.runPromise(
      Effect.provide(createTasks, WorkManagementLive)
    );
    const recurringVersion = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* setRecurrence() {
          const work = yield* WorkManagement;
          const result = yield* work.setTaskRecurrence(
            employeeId,
            employeeTask.id,
            employeeTask.version,
            {
              endsOn: null,
              frequency: "daily",
              interval: 1,
              weekDays: [],
            }
          );
          return result.version;
        }),
        WorkManagementLive
      )
    );
    const employeeBulk = Effect.gen(function* unauthorizedBulk() {
      const work = yield* WorkManagement;
      return yield* work.bulkUpdateTasks(
        employeeId,
        [
          { expectedVersion: recurringVersion, taskId: employeeTask.id },
          { expectedVersion: 1, taskId: adminTask.id },
        ],
        {
          assigneeIds: [],
          dueDate: "2026-10-10",
          priority: "high",
          status: "done",
        }
      );
    });
    const denied = await runEffectResult(
      Effect.provide(employeeBulk, WorkManagementLive)
    );
    expect(denied).toMatchObject({
      error: { code: "FORBIDDEN" },
      ok: false,
    });

    const employeeEdit = Effect.gen(function* employeeEdit() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(
        employeeId,
        employeeTask.id,
        recurringVersion,
        {
          assigneeIds: [],
          description: null,
          dueDate: "2026-10-10",
          priority: "medium",
          status: "todo",
          title: "Still unchanged by failed bulk",
        }
      );
    });
    const unchangedTask = await Effect.runPromise(
      Effect.provide(employeeEdit, WorkManagementLive)
    );
    const adminBulk = Effect.gen(function* authorizedBulk() {
      const work = yield* WorkManagement;
      return yield* work.bulkUpdateTasks(
        adminId,
        [
          { expectedVersion: unchangedTask.version, taskId: employeeTask.id },
          { expectedVersion: adminTask.version, taskId: adminTask.id },
        ],
        {
          assigneeIds: [],
          dueDate: "2026-10-10",
          priority: "high",
          status: "done",
        }
      );
    });
    const updated = await Effect.runPromise(
      Effect.provide(adminBulk, WorkManagementLive)
    );
    expect(unchangedTask.version).toBe(3);
    expect(updated).toHaveLength(2);
    expect(updated.every((task) => task.status === "done")).toBe(true);
    expect(
      updated.find(({ id }) => id === employeeTask.id)?.completionUndo
    ).toBeDefined();
    expect(
      updated.find(({ id }) => id === employeeTask.id)?.recurrenceSuccessorId
    ).toBeDefined();
    expect(
      updated.find(({ id }) => id === adminTask.id)?.completionUndo
    ).toBeDefined();
  } finally {
    await authPool.query(
      "DELETE FROM job WHERE payload->>'userId' = ANY($1::text[])",
      [[adminId, employeeId]]
    );
    await authPool.query(
      'DELETE FROM notification WHERE "userId" = ANY($1::text[])',
      [[adminId, employeeId]]
    );
    await authPool.query(
      'DELETE FROM activity WHERE "actorId" = ANY($1::text[])',
      [[adminId, employeeId]]
    );
    await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
      adminId,
    ]);
    await authPool.query(
      'DELETE FROM recurrence_generation WHERE "sourceTaskId" IN (SELECT id FROM task WHERE "projectId" = $1) OR "successorTaskId" IN (SELECT id FROM task WHERE "projectId" = $1)',
      [projectId]
    );
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [adminId, employeeId],
    ]);
  }
});

it("changes a task board column without resending its other fields", async () => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const email = `${actorId}@column-change-test.example`;
  const projectKey = `C${randomUUID().slice(0, 6)}`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Column Employee", email]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, projectKey, "Column project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, description, priority, status, "createdById") VALUES ($1, $2, 1, $3, $4, $5, $6, $7)',
    [
      taskId,
      projectId,
      "Preserve this title",
      "Keep the description",
      "high",
      "todo",
      actorId,
    ]
  );

  try {
    const program = Effect.gen(function* program() {
      const work = yield* WorkManagement;
      return yield* work.changeTaskStatus(actorId, taskId, 1, "progress");
    });
    const updated = await Effect.runPromise(
      Effect.provide(program, WorkManagementLive)
    );
    expect(updated.status).toBe("progress");
    expect(updated.title).toBe("Preserve this title");
    expect(updated.description).toBe("Keep the description");
    expect(updated.priority).toBe("high");
    expect(updated.version).toBe(2);
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
