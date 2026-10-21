import { Schema } from "effect";

import { UUIDSchema } from "../core/input-schemas";

// Input and output shapes that cross the Server Action boundary.

const BudgetKindSchema = Schema.Literals(["one_off", "retainer"]);

export const BudgetInputFieldsSchema = Schema.Struct({
  billableOnly: Schema.Boolean,
  budgetMinutes: Schema.Number,
  currency: Schema.String,
  hourlyRateCents: Schema.NullOr(Schema.Number),
  kind: BudgetKindSchema,
  warningPercent: Schema.Number,
});

export const ProjectBudgetViewSchema = Schema.Struct({
  billableOnly: Schema.Boolean,
  budgetAmountCents: Schema.NullOr(Schema.Number),
  budgetMinutes: Schema.Number,
  currency: Schema.String,
  hourlyRateCents: Schema.NullOr(Schema.Number),
  kind: BudgetKindSchema,
  level: Schema.Literals(["ok", "warning", "overrun"]),
  percent: Schema.Number,
  period: Schema.Struct({
    from: Schema.NullOr(Schema.String),
    key: Schema.String,
    to: Schema.NullOr(Schema.String),
  }),
  projectId: Schema.String,
  remainingMinutes: Schema.Number,
  spentAmountCents: Schema.NullOr(Schema.Number),
  spentMinutes: Schema.Number,
  warningPercent: Schema.Number,
});

export const BudgetListRowSchema = Schema.Struct({
  ...ProjectBudgetViewSchema.fields,
  projectKey: Schema.String,
  projectName: Schema.String,
});

export const ProjectIdInputSchema = Schema.Struct({ projectId: UUIDSchema });
