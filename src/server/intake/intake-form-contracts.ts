import { Schema } from "effect";

import { UUIDSchema } from "../core/input-schemas";
import { MAX_NAME_LENGTH } from "./intake-config";

const VersionSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThan(0)
);
const NAME_MESSAGE = `Enter a form name between 1 and ${MAX_NAME_LENGTH} characters.`;

export const CreateIntakeFormInputSchema = Schema.Struct({
  clientCompanyId: UUIDSchema,
  name: Schema.Trim.check(
    Schema.isMinLength(1, { message: NAME_MESSAGE }),
    Schema.isMaxLength(MAX_NAME_LENGTH, { message: NAME_MESSAGE })
  ),
  projectId: UUIDSchema,
});

export const IntakeFormVersionInputSchema = Schema.Struct({
  expectedVersion: VersionSchema,
  formId: UUIDSchema,
});

export const SetIntakeFormEnabledInputSchema = Schema.Struct({
  enabled: Schema.Boolean,
  expectedVersion: VersionSchema,
  formId: UUIDSchema,
});

export const IntakeFormReceiptSchema = Schema.Struct({
  formId: UUIDSchema,
  slug: Schema.String,
  version: Schema.Number,
});

export const IntakeFormItemSchema = Schema.Struct({
  clientCompanyId: UUIDSchema,
  companyName: Schema.String,
  createdAt: Schema.String,
  enabled: Schema.Boolean,
  id: UUIDSchema,
  lastSubmissionAt: Schema.NullOr(Schema.String),
  name: Schema.String,
  projectId: UUIDSchema,
  projectKey: Schema.String,
  projectName: Schema.String,
  slug: Schema.String,
  submissionCount: Schema.Number,
  version: Schema.Number,
});

export const IntakeFormListSchema = Schema.Array(IntakeFormItemSchema);

export type CreateIntakeFormInput = typeof CreateIntakeFormInputSchema.Type;
export type IntakeFormVersionInput = typeof IntakeFormVersionInputSchema.Type;
export type SetIntakeFormEnabledInput =
  typeof SetIntakeFormEnabledInputSchema.Type;
export type IntakeFormReceipt = typeof IntakeFormReceiptSchema.Type;
export type IntakeFormItem = typeof IntakeFormItemSchema.Type;
