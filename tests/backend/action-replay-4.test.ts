/* eslint-disable no-unused-vars */
import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import {
  authPool,
  callAs,
  EMAIL_DOMAIN,
  ids,
  nextKey,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { ActionFunction, Persona } from "./support/action-harness";

const calendar = await import("../../app/actions/calendar");
const comments = await import("../../app/actions/comments");
const companySettings = await import("../../app/actions/company-settings");
const dashboard = await import("../../app/actions/dashboard");
const discovery = await import("../../app/actions/discovery");
const employees = await import("../../app/actions/employees");
const jobs = await import("../../app/actions/jobs");
const labels = await import("../../app/actions/labels");
const notifications = await import("../../app/actions/notifications");
const password = await import("../../app/actions/password");
const personalPreferences =
  await import("../../app/actions/personal-preferences");
const projects = await import("../../app/actions/projects");
const savedViews = await import("../../app/actions/saved-views");
const sessions = await import("../../app/actions/sessions");
const subtasks = await import("../../app/actions/subtasks");
const tasks = await import("../../app/actions/tasks");
const teams = await import("../../app/actions/teams");
const uploads = await import("../../app/actions/uploads");
const { Idempotency, IdempotencyLive } =
  await import("../../src/server/core/idempotency");
const { Storage } = await import("../../src/server/storage/storage");
const { AvatarUploadResultSchema, FinalizedFileSchema, Uploads } =
  await import("../../src/server/storage/uploads-contracts");
const { UploadsLive } = await import("../../src/server/storage/uploads");

const unique = (): string => randomUUID().replaceAll("-", "").slice(0, 8);
const projectKey = (): string => `R${unique().slice(0, 6)}`.toUpperCase();

/**
 * Runs an action twice with the same idempotency key and checks that the
 * second call replays the first result exactly instead of acting again.
 */
const replay = async <Data>(
  name: string,
  persona: Persona,
  action: unknown,
  input: Record<string, unknown>
): Promise<Data> => {
  const idempotencyKey = nextKey();
  const run = () =>
    callAs(persona, action as ActionFunction, { ...input, idempotencyKey });
  const first = await run();
  if (!first.ok) {
    throw new Error(
      `${name} failed on the first call: ${first.error?.code} ${first.error?.message}`
    );
  }
  const second = await run();
  if (!second.ok) {
    throw new Error(
      `${name} failed on the replay: ${second.error?.code} ${second.error?.message}`
    );
  }
  expect(JSON.stringify(second.data), `${name} replay result`).toBe(
    JSON.stringify(first.data)
  );
  return first.data as Data;
};

const taskVersion = async (taskId: string): Promise<number> => {
  const rows = await authPool.query("SELECT version FROM task WHERE id = $1", [
    taskId,
  ]);
  return rows.rows[0]?.version;
};

interface Versioned {
  readonly id: string;
  readonly version: number;
}
interface VersionOnly {
  readonly version: number;
}
interface SubtaskResult {
  readonly parentVersion: number;
  readonly subtask: { readonly id: string };
}

const state: {
  copyProjectId: string;
  projectId: string;
  taskId: string;
} = { copyProjectId: "", projectId: "", taskId: "" };

beforeAll(async () => {
  await setupHarness();
  state.projectId = ids.projectId;
  state.taskId = ids.taskId;
});
afterAll(teardownHarness);

it("replays every subtask and comment mutation", async () => {
  const subtaskBody = {
    assigneeId: null,
    description: null,
    dueDate: null,
  };
  const first = await replay<SubtaskResult>(
    "createSubtaskAction",
    "owner",
    subtasks.createSubtaskAction,
    {
      ...subtaskBody,
      expectedTaskVersion: await taskVersion(state.taskId),
      taskId: state.taskId,
      title: "Replay subtask one",
    }
  );
  const renamed = await replay<SubtaskResult>(
    "updateSubtaskAction",
    "owner",
    subtasks.updateSubtaskAction,
    {
      ...subtaskBody,
      completed: false,
      expectedTaskVersion: first.parentVersion,
      subtaskId: first.subtask.id,
      title: "Replay subtask one renamed",
    }
  );
  const second = await replay<SubtaskResult>(
    "createSubtaskAction",
    "owner",
    subtasks.createSubtaskAction,
    {
      ...subtaskBody,
      expectedTaskVersion: renamed.parentVersion,
      taskId: state.taskId,
      title: "Replay subtask two",
    }
  );
  const reordered = await replay<{
    parentVersion: number;
    subtasks: readonly { id: string }[];
  }>("reorderSubtasksAction", "owner", subtasks.reorderSubtasksAction, {
    expectedTaskVersion: second.parentVersion,
    subtaskIds: [second.subtask.id, first.subtask.id],
    taskId: state.taskId,
  });
  await replay("promoteSubtaskAction", "owner", subtasks.promoteSubtaskAction, {
    expectedTaskVersion: reordered.parentVersion,
    subtaskId: second.subtask.id,
  });
  await replay("removeSubtaskAction", "owner", subtasks.removeSubtaskAction, {
    expectedTaskVersion: await taskVersion(state.taskId),
    subtaskId: first.subtask.id,
  });

  const comment = await replay<{ id: string }>(
    "createCommentAction",
    "owner",
    comments.createCommentAction,
    { body: "Replay comment", taskId: state.taskId }
  );
  await replay(
    "toggleCommentReactionAction",
    "owner",
    comments.toggleCommentReactionAction,
    { commentId: comment.id, emoji: "👍" }
  );
  const removal = await replay<{ undoId: string }>(
    "removeCommentAction",
    "owner",
    comments.removeCommentAction,
    { commentId: comment.id }
  );
  await replay(
    "undoCommentRemovalAction",
    "owner",
    comments.undoCommentRemovalAction,
    { undoId: removal.undoId }
  );
});

it("replays task completion, archive, restore, and both Undo actions", async () => {
  const task = await replay<Versioned>(
    "createTaskAction",
    "owner",
    tasks.createTaskAction,
    {
      assigneeIds: [],
      description: null,
      dueDate: null,
      priority: "medium",
      projectId: ids.projectId,
      title: "Replay completion task",
    }
  );
  const completed = await replay<{
    completionUndo?: { undoId: string };
  }>("updateTaskAction", "owner", tasks.updateTaskAction, {
    assigneeIds: [],
    description: null,
    dueDate: null,
    expectedVersion: task.version,
    priority: "medium",
    status: "done",
    taskId: task.id,
    title: "Replay completion task",
  });
  const { completionUndo } = completed;
  if (!completionUndo) {
    throw new Error("Completing a task should return an Undo receipt.");
  }
  await replay(
    "undoTaskCompletionAction",
    "owner",
    tasks.undoTaskCompletionAction,
    { undoId: completionUndo.undoId }
  );

  const archived = await replay<{ undoId: string }>(
    "archiveTaskAction",
    "admin",
    tasks.archiveTaskAction,
    { expectedVersion: await taskVersion(task.id), taskId: task.id }
  );
  await replay("undoTaskArchiveAction", "admin", tasks.undoTaskArchiveAction, {
    undoId: archived.undoId,
  });
  await replay("archiveTaskAction", "admin", tasks.archiveTaskAction, {
    expectedVersion: await taskVersion(task.id),
    taskId: task.id,
  });
  await replay<Versioned>(
    "restoreTaskAction",
    "admin",
    tasks.restoreTaskAction,
    {
      expectedVersion: await taskVersion(task.id),
      taskId: task.id,
    }
  );
});
