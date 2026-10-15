import "server-only";
import { Effect, Schema } from "effect";

import { AuthSessionLive } from "@/src/server/auth/session";
import {
  SlaSettingsManagement,
  SlaSettingsManagementLive,
  SlaSettingsValuesSchema,
} from "@/src/server/company/sla-settings";
import { requireAdmin } from "@/src/server/core/admin-action";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";

export const getSlaSettings = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* getSlaSettingsProgram() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const settings = yield* SlaSettingsManagement;
        return yield* settings.get(administrator.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(SlaSettingsManagementLive)
      ),
    undefined,
    SlaSettingsValuesSchema
  );
