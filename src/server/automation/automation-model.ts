// The vocabulary shared by the rule schema, the evaluator and the runner. No
// I/O lives here, so the evaluator can be tested as plain functions.

export const AUTOMATION_TRIGGERS = [
  "task_created",
  "status_changed",
  "assignee_changed",
  "priority_changed",
  "due_date_changed",
  "task_overdue",
  "bug_reported",
  "bug_status_changed",
] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const AUTOMATION_TRIGGER_LABELS: Readonly<
  Record<AutomationTrigger, string>
> = {
  assignee_changed: "Assignee changed",
  bug_reported: "Client bug reported",
  bug_status_changed: "Client bug status changed",
  due_date_changed: "Due date changed",
  priority_changed: "Priority changed",
  status_changed: "Status changed",
  task_created: "Task created",
  task_overdue: "Due date passed",
};

export const TASK_STATUSES = [
  "backlog",
  "todo",
  "progress",
  "review",
  "done",
] as const;
export type AutomationTaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
] as const;
export type AutomationTaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TYPES = ["task", "bug"] as const;
export type AutomationTaskType = (typeof TASK_TYPES)[number];

export const CONDITION_FIELDS = [
  "status",
  "priority",
  "assignee",
  "label",
  "taskType",
] as const;
export type ConditionField = (typeof CONDITION_FIELDS)[number];

export const CONDITION_OPS = ["in", "not_in"] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];

export interface AutomationCondition {
  readonly field: ConditionField;
  readonly op: ConditionOp;
  readonly values: readonly string[];
}

export const ACTION_TYPES = [
  "set_status",
  "set_priority",
  "assign",
  "unassign",
  "add_label",
  "post_comment",
  "notify",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export type AutomationAction =
  | { readonly type: "set_status"; readonly status: AutomationTaskStatus }
  | { readonly type: "set_priority"; readonly priority: AutomationTaskPriority }
  | { readonly type: "assign"; readonly userId: string }
  | { readonly type: "unassign"; readonly userId: string }
  | { readonly type: "add_label"; readonly labelId: string }
  | { readonly type: "post_comment"; readonly body: string }
  | {
      readonly type: "notify";
      readonly userId: string;
      readonly message: string;
    };

export interface AutomationRuleDefinition {
  readonly id: string;
  readonly enabled: boolean;
  readonly trigger: AutomationTrigger;
  readonly conditions: readonly AutomationCondition[];
  readonly actions: readonly AutomationAction[];
}

// Marks who caused an event. Depth 0 is a person's own change; an automation
// action raises the depth of every event it causes.
export interface AutomationEvent {
  readonly eventId: string;
  readonly trigger: AutomationTrigger;
  readonly depth: number;
  readonly causedByRuleId: string | null;
}

export interface TaskSnapshot {
  readonly status: string;
  readonly priority: string;
  readonly type: string;
  readonly assigneeIds: readonly string[];
  readonly labelIds: readonly string[];
  readonly archived: boolean;
  readonly hasRecurrence: boolean;
}

export type SkipReason =
  | "conditions_not_met"
  | "loop_protection_depth"
  | "loop_protection_self"
  | "rate_limited"
  | "task_archived"
  | `action_blocked:${ActionType}`;

export type RunDecision =
  | { readonly outcome: "not_applicable" }
  | { readonly outcome: "matched" }
  | { readonly outcome: "skipped"; readonly reason: SkipReason };
