import { GLOBAL_TASK_STATUSES } from "./global-task-view-contracts";
import type {
  GlobalTaskGroup,
  GlobalTaskLike,
  GlobalTaskSort,
  NormalizedGlobalTaskSearch,
} from "./global-task-view-contracts";

// Shape the filter and grouping functions need from a task row.
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
