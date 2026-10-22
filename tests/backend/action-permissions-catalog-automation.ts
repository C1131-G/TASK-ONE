import { entry } from "./action-permissions-shared";
import type { ActionEntry } from "./action-permissions-shared";
import { ids, nextKey } from "./support/action-harness";

const automationActions =
  await import("../../features/projects/automation-actions");
const automationQueries =
  await import("../../features/projects/automation-queries");

const rule = () => ({
  actions: [{ priority: "high", type: "set_priority" }],
  conditions: [{ field: "status", op: "in", values: ["todo"] }],
  name: "Harness permission rule",
  trigger: "status_changed",
});

// Automation rules and their run log are administrator-only end to end;
// clients and anonymous visitors never see them.
export const automationActionCatalog: readonly ActionEntry[] = [
  entry("listAutomationRules", automationQueries.listAutomationRules, () => ({
    projectId: ids.projectId,
  })),
  entry("listAutomationRuns", automationQueries.listAutomationRuns, () => ({
    limit: 10,
    projectId: ids.projectId,
  })),
  entry(
    "createAutomationRuleAction",
    automationActions.createAutomationRuleAction,
    () => ({ ...rule(), idempotencyKey: nextKey(), projectId: ids.projectId })
  ),
  entry(
    "updateAutomationRuleAction",
    automationActions.updateAutomationRuleAction,
    () => ({
      ...rule(),
      expectedVersion: 1,
      idempotencyKey: nextKey(),
      ruleId: ids.random,
    })
  ),
  entry(
    "setAutomationRuleEnabledAction",
    automationActions.setAutomationRuleEnabledAction,
    () => ({ enabled: false, idempotencyKey: nextKey(), ruleId: ids.random })
  ),
  entry(
    "removeAutomationRuleAction",
    automationActions.removeAutomationRuleAction,
    () => ({ idempotencyKey: nextKey(), ruleId: ids.random })
  ),
];

export const automationAdminOnlyNames: readonly string[] =
  automationActionCatalog.map(({ name }) => name);
