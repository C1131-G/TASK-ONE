import type { TaskRecurrenceInput } from "@/src/server/work/work-contracts";

export interface EditableTask {
  readonly id: string;
  readonly projectId: string;
  readonly type?: "task" | "bug";
  readonly createdById: string;
  readonly version: number;
  readonly title: string;
  readonly description: string | null;
  readonly status: "backlog" | "todo" | "progress" | "review" | "done";
  readonly priority: "urgent" | "high" | "medium" | "low" | "none";
  readonly dueDate: string | null;
  readonly startDate: string | null;
  readonly estimate: string | null;
  readonly assigneeIds: readonly string[];
  readonly labelIds: readonly string[];
  readonly dependencyIds: readonly string[];
  readonly recurrence: TaskRecurrenceInput | null;
  // Whether the task is shown in the client portal's project view.
  readonly clientVisible?: boolean;
}

// The fields the details section edits. Assignees are kept sorted so the dirty
// check does not depend on the order the checkboxes were ticked.
export interface TaskDetailsDraft {
  readonly assigneeIds: readonly string[];
  readonly description: string;
  readonly dueDate: string | null;
  readonly estimate: string;
  readonly priority: EditableTask["priority"];
  readonly startDate: string | null;
  readonly status: EditableTask["status"];
  readonly title: string;
}

export const draftFromTask = (task: EditableTask): TaskDetailsDraft => ({
  assigneeIds: task.assigneeIds.toSorted(),
  description: task.description ?? "",
  dueDate: task.dueDate,
  estimate: task.estimate ?? "",
  priority: task.priority,
  startDate: task.startDate,
  status: task.status,
  title: task.title,
});

export const isDraftDirty = (
  draft: TaskDetailsDraft,
  task: EditableTask
): boolean => JSON.stringify(draft) !== JSON.stringify(draftFromTask(task));
