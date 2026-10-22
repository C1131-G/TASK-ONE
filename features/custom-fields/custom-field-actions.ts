"use server";

import { Effect, Schema } from "effect";
import { refresh } from "next/cache";

import { AuthSessionLive } from "@/src/server/auth/session";
import { requireAdmin } from "@/src/server/core/admin-action";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  CreateCustomFieldInputSchema,
  CustomFieldDraftSchema,
  CustomFieldReceiptSchema,
  CustomFields,
} from "@/src/server/custom-fields/custom-field-contracts";
import { MAX_FIELDS_PER_PROJECT } from "@/src/server/custom-fields/custom-field-definition";
import { CustomFieldsLive } from "@/src/server/custom-fields/custom-fields";

// Defines a new field on a project. Administrators only.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createCustomFieldAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      ...CreateCustomFieldInputSchema.fields,
      idempotencyKey: IdempotencyKeySchema,
    }),
    ({ idempotencyKey, ...definition }) =>
      Effect.gen(function* createField() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const fields = yield* CustomFields;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () => fields.create(administrator.id, definition),
          input: definition,
          key: idempotencyKey,
          operation: "customField.create",
          resultSchema: CustomFieldReceiptSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CustomFieldsLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    CustomFieldReceiptSchema
  );
  if (result.ok) {
    refresh();
  }
  return result;
}

// Renames a field, changes its options or toggles required. The type stays.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateCustomFieldAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      ...CustomFieldDraftSchema.fields,
      fieldId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    ({ fieldId, idempotencyKey, ...draft }) =>
      Effect.gen(function* updateField() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const fields = yield* CustomFields;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            fields
              .update(administrator.id, fieldId, draft)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { fieldId, ...draft },
          key: idempotencyKey,
          operation: "customField.update",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CustomFieldsLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    DoneResultSchema
  );
  if (result.ok) {
    refresh();
  }
  return result;
}

// Hides a field from tasks and tables. Its values are kept.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function archiveCustomFieldAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      fieldId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    ({ fieldId, idempotencyKey }) =>
      Effect.gen(function* archiveField() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const fields = yield* CustomFields;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            fields
              .archive(administrator.id, fieldId)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { fieldId },
          key: idempotencyKey,
          operation: "customField.archive",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CustomFieldsLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    DoneResultSchema
  );
  if (result.ok) {
    refresh();
  }
  return result;
}

// Sets the display order from a complete list of the project's active fields.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function reorderCustomFieldsAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      fieldIds: Schema.Array(UUIDSchema).check(
        Schema.isMaxLength(MAX_FIELDS_PER_PROJECT)
      ),
      idempotencyKey: IdempotencyKeySchema,
      projectId: UUIDSchema,
    }),
    ({ fieldIds, idempotencyKey, projectId }) =>
      Effect.gen(function* reorderFields() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const fields = yield* CustomFields;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            fields
              .reorder(administrator.id, projectId, fieldIds)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { fieldIds, projectId },
          key: idempotencyKey,
          operation: "customField.reorder",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CustomFieldsLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    DoneResultSchema
  );
  if (result.ok) {
    refresh();
  }
  return result;
}
