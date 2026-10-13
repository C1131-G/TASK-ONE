import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

export type ProjectOverviewTask = Pick<
  ProjectTaskListItem,
  | "assigneeIds"
  | "assignees"
  | "createdById"
  | "dependencyIds"
  | "dueDate"
  | "id"
  | "labelIds"
  | "projectId"
  | "recurrence"
  | "status"
  | "title"
  | "version"
>;
