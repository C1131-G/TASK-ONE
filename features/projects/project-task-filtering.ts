import type { ProjectTaskViewItem } from "@/features/projects/types/project-task-view-types";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

const priorityOrder = {
  high: 1,
  low: 3,
  medium: 2,
  none: 4,
  urgent: 0,
} as const;

const TASK_STATUS_GROUPS: readonly {
  readonly status: ProjectTaskListItem["status"];
  readonly label: string;
}[] = [
  { label: "Backlog", status: "backlog" },
  { label: "To Do", status: "todo" },
  { label: "In Progress", status: "progress" },
  { label: "Review", status: "review" },
  { label: "Done", status: "done" },
];

// Sorts with no due date last.
const NO_DUE_DATE = "9999-12-31";

export interface ProjectTaskFilter {
  readonly priority: string;
  readonly projectKey: string;
  readonly query: string;
  readonly sort: string;
  readonly status: string;
}

export const filterProjectTasks = (
  tasks: readonly ProjectTaskViewItem[],
  { priority, projectKey, query, sort, status }: ProjectTaskFilter
): ProjectTaskViewItem[] => {
  const normalizedQuery = query.trim().toLowerCase();
  return tasks
    .filter((task) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        task.title.toLowerCase().includes(normalizedQuery) ||
        `${projectKey}-${task.projectTaskNumber}`
          .toLowerCase()
          .includes(normalizedQuery);
      return (
        matchesQuery &&
        (status === "all" || task.status === status) &&
        (priority === "all" || task.priority === priority)
      );
    })
    .toSorted((first, second) => {
      if (sort === "name") {
        return first.title.localeCompare(second.title);
      }
      if (sort === "due") {
        return (first.dueDate ?? NO_DUE_DATE).localeCompare(
          second.dueDate ?? NO_DUE_DATE
        );
      }
      if (sort === "priority") {
        return priorityOrder[first.priority] - priorityOrder[second.priority];
      }
      return 0;
    });
};

export const groupProjectTasks = (
  tasks: readonly ProjectTaskViewItem[],
  groupBy: string
) =>
  groupBy === "status"
    ? TASK_STATUS_GROUPS.flatMap(({ label, status }) => {
        const groupedTasks = tasks.filter((task) => task.status === status);
        return groupedTasks.length
          ? [{ id: status, label, tasks: groupedTasks }]
          : [];
      })
    : [{ id: "all", label: "", tasks }];
