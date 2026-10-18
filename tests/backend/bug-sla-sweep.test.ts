import { expect, it } from "bun:test";

import {
  authPool,
  callAs,
  ids,
  nextKey,
  personaId,
} from "./support/action-harness";
import {
  portal,
  submit,
  slaOf,
  slaField,
  taskOf,
  versionOf,
  pick,
  pinClocks,
  slaNotices,
  sweep,
  installHooks,
} from "./support/bug-sla-fixtures";

installHooks();

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
