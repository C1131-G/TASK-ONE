import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import { CalendarDateSchema } from "../core/input-schemas";
import { TaskRecurrenceInputSchema } from "./work-contracts";

export const TaskStatusSchema = Schema.Literals([
  "backlog",
  "todo",
  "progress",
  "review",
  "done",
]);
export const TaskPrioritySchema = Schema.Literals([
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);

export const TaskCalendarQuerySchema = Schema.Struct({
  assigneeIds: Schema.optional(
    Schema.Array(Schema.String.check(Schema.isUUID())).check(
      Schema.isMaxLength(100)
    )
  ),
  from: CalendarDateSchema,
  groupBy: Schema.Literals(["none", "status", "project", "assignee"]),
  limit: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(200)
  ),
  offset: Schema.optional(
    Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
  ),
  priorities: Schema.Array(TaskPrioritySchema).check(Schema.isMaxLength(5)),
  projectIds: Schema.optional(
    Schema.Array(Schema.String.check(Schema.isUUID())).check(
      Schema.isMaxLength(100)
    )
  ),
  sortBy: Schema.Literals(["startDate", "dueDate", "title", "position"]),
  sortDirection: Schema.Literals(["asc", "desc"]),
  statuses: Schema.Array(TaskStatusSchema).check(Schema.isMaxLength(5)),
  to: CalendarDateSchema,
});

export type TaskCalendarQuery = typeof TaskCalendarQuerySchema.Type;

export const TaskCalendarEntrySchema = Schema.Struct({
  assigneeIds: Schema.Array(Schema.String),
  createdById: Schema.String,
  dependencyIds: Schema.Array(Schema.String),
  dueDate: Schema.NullOr(Schema.String),
  groupKey: Schema.NullOr(Schema.String),
  id: Schema.String,
  labelIds: Schema.Array(Schema.String),
  position: Schema.Number,
  priority: TaskPrioritySchema,
  projectId: Schema.String,
  projectName: Schema.String,
  recurrence: Schema.NullOr(TaskRecurrenceInputSchema),
  startDate: Schema.NullOr(Schema.String),
  status: TaskStatusSchema,
  title: Schema.String,
  version: Schema.Number,
});

export type TaskCalendarEntry = typeof TaskCalendarEntrySchema.Type;

export class TaskCalendar extends Context.Service<
  TaskCalendar,
  {
    readonly list: (
      actorId: string,
      query: TaskCalendarQuery
    ) => Effect.Effect<readonly TaskCalendarEntry[], AppError>;
  }
>()("metsys/server/TaskCalendar") {}
