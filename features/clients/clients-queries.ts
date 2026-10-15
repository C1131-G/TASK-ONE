import "server-only";
import { Effect, Schema } from "effect";

import { AuthSessionLive } from "@/src/server/auth/session";
import {
  ClientCompanyDetailSchema,
  ClientCompanyIdInputSchema,
  ClientCompanyManagement,
  ClientCompanySummaryListSchema,
} from "@/src/server/clients/client-company-contracts";
import { ClientCompanyManagementLive } from "@/src/server/clients/client-company-management";
import { requireAdmin } from "@/src/server/core/admin-action";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";

export const listClientCompanies = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* listClientCompaniesProgram() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const companies = yield* ClientCompanyManagement;
        return yield* companies.listCompanies(administrator.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ClientCompanyManagementLive)
      ),
    undefined,
    ClientCompanySummaryListSchema
  );

export const getClientCompany = async (input: unknown) =>
  await runServerAction(
    input,
    ClientCompanyIdInputSchema,
    (validated) =>
      Effect.gen(function* getClientCompanyProgram() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const companies = yield* ClientCompanyManagement;
        return yield* companies.getCompany(
          administrator.id,
          validated.companyId
        );
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ClientCompanyManagementLive)
      ),
    undefined,
    ClientCompanyDetailSchema
  );
