import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

export type ProjectTaskViewItem = Pick<
  ProjectTaskListItem,
  | "assigneeIds"
  | "assignees"
  | "createdById"
  | "completedSubtaskCount"
  | "dependencyIds"
  | "description"
  | "dueDate"
  | "estimate"
  | "id"
  | "labelIds"
  | "priority"
  | "position"
  | "projectId"
  | "projectTaskNumber"
  | "recurrence"
  | "startDate"
  | "status"
  | "subtaskCount"
  | "title"
  | "version"
>;
