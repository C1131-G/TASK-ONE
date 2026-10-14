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
const comments = await import("../../features/tasks/actions/task-comments");
const companySettings = await import("../../features/company/company-actions");
const dashboard = await import("../../features/dashboard/dashboard-queries");
const discovery = await import("../../features/discovery/discovery-actions");
const employees = await import("../../features/people/people-actions");
const jobs = await import("../../features/jobs/jobs-queries");
const labels = await import("../../features/tasks/actions/labels");
const notifications =
  await import("../../features/notifications/notifications-actions");
const password = await import("../../features/user/actions/password");
const personalPreferences =
  await import("../../features/user/actions/personal-preferences");
const projects = await import("../../features/projects/projects-actions");
const savedViews = await import("../../features/projects/actions/saved-views");
const sessions = await import("../../features/user/actions/sessions");
const subtasks = await import("../../features/tasks/actions/subtasks");
const tasks = await import("../../features/tasks/tasks-actions");
const teams = await import("../../features/people/actions/teams");
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
  const destinationProject = await replay(
    "createProjectAction",
    "admin",
    projects.createProjectAction,
    {
      description: null,
      key: projectKey(),
      name: "Replay destination",
      status: "planning",
    }
  );
  state.projectId = destinationProject.id;
  state.taskId = ids.taskId;
});
afterAll(teardownHarness);

it("replays every task mutation", async () => {
  const task = await replay(
    "createTaskAction",
    "owner",
    tasks.createTaskAction,
    {
      assigneeIds: [],
      description: null,
      dueDate: "2026-12-01",
      priority: "medium",
      projectId: ids.projectId,
      title: "Replay task",
    }
  );
  state.taskId = task.id;
  const updated = await replay(
    "updateTaskAction",
    "owner",
    tasks.updateTaskAction,
    {
      assigneeIds: [],
      description: null,
      dueDate: "2026-12-01",
      expectedVersion: task.version,
      priority: "high",
      status: "todo",
      taskId: task.id,
      title: "Replay task renamed",
    }
  );
  const column = await replay(
    "changeTaskColumnAction",
    "owner",
    tasks.changeTaskColumnAction,
    {
      expectedVersion: updated.version,
      status: "progress",
      taskId: task.id,
    }
  );
  const recurrence = await replay(
    "setTaskRecurrenceAction",
    "owner",
    tasks.setTaskRecurrenceAction,
    {
      expectedVersion: column.version,
      recurrence: {
        endsOn: null,
        frequency: "daily",
        interval: 1,
        weekDays: [],
      },
      taskId: task.id,
    }
  );
  const related = await replay(
    "setTaskRelationsAction",
    "owner",
    tasks.setTaskRelationsAction,
    {
      dependencyTaskIds: [],
      expectedVersion: recurrence.version,
      labelIds: [],
      taskId: task.id,
    }
  );
  const copy = await replay(
    "duplicateTaskAction",
    "owner",
    tasks.duplicateTaskAction,
    { expectedVersion: related.version, taskId: task.id }
  );
  const bulk = await replay(
    "bulkUpdateTasksAction",
    "owner",
    tasks.bulkUpdateTasksAction,
    {
      changes: {
        assigneeIds: [],
        dueDate: null,
        priority: "low",
        status: "todo",
      },
      targets: [{ expectedVersion: copy.version, taskId: copy.id }],
    }
  );
  const ordered = await replay(
    "reorderTasksAction",
    "owner",
    tasks.reorderTasksAction,
    {
      changes: [
        {
          expectedVersion: bulk[0]?.version ?? 0,
          position: 7,
          taskId: copy.id,
        },
      ],
    }
  );
  await replay("moveTaskAction", "owner", tasks.moveTaskAction, {
    destinationProjectId: state.projectId,
    expectedVersion: ordered[0]?.version ?? 0,
    taskId: copy.id,
  });
});
