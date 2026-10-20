import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { sanitizeDescription } from "../../src/server/work/sanitize-description";
import { TASK_DESCRIPTION_MAX_LENGTH } from "../../src/server/work/work-contracts";
import type { CreateTaskInput } from "../../src/server/work/work-management";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const actorId = randomUUID();
const projectId = randomUUID();
const taskIds: string[] = [];

const XSS_DESCRIPTION =
  '<p onclick="steal()">Safe <strong>text</strong></p><script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">bad</a><a href="https://example.com" onmouseover="alert(4)">good</a>';

const taskInput = (description: string | null): CreateTaskInput => ({
  assigneeIds: [],
  description,
  dueDate: null,
  priority: "none",
  projectId,
  title: "Description hardening",
});

const runWork = <Success, Failure>(
  program: Effect.Effect<Success, Failure, WorkManagement>
): Promise<Success> =>
  Effect.runPromise(Effect.provide(program, WorkManagementLive));

beforeAll(async () => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [
      actorId,
      "Description Editor",
      `${actorId}@task-description.example`,
      "admin",
    ]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `D${randomUUID().slice(0, 6)}`, "Description project"]
  );
});

afterAll(async () => {
  await authPool.query(
    'DELETE FROM activity WHERE "taskId"::text = ANY($1::text[])',
    [taskIds]
  );
  await authPool.query("DELETE FROM task WHERE id::text = ANY($1::text[])", [
    taskIds,
  ]);
  await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
});

it("strips scripts, event handlers and unsafe links from descriptions", () => {
  const sanitized = sanitizeDescription(XSS_DESCRIPTION) ?? "";

  expect(sanitized).not.toContain("<script");
  expect(sanitized).not.toContain("alert(1)");
  expect(sanitized).not.toContain("<img");
  expect(sanitized).not.toMatch(/\son\w+=/u);
  expect(sanitized).not.toMatch(/javascript/u);
  expect(sanitized).toContain("<p>Safe <strong>text</strong></p>");
  expect(sanitized).toContain('<a href="https://example.com">good</a>');
  expect(sanitizeDescription(null)).toBeNull();
});

it("stores a sanitized description on create and update", async () => {
  const task = await runWork(
    Effect.gen(function* createXssTask() {
      const work = yield* WorkManagement;
      return yield* work.createTask(actorId, taskInput(XSS_DESCRIPTION));
    })
  );
  taskIds.push(task.id);

  const created = await authPool.query<{ description: string | null }>(
    "SELECT description FROM task WHERE id = $1",
    [task.id]
  );
  expect(created.rows[0]?.description).toBe(
    sanitizeDescription(XSS_DESCRIPTION)
  );

  await runWork(
    Effect.gen(function* updateXssTask() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(actorId, task.id, task.version, {
        assigneeIds: [],
        description: '<em>edited</em><svg onload="alert(5)"></svg>',
        dueDate: null,
        priority: "none",
        status: "todo",
        title: task.title,
      });
    })
  );
  const updated = await authPool.query<{ description: string | null }>(
    "SELECT description FROM task WHERE id = $1",
    [task.id]
  );
  expect(updated.rows[0]?.description).toBe("<em>edited</em>");
});

it("rejects descriptions over the length limit", async () => {
  const tooLong = "a".repeat(TASK_DESCRIPTION_MAX_LENGTH + 1);

  const createError = await runWork(
    Effect.gen(function* createTooLongTask() {
      const work = yield* WorkManagement;
      return yield* Effect.flip(work.createTask(actorId, taskInput(tooLong)));
    })
  );
  expect(createError.code).toBe("VALIDATION_FAILED");

  const task = await runWork(
    Effect.gen(function* createMaxLengthTask() {
      const work = yield* WorkManagement;
      return yield* work.createTask(
        actorId,
        taskInput("a".repeat(TASK_DESCRIPTION_MAX_LENGTH))
      );
    })
  );
  taskIds.push(task.id);

  const updateError = await runWork(
    Effect.gen(function* updateTooLongTask() {
      const work = yield* WorkManagement;
      return yield* Effect.flip(
        work.updateTask(actorId, task.id, task.version, {
          assigneeIds: [],
          description: tooLong,
          dueDate: null,
          priority: "none",
          status: "todo",
          title: task.title,
        })
      );
    })
  );
  expect(updateError.code).toBe("VALIDATION_FAILED");
});
