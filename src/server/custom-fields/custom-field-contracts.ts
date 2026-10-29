import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import {
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_OPTION_LENGTH,
  MAX_FIELD_OPTIONS,
} from "./custom-field-definition";
import { FieldTypeSchema } from "./custom-field-values";

const OptionsSchema = Schema.Array(
  Schema.String.check(Schema.isMaxLength(MAX_FIELD_OPTION_LENGTH * 4))
).check(Schema.isMaxLength(MAX_FIELD_OPTIONS * 4));

// The part an administrator types. The service trims and checks it again, so
// a bad value reads as a field error rather than a schema one.
export const CustomFieldDraftSchema = Schema.Struct({
  name: Schema.String.check(Schema.isMaxLength(MAX_FIELD_NAME_LENGTH * 4)),
  options: OptionsSchema,
  required: Schema.Boolean,
});
export type CustomFieldDraft = typeof CustomFieldDraftSchema.Type;

export const CreateCustomFieldInputSchema = Schema.Struct({
  ...CustomFieldDraftSchema.fields,
  projectId: UUIDSchema,
  type: FieldTypeSchema,
});
export type CreateCustomFieldInput = typeof CreateCustomFieldInputSchema.Type;

export const FieldValueSchema = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
]);

export const CustomFieldSchema = Schema.Struct({
  id: UUIDSchema,
  name: Schema.String,
  options: Schema.Array(Schema.String),
  position: Schema.Number,
  projectId: UUIDSchema,
  required: Schema.Boolean,
  type: FieldTypeSchema,
});
export type CustomFieldView = typeof CustomFieldSchema.Type;

export const CustomFieldListSchema = Schema.Array(CustomFieldSchema);

// What the task drawer shows: each active field with this task's value.
export const TaskCustomFieldSchema = Schema.Struct({
  ...CustomFieldSchema.fields,
  value: Schema.NullOr(FieldValueSchema),
});
export type TaskCustomField = typeof TaskCustomFieldSchema.Type;

export const TaskCustomFieldsSchema = Schema.Struct({
  canEdit: Schema.Boolean,
  fields: Schema.Array(TaskCustomFieldSchema),
});
export type TaskCustomFields = typeof TaskCustomFieldsSchema.Type;

// What the project table shows: the active fields and, per task id, the value
// of each field that task has one for.
export const ProjectCustomFieldTableSchema = Schema.Struct({
  fields: CustomFieldListSchema,
  values: Schema.Record(
    UUIDSchema,
    Schema.Record(UUIDSchema, FieldValueSchema)
  ),
});
export type ProjectCustomFieldTable = typeof ProjectCustomFieldTableSchema.Type;

export const CustomFieldReceiptSchema = Schema.Struct({ id: UUIDSchema });

export const ValueChangeSchema = Schema.Struct({ changed: Schema.Boolean });
export type ValueChange = typeof ValueChangeSchema.Type;

export class CustomFields extends Context.Service<
  CustomFields,
  {
    readonly create: (
      actorId: string,
      input: CreateCustomFieldInput
    ) => Effect.Effect<{ readonly id: string }, AppError>;
    readonly archive: (
      actorId: string,
      fieldId: string
    ) => Effect.Effect<void, AppError>;
    readonly reorder: (
      actorId: string,
      projectId: string,
      fieldIds: readonly string[]
    ) => Effect.Effect<void, AppError>;
    readonly clearValue: (
      actorId: string,
      taskId: string,
      fieldId: string
    ) => Effect.Effect<ValueChange, AppError>;
    readonly forTask: (
      actorId: string,
      taskId: string
    ) => Effect.Effect<TaskCustomFields, AppError>;
    readonly tableForProject: (
      actorId: string,
      projectId: string
    ) => Effect.Effect<ProjectCustomFieldTable, AppError>;
    readonly setValue: (
      actorId: string,
      taskId: string,
      fieldId: string,
      value: unknown
    ) => Effect.Effect<ValueChange, AppError>;
    readonly update: (
      actorId: string,
      fieldId: string,
      draft: CustomFieldDraft
    ) => Effect.Effect<void, AppError>;
    readonly listForProject: (
      actorId: string,
      projectId: string
    ) => Effect.Effect<readonly CustomFieldView[], AppError>;
  }
>()("taskora/server/CustomFields") {}
