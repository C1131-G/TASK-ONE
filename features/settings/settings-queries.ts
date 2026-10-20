import "server-only";
import { Effect, Layer, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import {
  CompanySettingsManagement,
  CompanySettingsManagementLive,
  CompanySettingsValuesSchema,
} from "@/src/server/company/company-settings";
import {
  SlaSettingsManagement,
  SlaSettingsManagementLive,
  SlaSettingsValuesSchema,
} from "@/src/server/company/sla-settings";
import { requireAdmin } from "@/src/server/core/admin-action";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import { JobHandlersLive } from "@/src/server/jobs/job-handlers-live";
import {
  DeadJobListSchema,
  JobProcessor,
  JobProcessorLive,
} from "@/src/server/jobs/processor";
import { PushTransportLive } from "@/src/server/notifications/push-transport";
import { StorageLive } from "@/src/server/storage/storage";

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

// Jobs that exhausted their retries, for an administrator to inspect.
export const listDeadJobs = async (input: unknown) => {
  const result = await runServerAction(
    input,
    Schema.Struct({ limit: Schema.Number }),
    ({ limit }) =>
      Effect.gen(function* listDeadJobsProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
        const user = yield* requireAdmin(requestHeaders);
        const processor = yield* JobProcessor;
        return yield* processor.listDeadJobs(user.id, limit);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(
          Layer.provide(
            JobProcessorLive,
            Layer.provide(
              JobHandlersLive,
              Layer.merge(StorageLive, PushTransportLive)
            )
          )
        )
      ),
    undefined,
    DeadJobListSchema
  );
  return result;
};
