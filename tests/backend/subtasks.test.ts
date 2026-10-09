import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  SubtaskManagement,
  SubtaskManagementLive,
} from "../../src/server/tasks/subtask-management";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

it("creates, completes, and promotes a subtask through task services", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const email = `${actorId}@subtask-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Subtask Owner", email]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `S${suffix.slice(0, 5)}`, "Subtask project"]
  );

  try {
    const createTask = Effect.gen(function* createTask() {
      const work = yield* WorkManagement;
      return yield* work.createTask(actorId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "medium",
        projectId,
        title: "Prepare client deck",
      });
    });
    const task = await Effect.runPromise(
      Effect.provide(createTask, WorkManagementLive)
    );
    const createSubtask = Effect.gen(function* createSubtask() {
      const subtasks = yield* SubtaskManagement;
      return yield* subtasks.createSubtask(actorId, task.id, task.version, {
        assigneeId: actorId,
        description: "<script>ignore()</script><p>Draft slides</p>",
        dueDate: "2026-11-21",
        title: "Draft slides",
      });
    });
    const created = await Effect.runPromise(
      Effect.provide(createSubtask, SubtaskManagementLive)
    );
    const complete = Effect.gen(function* completeSubtask() {
      const subtasks = yield* SubtaskManagement;
      return yield* subtasks.updateSubtask(
        actorId,
        created.subtask.id,
        created.parentVersion,
        {
          assigneeId: actorId,
          completed: true,
          description: "<p>Slides drafted</p>",
          dueDate: "2026-11-21",
          title: "Draft slides",
        }
      );
    });
    const completed = await Effect.runPromise(
      Effect.provide(complete, SubtaskManagementLive)
    );
    const createDisposable = Effect.gen(function* createDisposable() {
      const subtasks = yield* SubtaskManagement;
      return yield* subtasks.createSubtask(
        actorId,
        task.id,
        completed.parentVersion,
        {
          assigneeId: null,
          description: null,
          dueDate: null,
          title: "Remove this subtask",
        }
      );
    });
    const disposable = await Effect.runPromise(
      Effect.provide(createDisposable, SubtaskManagementLive)
    );
    const createSecondSubtask = Effect.gen(function* makeSecondSubtask() {
      const subtasks = yield* SubtaskManagement;
      return yield* subtasks.createSubtask(
        actorId,
        task.id,
        disposable.parentVersion,
        {
          assigneeId: null,
          description: null,
          dueDate: null,
          title: "Second subtask",
        }
      );
    });
    const secondSubtask = await Effect.runPromise(
      Effect.provide(createSecondSubtask, SubtaskManagementLive)
    );
    const reorder = Effect.gen(function* reorderSubtasks() {
      const subtasks = yield* SubtaskManagement;
      return yield* subtasks.reorderSubtasks(
        actorId,
        task.id,
        secondSubtask.parentVersion,
        [secondSubtask.subtask.id, created.subtask.id, disposable.subtask.id]
      );
    });
    const reordered = await Effect.runPromise(
      Effect.provide(reorder, SubtaskManagementLive)
    );
    const listSubtasks = Effect.gen(function* listSubtasks() {
      const subtasks = yield* SubtaskManagement;
      return yield* subtasks.listSubtasks(actorId, task.id);
    });
    const orderedSubtasks = await Effect.runPromise(
      Effect.provide(listSubtasks, SubtaskManagementLive)
    );
    expect(reordered.parentVersion).toBe(6);
    expect(orderedSubtasks.map(({ id }) => id)).toEqual([
      secondSubtask.subtask.id,
      created.subtask.id,
      disposable.subtask.id,
    ]);
    const removeDisposable = Effect.gen(function* removeDisposable() {
      const subtasks = yield* SubtaskManagement;
      return yield* subtasks.removeSubtask(
        actorId,
        disposable.subtask.id,
        reordered.parentVersion
      );
    });
    const removal = await Effect.runPromise(
      Effect.provide(removeDisposable, SubtaskManagementLive)
    );
    const promote = Effect.gen(function* promoteSubtask() {
      const subtasks = yield* SubtaskManagement;
      return yield* subtasks.promoteSubtask(
        actorId,
        created.subtask.id,
        removal.parentVersion
      );
    });
    const promoted = await Effect.runPromise(
      Effect.provide(promote, SubtaskManagementLive)
    );

    expect(created.subtask.description).toBe("<p>Draft slides</p>");
    expect(created.parentVersion).toBe(2);
    expect(completed.subtask.completed).toBe(true);
    expect(removal.parentVersion).toBe(7);
    expect(promoted.id).not.toBe(task.id);
    expect(promoted.projectTaskNumber).toBe(2);
    expect(promoted.title).toBe("Draft slides");
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

it("allocates distinct project numbers when separate subtasks promote concurrently", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Concurrent Promoter", `${actorId}@subtask-concurrent.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `T${suffix.slice(0, 5)}`, "Concurrent promotion project"]
  );

  try {
    const parents = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* createParents() {
          const work = yield* WorkManagement;
          const first = yield* work.createTask(actorId, {
            assigneeIds: [],
            description: null,
            dueDate: null,
            priority: "none",
            projectId,
            title: "First parent",
          });
          const second = yield* work.createTask(actorId, {
            assigneeIds: [],
            description: null,
            dueDate: null,
            priority: "none",
            projectId,
            title: "Second parent",
          });
          return [first, second] as const;
        }),
        WorkManagementLive
      )
    );
    const subtasks = await Promise.all(
      parents.map((parent, index) =>
        Effect.runPromise(
          Effect.provide(
            Effect.gen(function* createSubtask() {
              const service = yield* SubtaskManagement;
              return yield* service.createSubtask(
                actorId,
                parent.id,
                parent.version,
                {
                  assigneeId: null,
                  description: null,
                  dueDate: null,
                  title: `Promoted item ${index}`,
                }
              );
            }),
            SubtaskManagementLive
          )
        )
      )
    );
    const promoted = await Promise.all(
      subtasks.map((subtask) =>
        Effect.runPromise(
          Effect.provide(
            Effect.gen(function* promote() {
              const service = yield* SubtaskManagement;
              return yield* service.promoteSubtask(
                actorId,
                subtask.subtask.id,
                subtask.parentVersion
              );
            }),
            SubtaskManagementLive
          )
        )
      )
    );

    expect(
      promoted.map(({ projectTaskNumber }) => projectTaskNumber).toSorted()
    ).toEqual([3, 4]);
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
