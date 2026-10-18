import { Schema } from "effect";

import { clientStatusLabels } from "@/features/portal/client-status";

import { UUIDSchema } from "../core/input-schemas";
import { ClientImpactSchema } from "../work/bug-contracts";

export const VersionSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThan(0)
);
const RequiredTextSchema = Schema.String.check(
  Schema.isMaxLength(10_000),
  Schema.makeFilter((value) =>
    value.trim() ? undefined : "This field is required."
  )
);
const ShortTextSchema = Schema.NullOr(
  Schema.String.check(Schema.isMaxLength(500))
);

export const ClientStatusLabelSchema = Schema.Literals(clientStatusLabels);

// The fields a client fills in to describe a bug.
const ClientBugFields = {
  actualBehavior: RequiredTextSchema,
  browser: ShortTextSchema,
  description: Schema.NullOr(Schema.String.check(Schema.isMaxLength(10_000))),
  device: ShortTextSchema,
  expectedBehavior: RequiredTextSchema,
  impact: ClientImpactSchema,
  os: ShortTextSchema,
  pageUrl: RequiredTextSchema.check(Schema.isMaxLength(2000)),
  reproductionSteps: Schema.Array(RequiredTextSchema).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(30)
  ),
  title: RequiredTextSchema.check(Schema.isMaxLength(300)),
} as const;

export const SatisfactionSchema = Schema.Literals(["up", "down"]);

export const SubmitClientBugInputSchema = Schema.Struct({
  ...ClientBugFields,
  projectId: UUIDSchema,
  // Set when reporting a closed bug again; links the new bug as a recurrence.
  recurrenceOfBugId: Schema.optional(UUIDSchema),
});

export const ConfirmClientFixInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  comment: Schema.optional(Schema.String.check(Schema.isMaxLength(2000))),
  expectedVersion: VersionSchema,
  satisfaction: Schema.optional(SatisfactionSchema),
});

export const ReopenClientFixInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  expectedVersion: VersionSchema,
  reason: RequiredTextSchema,
});

export const RateClientBugInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  comment: Schema.optional(Schema.String.check(Schema.isMaxLength(2000))),
  satisfaction: SatisfactionSchema,
});

export const EditClientBugInputSchema = Schema.Struct({
  ...ClientBugFields,
  bugId: UUIDSchema,
  expectedVersion: VersionSchema,
});

export const ClientBugVersionInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  expectedVersion: VersionSchema,
});

export const ClientBugIdInputSchema = Schema.Struct({ bugId: UUIDSchema });

export const ClientCommentInputSchema = Schema.Struct({
  body: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10_000)),
  bugId: UUIDSchema,
});

export const AttachClientFileInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  fileId: UUIDSchema,
});

export const ListCompanyBugsInputSchema = Schema.Struct({
  mine: Schema.optional(Schema.Boolean),
  projectId: Schema.optional(UUIDSchema),
  status: Schema.optional(ClientStatusLabelSchema),
});

export type ConfirmClientFixInput = typeof ConfirmClientFixInputSchema.Type;
export type ReopenClientFixInput = typeof ReopenClientFixInputSchema.Type;
export type RateClientBugInput = typeof RateClientBugInputSchema.Type;
export type SubmitClientBugInput = typeof SubmitClientBugInputSchema.Type;
export type EditClientBugInput = typeof EditClientBugInputSchema.Type;
export type ClientBugVersionInput = typeof ClientBugVersionInputSchema.Type;
export type ClientCommentInput = typeof ClientCommentInputSchema.Type;
export type AttachClientFileInput = typeof AttachClientFileInputSchema.Type;
export type ListCompanyBugsInput = typeof ListCompanyBugsInputSchema.Type;
