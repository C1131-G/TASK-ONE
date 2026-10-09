"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import {
  CompanySettingsInputSchema,
  CompanySettingsManagement,
  CompanySettingsManagementLive,
  CompanySettingsValuesSchema,
} from "@/src/server/company/company-settings";
import { AppError } from "@/src/server/core/action-result";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";

const requestHeaders = () =>
  Effect.tryPromise({
    catch: () =>
      new AppError({ code: "UNAVAILABLE", message: "Request failed." }),
    try: () => headers(),
  });

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function getCompanySettingsAction(input: unknown = {}) {
  return await runServerAction(
    input,
    Schema.Struct({}),
    (validated) =>
      Effect.gen(function* getSettings() {
        void validated;
        const currentHeaders = yield* requestHeaders();
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(currentHeaders);
        const settings = yield* CompanySettingsManagement;
        return yield* settings.get(actor.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CompanySettingsManagementLive)
      ),
    undefined,
    CompanySettingsValuesSchema
  );
}

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
        const currentHeaders = yield* requestHeaders();
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
      )
  );
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/settings");
  }
  return result;
}
