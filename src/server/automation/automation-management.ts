import { Context, Effect, Layer } from "effect";

import { AppError } from "../core/action-result";
import type {
  AutomationRuleInput,
  AutomationRuleSummary,
  AutomationRunSummary,
} from "./automation-contracts";
import {
  createRule,
  listRules,
  listRuns,
  removeRule,
  setRuleEnabled,
  updateRule,
} from "./automation-rule-ops";

export class AutomationManagement extends Context.Service<
  AutomationManagement,
  {
    readonly list: (
      actorId: string,
      projectId: string
    ) => Effect.Effect<readonly AutomationRuleSummary[], AppError>;
    readonly create: (
      actorId: string,
      projectId: string,
      input: AutomationRuleInput
    ) => Effect.Effect<AutomationRuleSummary, AppError>;
    readonly update: (
      actorId: string,
      ruleId: string,
      expectedVersion: number,
      input: AutomationRuleInput
    ) => Effect.Effect<AutomationRuleSummary, AppError>;
    readonly setEnabled: (
      actorId: string,
      ruleId: string,
      enabled: boolean
    ) => Effect.Effect<AutomationRuleSummary, AppError>;
    readonly remove: (
      actorId: string,
      ruleId: string
    ) => Effect.Effect<void, AppError>;
    readonly listRuns: (
      actorId: string,
      projectId: string,
      limit: number
    ) => Effect.Effect<readonly AutomationRunSummary[], AppError>;
  }
>()("taskora/server/AutomationManagement") {}

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "Automations could not be loaded or saved.",
      });

const attempt = <Value>(run: () => Promise<Value>) =>
  Effect.tryPromise({ catch: mapError, try: run });

export const AutomationManagementLive = Layer.succeed(
  AutomationManagement,
  AutomationManagement.of({
    create: (actorId, projectId, input) =>
      attempt(() => createRule(actorId, projectId, input)),
    list: (actorId, projectId) => attempt(() => listRules(actorId, projectId)),
    listRuns: (actorId, projectId, limit) =>
      attempt(() => listRuns(actorId, projectId, limit)),
    remove: (actorId, ruleId) => attempt(() => removeRule(actorId, ruleId)),
    setEnabled: (actorId, ruleId, enabled) =>
      attempt(() => setRuleEnabled(actorId, ruleId, enabled)),
    update: (actorId, ruleId, expectedVersion, input) =>
      attempt(() => updateRule(actorId, ruleId, expectedVersion, input)),
  })
);
