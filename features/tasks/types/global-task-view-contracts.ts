import type { TaskTableColumnId } from "../task-table-columns";

export const GLOBAL_TASK_STATUSES = [
  "backlog",
  "todo",
  "progress",
  "review",
  "done",
] as const;
export const GLOBAL_TASK_PRIORITIES = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
] as const;
export const GLOBAL_TASK_SORTS = ["due", "priority", "title"] as const;
export const GLOBAL_TASK_GROUPS = [
  "status",
  "project",
  "assignee",
  "priority",
  "none",
] as const;
export const GLOBAL_TASK_VIEWS = ["list", "board", "table"] as const;
export const MY_TASK_VIEWS = ["list", "calendar"] as const;
export const CALENDAR_MODES = ["month", "week"] as const;

export type GlobalTaskSort = (typeof GLOBAL_TASK_SORTS)[number];
export type GlobalTaskGroup = (typeof GLOBAL_TASK_GROUPS)[number];

export interface GlobalTaskSearch {
  readonly q: string;
  readonly status: string;
  readonly priority: string;
  readonly sort: string;
  readonly group: string;
  readonly view: string;
  readonly overdue: string;
  readonly hidden: string;
  readonly calendarMode: string;
  readonly monthOffset: string;
}

export interface NormalizedGlobalTaskSearch {
  readonly q: string;
  readonly status: (typeof GLOBAL_TASK_STATUSES)[number] | "all";
  readonly priority: (typeof GLOBAL_TASK_PRIORITIES)[number] | "all";
  readonly sort: GlobalTaskSort;
  readonly group: GlobalTaskGroup;
  readonly view: string;
  readonly overdue: boolean;
  readonly hidden: readonly TaskTableColumnId[];
  readonly calendarMode: (typeof CALENDAR_MODES)[number];
  readonly monthOffset: number;
}

export interface GlobalTaskLike {
  readonly assignees: readonly { readonly name: string }[];
  readonly dueDate: string | null;
  readonly id: string;
  readonly priority: string;
  readonly projectKey: string;
  readonly projectName: string;
  readonly status: string;
  readonly title: string;
}
