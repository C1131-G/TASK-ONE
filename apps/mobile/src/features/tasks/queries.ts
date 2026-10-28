import type { Effect } from "effect";

import type { AppFailure } from "@/errors";
import type { MobileApi } from "@/services/mobile-api";

/**
 * Typed task queries and commands. The client's per-operation types are
 * unknown while the routes are pending, so these wrappers carry the
 * contract; the mock fixtures keep them honest until the routes land live.
 */

export type TaskStatus = "backlog" | "done" | "progress" | "review" | "todo";
export type TaskPriority = "high" | "low" | "medium" | "urgent";

export interface TaskSummary {
  readonly assigneeNames: readonly string[];
  readonly dueAt: string | null;
  readonly id: string;
  readonly priority: TaskPriority;
  readonly projectId: string;
  readonly projectName: string;
  readonly status: TaskStatus;
  readonly title: string;
  readonly version: number;
}

export interface TasksPage {
  readonly tasks: readonly TaskSummary[];
}

export interface Subtask {
  readonly done: boolean;
  readonly id: string;
  readonly title: string;
}

export interface TaskDetail {
  readonly assigneeNames: readonly string[];
  readonly commentsCount: number;
  readonly description: string | null;
  readonly dueAt: string | null;
  readonly id: string;
  readonly labels: readonly string[];
  readonly priority: TaskPriority;
  readonly projectId: string;
  readonly projectName: string;
  readonly status: TaskStatus;
  readonly subtasks: readonly Subtask[];
  readonly title: string;
  readonly version: number;
}

export interface TasksQuery {
  readonly projectId?: string;
  readonly search?: string;
  readonly status?: TaskStatus;
}

export interface CreateTaskInput {
  readonly assigneeIds: readonly string[];
  readonly dueDate?: string | null;
  readonly priority: TaskPriority;
  readonly projectId: string;
  readonly title: string;
}

export interface CreatedTask {
  readonly id: string;
  readonly reference: string;
  readonly version: number;
}

type Api = MobileApi["Service"];

/** The live page: rows name the due day `dueDate` and add a task reference. */
interface LiveTasksPage {
  readonly items: readonly {
    readonly assigneeNames: readonly string[];
    readonly dueDate: string | null;
    readonly id: string;
    readonly priority: "high" | "low" | "medium" | "none" | "urgent";
    readonly projectId: string;
    readonly projectName: string;
    readonly status: TaskStatus;
    readonly title: string;
    readonly version: number;
  }[];
  readonly nextCursor: string | null;
}

interface LiveTasksQuery {
  readonly projectId?: string;
  readonly status?: TaskStatus;
}

interface TypedClient {
  readonly createTask: (input: {
    readonly body: CreateTaskInput;
    readonly idempotencyKey: string;
  }) => Promise<CreatedTask>;
  readonly getTask: (input: { params: { readonly taskId: string } }) => Promise<TaskDetail>;
  readonly listSubtasks: (input: { params: { readonly taskId: string } }) => Promise<{ readonly subtasks: readonly Subtask[] }>;
  readonly listTasks: (input: { readonly query?: LiveTasksQuery }) => Promise<LiveTasksPage>;
  readonly setSubtaskStatus: (input: {
    readonly body: { readonly done: boolean; readonly expectedVersion: number };
    readonly idempotencyKey: string;
    readonly params: { readonly subtaskId: string; readonly taskId: string };
  }) => Promise<{ readonly done: boolean; readonly version: number }>;
  readonly setTaskStatus: (input: {
    readonly body: { readonly expectedVersion: number; readonly status: TaskStatus };
    readonly idempotencyKey: string;
    readonly params: { readonly taskId: string };
  }) => Promise<{ readonly status: TaskStatus; readonly version: number }>;
}

export const listTasks = (api: Api, query: TasksQuery = {}): Effect.Effect<TasksPage, AppFailure> =>
  api.call(async (client) => {
    const page = await (client as unknown as TypedClient).listTasks({
      query: {
        ...(query.projectId === undefined ? {} : { projectId: query.projectId }),
        ...(query.status === undefined ? {} : { status: query.status }),
      },
    });
    return {
      tasks: page.items.map((task) => ({
        assigneeNames: task.assigneeNames,
        dueAt: task.dueDate,
        id: task.id,
        priority: task.priority === "none" ? "low" : task.priority,
        projectId: task.projectId,
        projectName: task.projectName,
        status: task.status,
        title: task.title,
        version: task.version,
      })),
    };
  });

export const getTask = (api: Api, id: string): Effect.Effect<TaskDetail, AppFailure> =>
  api.call((client) => (client as unknown as TypedClient).getTask({ params: { taskId: id } }));

export const listSubtasks = (
  api: Api,
  id: string,
): Effect.Effect<{ readonly subtasks: readonly Subtask[] }, AppFailure> =>
  api.call((client) => (client as unknown as TypedClient).listSubtasks({ params: { taskId: id } }));

export const createTask = (
  api: Api,
  key: string,
  input: CreateTaskInput,
): Effect.Effect<CreatedTask, AppFailure> =>
  api.call((client) =>
    (client as unknown as TypedClient).createTask({ body: input, idempotencyKey: key }),
  );

export const setTaskStatus = (
  api: Api,
  key: string,
  id: string,
  expectedVersion: number,
  status: TaskStatus,
): Effect.Effect<{ readonly status: TaskStatus; readonly version: number }, AppFailure> =>
  api.call((client) =>
    (client as unknown as TypedClient).setTaskStatus({
      body: { expectedVersion, status },
      idempotencyKey: key,
      params: { taskId: id },
    }),
  );

export const setSubtaskStatus = (
  api: Api,
  key: string,
  id: string,
  subtaskId: string,
  expectedVersion: number,
  done: boolean,
): Effect.Effect<{ readonly done: boolean; readonly version: number }, AppFailure> =>
  api.call((client) =>
    (client as unknown as TypedClient).setSubtaskStatus({
      body: { done, expectedVersion },
      idempotencyKey: key,
      params: { subtaskId, taskId: id },
    }),
  );
