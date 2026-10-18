import { expect, it } from "bun:test";

import { db } from "../../src/prisma/db";
import { enqueueSlaSweep } from "../../src/server/work/bug-sla-sweep";
import { businessDeadline } from "../../src/server/work/business-time";
import type { BusinessCalendar } from "../../src/server/work/business-time";
import {
  authPool,
  callAs,
  ids,
  nextKey,
  replay,
} from "./support/action-harness";
import {
  portalQueries,
  bugActions,
  slaActions,
  slaQueries,
  clientQueries,
  at,
  targets,
  useTestCalendar,
  submit,
  pinClocks,
  sweep,
  slaOf,
  pick,
  installHooks,
} from "./support/bug-sla-fixtures";

installHooks();

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
  const bugId = await submit("Overdue response breach", "high");
  await pinClocks(bugId, {
    firstResponseDueAt: "2030-01-01T10:00:00.000Z",
    resolutionDueAt: "2030-01-02T10:00:00.000Z",
  });
  await sweep("2030-01-03T10:00:00.000Z");
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
