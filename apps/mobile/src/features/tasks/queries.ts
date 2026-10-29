import type { Effect } from "effect";

import type {
  MobileMyWork,
  MobileTaskChange,
  MobileTaskChangeBody,
  MobileTaskContext,
  MobileTaskCreateBody,
} from "@api/routes-tasks";
import type { AppFailure } from "@/errors";
import type { MobileApi } from "@/services/mobile-api";

/**
 * Typed task queries and commands. Every task route is live and read straight
 * from the shared client; the all-tasks list is reshaped into the rows the
 * screens use.
 */

export type TaskStatus = MobileTaskContext["status"];
export type TaskPriority = MobileTaskContext["priority"];
export type MyWorkScope = "assigned" | "due" | "overdue";

export type { MobileMyWork, MobileTaskChange, MobileTaskContext };

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

export interface TasksQuery {
  readonly projectId?: string;
  readonly search?: string;
  readonly status?: TaskStatus;
}

type Api = MobileApi["Service"];

export const getMyWork = (
  api: Api,
  scope?: MyWorkScope,
): Effect.Effect<MobileMyWork, AppFailure> =>
  api.call((client) => client.getMyWork({ query: scope === undefined ? {} : { scope } }));

export const getTaskContext = (
  api: Api,
  taskId: string,
): Effect.Effect<MobileTaskContext, AppFailure> =>
  api.call((client) => client.getTaskContext({ params: { taskId } }));

export const changeTask = (
  api: Api,
  key: string,
  taskId: string,
  body: MobileTaskChangeBody,
): Effect.Effect<MobileTaskChange, AppFailure> =>
  api.call((client) => client.changeTask({ body, idempotencyKey: key, params: { taskId } }));

export const createTask = (
  api: Api,
  key: string,
  body: MobileTaskCreateBody,
): Effect.Effect<MobileTaskChange, AppFailure> =>
  api.call((client) => client.createTask({ body, idempotencyKey: key }));

export const listTasks = (api: Api, query: TasksQuery = {}): Effect.Effect<TasksPage, AppFailure> =>
  api.call(async (client) => {
    const page = await client.listTasks({
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
        priority: task.priority,
        projectId: task.projectId,
        projectName: task.projectName,
        status: task.status,
        title: task.title,
        version: task.version,
      })),
    };
  });

export const setSubtaskStatus = (
  api: Api,
  key: string,
  taskId: string,
  subtaskId: string,
  expectedVersion: number,
  done: boolean,
): Effect.Effect<{ readonly done: boolean; readonly version: number }, AppFailure> =>
  api.call((client) =>
    client.setSubtaskStatus({
      body: { done, expectedVersion },
      idempotencyKey: key,
      params: { subtaskId, taskId },
    }),
  );
