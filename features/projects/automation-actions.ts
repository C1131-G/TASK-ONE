"use server";

import { Effect, Schema } from "effect";
import { refresh } from "next/cache";

import { AuthSessionLive } from "@/src/server/auth/session";
import {
  AutomationRuleInputSchema,
  AutomationRuleSummarySchema,
} from "@/src/server/automation/automation-contracts";
import {
  AutomationManagement,
  AutomationManagementLive,
} from "@/src/server/automation/automation-management";
import type { AppError } from "@/src/server/core/action-result";
import { requireAdmin } from "@/src/server/core/admin-action";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";

const IdSchema = Schema.String.check(Schema.isUUID());
const RemovedSchema = Schema.Struct({ removed: Schema.Literal(true) });
const VersionSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(1)
);

type Service = typeof AutomationManagement.Service;

const withKey = <Fields extends Schema.Struct.Fields>(fields: Fields) =>
  Schema.Struct({ ...fields, idempotencyKey: IdempotencyKeySchema });

// Automation changes are admin-only and idempotent on their key, like every
// other mutation; success refreshes the page's server data.
const runRuleAction = async <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
  ResultSchema extends Schema.Codec<unknown, unknown, never, never>,
>(
  input: unknown,
  schema: InputSchema,
  operation: string,
  resultSchema: ResultSchema,
  execute: (
    service: Service,
    administratorId: string,
    validated: Omit<InputSchema["Type"], "idempotencyKey">
  ) => Effect.Effect<ResultSchema["Type"], AppError>
) => {
  const result = await runServerAction(
    input,
    schema,
    (validated) =>
      Effect.gen(function* runAutomationAction() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const service = yield* AutomationManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...ruleInput } = validated as {
          readonly idempotencyKey: string;
        } & Omit<InputSchema["Type"], "idempotencyKey">;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () => execute(service, administrator.id, ruleInput),
          input: ruleInput,
          key: idempotencyKey,
          operation,
          resultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(AutomationManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    resultSchema
  );
  if (result.ok) {
    refresh();
  }
  return result;
};

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createAutomationRuleAction(input: unknown) {
  return await runRuleAction(
    input,
    withKey({ ...AutomationRuleInputSchema.fields, projectId: IdSchema }),
    "automation.create",
    AutomationRuleSummarySchema,
    (service, administratorId, { projectId, ...rule }) =>
      service.create(administratorId, projectId, rule)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateAutomationRuleAction(input: unknown) {
  return await runRuleAction(
    input,
    withKey({
      ...AutomationRuleInputSchema.fields,
      expectedVersion: VersionSchema,
      ruleId: IdSchema,
    }),
    "automation.update",
    AutomationRuleSummarySchema,
    (service, administratorId, { expectedVersion, ruleId, ...rule }) =>
      service.update(administratorId, ruleId, expectedVersion, rule)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function setAutomationRuleEnabledAction(input: unknown) {
  return await runRuleAction(
    input,
    withKey({ enabled: Schema.Boolean, ruleId: IdSchema }),
    "automation.set_enabled",
    AutomationRuleSummarySchema,
    (service, administratorId, { enabled, ruleId }) =>
      service.setEnabled(administratorId, ruleId, enabled)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function removeAutomationRuleAction(input: unknown) {
  return await runRuleAction(
    input,
    withKey({ ruleId: IdSchema }),
    "automation.remove",
    RemovedSchema,
    (service, administratorId, { ruleId }) =>
      service
        .remove(administratorId, ruleId)
        .pipe(Effect.as({ removed: true as const }))
  );
}
