import { afterAll, beforeAll, expect, it } from "bun:test";

import { adminOnlyNames, allActions } from "./action-permissions-catalog";
import {
  collectViolations,
  subtaskBody,
  taskBody,
} from "./action-permissions-shared";
import {
  callAs,
  ids,
  nextKey,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type {
  ActionFunction,
  ActionResultLike,
} from "./support/action-harness";
import { serverEntryModules } from "./support/server-entry-modules";

const comments = await import("../../features/tasks/actions/task-comments");
const password = await import("../../features/user/actions/password");
const projects = await import("../../features/projects/projects-actions");
const subtasks = await import("../../features/tasks/actions/subtasks");
const tasks = await import("../../features/tasks/tasks-actions");
const userQueries = await import("../../features/user/user-queries");

beforeAll(setupHarness);
afterAll(teardownHarness);

// Actions that require an administrator. An ordinary employee must be refused
// even though the request is otherwise well formed.

const rejectedWith =
  (...codes: string[]) =>
  (result: ActionResultLike): boolean =>
    !result.ok && codes.includes(result.error?.code ?? "");

// Server-side helpers that only combine catalogued reads (and so inherit their
// session checks); they take no request input of their own.
const composedReads = new Set([
  "listAllEmployees",
  "listAllProjectTasks",
  "listAllProjects",
  "listAllTeams",
  "listProjectTaskPages",
]);

it("covers every Server Action and query exported by the features", () => {
  const exported = new Set<string>();
  for (const actionModule of serverEntryModules) {
    for (const name of Object.keys(actionModule)) {
      exported.add(name);
    }
  }
  const covered = new Set([
    ...allActions.map(({ name }) => name),
    ...composedReads,
  ]);
  // Reads with their own dedicated shape of input are listed explicitly.
  const missing = [...exported].filter((name) => !covered.has(name));
  expect(missing).toEqual([]);
});

it("rejects anonymous requests on every action", async () => {
  const violations = await collectViolations(
    "anonymous",
    allActions,
    rejectedWith("UNAUTHENTICATED")
  );
  expect(violations).toEqual([]);
});

it("rejects deactivated accounts on every action", async () => {
  const violations = await collectViolations(
    "deactivated",
    allActions,
    rejectedWith("UNAUTHENTICATED")
  );
  expect(violations).toEqual([]);
});

it("blocks accounts that must change their password from every workspace action", async () => {
  const workspaceActions = allActions.filter(({ authOnly }) => !authOnly);
  const violations = await collectViolations(
    "forced",
    workspaceActions,
    rejectedWith("FORBIDDEN")
  );
  expect(violations).toEqual([]);
});

it("lets accounts that must change their password reach the onboarding actions only", async () => {
  const sessionList = await callAs("forced", userQueries.listMySessions, {});
  expect(sessionList.ok).toBe(true);
  const wrongPassword = await callAs(
    "forced",
    password.changeOwnPasswordAction,
    { currentPassword: "not-the-password", newPassword: "another-secret-9!" }
  );
  // The request reaches the password check instead of the onboarding gate.
  if (wrongPassword.ok) {
    throw new Error("The forced-change request unexpectedly succeeded.");
  }
  expect(wrongPassword.error?.message ?? "").not.toContain(
    "Change your password before continuing."
  );
});

it("refuses administrator-only actions for an ordinary employee", async () => {
  const adminEntries = allActions.filter(({ name }) =>
    adminOnlyNames.includes(name)
  );
  expect(adminEntries).toHaveLength(adminOnlyNames.length);
  const violations = await collectViolations(
    "owner",
    adminEntries,
    rejectedWith("FORBIDDEN")
  );
  expect(violations).toEqual([]);
});

it("refuses task, subtask, and file edits from an employee who neither owns nor is assigned the work", async () => {
  const names = [
    "updateTaskAction",
    "changeTaskColumnAction",
    "setTaskRecurrenceAction",
    "moveTaskAction",
    "duplicateTaskAction",
    "bulkUpdateTasksAction",
    "setTaskRelationsAction",
    "reorderTasksAction",
    "createSubtaskAction",
    "renameFileAction",
    "removeFileAction",
    "duplicateFileAction",
  ];
  const guarded = allActions.filter(({ name }) => names.includes(name));
  expect(guarded).toHaveLength(names.length);
  const violations = await collectViolations(
    "outsider",
    guarded,
    rejectedWith("FORBIDDEN", "NOT_FOUND")
  );
  expect(violations).toEqual([]);
});

it("lets the owner of a task through the same edit actions the outsider was refused", async () => {
  const update = await callAs("owner", tasks.updateTaskAction, {
    ...taskBody(),
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    status: "todo",
    taskId: ids.taskId,
  });
  expect(update).toMatchObject({ ok: true });
});

it("enforces ownership on comments and subtasks created by someone else", async () => {
  const comment = await callAs("owner", comments.createCommentAction, {
    body: "Owner comment",
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
  });
  if (!comment.ok) {
    throw new Error("The task owner could not create a comment.");
  }
  const commentId = comment.data.id;
  const removeByOutsider = await callAs(
    "outsider",
    comments.removeCommentAction,
    {
      commentId,
      idempotencyKey: nextKey(),
    }
  );
  expect(removeByOutsider).toMatchObject({
    error: { code: expect.stringMatching(/FORBIDDEN|NOT_FOUND/u) },
    ok: false,
  });

  const subtask = await callAs("owner", subtasks.createSubtaskAction, {
    ...subtaskBody(),
    expectedTaskVersion: 2,
    taskId: ids.taskId,
  });
  if (!subtask.ok) {
    throw new Error("The task owner could not create a subtask.");
  }
  const created = subtask.data;
  for (const [action, extra] of [
    [subtasks.updateSubtaskAction, { completed: false, title: "Hijacked" }],
    [subtasks.removeSubtaskAction, {}],
    [subtasks.promoteSubtaskAction, {}],
  ] as const) {
    // Sequential on purpose: the persona headers are shared.
    // eslint-disable-next-line no-await-in-loop
    const result = await callAs("outsider", action as ActionFunction, {
      assigneeId: null,
      description: null,
      dueDate: null,
      expectedTaskVersion: created.parentVersion,
      idempotencyKey: nextKey(),
      subtaskId: created.subtask.id,
      title: "Hijacked",
      ...extra,
    });
    expect(result).toMatchObject({
      error: { code: expect.stringMatching(/FORBIDDEN|NOT_FOUND/u) },
      ok: false,
    });
  }
});

it("refuses edits to archived work even for the owner and for administrators", async () => {
  const archivedTaskEdit = await callAs("owner", tasks.updateTaskAction, {
    ...taskBody(),
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    status: "todo",
    taskId: ids.archivedTaskId,
  });
  expect(archivedTaskEdit).toMatchObject({
    error: { code: "FORBIDDEN" },
    ok: false,
  });

  const archivedTaskByAdmin = await callAs("admin", tasks.updateTaskAction, {
    ...taskBody(),
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    status: "todo",
    taskId: ids.archivedTaskId,
  });
  expect(archivedTaskByAdmin).toMatchObject({ ok: false });

  const taskInArchivedProject = await callAs("owner", tasks.createTaskAction, {
    ...taskBody(),
    idempotencyKey: nextKey(),
    projectId: ids.archivedProjectId,
  });
  expect(taskInArchivedProject).toMatchObject({ ok: false });

  const archivedProjectEdit = await callAs(
    "admin",
    projects.updateProjectAction,
    {
      description: null,
      expectedVersion: 1,
      idempotencyKey: nextKey(),
      name: "Should not change",
      projectId: ids.archivedProjectId,
      status: "planning",
    }
  );
  expect(archivedProjectEdit).toMatchObject({
    error: { code: "FORBIDDEN" },
    ok: false,
  });

  const moveIntoArchivedProject = await callAs("owner", tasks.moveTaskAction, {
    destinationProjectId: ids.archivedProjectId,
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
  });
  expect(moveIntoArchivedProject).toMatchObject({ ok: false });
});
