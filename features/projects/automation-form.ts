import type {
  AutomationOutcome,
  AutomationRuleInput,
  AutomationRuleSummary,
} from "@/src/server/automation/automation-contracts";
import {
  AUTOMATION_TRIGGER_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/src/server/automation/automation-model";
import type {
  ActionType,
  AutomationAction,
  AutomationCondition,
  AutomationTrigger,
  ConditionField,
  ConditionOp,
} from "@/src/server/automation/automation-model";

// The builder edits plain strings; this module turns them into the typed
// rule the server validates, and turns stored rules back into words.

export interface ConditionDraft {
  readonly key: string;
  readonly field: ConditionField;
  readonly op: ConditionOp;
  readonly values: readonly string[];
}

export interface ActionDraft {
  readonly key: string;
  readonly type: ActionType;
  readonly status: string;
  readonly priority: string;
  readonly userId: string;
  readonly labelId: string;
  readonly body: string;
  readonly message: string;
}

export interface RuleDraft {
  readonly name: string;
  readonly trigger: AutomationTrigger;
  readonly conditions: readonly ConditionDraft[];
  readonly actions: readonly ActionDraft[];
}

export const STATUS_LABELS: Readonly<Record<string, string>> = {
  backlog: "Backlog",
  done: "Done",
  progress: "In Progress",
  review: "Review",
  todo: "To Do",
};
export const PRIORITY_LABELS: Readonly<Record<string, string>> = {
  high: "High",
  low: "Low",
  medium: "Medium",
  none: "None",
  urgent: "Urgent",
};
export const TASK_TYPE_LABELS: Readonly<Record<string, string>> = {
  bug: "Bug",
  task: "Task",
};
export const CONDITION_FIELD_LABELS: Readonly<Record<ConditionField, string>> =
  {
    assignee: "Assignee",
    label: "Label",
    priority: "Priority",
    status: "Status",
    taskType: "Task type",
  };
export const ACTION_TYPE_LABELS: Readonly<Record<ActionType, string>> = {
  add_label: "Add a label",
  assign: "Assign a person",
  notify: "Notify a person",
  post_comment: "Post an internal comment",
  set_priority: "Set the priority",
  set_status: "Set the status",
  unassign: "Unassign a person",
};

let draftCounter = 0;
export const nextDraftKey = (prefix: string): string => {
  draftCounter += 1;
  return `${prefix}-${draftCounter}`;
};

export const emptyActionDraft = (type: ActionType): ActionDraft => ({
  body: "",
  key: nextDraftKey("action"),
  labelId: "",
  message: "",
  priority: "medium",
  status: "todo",
  type,
  userId: "",
});

export const emptyConditionDraft = (): ConditionDraft => ({
  field: "status",
  key: nextDraftKey("condition"),
  op: "in",
  values: [],
});

export const emptyRuleDraft = (): RuleDraft => ({
  actions: [],
  conditions: [],
  name: "",
  trigger: "task_created",
});

const actionToDraft = (action: AutomationAction): ActionDraft => {
  const base = emptyActionDraft(action.type);
  switch (action.type) {
    case "set_status": {
      return { ...base, status: action.status };
    }
    case "set_priority": {
      return { ...base, priority: action.priority };
    }
    case "assign":
    case "unassign": {
      return { ...base, userId: action.userId };
    }
    case "add_label": {
      return { ...base, labelId: action.labelId };
    }
    case "post_comment": {
      return { ...base, body: action.body };
    }
    case "notify": {
      return { ...base, message: action.message, userId: action.userId };
    }
    default: {
      const unhandled: never = action;
      return unhandled;
    }
  }
};

export const ruleToDraft = (rule: AutomationRuleSummary): RuleDraft => ({
  actions: rule.actions.map(actionToDraft),
  conditions: rule.conditions.map((condition) => ({
    ...condition,
    key: nextDraftKey("condition"),
  })),
  name: rule.name,
  trigger: rule.trigger,
});

export type DraftResult =
  | { readonly ok: true; readonly input: AutomationRuleInput }
  | { readonly ok: false; readonly message: string };

const fail = (message: string): DraftResult => ({ message, ok: false });

const actionFromDraft = (draft: ActionDraft): AutomationAction | null => {
  switch (draft.type) {
    case "set_status": {
      const status = TASK_STATUSES.find((value) => value === draft.status);
      return status ? { status, type: "set_status" } : null;
    }
    case "set_priority": {
      const priority = TASK_PRIORITIES.find(
        (value) => value === draft.priority
      );
      return priority ? { priority, type: "set_priority" } : null;
    }
    case "assign":
    case "unassign": {
      return draft.userId ? { type: draft.type, userId: draft.userId } : null;
    }
    case "add_label": {
      return draft.labelId
        ? { labelId: draft.labelId, type: "add_label" }
        : null;
    }
    case "post_comment": {
      return draft.body.trim()
        ? { body: draft.body.trim(), type: "post_comment" }
        : null;
    }
    case "notify": {
      return draft.userId && draft.message.trim()
        ? {
            message: draft.message.trim(),
            type: "notify",
            userId: draft.userId,
          }
        : null;
    }
    default: {
      return null;
    }
  }
};

const MISSING_ACTION_MESSAGES: Readonly<Record<ActionType, string>> = {
  add_label: "Choose a label for every add label action.",
  assign: "Choose a person for every assign action.",
  notify: "Choose a person and write a message for every notify action.",
  post_comment: "Write the comment for every comment action.",
  set_priority: "Choose a priority for every set priority action.",
  set_status: "Choose a status for every set status action.",
  unassign: "Choose a person for every unassign action.",
};

export const draftToRuleInput = (draft: RuleDraft): DraftResult => {
  const name = draft.name.trim();
  if (!name) {
    return fail("Enter a name for the automation.");
  }
  if (draft.actions.length === 0) {
    return fail("Add at least one action.");
  }
  if (draft.conditions.some(({ values }) => values.length === 0)) {
    return fail("Choose at least one value for every condition.");
  }
  const actions: AutomationAction[] = [];
  for (const actionDraft of draft.actions) {
    const action = actionFromDraft(actionDraft);
    if (!action) {
      return fail(MISSING_ACTION_MESSAGES[actionDraft.type]);
    }
    actions.push(action);
  }
  const conditions: AutomationCondition[] = draft.conditions.map(
    ({ field, op, values }) => ({ field, op, values: [...values] })
  );
  return {
    input: { actions, conditions, name, trigger: draft.trigger },
    ok: true,
  };
};

export interface Lookups {
  readonly people: ReadonlyMap<string, string>;
  readonly labels: ReadonlyMap<string, string>;
}

const valueLabel = (
  field: ConditionField,
  value: string,
  lookups: Lookups
): string => {
  switch (field) {
    case "status": {
      return STATUS_LABELS[value] ?? value;
    }
    case "priority": {
      return PRIORITY_LABELS[value] ?? value;
    }
    case "taskType": {
      return TASK_TYPE_LABELS[value] ?? value;
    }
    case "assignee": {
      return lookups.people.get(value) ?? "a removed person";
    }
    case "label": {
      return lookups.labels.get(value) ?? "a removed label";
    }
    default: {
      const unhandled: never = field;
      return unhandled;
    }
  }
};

const describeCondition = (
  condition: AutomationCondition,
  lookups: Lookups
): string => {
  const values = condition.values
    .map((value) => valueLabel(condition.field, value, lookups))
    .join(" or ");
  const verb = condition.op === "in" ? "is" : "is not";
  return `${CONDITION_FIELD_LABELS[condition.field]} ${verb} ${values}`;
};

const person = (userId: string, lookups: Lookups): string =>
  lookups.people.get(userId) ?? "a removed person";

const describeAction = (action: AutomationAction, lookups: Lookups): string => {
  switch (action.type) {
    case "set_status": {
      return `Set status to ${STATUS_LABELS[action.status] ?? action.status}`;
    }
    case "set_priority": {
      return `Set priority to ${PRIORITY_LABELS[action.priority] ?? action.priority}`;
    }
    case "assign": {
      return `Assign ${person(action.userId, lookups)}`;
    }
    case "unassign": {
      return `Unassign ${person(action.userId, lookups)}`;
    }
    case "add_label": {
      return `Add label ${lookups.labels.get(action.labelId) ?? "a removed label"}`;
    }
    case "post_comment": {
      return `Post internal comment "${action.body}"`;
    }
    case "notify": {
      return `Notify ${person(action.userId, lookups)}: ${action.message}`;
    }
    default: {
      const unhandled: never = action;
      return unhandled;
    }
  }
};

export const describeRule = (
  rule: Pick<AutomationRuleSummary, "actions" | "conditions" | "trigger">,
  lookups: Lookups
): {
  readonly when: string;
  readonly conditions: readonly string[];
  readonly actions: readonly string[];
} => ({
  actions: rule.actions.map((action) => describeAction(action, lookups)),
  conditions: rule.conditions.map((condition) =>
    describeCondition(condition, lookups)
  ),
  when: AUTOMATION_TRIGGER_LABELS[rule.trigger],
});

export const outcomeBadge = (
  outcome: AutomationOutcome
): { readonly label: string; readonly tone: "gray" | "green" | "red" } => {
  switch (outcome) {
    case "matched": {
      return { label: "Ran", tone: "green" };
    }
    case "failed": {
      return { label: "Failed", tone: "red" };
    }
    default: {
      return { label: "Skipped", tone: "gray" };
    }
  }
};

const ACTION_BLOCKED_PREFIX = "action_blocked:";

const REASON_LABELS: Readonly<Record<string, string>> = {
  conditions_not_met: "Conditions were not met",
  loop_protection_depth:
    "Stopped: automations triggered by automations are followed only one step",
  loop_protection_self: "Stopped: a rule does not react to its own change",
  rate_limited:
    "Skipped: this rule already ran on this task several times recently",
  task_archived: "The task is archived",
  task_missing: "The task no longer exists",
};

export const describeReason = (reason: string | null): string => {
  if (!reason) {
    return "";
  }
  if (reason.startsWith(ACTION_BLOCKED_PREFIX)) {
    const action = reason.slice(ACTION_BLOCKED_PREFIX.length);
    return `This task cannot take the ${action.replaceAll("_", " ")} action`;
  }
  return REASON_LABELS[reason] ?? reason;
};
