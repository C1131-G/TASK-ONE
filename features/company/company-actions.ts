"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import {
  CompanySettingsInputSchema,
  CompanySettingsManagement,
  CompanySettingsManagementLive,
  CompanySettingsValuesSchema,
} from "@/src/server/company/company-settings";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateCompanySettingsAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      ...CompanySettingsInputSchema.fields,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* updateSettings() {
        const currentHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(currentHeaders);
        const settings = yield* CompanySettingsManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...settingsInput } = validated;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () => settings.update(actor.id, settingsInput),
          input: settingsInput,
          key: idempotencyKey,
          operation: "companySettings.update",
          resultSchema: CompanySettingsValuesSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CompanySettingsManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/settings");
  }
  return result;
}
