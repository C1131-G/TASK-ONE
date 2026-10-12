import type { TaskRecurrenceInput } from "@/src/server/work/work-contracts";

// Shared by the board and its card so both describe a task the same way.
export interface BoardTask {
  readonly id: string;
  readonly position: number;
  readonly projectId: string;
  readonly title: string;
  readonly status: "backlog" | "todo" | "progress" | "review" | "done";
  readonly priority: "urgent" | "high" | "medium" | "low" | "none";
  readonly version: number;
  readonly createdById: string;
  readonly assigneeIds: readonly string[];
  readonly description: string | null;
  readonly dueDate: string | null;
  readonly startDate: string | null;
  readonly estimate: string | null;
  readonly projectTaskNumber: number;
  readonly assignees: readonly { readonly id: string; readonly name: string }[];
  readonly labelIds: readonly string[];
  readonly dependencyIds: readonly string[];
  readonly recurrence: TaskRecurrenceInput | null;
  readonly subtaskCount: number;
  readonly completedSubtaskCount: number;
}

export interface BoardColumn {
  readonly id: BoardTask["status"];
  readonly label: string;
}
