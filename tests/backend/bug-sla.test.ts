import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { db } from "../../src/prisma/db";
import {
  createBugSla,
  enqueueSlaSweep,
  runSlaSweep,
  slaOnStatusChange,
} from "../../src/server/work/bug-sla";
import { businessDeadline } from "../../src/server/work/business-time";
import type { BusinessCalendar } from "../../src/server/work/business-time";
import {
  authPool,
  callAs,
  ids,
  nextKey,
  personaId,
  replay,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const portal = await import("../../features/portal/portal-actions");
const portalQueries = await import("../../features/portal/portal-queries");
const bugActions = await import("../../features/bugs/bugs-actions");
const comments = await import("../../features/tasks/actions/task-comments");
const slaActions = await import("../../features/company/sla-actions");
const slaQueries = await import("../../features/company/sla-queries");
const clientQueries = await import("../../features/clients/clients-queries");

const HOUR_MS = 60 * 60 * 1000;
const at = (iso: string): Date => new Date(iso);
const UTC_WEEK: BusinessCalendar = {
  days: [1, 2, 3, 4, 5],
  endMinute: 1080,
  startMinute: 540,
  timeZone: "UTC",
};

const targets = {
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

const useTestCalendar = async (): Promise<void> => {
  await authPool.query(
    `UPDATE company_settings SET "businessDays" = ARRAY[1,2,3,4,5], "businessStartMinute" = 540, "businessEndMinute" = 1080, "businessTimeZone" = 'UTC', "slaTargets" = $1::jsonb`,
    [JSON.stringify(targets)]
  );
};

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
    [randomUUID(), ids.clientCompanyId, personaId("owner"), personaId("admin")]
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

const submit = async (
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

interface SlaRow {
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

const slaOf = async (bugId: string): Promise<SlaRow> => {
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

const slaField = async <Key extends keyof SlaRow>(
  bugId: string,
  key: Key
): Promise<SlaRow[Key]> => {
  const row = await slaOf(bugId);
  return row[key];
};

const taskOf = async (bugId: string): Promise<string> => {
  const row = await authPool.query<{ taskId: string }>(
    'SELECT "taskId" FROM bug_report WHERE id = $1',
    [bugId]
  );
  return row.rows[0]?.taskId ?? "";
};

const versionOf = async (bugId: string): Promise<number> => {
  const row = await authPool.query<{ version: number }>(
    "SELECT version FROM bug_report WHERE id = $1",
    [bugId]
  );
  return row.rows[0]?.version ?? 0;
};

const pick = async (bugId: string): Promise<void> => {
  const result = await callAs("owner", bugActions.pickClientBugAction, {
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
const pinClocks = async (
  bugId: string,
  columns: Record<string, string | null>
): Promise<void> => {
  const names = Object.keys(columns);
  await authPool.query(
    `UPDATE bug_sla SET ${names.map((name, index) => `"${name}" = $${index + 2}`).join(", ")} WHERE "bugId" = $1`,
    [bugId, ...Object.values(columns)]
  );
};

const slaNotices = async (
  userId: string,
  taskId: string
): Promise<string[]> => {
  const rows = await authPool.query<{ text: string }>(
    'SELECT text FROM notification WHERE "userId" = $1 AND "taskId" = $2 AND type = \'sla\' ORDER BY "createdAt"',
    [userId, taskId]
  );
  return rows.rows.map(({ text }) => text);
};

const sweep = (now: string) =>
  db.transaction((transaction) => runSlaSweep(transaction, at(now)));

it("starts both clocks in business time when a client reports a bug", async () => {
  const bugId = await submit("Clocks");
  const started = await slaOf(bugId);
  expect(started.firstRespondedAt).toBeNull();
  expect(started.resolvedAt).toBeNull();
  expect(started.resolutionStartedAt.getTime()).toBe(
    started.createdAt.getTime()
  );
  expect(started.firstResponseDueAt.getTime()).toBe(
    businessDeadline(started.createdAt, 480, UTC_WEEK).getTime()
  );
  expect(started.resolutionDueAt.getTime()).toBe(
    businessDeadline(started.createdAt, 4800, UTC_WEEK).getTime()
  );

  // With a pinned start the results are exact: urgent on a Monday morning.
  await authPool.query('DELETE FROM bug_sla WHERE "bugId" = $1', [bugId]);
  await db.transaction((transaction) =>
    createBugSla(transaction, {
      bugId,
      impact: "urgent",
      now: at("2026-10-05T10:00:00Z"),
    })
  );
  const urgent = await slaOf(bugId);
  expect(urgent.firstResponseDueAt.toISOString()).toBe(
    "2026-10-05T11:00:00.000Z"
  );
  expect(urgent.resolutionDueAt.toISOString()).toBe("2026-10-05T18:00:00.000Z");

  // A medium bug's 80 business hours skip the weekend.
  await authPool.query('DELETE FROM bug_sla WHERE "bugId" = $1', [bugId]);
  await db.transaction((transaction) =>
    createBugSla(transaction, {
      bugId,
      impact: "medium",
      now: at("2026-10-05T10:00:00Z"),
    })
  );
  const medium = await slaOf(bugId);
  expect(medium.resolutionDueAt.toISOString()).toBe("2026-10-15T18:00:00.000Z");
});

it("counts a pick as the first response, and only the first", async () => {
  const bugId = await submit("First by pick");
  expect(await slaField(bugId, "firstRespondedAt")).toBeNull();
  await pick(bugId);
  const picked = await slaOf(bugId);
  expect(picked.firstRespondedAt).not.toBeNull();
  const taskId = await taskOf(bugId);
  const reply = await callAs("owner", comments.createCommentAction, {
    body: "On it",
    idempotencyKey: nextKey(),
    taskId,
    visibility: "public",
  });
  expect(reply).toMatchObject({ ok: true });
  const after = await slaOf(bugId);
  expect(after.firstRespondedAt?.getTime()).toBe(
    picked.firstRespondedAt?.getTime()
  );
});

it("counts the team's first public reply, but not notes or client comments", async () => {
  const bugId = await submit("First by reply");
  const taskId = await taskOf(bugId);
  const internal = await callAs("admin", comments.createCommentAction, {
    body: "Internal triage note",
    idempotencyKey: nextKey(),
    taskId,
  });
  expect(internal).toMatchObject({ ok: true });
  const fromClient = await callAs("coworker", portal.addClientCommentAction, {
    body: "Any news?",
    bugId,
    idempotencyKey: nextKey(),
  });
  expect(fromClient).toMatchObject({ ok: true });
  expect(await slaField(bugId, "firstRespondedAt")).toBeNull();

  const reply = await callAs("admin", comments.createCommentAction, {
    body: "We are looking",
    idempotencyKey: nextKey(),
    taskId,
    visibility: "public",
  });
  expect(reply).toMatchObject({ ok: true });
  expect(await slaField(bugId, "firstRespondedAt")).not.toBeNull();
});

it("pauses the resolution clock while the client is asked, then resumes it", async () => {
  const bugId = await submit("Pause and resume");
  await pick(bugId);
  const asked = await callAs("owner", bugActions.requestClientInfoAction, {
    bugId,
    expectedVersion: await versionOf(bugId),
    question: "Which browser?",
  });
  expect(asked).toMatchObject({ ok: true });
  expect(await slaField(bugId, "pausedAt")).not.toBeNull();
  const answered = await callAs("client", portal.addClientCommentAction, {
    body: "Firefox",
    bugId,
    idempotencyKey: nextKey(),
  });
  expect(answered).toMatchObject({ ok: true });
  const resumed = await slaOf(bugId);
  expect(resumed.pausedAt).toBeNull();
  expect(resumed.pausedBusinessMs).toBeGreaterThanOrEqual(0);

  // Pinned: paused Monday 10:00, resumed Tuesday 10:00, nine business hours
  // later, so a Monday 17:00 deadline moves to Tuesday 17:00.
  await pinClocks(bugId, {
    pausedAt: "2026-10-05T10:00:00Z",
    resolutionDueAt: "2026-10-05T17:00:00Z",
  });
  await authPool.query(
    'UPDATE bug_sla SET "pausedBusinessMs" = 0 WHERE "bugId" = $1',
    [bugId]
  );
  await db.transaction((transaction) =>
    slaOnStatusChange(transaction, {
      bugId,
      from: "needs_info",
      now: at("2026-10-06T10:00:00Z"),
      to: "triaged",
    })
  );
  const moved = await slaOf(bugId);
  expect(moved.pausedAt).toBeNull();
  expect(moved.pausedBusinessMs).toBe(9 * HOUR_MS);
  expect(moved.resolutionDueAt.toISOString()).toBe("2026-10-06T17:00:00.000Z");
});

it("stops the resolution clock when done and restarts it if the bug returns", async () => {
  const bugId = await submit("Stop and restart");
  const handOver = at("2026-10-05T12:00:00Z");
  await db.transaction((transaction) =>
    slaOnStatusChange(transaction, {
      bugId,
      from: "released",
      now: handOver,
      to: "awaiting_client",
    })
  );
  const handedOverAt = await slaField(bugId, "resolvedAt");
  expect(handedOverAt?.toISOString()).toBe(handOver.toISOString());
  await authPool.query(
    'UPDATE bug_sla SET "breachedResolution" = true, "warnedResolution" = true, "pausedBusinessMs" = 5000 WHERE "bugId" = $1',
    [bugId]
  );

  // Still broken: the clock starts over from the reopen.
  const reopened = at("2026-10-07T15:00:00Z");
  await db.transaction((transaction) =>
    slaOnStatusChange(transaction, {
      bugId,
      from: "awaiting_client",
      now: reopened,
      to: "triaged",
    })
  );
  const restarted = await slaOf(bugId);
  expect(restarted).toMatchObject({
    breachedResolution: false,
    pausedAt: null,
    pausedBusinessMs: 0,
    resolvedAt: null,
    warnedResolution: false,
  });
  expect(restarted.resolutionStartedAt.toISOString()).toBe(
    reopened.toISOString()
  );
  expect(restarted.resolutionDueAt.toISOString()).toBe(
    businessDeadline(reopened, 4800, UTC_WEEK).toISOString()
  );

  // Closing as not a bug through the real workflow also stops it.
  const closing = await submit("Closed early");
  await pick(closing);
  const closed = await callAs("owner", bugActions.closeClientBugNotABugAction, {
    bugId: closing,
    expectedVersion: await versionOf(closing),
    reason: "Works as designed",
  });
  expect(closed).toMatchObject({ ok: true });
  expect(await slaField(closing, "resolvedAt")).not.toBeNull();
});

it("warns at 75% and alerts on breach, once each, for an unpicked bug", async () => {
  const bugId = await submit("Sweep unpicked");
  const taskId = await taskOf(bugId);
  // Start Monday 09:00; first response due 13:00 (4 business hours),
  // resolution due 18:00 (9 business hours).
  await pinClocks(bugId, {
    createdAt: "2026-10-05T09:00:00Z",
    firstResponseDueAt: "2026-10-05T13:00:00Z",
    resolutionDueAt: "2026-10-05T18:00:00Z",
    resolutionStartedAt: "2026-10-05T09:00:00Z",
  });

  await sweep("2026-10-05T11:00:00Z");
  expect(await slaNotices(personaId("owner"), taskId)).toEqual([]);

  // 3h05 of 4h is past 75%: the company's handler is warned.
  await sweep("2026-10-05T12:05:00Z");
  expect(await slaNotices(personaId("owner"), taskId)).toEqual([
    expect.stringContaining("75% of its first response target"),
  ]);
  await sweep("2026-10-05T12:10:00Z");
  expect(await slaNotices(personaId("owner"), taskId)).toHaveLength(1);
  expect(await slaField(bugId, "warnedResponse")).toBe(true);

  // Past 13:00 the admins hear about the breach, exactly once.
  await sweep("2026-10-05T13:30:00Z");
  const adminNotices = await slaNotices(personaId("admin"), taskId);
  expect(adminNotices).toEqual([
    expect.stringContaining("breached its first response target"),
  ]);
  await sweep("2026-10-05T14:00:00Z");
  expect(await slaNotices(personaId("admin"), taskId)).toHaveLength(1);
  expect(await slaField(bugId, "breachedResponse")).toBe(true);

  // The resolution clock has its own warning (7h of 9h) and breach.
  await sweep("2026-10-05T16:00:00Z");
  expect(await slaNotices(personaId("owner"), taskId)).toContainEqual(
    expect.stringContaining("75% of its resolution target")
  );
  await sweep("2026-10-05T18:30:00Z");
  expect(await slaNotices(personaId("admin"), taskId)).toContainEqual(
    expect.stringContaining("breached its resolution target")
  );
  const finalState = await slaOf(bugId);
  expect(finalState).toMatchObject({
    breachedResolution: true,
    breachedResponse: true,
  });
});

it("warns the assignee, not the handlers, once a bug is picked", async () => {
  const bugId = await submit("Sweep picked");
  await pick(bugId);
  const taskId = await taskOf(bugId);
  await authPool.query(
    'UPDATE client_company_handler SET "employeeId" = "employeeId" WHERE "companyId" = $1',
    [ids.clientCompanyId]
  );
  await pinClocks(bugId, {
    createdAt: "2026-10-05T09:00:00Z",
    firstRespondedAt: null,
    firstResponseDueAt: "2026-10-05T10:00:00Z",
    resolutionDueAt: "2026-10-05T18:00:00Z",
    resolutionStartedAt: "2026-10-05T09:00:00Z",
  });
  // 00:50 of 01:00 used by the response clock; the assignee is the owner.
  await sweep("2026-10-05T09:50:00Z");
  expect(await slaNotices(personaId("owner"), taskId)).toEqual([
    expect.stringContaining("75% of its first response target"),
  ]);
  expect(await slaNotices(personaId("outsider"), taskId)).toEqual([]);

  // Two sweeps at once still raise the breach a single time.
  await Promise.all([
    sweep("2026-10-05T10:30:00Z"),
    sweep("2026-10-05T10:30:00Z"),
  ]);
  const admin = await slaNotices(personaId("admin"), taskId);
  expect(
    admin.filter((text) => text.includes("breached its first response"))
  ).toHaveLength(1);
  const owner = await slaNotices(personaId("owner"), taskId);
  expect(
    owner.filter((text) => text.includes("breached its first response"))
  ).toHaveLength(1);
});

it("leaves paused, finished and answered clocks alone", async () => {
  const paused = await submit("Sweep paused");
  const pausedTask = await taskOf(paused);
  await pinClocks(paused, {
    createdAt: "2026-10-05T09:00:00Z",
    firstRespondedAt: "2026-10-05T09:10:00Z",
    firstResponseDueAt: "2026-10-05T10:00:00Z",
    pausedAt: "2026-10-05T09:30:00Z",
    resolutionDueAt: "2026-10-05T12:00:00Z",
    resolutionStartedAt: "2026-10-05T09:00:00Z",
  });
  const done = await submit("Sweep done");
  const doneTask = await taskOf(done);
  await pinClocks(done, {
    createdAt: "2026-10-05T09:00:00Z",
    firstRespondedAt: "2026-10-05T09:10:00Z",
    firstResponseDueAt: "2026-10-05T10:00:00Z",
    resolutionDueAt: "2026-10-05T12:00:00Z",
    resolutionStartedAt: "2026-10-05T09:00:00Z",
    resolvedAt: "2026-10-05T11:00:00Z",
  });
  await sweep("2026-10-05T17:00:00Z");
  expect(await slaNotices(personaId("admin"), pausedTask)).toEqual([]);
  expect(await slaNotices(personaId("owner"), pausedTask)).toEqual([]);
  expect(await slaNotices(personaId("admin"), doneTask)).toEqual([]);
  expect(await slaNotices(personaId("owner"), doneTask)).toEqual([]);
});

it("never raises a response breach for a bug withdrawn before anyone answered", async () => {
  const bugId = await submit("Sweep withdrawn");
  const taskId = await taskOf(bugId);
  const withdrawn = await callAs("client", portal.withdrawClientBugAction, {
    bugId,
    expectedVersion: await versionOf(bugId),
    idempotencyKey: nextKey(),
  });
  expect(withdrawn.ok).toBe(true);
  expect(await slaField(bugId, "resolvedAt")).not.toBeNull();
  await pinClocks(bugId, {
    createdAt: "2026-10-05T09:00:00Z",
    firstResponseDueAt: "2026-10-05T10:00:00Z",
    resolutionDueAt: "2026-10-05T12:00:00Z",
    resolutionStartedAt: "2026-10-05T09:00:00Z",
    resolvedAt: "2026-10-05T09:30:00Z",
  });
  await sweep("2026-10-05T17:00:00Z");
  expect(await slaNotices(personaId("admin"), taskId)).toEqual([]);
  expect(await slaNotices(personaId("owner"), taskId)).toEqual([]);
  expect(await slaField(bugId, "breachedResponse")).toBe(false);
});

it("lets only an admin change the settings, and applies them to new bugs", async () => {
  const before = await callAs("admin", slaQueries.getSlaSettings, {});
  expect(before).toMatchObject({
    data: { businessDays: [1, 2, 3, 4, 5], effectiveTimeZone: "UTC" },
    ok: true,
  });
  const next = {
    businessDays: [1, 2, 3, 4],
    businessEndMinute: 1020,
    businessStartMinute: 600,
    businessTimeZone: "Asia/Kolkata",
    slaTargets: {
      ...targets,
      urgent: { firstResponseMinutes: 30, resolutionMinutes: 240 },
    },
  };
  const denied = await callAs("owner", slaActions.updateSlaSettingsAction, {
    ...next,
    idempotencyKey: nextKey(),
  });
  expect(denied).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const updated = await replay(
    "updateSlaSettingsAction",
    "admin",
    slaActions.updateSlaSettingsAction,
    next
  );
  expect(updated).toMatchObject({
    businessDays: [1, 2, 3, 4],
    businessTimeZone: "Asia/Kolkata",
  });

  const bugId = await submit("New rules", "urgent");
  const row = await slaOf(bugId);
  const kolkata: BusinessCalendar = {
    days: [1, 2, 3, 4],
    endMinute: 1020,
    startMinute: 600,
    timeZone: "Asia/Kolkata",
  };
  expect(row.firstResponseDueAt.getTime()).toBe(
    businessDeadline(row.createdAt, 30, kolkata).getTime()
  );
  expect(row.resolutionDueAt.getTime()).toBe(
    businessDeadline(row.createdAt, 240, kolkata).getTime()
  );
  await useTestCalendar();
});

it("rejects settings that make no sense", async () => {
  const valid = {
    businessDays: [1, 2, 3, 4, 5],
    businessEndMinute: 1080,
    businessStartMinute: 540,
    businessTimeZone: null,
    slaTargets: targets,
  };
  const attempt = (overrides: Record<string, unknown>) =>
    callAs("admin", slaActions.updateSlaSettingsAction, {
      ...valid,
      ...overrides,
      idempotencyKey: nextKey(),
    });
  expect(await attempt({ businessEndMinute: 540 })).toMatchObject({
    ok: false,
  });
  expect(await attempt({ businessDays: [] })).toMatchObject({ ok: false });
  expect(await attempt({ businessDays: [7] })).toMatchObject({ ok: false });
  expect(await attempt({ businessTimeZone: "Mars/Olympus" })).toMatchObject({
    ok: false,
  });
  expect(
    await attempt({
      slaTargets: {
        ...targets,
        urgent: { firstResponseMinutes: 120, resolutionMinutes: 60 },
      },
    })
  ).toMatchObject({ ok: false });
  expect(
    await attempt({
      slaTargets: {
        ...targets,
        low: { firstResponseMinutes: 0, resolutionMinutes: 60 },
      },
    })
  ).toMatchObject({ ok: false });
  const still = await callAs("admin", slaQueries.getSlaSettings, {});
  expect(still).toMatchObject({ data: { businessEndMinute: 1080 }, ok: true });
});

it("shows the team both clocks and the client the usual response time", async () => {
  const bugId = await submit("Views", "high");
  const history = await callAs("admin", bugActions.getBugHistoryAction, {
    bugId,
  });
  if (!history.ok) {
    throw new Error(history.error.message);
  }
  const view = (
    history.data as {
      clientReport: {
        sla: {
          firstResponse: { minutesLeft: number | null; state: string };
          resolution: { state: string };
        } | null;
      };
    }
  ).clientReport.sla;
  expect(view?.firstResponse.state).toBe("ok");
  expect(view?.resolution.state).toBe("ok");

  const list = await callAs("admin", bugActions.listBugsAction, {});
  const rows = list.ok
    ? (list.data as readonly { bug: { id: string }; sla: unknown }[])
    : [];
  expect(rows.find((row) => row.bug.id === bugId)?.sla).toMatchObject({
    firstResponse: { state: "ok" },
  });

  const times = await callAs(
    "client",
    portalQueries.getPortalResponseTimes,
    {}
  );
  expect(times).toMatchObject({
    data: {
      businessDays: [1, 2, 3, 4, 5],
      firstResponseMinutes: { high: 240, low: 1440, medium: 480, urgent: 60 },
      timeZone: "UTC",
    },
    ok: true,
  });
  const detail = await callAs("client", portalQueries.getPortalBug, { bugId });
  expect(detail).toMatchObject({
    data: { firstResponse: { respondedAt: null, targetMinutes: 240 } },
    ok: true,
  });
  await pick(bugId);
  const answered = await callAs("client", portalQueries.getPortalBug, {
    bugId,
  });
  expect(answered).toMatchObject({
    data: { firstResponse: { respondedAt: expect.any(String) } },
    ok: true,
  });
});

it("counts breaches on the client company page", async () => {
  const company = await callAs("admin", clientQueries.getClientCompany, {
    companyId: ids.clientCompanyId,
  });
  if (!company.ok) {
    throw new Error(company.error.message);
  }
  const { sla } = company.data as {
    sla: {
      resolutionBreaches: number;
      responseBreaches: number;
      tracked: number;
    };
  };
  const stored = await authPool.query<{
    resolution: number;
    response: number;
    tracked: number;
  }>(
    `SELECT count(*)::int AS tracked,
            count(*) FILTER (WHERE "breachedResponse")::int AS response,
            count(*) FILTER (WHERE "breachedResolution")::int AS resolution
       FROM bug_sla s JOIN bug_report b ON b.id = s."bugId"
      WHERE b."clientCompanyId" = $1`,
    [ids.clientCompanyId]
  );
  const [counts] = stored.rows;
  expect(sla).toEqual({
    resolutionBreaches: counts?.resolution ?? -1,
    responseBreaches: counts?.response ?? -1,
    tracked: counts?.tracked ?? -1,
  });
  expect(sla.responseBreaches).toBeGreaterThan(0);
});

it("queues one sweep job per five-minute interval", async () => {
  const start = at("2030-01-01T10:00:00Z");
  await db.transaction(async (transaction) => {
    await enqueueSlaSweep(transaction, start);
    await enqueueSlaSweep(transaction, at("2030-01-01T10:04:59Z"));
    await enqueueSlaSweep(transaction, at("2030-01-01T10:05:00Z"));
  });
  const jobs = await authPool.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM job WHERE kind = 'bug.sla_sweep' AND \"availableAt\" >= '2030-01-01'"
  );
  expect(jobs.rows[0]?.count).toBe(2);
  await authPool.query(
    "DELETE FROM job WHERE kind = 'bug.sla_sweep' AND \"availableAt\" >= '2030-01-01'"
  );
});
