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
  readonly dueAt?: string | null;
  readonly priority: TaskPriority;
  readonly projectId: string;
  readonly title: string;
}

export interface CreatedTask {
  readonly id: string;
  readonly number: number;
  readonly version: number;
}

type Api = MobileApi["Service"];

interface TypedClient {
  readonly createTask: (input: {
    readonly body: CreateTaskInput;
    readonly idempotencyKey: string;
  }) => Promise<CreatedTask>;
  readonly getTask: (input: { params: { readonly id: string } }) => Promise<TaskDetail>;
  readonly listSubtasks: (input: { params: { readonly id: string } }) => Promise<{ readonly subtasks: readonly Subtask[] }>;
  readonly listTasks: (input: { readonly query?: TasksQuery }) => Promise<TasksPage>;
  readonly setSubtaskStatus: (input: {
    readonly body: { readonly done: boolean; readonly expectedVersion: number };
    readonly idempotencyKey: string;
    readonly params: { readonly id: string; readonly subtaskId: string };
  }) => Promise<{ readonly done: boolean; readonly version: number }>;
  readonly setTaskStatus: (input: {
    readonly body: { readonly expectedVersion: number; readonly status: TaskStatus };
    readonly idempotencyKey: string;
    readonly params: { readonly id: string };
  }) => Promise<{ readonly status: TaskStatus; readonly version: number }>;
}

export const listTasks = (api: Api, query: TasksQuery = {}): Effect.Effect<TasksPage, AppFailure> =>
  api.call((client) => (client as unknown as TypedClient).listTasks({ query }));

export const getTask = (api: Api, id: string): Effect.Effect<TaskDetail, AppFailure> =>
  api.call((client) => (client as unknown as TypedClient).getTask({ params: { id } }));

export const listSubtasks = (
  api: Api,
  id: string,
): Effect.Effect<{ readonly subtasks: readonly Subtask[] }, AppFailure> =>
  api.call((client) => (client as unknown as TypedClient).listSubtasks({ params: { id } }));

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
      params: { id },
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
      params: { id, subtaskId },
    }),
  );
