import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  callAs,
  ids,
  nextKey,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const portal = await import("../../features/portal/portal-bug-actions");
const portalQueries = await import("../../features/portal/portal-queries");
const staffBugs = await import("../../features/bugs/bugs-actions");
const activityQueries =
  await import("../../features/activity/activity-queries");

beforeAll(async () => {
  await setupHarness();
  await authPool.query(
    'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
    [randomUUID(), ids.clientCompanyId, ids.projectId]
  );
});
afterAll(teardownHarness);

const browserContext = {
  language: "en-GB",
  path: "/portal/new",
  pixelRatio: 2,
  timeZone: "Asia/Kolkata",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0 ContextProbe",
  viewportHeight: 800,
  viewportWidth: 1280,
};

const bugInput = (overrides: Record<string, unknown> = {}) => ({
  actualBehavior: "The page crashes",
  browser: "Firefox 140",
  description: null,
  device: "Desktop",
  expectedBehavior: "The page loads",
  impact: "high",
  os: "Linux",
  pageUrl: "https://app.example.test/settings",
  projectId: ids.projectId,
  reproductionSteps: ["Open settings"],
  title: "Context bug",
  ...overrides,
});

const submit = (
  persona: "anonymous" | "client",
  overrides: Record<string, unknown> = {}
) =>
  callAs(persona, portal.submitClientBugAction, {
    ...bugInput(overrides),
    idempotencyKey: nextKey(),
  });

const staffContext = async (bugId: string) => {
  const result = await callAs("admin", staffBugs.getBugHistoryAction, {
    bugId,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return (result.data as { clientContext: unknown }).clientContext;
};

it("stores the reporter's browser context for staff only", async () => {
  const created = await submit("client", { browserContext });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  const { bugId } = created.data as { bugId: string };
  expect(await staffContext(bugId)).toEqual(browserContext);

  // No client-facing read, the reporter's own included, carries the context.
  for (const persona of ["client", "coworker", "otherClient"] as const) {
    // oxlint-disable-next-line no-await-in-loop -- Few personas, read in turn.
    const read = await callAs(persona, portalQueries.getPortalBug, { bugId });
    expect(JSON.stringify(read)).not.toContain("ContextProbe");
  }
  const list = await callAs("client", portalQueries.listPortalBugs, {});
  expect(JSON.stringify(list)).not.toContain("ContextProbe");

  // Another company's client cannot open the staff record at all.
  const foreign = await callAs("otherClient", staffBugs.getBugHistoryAction, {
    bugId,
  });
  expect(foreign.ok).toBe(false);
});

it("records no context when the reporter opts out", async () => {
  const created = await submit("client", { title: "No context" });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  expect(await staffContext((created.data as { bugId: string }).bugId)).toBe(
    null
  );
});

it("refuses invalid or markup-bearing context without filing the bug", async () => {
  const before = await authPool.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM bug_report"
  );
  const bad = [
    { ...browserContext, userAgent: "<img src=x onerror=alert(1)>" },
    { ...browserContext, path: "/portal/new?token=secret" },
    { ...browserContext, userAgent: "a".repeat(5000) },
    { ...browserContext, viewportWidth: -5 },
    "not an object",
  ];
  for (const value of bad) {
    // oxlint-disable-next-line no-await-in-loop -- Each case reads the same table.
    const result = await submit("client", { browserContext: value });
    expect(result).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
      ok: false,
    });
  }
  const after = await authPool.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM bug_report"
  );
  expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
});

it("does not accept context from a signed-out caller", async () => {
  const result = await submit("anonymous", { browserContext });
  expect(result).toMatchObject({
    error: { code: "UNAUTHENTICATED" },
    ok: false,
  });
});

it("keeps the context out of the team's activity feeds", async () => {
  const created = await submit("client", { browserContext });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  const feed = await callAs("admin", activityQueries.listActivity, {
    limit: 100,
    projectId: ids.projectId,
  });
  expect(feed.ok).toBe(true);
  expect(JSON.stringify(feed)).not.toContain("ContextProbe");
});

it("files the context once when the submit is replayed", async () => {
  const idempotencyKey = nextKey();
  const input = { ...bugInput({ browserContext }), idempotencyKey };
  const first = await callAs("client", portal.submitClientBugAction, input);
  const second = await callAs("client", portal.submitClientBugAction, input);
  if (!first.ok || !second.ok) {
    throw new Error("submit failed");
  }
  const { bugId } = first.data as { bugId: string };
  const rows = await authPool.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM activity WHERE action = 'bug.client_context' AND details->>'bugId' = $1",
    [bugId]
  );
  expect(rows.rows[0]?.count).toBe(1);
});
