import { Effect, Schema } from "effect";
import { headers } from "next/headers";

import { AppError } from "@/src/server/core/action-result";
import {
  CalendarDateSchema,
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import {
  CreateProjectInputSchema,
  DuplicateProjectInputSchema,
  SaveProjectMilestonesInputSchema,
} from "@/src/server/projects/project-contracts";

export const UpdateProjectActionInputSchema = Schema.Struct({
  color: Schema.optional(Schema.String.check(Schema.isMaxLength(40))),
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  expectedVersion: Schema.Number,
  icon: Schema.optional(Schema.String.check(Schema.isMaxLength(40))),
  idempotencyKey: IdempotencyKeySchema,
  name: Schema.String,
  position: Schema.optional(
    Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
  ),
  projectId: UUIDSchema,
  startDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  status: Schema.Literals(["planning", "active", "risk", "hold", "complete"]),
  teamId: Schema.optional(Schema.NullOr(UUIDSchema)),
});

export const VersionedProjectActionInputSchema = Schema.Struct({
  expectedVersion: Schema.Number,
  idempotencyKey: IdempotencyKeySchema,
  projectId: UUIDSchema,
});

export const SetProjectPeopleActionInputSchema = Schema.Struct({
  expectedVersion: Schema.Number,
  idempotencyKey: IdempotencyKeySchema,
  leadId: Schema.NullOr(UUIDSchema),
  memberIds: Schema.Array(UUIDSchema),
  projectId: UUIDSchema,
});

export const DuplicateProjectActionInputSchema = Schema.Struct({
  idempotencyKey: IdempotencyKeySchema,
  sourceProjectId: UUIDSchema,
  ...DuplicateProjectInputSchema.fields,
});

export const CreateProjectActionInputSchema = Schema.Struct({
  ...CreateProjectInputSchema.fields,
  idempotencyKey: IdempotencyKeySchema,
});

export const SaveProjectMilestonesActionInputSchema = Schema.Struct({
  ...SaveProjectMilestonesInputSchema.fields,
  idempotencyKey: IdempotencyKeySchema,
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
