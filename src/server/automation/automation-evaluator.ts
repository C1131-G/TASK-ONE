import type {
  ActionType,
  AutomationAction,
  AutomationCondition,
  AutomationEvent,
  AutomationRuleDefinition,
  RunDecision,
  TaskSnapshot,
} from "./automation-model";

// Events a person causes have depth 0. Events caused by an automation action
// have depth 1 and may trigger other rules once; anything deeper is dropped,
// and a rule never reacts to a change it made itself.
export const MAX_AUTOMATION_DEPTH = 1;

// One rule runs at most this many times per task inside the window; the
// runner counts recent runs from the run log.
export const RATE_LIMIT_MAX_RUNS = 5;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const valuesOf = (
  field: AutomationCondition["field"],
  task: TaskSnapshot
): readonly string[] => {
  switch (field) {
    case "status": {
      return [task.status];
    }
    case "priority": {
      return [task.priority];
    }
    case "taskType": {
      return [task.type];
    }
    case "assignee": {
      return task.assigneeIds;
    }
    case "label": {
      return task.labelIds;
    }
    default: {
      const unhandled: never = field;
      return unhandled;
    }
  }
};

/** "in" holds when any task value is listed; "not_in" when none is. */
export const conditionMatches = (
  condition: AutomationCondition,
  task: TaskSnapshot
): boolean => {
  const wanted = new Set(condition.values);
  const present = valuesOf(condition.field, task).some((value) =>
    wanted.has(value)
  );
  return condition.op === "in" ? present : !present;
};

/** Why a task cannot take an action, or null when it can. */
export const actionBlockedReason = (
  action: AutomationAction,
  task: TaskSnapshot
): ActionType | null => {
  const onBugWorkflow =
    task.type === "bug" &&
    (action.type === "set_status" ||
      action.type === "assign" ||
      action.type === "unassign");
  if (onBugWorkflow) {
    return action.type;
  }
  if (
    action.type === "set_status" &&
    action.status === "done" &&
    task.hasRecurrence
  ) {
    return action.type;
  }
  return null;
};

export interface RunInput {
  readonly rule: AutomationRuleDefinition;
  readonly event: AutomationEvent;
  readonly task: TaskSnapshot;
  // Runs of this rule on this task inside the rate-limit window.
  readonly recentRuns: number;
}

/**
 * Decides whether a rule runs for an event. Loop protection comes first so
 * that a runaway chain is logged as such, whatever else would also apply.
 */
export const decideRun = ({
  event,
  recentRuns,
  rule,
  task,
}: RunInput): RunDecision => {
  if (!rule.enabled || rule.trigger !== event.trigger) {
    return { outcome: "not_applicable" };
  }
  if (event.depth > MAX_AUTOMATION_DEPTH) {
    return { outcome: "skipped", reason: "loop_protection_depth" };
  }
  if (event.causedByRuleId === rule.id) {
    return { outcome: "skipped", reason: "loop_protection_self" };
  }
  if (task.archived) {
    return { outcome: "skipped", reason: "task_archived" };
  }
  if (recentRuns >= RATE_LIMIT_MAX_RUNS) {
    return { outcome: "skipped", reason: "rate_limited" };
  }
  if (
    !rule.conditions.every((condition) => conditionMatches(condition, task))
  ) {
    return { outcome: "skipped", reason: "conditions_not_met" };
  }
  for (const action of rule.actions) {
    const blocked = actionBlockedReason(action, task);
    if (blocked) {
      return { outcome: "skipped", reason: `action_blocked:${blocked}` };
    }
  }
  return { outcome: "matched" };
};

export interface FieldChanges {
  readonly statusChanged: boolean;
  readonly priorityChanged: boolean;
  readonly assigneesChanged: boolean;
}

export interface CausedEvent {
  readonly trigger: "status_changed" | "priority_changed" | "assignee_changed";
  readonly depth: number;
  readonly causedByRuleId: string;
}

/** The follow-up events an automation run raises, one deeper than its own. */
export const eventsCausedBy = ({
  changes,
  depth,
  ruleId,
}: {
  readonly changes: FieldChanges;
  readonly depth: number;
  readonly ruleId: string;
}): readonly CausedEvent[] => {
  const caused: CausedEvent["trigger"][] = [];
  if (changes.statusChanged) {
    caused.push("status_changed");
  }
  if (changes.priorityChanged) {
    caused.push("priority_changed");
  }
  if (changes.assigneesChanged) {
    caused.push("assignee_changed");
  }
  return caused.map((trigger) => ({
    causedByRuleId: ruleId,
    depth: depth + 1,
    trigger,
  }));
};
