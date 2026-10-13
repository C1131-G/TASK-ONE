import { randomUUID } from "node:crypto";

import { authPool } from "../../../src/server/auth/database";

export interface LifecycleIds {
  readonly adminId: string;
  readonly employeeId: string;
  readonly projectId: string;
}

export const seedLifecycleRecords = async ({
  adminId,
  employeeId,
  projectId,
}: LifecycleIds): Promise<void> => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false), ($4, $5, $6, $6, \'employee\', false)',
    [
      adminId,
      "Lifecycle Admin",
      `${adminId}@bug-lifecycle.example`,
      employeeId,
      "Lifecycle Reporter",
      `${employeeId}@bug-lifecycle.example`,
    ]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `L${randomUUID().slice(0, 6)}`, "Bug lifecycle test"]
  );
};

const removeBugRecords = async (
  taskId: string,
  bugId: string | null
): Promise<void> => {
  await authPool.query(
    'DELETE FROM job WHERE "dedupeKey" IN (SELECT \'push:\' || id::text FROM notification WHERE "taskId" = $1)',
    [taskId]
  );
  await authPool.query('DELETE FROM notification WHERE "taskId" = $1', [
    taskId,
  ]);
  await authPool.query('DELETE FROM activity WHERE "taskId" = $1', [taskId]);
  await authPool.query('DELETE FROM bug_release WHERE "bugReportId" = $1', [
    bugId,
  ]);
  await authPool.query('DELETE FROM bug_approval WHERE "bugReportId" = $1', [
    bugId,
  ]);
  await authPool.query('DELETE FROM bug_evidence WHERE "bugReportId" = $1', [
    bugId,
  ]);
  await authPool.query('DELETE FROM bug_fix_attempt WHERE "bugReportId" = $1', [
    bugId,
  ]);
  await authPool.query(
    'DELETE FROM bug_relation WHERE "fromBugReportId" = $1 OR "toBugReportId" = $1',
    [bugId]
  );
  await authPool.query("DELETE FROM bug_report WHERE id = $1", [bugId]);
  await authPool.query('DELETE FROM "task_assignee" WHERE "taskId" = $1', [
    taskId,
  ]);
  await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
};

export const removeLifecycleRecords = async (
  { adminId, employeeId, projectId }: LifecycleIds,
  taskId: string | null,
  bugId: string | null
): Promise<void> => {
  if (taskId) {
    await removeBugRecords(taskId, bugId);
  }
  await authPool.query('DELETE FROM activity WHERE "projectId" = $1', [
    projectId,
  ]);
  await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
  await authPool.query('DELETE FROM "user" WHERE id IN ($1, $2)', [
    adminId,
    employeeId,
  ]);
};
