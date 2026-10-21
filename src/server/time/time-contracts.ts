import { Schema } from "effect";

import { CalendarDateSchema, UUIDSchema } from "../core/input-schemas";

// Input and output shapes that cross the Server Action boundary.

const NoteSchema = Schema.NullOr(Schema.String);

export const TimeEntryViewSchema = Schema.Struct({
  billable: Schema.Boolean,
  id: Schema.String,
  minutes: Schema.Number,
  note: NoteSchema,
  taskId: Schema.String,
  taskReference: Schema.String,
  taskTitle: Schema.String,
  userId: Schema.String,
  userName: Schema.String,
  workDate: Schema.String,
});

export const RunningTimerSchema = Schema.Struct({
  billable: Schema.Boolean,
  note: NoteSchema,
  startedAt: Schema.String,
  taskId: Schema.String,
  taskReference: Schema.String,
  taskTitle: Schema.String,
});

export const StartedTimerSchema = Schema.Struct({
  stopped: Schema.NullOr(TimeEntryViewSchema),
  timer: RunningTimerSchema,
});

const TotalsFields = {
  billableMinutes: Schema.Number,
  totalMinutes: Schema.Number,
};

export const TaskTimeSchema = Schema.Struct({
  ...TotalsFields,
  entries: Schema.Array(TimeEntryViewSchema),
});

export const WeeklyTimeSchema = Schema.Struct({
  ...TotalsFields,
  days: Schema.Array(
    Schema.Struct({ date: Schema.String, minutes: Schema.Number })
  ),
  entries: Schema.Array(TimeEntryViewSchema),
  weekStart: Schema.String,
});

export const TaskOptionListSchema = Schema.Array(
  Schema.Struct({
    reference: Schema.String,
    taskId: Schema.String,
    title: Schema.String,
  })
);

export const ProjectTimeReportSchema = Schema.Struct({
  ...TotalsFields,
  byPerson: Schema.Array(
    Schema.Struct({
      ...TotalsFields,
      name: Schema.String,
      userId: Schema.String,
    })
  ),
  byTask: Schema.Array(
    Schema.Struct({
      ...TotalsFields,
      taskId: Schema.String,
      taskReference: Schema.String,
      taskTitle: Schema.String,
    })
  ),
  from: Schema.String,
  nonBillableMinutes: Schema.Number,
  to: Schema.String,
});

export const TimeEntryChangesSchema = Schema.Struct({
  billable: Schema.Boolean,
  minutes: Schema.Number,
  note: NoteSchema,
  workDate: CalendarDateSchema,
});

export const DateRangeSchema = Schema.Struct({
  from: CalendarDateSchema,
  to: CalendarDateSchema,
});

export const ProjectRangeSchema = Schema.Struct({
  ...DateRangeSchema.fields,
  projectId: UUIDSchema,
});
