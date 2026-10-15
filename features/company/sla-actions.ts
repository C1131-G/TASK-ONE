"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { AuthSessionLive } from "@/src/server/auth/session";
import {
  SlaSettingsInputSchema,
  SlaSettingsManagement,
  SlaSettingsManagementLive,
  SlaSettingsValuesSchema,
} from "@/src/server/company/sla-settings";
import { requireAdmin } from "@/src/server/core/admin-action";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateSlaSettingsAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      ...SlaSettingsInputSchema.fields,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* updateSlaSettings() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const settings = yield* SlaSettingsManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...settingsInput } = validated;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () => settings.update(administrator.id, settingsInput),
          input: settingsInput,
          key: idempotencyKey,
          operation: "companySettings.sla.update",
          resultSchema: SlaSettingsValuesSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(SlaSettingsManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    SlaSettingsValuesSchema
  );
  if (result.ok) {
    revalidatePath("/settings");
    revalidatePath("/bugs");
  }
  return result;
}
