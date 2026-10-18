import { afterAll, beforeAll } from "bun:test";
import { randomUUID } from "node:crypto";

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
  await import("../../../features/bugs/bugs-actions");

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface BugState {
  awaitingClientSince: Date | null;
  clientReopenCount: number;
  needsInfoSince: Date | null;
  pickedById: string | null;
  resolution: string | null;
  satisfaction: string | null;
  status: string;
  statusBeforeNeedsInfo: string | null;
  taskId: string;
  version: number;
}

export const state = async (bugId: string): Promise<BugState> => {
  const result = await authPool.query<BugState>(
    'SELECT "awaitingClientSince", "clientReopenCount", "needsInfoSince", "pickedById", resolution, satisfaction, status, "statusBeforeNeedsInfo", "taskId", version FROM bug_report WHERE id = $1',
    [bugId]
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error("bug missing");
  }
  return row;
};

export const stateField = async <Key extends keyof BugState>(
  bugId: string,
  key: Key
): Promise<BugState[Key]> => {
  const row = await state(bugId);
  return row[key];
};

export const submit = async (
  title: string,
  persona: "client" | "otherClient" = "client",
  extra: Record<string, unknown> = {}
): Promise<string> => {
  const result = await callAs(persona, portal.submitClientBugAction, {
    actualBehavior: "Broken",
    browser: null,
    description: null,
    device: null,
    expectedBehavior: "Works",
    idempotencyKey: nextKey(),
    impact: "medium",
    os: null,
    pageUrl: "/page",
    projectId: ids.projectId,
    reproductionSteps: ["Open it"],
    title,
    ...extra,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return (result.data as { bugId: string }).bugId;
};

export const pick = async (bugId: string): Promise<void> => {
  const row = await state(bugId);
  const result = await callAs("owner", bugClientActions.pickClientBugAction, {
    bugId,
    expectedVersion: row.version,
    priority: "high",
    severity: "major",
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
};

// Moves a bug straight to a status, the way earlier workflow steps would.
export const force = async (
  bugId: string,
  status: string,
  columns: Record<string, string | null> = {}
): Promise<void> => {
  const set = Object.keys(columns).map(
    (name, index) => `"${name}" = $${index + 3}`
  );
  await authPool.query(
    `UPDATE bug_report SET status = $2, version = version + 1${set.length ? `, ${set.join(", ")}` : ""} WHERE id = $1`,
    [bugId, status, ...Object.values(columns)]
  );
};

export const portalView = async (
  persona: "client" | "coworker" | "otherClient",
  bugId: string
) => {
  const result = await callAs(persona, portalQueries.getPortalBug, { bugId });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data as unknown as {
    comments: { body: string; isTeam: boolean }[];
    lifecycle: {
      canRate: boolean;
      canReportAgain: boolean;
      closedReason: string | null;
      duplicateOf: {
        key: string | null;
        status: string;
        title: string | null;
      } | null;
      question: { text: string | null } | null;
      rating: { satisfaction: string } | null;
      verification: {
        canReopen: boolean;
        canRespond: boolean;
        reopensLeft: number;
      } | null;
    };
    canAttach: boolean;
    canComment: boolean;
    readOnlyReason: string | null;
    status: string;
    timeline: { status: string }[];
    version: number;
  };
};

export const noticesFor = async (
  userId: string,
  taskId: string
): Promise<string[]> => {
  const rows = await authPool.query<{ text: string }>(
    'SELECT text FROM notification WHERE "userId" = $1 AND "taskId" = $2 ORDER BY "createdAt"',
    [userId, taskId]
  );
  return rows.rows.map(({ text }) => text);
};

// Takes a picked bug through approval and release so the real release branch
// runs: it ends waiting on the client instead of closed.
export const releaseThroughAdmin = async (bugId: string): Promise<void> => {
  const row = await state(bugId);
  const attemptId = randomUUID();
  await authPool.query(
    'INSERT INTO bug_fix_attempt (id, "bugReportId", "authorId", "rootCause", "fixSummary", "verificationSteps") VALUES ($1, $2, $3, \'Cause\', \'Fix\', ARRAY[\'Retest\'])',
    [attemptId, bugId, personaId("owner")]
  );
  const approvalId = randomUUID();
  await authPool.query(
    'INSERT INTO bug_approval (id, "bugReportId", "fixAttemptId", "submittedById", "decidedById", status, snapshot, "decidedAt") VALUES ($1, $2, $3, $4, $5, \'approved\', \'{}\', now())',
    [approvalId, bugId, attemptId, personaId("owner"), personaId("admin")]
  );
  await force(bugId, "approved_for_release");
  const released = await callAs("admin", bugActions.recordBugReleaseAction, {
    approvalId,
    bugId,
    environment: "production",
    expectedVersion: row.version + 1,
    notes: null,
    version: "1.0.0",
  });
  if (!released.ok) {
    throw new Error(released.error.message);
  }
  const release = await authPool.query<{ id: string }>(
    'SELECT id FROM bug_release WHERE "bugReportId" = $1',
    [bugId]
  );
  const checked = await callAs(
    "admin",
    bugActions.recordBugPostReleaseCheckAction,
    {
      bugId,
      expectedVersion: await stateField(bugId, "version"),
      notes: "Verified in production",
      passed: true,
      releaseId: release.rows[0]?.id,
    }
  );
  if (!checked.ok) {
    throw new Error(checked.error.message);
  }
};

export const installHooks = () => {
  beforeAll(async () => {
    await setupHarness();
    for (const companyId of [ids.clientCompanyId, ids.otherClientCompanyId]) {
      // eslint-disable-next-line no-await-in-loop
      await authPool.query(
        'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
        [randomUUID(), companyId, ids.projectId]
      );
    }
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
  afterAll(teardownHarness);
};
