"use server";

import { Effect, Schema } from "effect";
import { refresh } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  CustomFields,
  FieldValueSchema,
  ValueChangeSchema,
} from "@/src/server/custom-fields/custom-field-contracts";
import { CustomFieldsLive } from "@/src/server/custom-fields/custom-fields";

// Sets one task's value for a field. Anyone who can edit the task may do it;
// the service checks the value against the field's type. Setting the value a
// task already has changes nothing.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function setCustomFieldValueAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      fieldId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
      taskId: UUIDSchema,
      // Checked against the field's type by the service, not by shape here.
      value: Schema.Union([FieldValueSchema, Schema.Null, Schema.Undefined]),
    }),
    ({ fieldId, idempotencyKey, taskId, value }) =>
      Effect.gen(function* setValue() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const fields = yield* CustomFields;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () => fields.setValue(actor.id, taskId, fieldId, value),
          input: { fieldId, taskId, value },
          key: idempotencyKey,
          operation: "customField.setValue",
          resultSchema: ValueChangeSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CustomFieldsLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ValueChangeSchema
  );
  if (result.ok) {
    refresh();
  }
  return result;
}

// Removes one task's value for a field. Clearing a value that is not set
// changes nothing.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function clearCustomFieldValueAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      fieldId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
      taskId: UUIDSchema,
    }),
    ({ fieldId, idempotencyKey, taskId }) =>
      Effect.gen(function* clearValue() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const fields = yield* CustomFields;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () => fields.clearValue(actor.id, taskId, fieldId),
          input: { fieldId, taskId },
          key: idempotencyKey,
          operation: "customField.clearValue",
          resultSchema: ValueChangeSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CustomFieldsLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ValueChangeSchema
  );
  if (result.ok) {
    refresh();
  }
  return result;
}
