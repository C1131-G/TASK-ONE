"use server";

import { Effect, Schema, Layer } from "effect";
import { revalidatePath } from "next/cache";

import { auditEffect } from "@/src/server/audit/audit-log";
import { AuthSessionLive } from "@/src/server/auth/session";
import type { ClientCompanyReceipt } from "@/src/server/clients/client-company-contracts";
import {
  ClientCompanyManagement,
  ClientCompanyReceiptSchema,
  ClientCompanyVersionInputSchema,
  ClientUserIdInputSchema,
  CreateClientCompanyInputSchema,
  CreateClientUserInputSchema,
  CreatedClientUserSchema,
  SetClientCompanyHandlersInputSchema,
  SetClientCompanyProjectsInputSchema,
  UpdateClientCompanyInputSchema,
} from "@/src/server/clients/client-company-contracts";
import { ClientCompanyManagementLive } from "@/src/server/clients/client-company-management";
import { ClientLogosLive } from "@/src/server/clients/client-logo";
import {
  ClientLogos,
  FinalizeClientLogoUploadInputSchema,
  RemoveClientLogoInputSchema,
  RequestClientLogoUploadInputSchema,
} from "@/src/server/clients/client-logo-contracts";
import type { AppError } from "@/src/server/core/action-result";
import { requireAdmin } from "@/src/server/core/admin-action";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  UserManagement,
  UserManagementLive,
} from "@/src/server/people/user-management";
import { StorageLive } from "@/src/server/storage/storage";
import { UploadTicketSchema } from "@/src/server/storage/uploads-contracts";

const companyAuditTypes: Record<
  string,
  "company_deactivated" | "company_reactivated"
> = {
  "client_company.deactivate": "company_deactivated",
  "client_company.reactivate": "company_reactivated",
};

const withKey = <Fields extends Schema.Struct.Fields>(
  schema: Schema.Struct<Fields>
) => Schema.Struct({ ...schema.fields, idempotencyKey: IdempotencyKeySchema });

// Company mutations are admin-only, idempotent on their key, and guarded by
// the company's optimistic version.
const runCompanyAction = async <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
>(
  input: unknown,
  schema: InputSchema,
  operation: string,
  execute: (
    service: typeof ClientCompanyManagement.Service,
    administratorId: string,
    validated: Omit<InputSchema["Type"], "idempotencyKey">
  ) => Effect.Effect<ClientCompanyReceipt, AppError>
) => {
  const result = await runServerAction(
    input,
    schema,
    (validated) =>
      Effect.gen(function* runClientCompanyAction() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const service = yield* ClientCompanyManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...companyInput } = validated as {
          readonly idempotencyKey: string;
        } & Omit<InputSchema["Type"], "idempotencyKey">;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            execute(service, administrator.id, companyInput).pipe(
              Effect.tap((receipt) => {
                const type = companyAuditTypes[operation];
                return type
                  ? auditEffect({
                      actorId: administrator.id,
                      details: { companyId: receipt.companyId },
                      headers: requestHeaders,
                      type,
                    })
                  : Effect.void;
              })
            ),
          input: companyInput,
          key: idempotencyKey,
          operation,
          resultSchema: ClientCompanyReceiptSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ClientCompanyManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ClientCompanyReceiptSchema
  );
  if (result.ok) {
    revalidatePath("/clients");
  }
  return result;
};

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createClientCompanyAction(input: unknown) {
  return await runCompanyAction(
    input,
    withKey(CreateClientCompanyInputSchema),
    "client_company.create",
    (service, administratorId, validated) =>
      service.createCompany(administratorId, validated)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateClientCompanyAction(input: unknown) {
  return await runCompanyAction(
    input,
    withKey(UpdateClientCompanyInputSchema),
    "client_company.update",
    (service, administratorId, validated) =>
      service.updateCompany(administratorId, validated)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function setClientCompanyProjectsAction(input: unknown) {
  return await runCompanyAction(
    input,
    withKey(SetClientCompanyProjectsInputSchema),
    "client_company.set_projects",
    (service, administratorId, validated) =>
      service.setProjects(administratorId, validated)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function setClientCompanyHandlersAction(input: unknown) {
  return await runCompanyAction(
    input,
    withKey(SetClientCompanyHandlersInputSchema),
    "client_company.set_handlers",
    (service, administratorId, validated) =>
      service.setHandlers(administratorId, validated)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function deactivateClientCompanyAction(input: unknown) {
  return await runCompanyAction(
    input,
    withKey(ClientCompanyVersionInputSchema),
    "client_company.deactivate",
    (service, administratorId, validated) =>
      service.deactivateCompany(administratorId, validated)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function reactivateClientCompanyAction(input: unknown) {
  return await runCompanyAction(
    input,
    withKey(ClientCompanyVersionInputSchema),
    "client_company.reactivate",
    (service, administratorId, validated) =>
      service.reactivateCompany(administratorId, validated)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createClientUserAction(input: unknown) {
  const result = await runServerAction(
    input,
    CreateClientUserInputSchema,
    (validated) =>
      Effect.gen(function* createClientUser() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const service = yield* ClientCompanyManagement;
        return yield* service.createClientUser(administrator.id, validated);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ClientCompanyManagementLive)
      ),
    undefined,
    CreatedClientUserSchema
  );
  if (result.ok) {
    revalidatePath("/clients");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function unlockUserAction(input: unknown) {
  const result = await runServerAction(
    input,
    ClientUserIdInputSchema,
    (validated) =>
      Effect.gen(function* unlockUser() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const users = yield* UserManagement;
        const wasLocked = yield* users.unlockUser(
          administrator.id,
          validated.userId
        );
        // A repeated unlock changes nothing, so it adds no audit row.
        if (wasLocked) {
          yield* auditEffect({
            actorId: administrator.id,
            headers: yield* requestHeadersOrFail,
            subjectUserId: validated.userId,
            type: "account_unlocked",
          });
        }
        return { done: true as const };
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(UserManagementLive)
      ),
    undefined,
    DoneResultSchema
  );
  if (result.ok) {
    revalidatePath("/clients");
  }
  return result;
}

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
