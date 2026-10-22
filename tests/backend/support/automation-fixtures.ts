import { randomUUID } from "node:crypto";

import { authPool } from "../../../src/server/auth/database";

export interface AutomationWorld {
  readonly domain: string;
  readonly adminId: string;
  readonly staffId: string;
  readonly otherStaffId: string;
  readonly clientId: string;
  readonly deactivatedId: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly otherProjectId: string;
  readonly labelId: string;
}

const insertUser = (
  id: string,
  domain: string,
  name: string,
  role: string,
  extra = ""
) =>
  authPool.query(
    `INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword"${extra ? ', "clientCompanyId"' : ""}) VALUES ($1, $2, $3, $3, $4, false${extra ? ", $5" : ""})`,
    extra
      ? [id, name, `${id}@${domain}`, role, extra]
      : [id, name, `${id}@${domain}`, role]
  );

export const createAutomationWorld = async (
  domain: string
): Promise<AutomationWorld> => {
  const world: AutomationWorld = {
    adminId: randomUUID(),
    clientId: randomUUID(),
    companyId: randomUUID(),
    deactivatedId: randomUUID(),
    domain,
    labelId: randomUUID(),
    otherProjectId: randomUUID(),
    otherStaffId: randomUUID(),
    projectId: randomUUID(),
    staffId: randomUUID(),
  };
  await insertUser(world.adminId, domain, "Automation Admin", "admin");
  await insertUser(world.staffId, domain, "Automation Staff", "employee");
  await insertUser(world.otherStaffId, domain, "Other Staff", "employee");
  await insertUser(world.deactivatedId, domain, "Gone Staff", "employee");
  await authPool.query(
    'UPDATE "user" SET "deactivatedAt" = now(), "deactivatedById" = $2 WHERE id = $1',
    [world.deactivatedId, world.adminId]
  );
  await authPool.query(
    'INSERT INTO client_company (id, name, "createdById") VALUES ($1, $2, $3)',
    [world.companyId, `Automation client ${world.companyId}`, world.adminId]
  );
  await insertUser(
    world.clientId,
    domain,
    "Automation Client",
    "client",
    world.companyId
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, 'Automation project'), ($3, $4, 'Other automation project')",
    [
      world.projectId,
      `A${world.projectId.slice(0, 7)}`,
      world.otherProjectId,
      `O${world.otherProjectId.slice(0, 7)}`,
    ]
  );
  await authPool.query(
    "INSERT INTO label (id, name, color) VALUES ($1, $2, '#336699')",
    [world.labelId, `automation-${world.labelId}`]
  );
  return world;
};

let taskNumber = 0;

export const createTaskRow = async (
  world: AutomationWorld,
  overrides: {
    readonly status?: string;
    readonly priority?: string;
    readonly type?: string;
    readonly projectId?: string;
    readonly dueDate?: string | null;
  } = {}
): Promise<string> => {
  const id = randomUUID();
  taskNumber += 1;
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById", status, priority, type, "dueDate") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [
      id,
      overrides.projectId ?? world.projectId,
      taskNumber,
      "Automation task",
      world.adminId,
      overrides.status ?? "todo",
      overrides.priority ?? "none",
      overrides.type ?? "task",
      overrides.dueDate ?? null,
    ]
  );
  return id;
};

export const insertRule = async (
  world: AutomationWorld,
  rule: {
    readonly trigger: string;
    readonly conditions?: readonly unknown[];
    readonly actions: readonly unknown[];
    readonly enabled?: boolean;
    readonly name?: string;
    readonly projectId?: string;
  }
): Promise<string> => {
  const id = randomUUID();
  await authPool.query(
    'INSERT INTO automation_rule (id, "projectId", name, trigger, conditions, actions, enabled, "createdById") VALUES ($1, $2, $3, $4, $5::json, $6::json, $7, $8)',
    [
      id,
      rule.projectId ?? world.projectId,
      rule.name ?? `Rule ${id.slice(0, 6)}`,
      rule.trigger,
      JSON.stringify(rule.conditions ?? []),
      JSON.stringify(rule.actions),
      rule.enabled ?? true,
      world.adminId,
    ]
  );
  return id;
};

export const destroyAutomationWorld = async (
  world: AutomationWorld
): Promise<void> => {
  const projects = [world.projectId, world.otherProjectId];
  const taskIds = `(SELECT id FROM task WHERE "projectId" = ANY($1::uuid[]))`;
  await authPool.query(
    "DELETE FROM job WHERE kind LIKE 'automation.%' OR kind = 'webhooks.deliver'"
  );
  await authPool.query(
    `DELETE FROM job WHERE "dedupeKey" IN (SELECT 'push:' || id::text FROM notification WHERE "projectId" = ANY($1::uuid[]))`,
    [projects]
  );
  await authPool.query(
    'DELETE FROM notification WHERE "projectId" = ANY($1::uuid[])',
    [projects]
  );
  await authPool.query(`DELETE FROM comment WHERE "taskId" IN ${taskIds}`, [
    projects,
  ]);
  await authPool.query(
    `DELETE FROM activity WHERE "projectId" = ANY($1::uuid[])`,
    [projects]
  );
  await authPool.query(`DELETE FROM task_label WHERE "taskId" IN ${taskIds}`, [
    projects,
  ]);
  await authPool.query(
    `DELETE FROM task_assignee WHERE "taskId" IN ${taskIds}`,
    [projects]
  );
  await authPool.query(
    `DELETE FROM bug_report WHERE "projectId" = ANY($1::uuid[])`,
    [projects]
  );
  await authPool.query('DELETE FROM task WHERE "projectId" = ANY($1::uuid[])', [
    projects,
  ]);
  await authPool.query("DELETE FROM project WHERE id = ANY($1::uuid[])", [
    projects,
  ]);
  await authPool.query("DELETE FROM label WHERE id = $1", [world.labelId]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [world.clientId]);
  await authPool.query("DELETE FROM client_company WHERE id = $1", [
    world.companyId,
  ]);
  await authPool.query('DELETE FROM "user" WHERE email LIKE $1', [
    `%@${world.domain}`,
  ]);
};
