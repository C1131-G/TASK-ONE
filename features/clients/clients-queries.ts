import "server-only";
import { Effect, Layer, Schema } from "effect";

import {
  AuditFilterSchema,
  AuditListSchema,
  AuditLog,
  AuditLogLive,
  LockedAccountListSchema,
} from "@/src/server/audit/audit-log";
import { AuthSessionLive } from "@/src/server/auth/session";
import {
  ClientCompanyAdminDetailSchema,
  ClientCompanyIdInputSchema,
  ClientCompanyManagement,
  ClientCompanySummaryListSchema,
} from "@/src/server/clients/client-company-contracts";
import { ClientCompanyManagementLive } from "@/src/server/clients/client-company-management";
import { ClientLogosLive } from "@/src/server/clients/client-logo";
import { ClientLogos } from "@/src/server/clients/client-logo-contracts";
import { requireAdmin } from "@/src/server/core/admin-action";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import { StorageLive } from "@/src/server/storage/storage";

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
        const logos = yield* ClientLogos;
        const detail = yield* companies.getCompany(
          administrator.id,
          validated.companyId
        );
        // A signing failure only hides the logo; the page still loads.
        const logoUrl = yield* logos
          .signedLogo(administrator.id, detail.company.id)
          .pipe(Effect.orElseSucceed(() => null));
        return { ...detail, logoUrl };
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ClientCompanyManagementLive),
        Effect.provide(Layer.provide(ClientLogosLive, StorageLive))
      ),
    undefined,
    ClientCompanyAdminDetailSchema
  );

export const listAuditEvents = async (input: unknown) =>
  await runServerAction(
    input,
    AuditFilterSchema,
    (validated) =>
      Effect.gen(function* listAuditEventsProgram() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const audit = yield* AuditLog;
        return yield* audit.list(administrator.id, validated);
      }).pipe(Effect.provide(AuthSessionLive), Effect.provide(AuditLogLive)),
    undefined,
    AuditListSchema
  );

export const listLockedAccounts = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* listLockedAccountsProgram() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const audit = yield* AuditLog;
        return yield* audit.lockedAccounts(administrator.id);
      }).pipe(Effect.provide(AuthSessionLive), Effect.provide(AuditLogLive)),
    undefined,
    LockedAccountListSchema
  );
