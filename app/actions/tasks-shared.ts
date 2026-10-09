import { Effect, Schema } from "effect";
import { headers } from "next/headers";

import { AppError } from "@/src/server/core/action-result";
import {
  CalendarDateSchema,
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";

export const TaskPriorityInputSchema = Schema.Literals([
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);
export const TaskStatusInputSchema = Schema.Literals([
  "backlog",
  "todo",
  "progress",
  "review",
  "done",
]);

export const CreateTaskActionInputSchema = Schema.Struct({
  assigneeIds: Schema.Array(UUIDSchema),
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.NullOr(CalendarDateSchema),
  estimate: Schema.optional(
    Schema.NullOr(Schema.String.check(Schema.isMaxLength(40)))
  ),
  idempotencyKey: IdempotencyKeySchema,
  priority: TaskPriorityInputSchema,
  projectId: UUIDSchema,
  startDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  title: Schema.String,
});

export const ListProjectTasksInputSchema = Schema.Struct({
  includeArchived: Schema.optional(Schema.Boolean),
  limit: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(200)
  ),
  offset: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  projectId: UUIDSchema,
});

export const requestHeadersOrFail = Effect.tryPromise({
  catch: () =>
    new AppError({
      code: "UNAVAILABLE",
      message: "The request could not be completed.",
    }),
  try: () => headers(),
});

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
