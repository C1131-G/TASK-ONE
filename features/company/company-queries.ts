import "server-only";
import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import {
  CompanySettingsManagement,
  CompanySettingsManagementLive,
  CompanySettingsValuesSchema,
} from "@/src/server/company/company-settings";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";

export const getCompanySettings = async (input: unknown = {}) =>
  await runServerAction(
    input,
    Schema.Struct({}),
    (validated) =>
      Effect.gen(function* getSettings() {
        void validated;
        const currentHeaders = yield* requestHeadersOrFail;
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
