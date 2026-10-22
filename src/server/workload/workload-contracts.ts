import { Schema } from "effect";

const WorkloadWeekSchema = Schema.Struct({
  loadHours: Schema.Number,
  overloaded: Schema.Boolean,
  taskCount: Schema.Number,
  weekStart: Schema.String,
});

export const WorkloadPersonRowSchema = Schema.Struct({
  name: Schema.String,
  overdueCount: Schema.Number,
  overloadedWeekCount: Schema.Number,
  peakLoadHours: Schema.Number,
  unscheduled: Schema.Struct({
    loadHours: Schema.Number,
    taskCount: Schema.Number,
  }),
  userId: Schema.String,
  weeks: Schema.Array(WorkloadWeekSchema),
});

export const WorkloadViewSchema = Schema.Struct({
  capacityHours: Schema.Number,
  people: Schema.Array(WorkloadPersonRowSchema),
  weeks: Schema.Array(Schema.String),
});
