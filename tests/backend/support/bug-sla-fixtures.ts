import { afterAll, beforeAll } from "bun:test";
import { randomUUID } from "node:crypto";

import { db } from "../../../src/prisma/db";
import { runSlaSweep } from "../../../src/server/work/bug-sla-sweep";
import type { BusinessCalendar } from "../../../src/server/work/business-time";
import {
  authPool,
  callAs,
  ids,
  nextKey,
  personaId,
  setupHarness,
  teardownHarness,
} from "./action-harness";

export const portal = await import("../../../features/portal/portal-actions");
export const portalQueries =
  await import("../../../features/portal/portal-queries");
export const bugActions = await import("../../../features/bugs/bugs-actions");
export const bugClientActions =
  await import("../../../features/bugs/bugs-client-actions");
export const comments =
  await import("../../../features/tasks/actions/task-comments");
export const slaActions = await import("../../../features/company/sla-actions");
export const slaQueries = await import("../../../features/company/sla-queries");
export const clientQueries =
  await import("../../../features/clients/clients-queries");

export const HOUR_MS = 60 * 60 * 1000;
export const at = (iso: string): Date => new Date(iso);
export const UTC_WEEK: BusinessCalendar = {
  days: [1, 2, 3, 4, 5],
  endMinute: 1080,
  startMinute: 540,
  timeZone: "UTC",
};

export const targets = {
  high: { firstResponseMinutes: 240, resolutionMinutes: 1440 },
  low: { firstResponseMinutes: 1440, resolutionMinutes: 14_400 },
  medium: { firstResponseMinutes: 480, resolutionMinutes: 4800 },
  urgent: { firstResponseMinutes: 60, resolutionMinutes: 480 },
};

interface SavedSettings {
  business_days: number[];
  business_end_minute: number;
  business_start_minute: number;
  business_time_zone: string | null;
  sla_targets: unknown;
}

let saved: SavedSettings | null = null;

export const useTestCalendar = async (): Promise<void> => {
  await authPool.query(
    `UPDATE company_settings SET "businessDays" = ARRAY[1,2,3,4,5], "businessStartMinute" = 540, "businessEndMinute" = 1080, "businessTimeZone" = 'UTC', "slaTargets" = $1::jsonb`,
    [JSON.stringify(targets)]
  );
};

export const submit = async (
  title: string,
  impact: "low" | "medium" | "high" | "urgent" = "medium"
): Promise<string> => {
  const result = await callAs("client", portal.submitClientBugAction, {
    actualBehavior: "Broken",
    browser: null,
    description: null,
    device: null,
    expectedBehavior: "Works",
    idempotencyKey: nextKey(),
    impact,
    os: null,
    pageUrl: "/page",
    projectId: ids.projectId,
    reproductionSteps: ["Open it"],
    title,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return (result.data as { bugId: string }).bugId;
};

export interface SlaRow {
  breachedResolution: boolean;
  breachedResponse: boolean;
  createdAt: Date;
  firstRespondedAt: Date | null;
  firstResponseDueAt: Date;
  pausedAt: Date | null;
  pausedBusinessMs: number;
  resolutionDueAt: Date;
  resolutionStartedAt: Date;
  resolvedAt: Date | null;
  warnedResolution: boolean;
  warnedResponse: boolean;
}

export const slaOf = async (bugId: string): Promise<SlaRow> => {
  const result = await authPool.query<SlaRow>(
    'SELECT "breachedResolution", "breachedResponse", "createdAt", "firstRespondedAt", "firstResponseDueAt", "pausedAt", "pausedBusinessMs", "resolutionDueAt", "resolutionStartedAt", "resolvedAt", "warnedResolution", "warnedResponse" FROM bug_sla WHERE "bugId" = $1',
    [bugId]
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error("sla row missing");
  }
  return row;
};

export const slaField = async <Key extends keyof SlaRow>(
  bugId: string,
  key: Key
): Promise<SlaRow[Key]> => {
  const row = await slaOf(bugId);
  return row[key];
};

export const taskOf = async (bugId: string): Promise<string> => {
  const row = await authPool.query<{ taskId: string }>(
    'SELECT "taskId" FROM bug_report WHERE id = $1',
    [bugId]
  );
  return row.rows[0]?.taskId ?? "";
};

export const versionOf = async (bugId: string): Promise<number> => {
  const row = await authPool.query<{ version: number }>(
    "SELECT version FROM bug_report WHERE id = $1",
    [bugId]
  );
  return row.rows[0]?.version ?? 0;
};

export const pick = async (bugId: string): Promise<void> => {
  const result = await callAs("owner", bugClientActions.pickClientBugAction, {
    bugId,
    expectedVersion: await versionOf(bugId),
    priority: "high",
    severity: "major",
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
};

// Sets the clocks to known instants so the sweep can be driven by a fixed
// "now" instead of the wall clock.
export const pinClocks = async (
  bugId: string,
  columns: Record<string, string | null>
): Promise<void> => {
  const names = Object.keys(columns);
  await authPool.query(
    `UPDATE bug_sla SET ${names.map((name, index) => `"${name}" = $${index + 2}`).join(", ")} WHERE "bugId" = $1`,
    [bugId, ...Object.values(columns)]
  );
};

export const slaNotices = async (
  userId: string,
  taskId: string
): Promise<string[]> => {
  const rows = await authPool.query<{ text: string }>(
    'SELECT text FROM notification WHERE "userId" = $1 AND "taskId" = $2 AND type = \'sla\' ORDER BY "createdAt"',
    [userId, taskId]
  );
  return rows.rows.map(({ text }) => text);
};

export const sweep = (now: string) =>
  db.transaction((transaction) => runSlaSweep(transaction, at(now)));

export const installHooks = () => {
  beforeAll(async () => {
    await setupHarness();
    await authPool.query(
      "INSERT INTO company_settings (id) VALUES ('company') ON CONFLICT DO NOTHING"
    );
    const current = await authPool.query<SavedSettings>(
      `SELECT "businessDays" AS business_days, "businessEndMinute" AS business_end_minute, "businessStartMinute" AS business_start_minute, "businessTimeZone" AS business_time_zone, "slaTargets" AS sla_targets FROM company_settings`
    );
    saved = current.rows[0] ?? null;
    await useTestCalendar();
    await authPool.query(
      'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
      [randomUUID(), ids.clientCompanyId, ids.projectId]
    );
    await authPool.query(
      'INSERT INTO client_company_handler (id, "companyId", "employeeId", "assignedById") VALUES ($1, $2, $3, $4)',
      [
        randomUUID(),
        ids.clientCompanyId,
        personaId("owner"),
        personaId("admin"),
      ]
    );
  });
  afterAll(async () => {
    // Notices sent at pinned past times queue push jobs stamped with those
    // times, which the harness cleanup (by creation time) would miss.
    await authPool.query(
      `DELETE FROM job WHERE kind = 'notifications.deliver-push' AND payload->>'userId' IN (SELECT id FROM "user" WHERE email LIKE '%@action-harness.example')`
    );
    if (saved) {
      await authPool.query(
        `UPDATE company_settings SET "businessDays" = $1, "businessEndMinute" = $2, "businessStartMinute" = $3, "businessTimeZone" = $4, "slaTargets" = $5::jsonb`,
        [
          saved.business_days,
          saved.business_end_minute,
          saved.business_start_minute,
          saved.business_time_zone,
          JSON.stringify(saved.sla_targets),
        ]
      );
    }
    await teardownHarness();
  });
};
