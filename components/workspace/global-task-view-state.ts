// View state for the workspace task pages (/tasks and /my-tasks). The URL, the
// store and the server page all read the same vocabulary from here, so a saved
// link, a tab or a month navigation keeps every filter the user set.
import type { TaskTableColumnId } from "./task-table-columns";
import {
  GLOBAL_HIDEABLE_COLUMNS,
  parseHiddenColumns,
  serializeHiddenColumns,
} from "./task-table-columns";

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

const MAX_QUERY_LENGTH = 200;
const MAX_MONTH_OFFSET = 24;

export type GlobalTaskSort = (typeof GLOBAL_TASK_SORTS)[number];
export type GlobalTaskGroup = (typeof GLOBAL_TASK_GROUPS)[number];

// Raw form: what the URL and the filter controls hold. Strings only, defaults
// filled in, values not yet validated.
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

// Defaults are omitted from the URL so a plain /tasks link stays clean.
export const defaultGlobalTaskSearch: GlobalTaskSearch = {
  calendarMode: "month",
  group: "status",
  hidden: "",
  monthOffset: "0",
  overdue: "",
  priority: "all",
  q: "",
  sort: "due",
  status: "all",
  view: "list",
};

const pick = <Value extends string>(
  values: readonly Value[],
  value: string | null | undefined
): Value | undefined => values.find((item) => item === value);

// Older links used "name" for the title sort; it maps to the same field.
const SORT_ALIASES: Readonly<Record<string, string>> = { name: "title" };

export const readGlobalTaskSearchRaw = (
  params: URLSearchParams
): GlobalTaskSearch => {
  const sortParam = params.get("sort");
  return {
    calendarMode:
      params.get("calendarMode") ?? defaultGlobalTaskSearch.calendarMode,
    group: params.get("group") ?? defaultGlobalTaskSearch.group,
    hidden: params.get("hidden") ?? defaultGlobalTaskSearch.hidden,
    monthOffset:
      params.get("monthOffset") ?? defaultGlobalTaskSearch.monthOffset,
    overdue: params.get("overdue") ?? defaultGlobalTaskSearch.overdue,
    priority: params.get("priority") ?? defaultGlobalTaskSearch.priority,
    q: params.get("q") ?? defaultGlobalTaskSearch.q,
    sort:
      SORT_ALIASES[sortParam ?? ""] ??
      sortParam ??
      defaultGlobalTaskSearch.sort,
    status: params.get("status") ?? defaultGlobalTaskSearch.status,
    view: params.get("view") ?? defaultGlobalTaskSearch.view,
  };
};

// Keeps unrelated params (for example a saved view or a deep link) and writes
// the search fields, dropping any field that is at its default.
export const writeGlobalTaskSearch = (
  params: URLSearchParams,
  search: GlobalTaskSearch
): URLSearchParams => {
  const next = new URLSearchParams(params);
  for (const key of Object.keys(
    defaultGlobalTaskSearch
  ) as (keyof GlobalTaskSearch)[]) {
    const value = search[key];
    if (value === defaultGlobalTaskSearch[key] || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next;
};

export const globalTaskHref = (
  pathname: string,
  search: GlobalTaskSearch,
  patch: Partial<GlobalTaskSearch> = {}
): string => {
  const query = writeGlobalTaskSearch(new URLSearchParams(), {
    ...search,
    ...patch,
  }).toString();
  return query ? `${pathname}?${query}` : pathname;
};

export const isSameGlobalTaskSearch = (
  first: GlobalTaskSearch,
  second: GlobalTaskSearch
): boolean =>
  writeGlobalTaskSearch(new URLSearchParams(), first).toString() ===
  writeGlobalTaskSearch(new URLSearchParams(), second).toString();

export const normalizeGlobalTaskSearch = (
  raw: GlobalTaskSearch,
  views: readonly string[]
): NormalizedGlobalTaskSearch => {
  const offset = Number(raw.monthOffset);
  return {
    calendarMode: pick(CALENDAR_MODES, raw.calendarMode) ?? "month",
    group: pick(GLOBAL_TASK_GROUPS, raw.group) ?? "status",
    hidden: parseHiddenColumns(raw.hidden, GLOBAL_HIDEABLE_COLUMNS),
    monthOffset: Number.isInteger(offset)
      ? Math.max(-MAX_MONTH_OFFSET, Math.min(MAX_MONTH_OFFSET, offset))
      : 0,
    overdue: raw.overdue === "true",
    priority: pick(GLOBAL_TASK_PRIORITIES, raw.priority) ?? "all",
    q: raw.q.trim().toLocaleLowerCase().slice(0, MAX_QUERY_LENGTH),
    sort: pick(GLOBAL_TASK_SORTS, raw.sort) ?? "due",
    status: pick(GLOBAL_TASK_STATUSES, raw.status) ?? "all",
    view: pick(views, raw.view) ?? views[0] ?? "list",
  };
};

export const serializeGlobalTaskHidden = (
  ids: readonly TaskTableColumnId[]
): string => serializeHiddenColumns(ids, GLOBAL_HIDEABLE_COLUMNS);

// Shape the filter and grouping functions need from a task row.
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

export const GLOBAL_TASK_PRIORITY_ORDER: Readonly<Record<string, number>> = {
  high: 1,
  low: 3,
  medium: 2,
  none: 4,
  urgent: 0,
};

const STATUS_LABELS: Readonly<Record<string, string>> = {
  backlog: "Backlog",
  done: "Done",
  progress: "In Progress",
  review: "Review",
  todo: "To Do",
};

export const filterGlobalTasks = <Task extends GlobalTaskLike>(
  tasks: readonly Task[],
  search: NormalizedGlobalTaskSearch,
  today: string
): Task[] =>
  tasks.filter((task) => {
    if (search.status !== "all" && task.status !== search.status) {
      return false;
    }
    if (search.priority !== "all" && task.priority !== search.priority) {
      return false;
    }
    if (
      search.q &&
      !`${task.title} ${task.projectName} ${task.projectKey}`
        .toLocaleLowerCase()
        .includes(search.q)
    ) {
      return false;
    }
    if (
      search.overdue &&
      (task.status === "done" || !task.dueDate || task.dueDate >= today)
    ) {
      return false;
    }
    return true;
  });

export const sortGlobalTasks = <Task extends GlobalTaskLike>(
  tasks: readonly Task[],
  sort: GlobalTaskSort
): Task[] =>
  tasks.toSorted((left, right) => {
    if (sort === "title") {
      return left.title.localeCompare(right.title);
    }
    if (sort === "priority") {
      return (
        (GLOBAL_TASK_PRIORITY_ORDER[left.priority] ?? 5) -
        (GLOBAL_TASK_PRIORITY_ORDER[right.priority] ?? 5)
      );
    }
    return (left.dueDate ?? "9999-12-31").localeCompare(
      right.dueDate ?? "9999-12-31"
    );
  });

export interface GlobalTaskGroupOf<Task> {
  readonly key: string;
  readonly label: string;
  readonly tasks: readonly Task[];
}

export const groupGlobalTasks = <Task extends GlobalTaskLike>(
  tasks: readonly Task[],
  group: GlobalTaskGroup
): readonly GlobalTaskGroupOf<Task>[] => {
  if (group === "none") {
    return [{ key: "all", label: "All tasks", tasks }];
  }
  const grouped = new Map<string, Task[]>();
  for (const task of tasks) {
    let value: string;
    if (group === "status") {
      value = task.status;
    } else if (group === "project") {
      value = task.projectName;
    } else if (group === "assignee") {
      value = task.assignees[0]?.name ?? "Unassigned";
    } else {
      value = task.priority;
    }
    const values = grouped.get(value) ?? [];
    values.push(task);
    grouped.set(value, values);
  }
  const statusOrder: readonly string[] = GLOBAL_TASK_STATUSES;
  const keys = [...grouped.keys()].toSorted((left, right) => {
    if (group === "status") {
      return statusOrder.indexOf(left) - statusOrder.indexOf(right);
    }
    return left.localeCompare(right);
  });
  return keys.map((key) => ({
    key,
    label: group === "status" ? (STATUS_LABELS[key] ?? key) : key,
    tasks: grouped.get(key) ?? [],
  }));
};

export interface DueGroup<Task> {
  readonly id: string;
  readonly label: string;
  readonly tasks: readonly Task[];
}

const DUE_LABELS: Readonly<Record<string, string>> = {
  completed: "Completed",
  "no-date": "No due date",
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
};

// Buckets for /my-tasks. Empty buckets are dropped; order is fixed.
export const groupTasksByDueDate = <
  Task extends { readonly dueDate: string | null; readonly status: string },
>(
  tasks: readonly Task[],
  today: string
): readonly DueGroup<Task>[] => {
  const buckets = new Map<string, Task[]>([
    ["overdue", []],
    ["today", []],
    ["upcoming", []],
    ["no-date", []],
    ["completed", []],
  ]);
  for (const task of tasks) {
    let id: string;
    if (task.status === "done") {
      id = "completed";
    } else if (task.dueDate === null) {
      id = "no-date";
    } else if (task.dueDate < today) {
      id = "overdue";
    } else if (task.dueDate === today) {
      id = "today";
    } else {
      id = "upcoming";
    }
    buckets.get(id)?.push(task);
  }
  const groups: DueGroup<Task>[] = [];
  for (const [id, groupTasks] of buckets.entries()) {
    if (groupTasks.length > 0) {
      groups.push({ id, label: DUE_LABELS[id] ?? id, tasks: groupTasks });
    }
  }
  return groups;
};
