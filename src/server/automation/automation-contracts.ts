import { Schema } from "effect";

import {
  AUTOMATION_TRIGGERS,
  CONDITION_FIELDS,
  CONDITION_OPS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
} from "./automation-model";
import type { ConditionField } from "./automation-model";

// Strict limits keep a rule readable and bound the work one event can cause.
export const MAX_RULES_PER_PROJECT = 25;
export const MAX_ACTIONS_PER_RULE = 5;
export const MAX_CONDITIONS_PER_RULE = 5;
export const MAX_CONDITION_VALUES = 20;
export const MAX_RULE_NAME_LENGTH = 80;
export const MAX_COMMENT_LENGTH = 1000;
export const MAX_NOTIFY_MESSAGE_LENGTH = 200;
const MAX_ID_LENGTH = 100;

const trimmedText = (maxLength: number, label: string) =>
  Schema.String.check(
    Schema.makeFilter((value: string) =>
      value.trim().length >= 1 && value.length <= maxLength
        ? undefined
        : `${label} must be 1 to ${maxLength} characters.`
    )
  );

const NameSchema = trimmedText(MAX_RULE_NAME_LENGTH, "The name");
const PersonIdSchema = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(MAX_ID_LENGTH)
);
const UuidSchema = Schema.String.check(Schema.isUUID());

const TriggerSchema = Schema.Literals(AUTOMATION_TRIGGERS);
const StatusSchema = Schema.Literals(TASK_STATUSES);
const PrioritySchema = Schema.Literals(TASK_PRIORITIES);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const ALLOWED_VALUES: Readonly<
  Partial<Record<ConditionField, ReadonlySet<string>>>
> = {
  priority: new Set(TASK_PRIORITIES),
  status: new Set(TASK_STATUSES),
  taskType: new Set(TASK_TYPES),
};

const conditionProblem = ({
  field,
  values,
}: {
  readonly field: ConditionField;
  readonly values: readonly string[];
}): string | undefined => {
  const allowed = ALLOWED_VALUES[field];
  if (allowed) {
    return values.every((value) => allowed.has(value))
      ? undefined
      : `Choose valid ${field} values.`;
  }
  if (field === "label") {
    return values.every((value) => UUID_PATTERN.test(value))
      ? undefined
      : "Choose valid labels.";
  }
  return undefined;
};

const ConditionSchema = Schema.Struct({
  field: Schema.Literals(CONDITION_FIELDS),
  op: Schema.Literals(CONDITION_OPS),
  values: Schema.Array(PersonIdSchema).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(MAX_CONDITION_VALUES)
  ),
}).check(Schema.makeFilter(conditionProblem));

const ActionSchema = Schema.Union([
  Schema.Struct({
    status: StatusSchema,
    type: Schema.Literal("set_status"),
  }),
  Schema.Struct({
    priority: PrioritySchema,
    type: Schema.Literal("set_priority"),
  }),
  Schema.Struct({ type: Schema.Literal("assign"), userId: PersonIdSchema }),
  Schema.Struct({ type: Schema.Literal("unassign"), userId: PersonIdSchema }),
  Schema.Struct({ labelId: UuidSchema, type: Schema.Literal("add_label") }),
  Schema.Struct({
    body: trimmedText(MAX_COMMENT_LENGTH, "The comment"),
    type: Schema.Literal("post_comment"),
  }),
  Schema.Struct({
    message: trimmedText(MAX_NOTIFY_MESSAGE_LENGTH, "The message"),
    type: Schema.Literal("notify"),
    userId: PersonIdSchema,
  }),
]);

// What a stored rule row must decode to before the runner trusts it.
export const StoredRuleBodySchema = Schema.Struct({
  actions: Schema.Array(ActionSchema),
  conditions: Schema.Array(ConditionSchema),
});

export const AutomationRuleInputSchema = Schema.Struct({
  actions: Schema.Array(ActionSchema).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(MAX_ACTIONS_PER_RULE)
  ),
  conditions: Schema.Array(ConditionSchema).check(
    Schema.isMaxLength(MAX_CONDITIONS_PER_RULE)
  ),
  name: NameSchema,
  trigger: TriggerSchema,
});
export type AutomationRuleInput = typeof AutomationRuleInputSchema.Type;

export const AutomationRuleSummarySchema = Schema.Struct({
  ...AutomationRuleInputSchema.fields,
  createdAt: Schema.String,
  enabled: Schema.Boolean,
  id: Schema.String,
  projectId: Schema.String,
  updatedAt: Schema.String,
  version: Schema.Number,
});
export type AutomationRuleSummary = typeof AutomationRuleSummarySchema.Type;
export const AutomationRuleListSchema = Schema.Array(
  AutomationRuleSummarySchema
);

export const AUTOMATION_OUTCOMES = ["matched", "skipped", "failed"] as const;
export type AutomationOutcome = (typeof AUTOMATION_OUTCOMES)[number];

export const AutomationRunSummarySchema = Schema.Struct({
  createdAt: Schema.String,
  depth: Schema.Number,
  id: Schema.String,
  outcome: Schema.Literals(AUTOMATION_OUTCOMES),
  reason: Schema.NullOr(Schema.String),
  ruleId: Schema.String,
  ruleName: Schema.String,
  taskId: Schema.NullOr(Schema.String),
  taskKey: Schema.NullOr(Schema.String),
  trigger: Schema.String,
});
export type AutomationRunSummary = typeof AutomationRunSummarySchema.Type;
export const AutomationRunListSchema = Schema.Array(AutomationRunSummarySchema);

export const AUTOMATION_RULE_JOB = "automation.run-event";
export const AUTOMATION_OVERDUE_SWEEP_JOB = "automation.overdue-sweep";
