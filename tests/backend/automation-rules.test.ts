import { afterAll, afterEach, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { MAX_RULES_PER_PROJECT } from "../../src/server/automation/automation-contracts";
import type { AutomationRuleInput } from "../../src/server/automation/automation-contracts";
import {
  AutomationManagement,
  AutomationManagementLive,
} from "../../src/server/automation/automation-management";
import {
  createAutomationWorld,
  createTaskRow,
  destroyAutomationWorld,
  insertRule,
} from "./support/automation-fixtures";
import type { AutomationWorld } from "./support/automation-fixtures";

type Service = AutomationManagement["Service"];

const use = <Value, Failure>(
  program: (service: Service) => Effect.Effect<Value, Failure>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* run() {
        return yield* program(yield* AutomationManagement);
      }),
      AutomationManagementLive
    )
  );

const failureOf = (
  program: (service: Service) => Effect.Effect<unknown, { code: string }>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* run() {
        const error = yield* Effect.flip(program(yield* AutomationManagement));
        return error.code;
      }),
      AutomationManagementLive
    )
  );

let world: AutomationWorld;

beforeAll(async () => {
  world = await createAutomationWorld("automation-rules.example");
});
afterEach(async () => {
  await authPool.query('DELETE FROM automation_rule WHERE "projectId" = $1', [
    world.projectId,
  ]);
});
afterAll(async () => {
  await destroyAutomationWorld(world);
});

const rule = (
  overrides: Partial<AutomationRuleInput> = {}
): AutomationRuleInput => ({
  actions: [{ priority: "urgent", type: "set_priority" }],
  conditions: [{ field: "status", op: "in", values: ["todo"] }],
  name: "Escalate",
  trigger: "status_changed",
  ...overrides,
});

it("lets an administrator create, list, update, disable and remove a rule", async () => {
  const created = await use((service) =>
    service.create(world.adminId, world.projectId, rule())
  );
  expect(created).toMatchObject({
    enabled: true,
    name: "Escalate",
    projectId: world.projectId,
    trigger: "status_changed",
    version: 1,
  });

  const listed = await use((service) =>
    service.list(world.adminId, world.projectId)
  );
  expect(listed.map(({ id }) => id)).toEqual([created.id]);

  const updated = await use((service) =>
    service.update(
      world.adminId,
      created.id,
      created.version,
      rule({
        actions: [{ type: "assign", userId: world.staffId }],
        name: "Assign on progress",
      })
    )
  );
  expect(updated).toMatchObject({ name: "Assign on progress", version: 2 });
  expect(updated.actions).toEqual([{ type: "assign", userId: world.staffId }]);

  const disabled = await use((service) =>
    service.setEnabled(world.adminId, created.id, false)
  );
  expect(disabled.enabled).toBe(false);

  await use((service) => service.remove(world.adminId, created.id));
  expect(
    await use((service) => service.list(world.adminId, world.projectId))
  ).toEqual([]);

  const audit = await authPool.query<{ action: string }>(
    'SELECT action FROM activity WHERE "projectId" = $1 AND action LIKE \'automation_rule.%\' ORDER BY "createdAt"',
    [world.projectId]
  );
  expect(audit.rows.map(({ action }) => action)).toEqual([
    "automation_rule.created",
    "automation_rule.updated",
    "automation_rule.disabled",
    "automation_rule.removed",
  ]);
});

it("refuses everyone but active administrators, for every operation", async () => {
  const existing = await insertRule(world, {
    actions: [{ priority: "low", type: "set_priority" }],
    trigger: "task_created",
  });
  const denied: readonly [string, string][] = [
    [world.staffId, "FORBIDDEN"],
    [world.clientId, "FORBIDDEN"],
    [world.deactivatedId, "UNAUTHENTICATED"],
    [randomUUID(), "UNAUTHENTICATED"],
  ];
  const codesFor = async (actorId: string): Promise<string[]> =>
    await Promise.all([
      failureOf((service) => service.list(actorId, world.projectId)),
      failureOf((service) => service.create(actorId, world.projectId, rule())),
      failureOf((service) => service.update(actorId, existing, 1, rule())),
      failureOf((service) => service.setEnabled(actorId, existing, false)),
      failureOf((service) => service.remove(actorId, existing)),
      failureOf((service) => service.listRuns(actorId, world.projectId, 10)),
    ]);
  await Promise.all(
    denied.map(async ([actorId, expected]) => {
      const codes = await codesFor(actorId);
      expect(codes).toEqual(codes.map(() => expected));
    })
  );
  const rows = await authPool.query(
    "SELECT enabled, name FROM automation_rule WHERE id = $1",
    [existing]
  );
  expect(rows.rows).toHaveLength(1);
  expect(rows.rows[0]).toMatchObject({ enabled: true });
});

it("enforces the per-project rule limit", async () => {
  for (let count = 0; count < MAX_RULES_PER_PROJECT; count += 1) {
    // eslint-disable-next-line no-await-in-loop
    await insertRule(world, {
      actions: [{ priority: "low", type: "set_priority" }],
      trigger: "task_created",
    });
  }
  const error = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* run() {
        const service = yield* AutomationManagement;
        return yield* Effect.flip(
          service.create(world.adminId, world.projectId, rule())
        );
      }),
      AutomationManagementLive
    )
  );
  expect(error.code).toBe("VALIDATION_FAILED");
  expect(error.message).toContain(String(MAX_RULES_PER_PROJECT));
});

it("rejects rules that name people or labels that cannot be used", async () => {
  const bad: readonly AutomationRuleInput["actions"][number][] = [
    { type: "assign", userId: world.clientId },
    { type: "assign", userId: world.deactivatedId },
    { type: "unassign", userId: randomUUID() },
    { message: "Hi", type: "notify", userId: world.clientId },
    { labelId: randomUUID(), type: "add_label" },
  ];
  const codes = await Promise.all(
    bad.map(
      async (action) =>
        await failureOf((service) =>
          service.create(
            world.adminId,
            world.projectId,
            rule({ actions: [action] })
          )
        )
    )
  );
  expect(codes).toEqual(bad.map(() => "VALIDATION_FAILED"));
  expect(
    await failureOf((service) =>
      service.create(
        world.adminId,
        world.projectId,
        rule({
          conditions: [{ field: "assignee", op: "in", values: [randomUUID()] }],
        })
      )
    )
  ).toBe("VALIDATION_FAILED");
  expect(
    await failureOf((service) =>
      service.create(
        world.adminId,
        world.projectId,
        rule({
          conditions: [{ field: "label", op: "in", values: [randomUUID()] }],
        })
      )
    )
  ).toBe("VALIDATION_FAILED");
});

it("re-validates the typed schema in the service", async () => {
  const invalid = { ...rule(), trigger: "task_deleted" };
  expect(
    await failureOf((service) =>
      service.create(
        world.adminId,
        world.projectId,
        invalid as unknown as AutomationRuleInput
      )
    )
  ).toBe("VALIDATION_FAILED");
});

it("reports missing and archived projects and rules", async () => {
  expect(
    await failureOf((service) =>
      service.create(world.adminId, randomUUID(), rule())
    )
  ).toBe("NOT_FOUND");
  expect(
    await failureOf((service) =>
      service.update(world.adminId, randomUUID(), 1, rule())
    )
  ).toBe("NOT_FOUND");
  expect(
    await failureOf((service) => service.remove(world.adminId, randomUUID()))
  ).toBe("NOT_FOUND");
  expect(
    await failureOf((service) =>
      service.setEnabled(world.adminId, randomUUID(), true)
    )
  ).toBe("NOT_FOUND");
});

it("rejects an update made from a stale version", async () => {
  const created = await use((service) =>
    service.create(world.adminId, world.projectId, rule())
  );
  await use((service) =>
    service.update(world.adminId, created.id, 1, rule({ name: "First" }))
  );
  expect(
    await failureOf((service) =>
      service.update(world.adminId, created.id, 1, rule({ name: "Stale" }))
    )
  ).toBe("CONFLICT");
});

it("lists the run log newest first with rule names and task keys", async () => {
  const ruleId = await insertRule(world, {
    actions: [{ priority: "low", type: "set_priority" }],
    name: "Logged rule",
    trigger: "task_created",
  });
  const taskId = await createTaskRow(world);
  for (const [outcome, reason, age] of [
    ["matched", null, 3],
    ["skipped", "conditions_not_met", 2],
    ["failed", "assign: that person is not an active team member", 1],
  ] as const) {
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(
      'INSERT INTO automation_run (id, "ruleId", "projectId", "taskId", "eventId", trigger, outcome, reason, "createdAt") VALUES ($1, $2, $3, $4, $5, \'task_created\', $6, $7, now() - ($8 || \' minutes\')::interval)',
      [
        randomUUID(),
        ruleId,
        world.projectId,
        taskId,
        randomUUID(),
        outcome,
        reason,
        String(age),
      ]
    );
  }
  const runs = await use((service) =>
    service.listRuns(world.adminId, world.projectId, 2)
  );
  expect(runs.map(({ outcome }) => outcome)).toEqual(["failed", "skipped"]);
  expect(runs[0]).toMatchObject({
    ruleName: "Logged rule",
    taskId,
    trigger: "task_created",
  });
  expect(runs[0]?.taskKey).toMatch(/^A[0-9a-f]{7}-\d+$/u);
  const other = await use((service) =>
    service.listRuns(world.adminId, world.otherProjectId, 10)
  );
  expect(other).toEqual([]);
});

it("deleting a rule removes its run log", async () => {
  const created = await use((service) =>
    service.create(world.adminId, world.projectId, rule())
  );
  const taskId = await createTaskRow(world);
  await authPool.query(
    'INSERT INTO automation_run (id, "ruleId", "projectId", "taskId", "eventId", trigger, outcome) VALUES ($1, $2, $3, $4, $5, \'status_changed\', \'matched\')',
    [randomUUID(), created.id, world.projectId, taskId, randomUUID()]
  );
  await use((service) => service.remove(world.adminId, created.id));
  const runs = await authPool.query(
    'SELECT id FROM automation_run WHERE "ruleId" = $1',
    [created.id]
  );
  expect(runs.rows).toHaveLength(0);
});
