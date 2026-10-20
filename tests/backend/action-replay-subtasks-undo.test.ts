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
  replay,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { ActionFunction, Persona } from "./support/action-harness";

const calendar = await import("../../features/calendar/calendar-actions");
const comments = await import("../../features/tasks/actions/tasks-comments");
const companySettings =
  await import("../../features/settings/settings-actions");
const dashboard = await import("../../features/dashboard/dashboard-queries");
const discovery = await import("../../features/discovery/discovery-actions");
const employees = await import("../../features/people/people-actions");
const jobs = await import("../../features/settings/settings-queries");
const labels = await import("../../features/tasks/actions/tasks-labels");
const notifications =
  await import("../../features/notifications/notifications-actions");
const password = await import("../../features/user/actions/user-password");
const personalPreferences =
  await import("../../features/user/actions/user-personal-preferences");
const projects = await import("../../features/projects/projects-actions");
const savedViews =
  await import("../../features/projects/actions/projects-saved-views");
const sessions = await import("../../features/user/actions/user-sessions");
const subtasks = await import("../../features/tasks/actions/tasks-subtasks");
const tasks = await import("../../features/tasks/tasks-actions");
const teams = await import("../../features/people/actions/people-teams");
const uploads = await import("../../features/files/files-actions");
const { Idempotency, IdempotencyLive } =
  await import("../../src/server/core/idempotency");
const { Storage } = await import("../../src/server/storage/storage");
const { AvatarUploadResultSchema, FinalizedFileSchema, Uploads } =
  await import("../../src/server/storage/uploads-contracts");
const { UploadsLive } = await import("../../src/server/storage/uploads");

const unique = (): string => randomUUID().replaceAll("-", "").slice(0, 8);
const projectKey = (): string => `R${unique().slice(0, 6)}`.toUpperCase();

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
  const first = await replay(
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
  const renamed = await replay(
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
  const second = await replay(
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
  const reordered = await replay(
    "reorderSubtasksAction",
    "owner",
    subtasks.reorderSubtasksAction,
    {
      expectedTaskVersion: second.parentVersion,
      subtaskIds: [second.subtask.id, first.subtask.id],
      taskId: state.taskId,
    }
  );
  await replay("promoteSubtaskAction", "owner", subtasks.promoteSubtaskAction, {
    expectedTaskVersion: reordered.parentVersion,
    subtaskId: second.subtask.id,
  });
  await replay("removeSubtaskAction", "owner", subtasks.removeSubtaskAction, {
    expectedTaskVersion: await taskVersion(state.taskId),
    subtaskId: first.subtask.id,
  });

  const comment = await replay(
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
  const removal = await replay(
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
  const task = await replay(
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
  const completed = await replay(
    "updateTaskAction",
    "owner",
    tasks.updateTaskAction,
    {
      assigneeIds: [],
      description: null,
      dueDate: null,
      expectedVersion: task.version,
      priority: "medium",
      status: "done",
      taskId: task.id,
      title: "Replay completion task",
    }
  );
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

  const archived = await replay(
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
  await replay("restoreTaskAction", "admin", tasks.restoreTaskAction, {
    expectedVersion: await taskVersion(task.id),
    taskId: task.id,
  });
});
