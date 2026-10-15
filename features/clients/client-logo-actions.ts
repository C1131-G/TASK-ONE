"use server";

import { Effect, Layer, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { AuthSessionLive } from "@/src/server/auth/session";
import { ClientCompanyReceiptSchema } from "@/src/server/clients/client-company-contracts";
import { ClientLogosLive } from "@/src/server/clients/client-logo";
import {
  ClientLogos,
  FinalizeClientLogoUploadInputSchema,
  RemoveClientLogoInputSchema,
  RequestClientLogoUploadInputSchema,
} from "@/src/server/clients/client-logo-contracts";
import type { AppError } from "@/src/server/core/action-result";
import { requireAdmin } from "@/src/server/core/admin-action";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import { StorageLive } from "@/src/server/storage/storage";
import { UploadTicketSchema } from "@/src/server/storage/uploads-contracts";

const withKey = <Fields extends Schema.Struct.Fields>(
  schema: Schema.Struct<Fields>
) => Schema.Struct({ ...schema.fields, idempotencyKey: IdempotencyKeySchema });

// Logo changes are admin-only and idempotent on their key; the company's
// optimistic version guards finalize and remove.
const runLogoAction = async <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
  OutputSchema extends Schema.Codec<unknown, unknown, never, never>,
>(
  input: unknown,
  schema: InputSchema,
  operation: string,
  outputSchema: OutputSchema,
  execute: (
    service: typeof ClientLogos.Service,
    administratorId: string,
    validated: Omit<InputSchema["Type"], "idempotencyKey">
  ) => Effect.Effect<OutputSchema["Type"], AppError>
) => {
  const result = await runServerAction(
    input,
    schema,
    (validated) =>
      Effect.gen(function* runClientLogoAction() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const service = yield* ClientLogos;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...logoInput } = validated as {
          readonly idempotencyKey: string;
        } & Omit<InputSchema["Type"], "idempotencyKey">;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () => execute(service, administrator.id, logoInput),
          input: logoInput,
          key: idempotencyKey,
          operation,
          resultSchema: outputSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(Layer.provide(ClientLogosLive, StorageLive)),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    outputSchema
  );
  return result;
};

const revalidateLogo = (companyId: string) => {
  revalidatePath(`/clients/${companyId}`);
  revalidatePath("/portal", "layout");
};

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function requestClientLogoUploadAction(input: unknown) {
  return await runLogoAction(
    input,
    withKey(RequestClientLogoUploadInputSchema),
    "client_company.logo_request",
    UploadTicketSchema,
    (service, administratorId, validated) =>
      service.requestLogoUpload(administratorId, validated)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function finalizeClientLogoUploadAction(input: unknown) {
  const result = await runLogoAction(
    input,
    withKey(FinalizeClientLogoUploadInputSchema),
    "client_company.logo_finalize",
    ClientCompanyReceiptSchema,
    (service, administratorId, validated) =>
      service.finalizeLogoUpload(administratorId, validated)
  );
  if (result.ok) {
    revalidateLogo(result.data.companyId);
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function removeClientLogoAction(input: unknown) {
  const result = await runLogoAction(
    input,
    withKey(RemoveClientLogoInputSchema),
    "client_company.logo_remove",
    ClientCompanyReceiptSchema,
    (service, administratorId, validated) =>
      service.removeLogo(administratorId, validated)
  );
  if (result.ok) {
    revalidateLogo(result.data.companyId);
  }
  return result;
}
