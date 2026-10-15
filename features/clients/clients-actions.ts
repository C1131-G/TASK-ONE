"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

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
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const service = yield* ClientCompanyManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...companyInput } = validated as {
          readonly idempotencyKey: string;
        } & Omit<InputSchema["Type"], "idempotencyKey">;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () => execute(service, administrator.id, companyInput),
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
        yield* users.unlockUser(administrator.id, validated.userId);
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
