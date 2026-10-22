import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  callAs,
  ids,
  nextKey,
  replay,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { refreshes } from "./support/next-cache-mock";

const actions = await import("../../features/projects/automation-actions");
const queries = await import("../../features/projects/automation-queries");

beforeAll(setupHarness);
afterAll(async () => {
  await authPool.query('DELETE FROM automation_rule WHERE "projectId" = $1', [
    ids.projectId,
  ]);
  await teardownHarness();
});

const ruleCount = async (): Promise<number> => {
  const rows = await authPool.query(
    'SELECT count(*)::int AS count FROM automation_rule WHERE "projectId" = $1',
    [ids.projectId]
  );
  return rows.rows[0]?.count ?? 0;
};

const input = {
  actions: [{ priority: "high", type: "set_priority" }],
  conditions: [{ field: "status", op: "in", values: ["todo"] }],
  name: "Replay rule",
  trigger: "status_changed",
};

it("replays every automation mutation exactly once and asks the page to refresh", async () => {
  const refreshesBefore = refreshes.count;
  const created = await replay(
    "createAutomationRuleAction",
    "admin",
    actions.createAutomationRuleAction,
    { ...input, projectId: ids.projectId }
  );
  expect(await ruleCount()).toBe(1);
  expect(refreshes.count).toBeGreaterThan(refreshesBefore);

  await replay(
    "updateAutomationRuleAction",
    "admin",
    actions.updateAutomationRuleAction,
    {
      ...input,
      expectedVersion: created.version,
      name: "Renamed once",
      ruleId: created.id,
    }
  );
  const stored = await authPool.query<{ name: string; version: number }>(
    "SELECT name, version FROM automation_rule WHERE id = $1",
    [created.id]
  );
  expect(stored.rows[0]).toEqual({ name: "Renamed once", version: 2 });

  await replay(
    "setAutomationRuleEnabledAction",
    "admin",
    actions.setAutomationRuleEnabledAction,
    { enabled: false, ruleId: created.id }
  );
  const listed = await callAs("admin", queries.listAutomationRules, {
    projectId: ids.projectId,
  });
  expect(listed).toMatchObject({
    data: [{ enabled: false, id: created.id }],
    ok: true,
  });

  await replay(
    "removeAutomationRuleAction",
    "admin",
    actions.removeAutomationRuleAction,
    { ruleId: created.id }
  );
  expect(await ruleCount()).toBe(0);
});

it("reports field errors for an invalid rule and never lists to clients", async () => {
  const invalid = await callAs("admin", actions.createAutomationRuleAction, {
    ...input,
    actions: [],
    idempotencyKey: nextKey(),
    projectId: ids.projectId,
  });
  expect(invalid).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
  const client = await callAs("client", queries.listAutomationRules, {
    projectId: ids.projectId,
  });
  expect(client).toMatchObject({ ok: false });
  expect(JSON.stringify(client)).not.toContain("Replay rule");
});
