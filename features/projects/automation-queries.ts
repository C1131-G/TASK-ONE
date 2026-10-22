import "server-only";
import { Effect, Schema } from "effect";

import { AuthSessionLive } from "@/src/server/auth/session";
import {
  AutomationRuleListSchema,
  AutomationRunListSchema,
} from "@/src/server/automation/automation-contracts";
import {
  AutomationManagement,
  AutomationManagementLive,
} from "@/src/server/automation/automation-management";
import { requireAdmin } from "@/src/server/core/admin-action";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";

const ProjectInputSchema = Schema.Struct({
  projectId: Schema.String.check(Schema.isUUID()),
});

export const listAutomationRules = async (input: unknown) =>
  await runServerAction(
    input,
    ProjectInputSchema,
    ({ projectId }) =>
      Effect.gen(function* listRules() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const automation = yield* AutomationManagement;
        return yield* automation.list(administrator.id, projectId);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(AutomationManagementLive)
      ),
    undefined,
    AutomationRuleListSchema
  );

export const listAutomationRuns = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({
      ...ProjectInputSchema.fields,
      limit: Schema.Number.check(Schema.isInt()),
    }),
    ({ limit, projectId }) =>
      Effect.gen(function* listRuns() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const automation = yield* AutomationManagement;
        return yield* automation.listRuns(administrator.id, projectId, limit);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(AutomationManagementLive)
      ),
    undefined,
    AutomationRunListSchema
  );
