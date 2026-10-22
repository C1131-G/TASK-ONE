"use server";

import { Effect, Schema } from "effect";
import { refresh, revalidatePath } from "next/cache";

import { AuthSessionLive } from "@/src/server/auth/session";
import type { AppError } from "@/src/server/core/action-result";
import { requireAdmin } from "@/src/server/core/admin-action";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  CreateIntakeFormInputSchema,
  IntakeFormReceiptSchema,
  IntakeFormVersionInputSchema,
  SetIntakeFormEnabledInputSchema,
} from "@/src/server/intake/intake-form-contracts";
import type { IntakeFormReceipt } from "@/src/server/intake/intake-form-contracts";
import {
  IntakeFormManagement,
  IntakeFormManagementLive,
} from "@/src/server/intake/intake-forms";

const withKey = <Fields extends Schema.Struct.Fields>(
  schema: Schema.Struct<Fields>
) => Schema.Struct({ ...schema.fields, idempotencyKey: IdempotencyKeySchema });

// Intake form changes are admin-only and idempotent on their key.
const runFormAction = async <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
>(
  input: unknown,
  schema: InputSchema,
  operation: string,
  execute: (
    service: typeof IntakeFormManagement.Service,
    administratorId: string,
    validated: Omit<InputSchema["Type"], "idempotencyKey">
  ) => Effect.Effect<IntakeFormReceipt, AppError>
) => {
  const result = await runServerAction(
    input,
    schema,
    (validated) =>
      Effect.gen(function* runIntakeFormAction() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const service = yield* IntakeFormManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...formInput } = validated as {
          readonly idempotencyKey: string;
        } & Omit<InputSchema["Type"], "idempotencyKey">;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () => execute(service, administrator.id, formInput),
          input: formInput,
          key: idempotencyKey,
          operation,
          resultSchema: IntakeFormReceiptSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(IntakeFormManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    IntakeFormReceiptSchema
  );
  if (result.ok) {
    revalidatePath("/settings");
    refresh();
  }
  return result;
};

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createIntakeFormAction(input: unknown) {
  return await runFormAction(
    input,
    withKey(CreateIntakeFormInputSchema),
    "intake_form.create",
    (service, administratorId, validated) =>
      service.create(administratorId, validated)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function rotateIntakeFormAction(input: unknown) {
  return await runFormAction(
    input,
    withKey(IntakeFormVersionInputSchema),
    "intake_form.rotate",
    (service, administratorId, validated) =>
      service.rotate(administratorId, validated)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function setIntakeFormEnabledAction(input: unknown) {
  return await runFormAction(
    input,
    withKey(SetIntakeFormEnabledInputSchema),
    "intake_form.set_enabled",
    (service, administratorId, validated) =>
      service.setEnabled(administratorId, validated)
  );
}
