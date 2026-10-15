import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { auth } from "../../src/server/auth/auth";
import {
  AuthSession,
  AuthSessionLive,
  PORTAL_PREVIEW_COOKIE,
} from "../../src/server/auth/session";
import { ClientCompanyManagement } from "../../src/server/clients/client-company-contracts";
import { companyInsight } from "../../src/server/clients/client-company-insight";
import { ClientCompanyManagementLive } from "../../src/server/clients/client-company-management";
import type { SlaSettings } from "../../src/server/company/sla-settings";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  PasswordManagement,
  PasswordManagementLive,
} from "../../src/server/people/password-management";
import {
  endPortalPreview,
  startPortalPreview,
} from "../../src/server/portal/portal-preview";
import type { ActionResultLike } from "./support/action-harness";
import {
  authPool,
  callAs,
  callAsWithCookie,
  ids,
  nextKey,
  personaHeaders,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const portal = await import("../../features/portal/portal-actions");
const portalQueries = await import("../../features/portal/portal-queries");
const clientQueries = await import("../../features/clients/clients-queries");
const clients = await import("../../features/clients/clients-actions");
const people = await import("../../features/people/people-actions");
const previewRoute = await import("../../app/(portal)/portal/preview/route");

beforeAll(async () => {
  await setupHarness();
  await authPool.query(
    'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
    [randomUUID(), ids.clientCompanyId, ids.projectId]
  );
});
afterAll(teardownHarness);

let addressCounter = Number.parseInt(randomUUID().slice(0, 4), 16);
const nextAddress = (): string => {
  addressCounter += 1;
  return `203.0.${Math.floor(addressCounter / 250) % 250}.${(addressCounter % 250) + 1}`;
};

interface ClientLogin {
  readonly email: string;
  readonly id: string;
  readonly password: string;
}

const createClient = async (): Promise<ClientLogin> => {
  const created = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* createClientUser() {
        const management = yield* ClientCompanyManagement;
        return yield* management.createClientUser(personaId("admin"), {
          companyId: ids.clientCompanyId,
          email: `lock-${randomUUID().slice(0, 8)}@action-harness.example`,
          name: "Lockout Client",
        });
      }),
      ClientCompanyManagementLive
    )
  );
  await authPool.query(
    'UPDATE "user" SET "mustChangePassword" = false WHERE id = $1',
    [created.id]
  );
  return {
    email: created.email,
    id: created.id,
    password: created.temporaryPassword,
  };
};

const signIn = (email: string, password: string, extra: HeadersInit = {}) =>
  auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/email", {
      body: JSON.stringify({ email, password }),
      headers: {
        "content-type": "application/json",
        "user-agent": "Vitest Browser/1.0",
        "x-forwarded-for": nextAddress(),
        ...extra,
      },
      method: "POST",
    })
  );

const cookieOf = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

const loginState = async (userId: string) => {
  const result = await authPool.query<{
    failedLoginCount: number;
    lastActiveAt: Date | null;
    lockedUntil: Date | null;
  }>(
    'SELECT "failedLoginCount", "lastActiveAt", "lockedUntil" FROM "user" WHERE id = $1',
    [userId]
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error("user missing");
  }
  return row;
};

const failedCount = async (userId: string): Promise<number> => {
  const row = await loginState(userId);
  return row.failedLoginCount;
};

const lastActiveMs = async (userId: string): Promise<number> => {
  const row = await loginState(userId);
  return row.lastActiveAt?.getTime() ?? 0;
};

const auditTypes = async (subjectId: string): Promise<string[]> => {
  const result = await authPool.query<{ type: string }>(
    'SELECT type FROM audit_event WHERE "subjectUserId" = $1 ORDER BY "createdAt", id',
    [subjectId]
  );
  return result.rows.map(({ type }) => type);
};

it("locks an account after five failed sign-ins and keeps it generic", async () => {
  const client = await createClient();
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const failed = await signIn(client.email, "not-the-password-1!");
    expect(failed.status).toBe(401);
    // eslint-disable-next-line no-await-in-loop
    const counted = await loginState(client.id);
    expect(counted.failedLoginCount).toBe(attempt);
    expect(counted.lockedUntil).toBeNull();
  }
  const fifth = await signIn(client.email, "not-the-password-1!");
  expect(fifth.status).toBe(401);
  const locked = await loginState(client.id);
  expect(locked.failedLoginCount).toBe(5);
  const minutesLocked =
    ((locked.lockedUntil?.getTime() ?? 0) - Date.now()) / 60_000;
  expect(minutesLocked).toBeGreaterThan(14);
  expect(minutesLocked).toBeLessThanOrEqual(15);

  // Even the right password is refused, with the same answer as a wrong one,
  // and the refusal is not counted as another failure.
  const refused = await signIn(client.email, client.password);
  expect(refused.status).toBe(401);
  const wrong = await signIn(client.email, "another-wrong-one-9!");
  expect(await refused.json()).toEqual(await wrong.json());
  expect(await failedCount(client.id)).toBe(5);
  expect(await auditTypes(client.id)).toEqual([
    "login_failed",
    "login_failed",
    "login_failed",
    "login_failed",
    "login_failed",
    "account_locked",
    "login_blocked",
    "login_blocked",
  ]);

  const listed = await callAs("admin", clientQueries.listLockedAccounts, {});
  expect(listed).toMatchObject({ ok: true });
  expect(
    listed.ok &&
      (listed.data as readonly { id: string }[]).some(
        ({ id }) => id === client.id
      )
  ).toBe(true);

  const denied = await callAs("owner", clients.unlockUserAction, {
    userId: client.id,
  });
  expect(denied).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const unlocked = await callAs("admin", clients.unlockUserAction, {
    userId: client.id,
  });
  expect(unlocked).toMatchObject({ ok: true });
  const success = await signIn(client.email, client.password);
  expect(success.status).toBe(200);
  const reset = await loginState(client.id);
  expect(reset).toMatchObject({ failedLoginCount: 0, lockedUntil: null });
  expect(reset.lastActiveAt).not.toBeNull();
  const types = await auditTypes(client.id);
  expect(types).toContain("account_unlocked");
  expect(types.at(-1)).toBe("login_succeeded");
  const stillListed = await callAs(
    "admin",
    clientQueries.listLockedAccounts,
    {}
  );
  expect(
    stillListed.ok &&
      (stillListed.data as readonly { id: string }[]).some(
        ({ id }) => id === client.id
      )
  ).toBe(false);
});

it("counts from zero again after a lock runs out, and a success clears the count", async () => {
  const client = await createClient();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await signIn(client.email, "not-the-password-1!");
  }
  expect(await failedCount(client.id)).toBe(3);
  const success = await signIn(client.email, client.password);
  expect(success.status).toBe(200);
  expect(await failedCount(client.id)).toBe(0);

  await authPool.query(
    `UPDATE "user" SET "failedLoginCount" = 5, "lockedUntil" = now() - interval '1 minute' WHERE id = $1`,
    [client.id]
  );
  const afterExpiry = await signIn(client.email, client.password);
  expect(afterExpiry.status).toBe(200);
  expect(await loginState(client.id)).toMatchObject({
    failedLoginCount: 0,
    lockedUntil: null,
  });
});

it("records failed sign-ins for unknown accounts without touching anyone", async () => {
  const email = `nobody-${randomUUID().slice(0, 8)}@action-harness.example`;
  const failed = await signIn(email, "whatever-password-1!", {
    "user-agent": "Probe/2.0",
  });
  expect(failed.status).toBe(401);
  const event = await authPool.query<{
    details: Record<string, unknown>;
    ip: string | null;
    subjectUserId: string | null;
    userAgent: string | null;
  }>(
    `SELECT details, ip, "subjectUserId", "userAgent" FROM audit_event WHERE details->>'email' = $1`,
    [email]
  );
  expect(event.rows).toHaveLength(1);
  expect(event.rows[0]).toMatchObject({
    subjectUserId: null,
    userAgent: "Probe/2.0",
  });
  expect(event.rows[0]?.ip).toMatch(/^203\.0\./u);
  await authPool.query("DELETE FROM audit_event WHERE details->>'email' = $1", [
    email,
  ]);
});

const portalAccess = (headers: Headers) =>
  runEffectResult(
    Effect.provide(
      Effect.gen(function* checkPortal() {
        const sessions = yield* AuthSession;
        return yield* sessions.requirePortalAccess(headers);
      }),
      AuthSessionLive
    )
  );

it("signs a client out after two idle hours and tracks activity at most once a minute", async () => {
  const client = await createClient();
  const response = await signIn(client.email, client.password);
  expect(response.status).toBe(200);
  const headers = new Headers({ cookie: cookieOf(response) });

  // Active a moment ago: nothing to write.
  await authPool.query(
    `UPDATE "user" SET "lastActiveAt" = now() - interval '10 seconds' WHERE id = $1`,
    [client.id]
  );
  const before = await lastActiveMs(client.id);
  expect(await portalAccess(headers)).toMatchObject({ ok: true });
  expect(await lastActiveMs(client.id)).toBe(before);

  // Quiet for 90 seconds: the activity time moves forward.
  await authPool.query(
    `UPDATE "user" SET "lastActiveAt" = now() - interval '90 seconds' WHERE id = $1`,
    [client.id]
  );
  const stale = await lastActiveMs(client.id);
  expect(await portalAccess(headers)).toMatchObject({ ok: true });
  expect(await lastActiveMs(client.id)).toBeGreaterThan(stale);

  // An hour and a half is still fine.
  await authPool.query(
    `UPDATE "user" SET "lastActiveAt" = now() - interval '110 minutes' WHERE id = $1`,
    [client.id]
  );
  expect(await portalAccess(headers)).toMatchObject({ ok: true });

  // More than two hours idle ends the session.
  await authPool.query(
    `UPDATE "user" SET "lastActiveAt" = now() - interval '121 minutes' WHERE id = $1`,
    [client.id]
  );
  const idle = await portalAccess(headers);
  expect(idle).toMatchObject({
    error: { code: "UNAUTHENTICATED", message: "Signed out for inactivity." },
    ok: false,
  });
  const sessions = await authPool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM session WHERE "userId" = $1',
    [client.id]
  );
  expect(sessions.rows[0]?.count).toBe(0);
  // The session is gone, so the next request is just signed out.
  expect(await portalAccess(headers)).toMatchObject({
    error: { code: "UNAUTHENTICATED", message: "Sign in to continue." },
    ok: false,
  });
});

it("never idles out staff", async () => {
  await authPool.query(
    `UPDATE "user" SET "lastActiveAt" = now() - interval '9 hours' WHERE id = $1`,
    [personaId("owner")]
  );
  const result = await callAs("owner", clientQueries.listClientCompanies, {});
  // Refused as a non-admin, not signed out.
  expect(result).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
});

it("audits password changes, resets, deactivations and company changes", async () => {
  const client = await createClient();
  const response = await signIn(client.email, client.password);
  const headers = new Headers({
    cookie: cookieOf(response),
    "user-agent": "Audit Agent/3.0",
    "x-forwarded-for": "198.51.100.77",
  });
  await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* change() {
        const passwords = yield* PasswordManagement;
        yield* passwords.changeOwnPassword(
          headers,
          client.password,
          "a-brand-new-password-42"
        );
      }),
      PasswordManagementLive
    )
  );
  const changed = await authPool.query<{
    actorId: string;
    ip: string | null;
    userAgent: string | null;
  }>(
    `SELECT "actorId", ip, "userAgent" FROM audit_event WHERE "subjectUserId" = $1 AND type = 'password_changed'`,
    [client.id]
  );
  expect(changed.rows).toEqual([
    { actorId: client.id, ip: "198.51.100.77", userAgent: "Audit Agent/3.0" },
  ]);

  expect(
    await callAs("admin", people.resetEmployeePasswordAction, {
      employeeId: client.id,
    })
  ).toMatchObject({ ok: true });
  expect(
    await callAs("admin", people.deactivateEmployeeAction, {
      employeeId: client.id,
      idempotencyKey: nextKey(),
    })
  ).toMatchObject({ ok: true });
  expect(
    await callAs("admin", people.reactivateEmployeeAction, {
      employeeId: client.id,
      idempotencyKey: nextKey(),
    })
  ).toMatchObject({ ok: true });
  const events = await authPool.query<{ actorId: string | null; type: string }>(
    `SELECT type, "actorId" FROM audit_event WHERE "subjectUserId" = $1 AND type IN ('password_reset','user_deactivated','user_reactivated') ORDER BY "createdAt", id`,
    [client.id]
  );
  expect(events.rows).toEqual([
    { actorId: personaId("admin"), type: "password_reset" },
    { actorId: personaId("admin"), type: "user_deactivated" },
    { actorId: personaId("admin"), type: "user_reactivated" },
  ]);

  const company = await callAs("admin", clients.createClientCompanyAction, {
    idempotencyKey: nextKey(),
    name: `Audit Co ${randomUUID().slice(0, 8)}`,
  });
  if (!company.ok) {
    throw new Error(company.error.message);
  }
  const { companyId, version } = company.data as {
    companyId: string;
    version: number;
  };
  const off = await callAs("admin", clients.deactivateClientCompanyAction, {
    companyId,
    expectedVersion: version,
    idempotencyKey: nextKey(),
  });
  expect(off).toMatchObject({ ok: true });
  const on = await callAs("admin", clients.reactivateClientCompanyAction, {
    companyId,
    expectedVersion: version + 1,
    idempotencyKey: nextKey(),
  });
  expect(on).toMatchObject({ ok: true });
  const companyEvents = await authPool.query<{ type: string }>(
    `SELECT type FROM audit_event WHERE details->>'companyId' = $1 ORDER BY "createdAt", id`,
    [companyId]
  );
  expect(companyEvents.rows.map(({ type }) => type)).toEqual([
    "company_deactivated",
    "company_reactivated",
  ]);
});

it("lets only admins read the audit log, with filters", async () => {
  const client = await createClient();
  await signIn(client.email, "wrong-password-for-audit!");
  const denied = await callAs("owner", clientQueries.listAuditEvents, {});
  expect(denied).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });

  const all = await callAs("admin", clientQueries.listAuditEvents, {
    query: client.email.slice(0, 12),
  });
  if (!all.ok) {
    throw new Error(all.error.message);
  }
  const entries = all.data as readonly {
    ip: string | null;
    subjectEmail: string | null;
    type: string;
  }[];
  expect(entries.length).toBeGreaterThan(0);
  expect(
    entries.every(({ subjectEmail }) => subjectEmail === client.email)
  ).toBe(true);
  expect(entries[0]?.type).toBe("login_failed");
  expect(entries[0]?.ip).toMatch(/^203\.0\./u);

  const onlySuccess = await callAs("admin", clientQueries.listAuditEvents, {
    query: client.email.slice(0, 12),
    type: "login_succeeded",
  });
  expect(onlySuccess).toMatchObject({ data: [], ok: true });
  const future = await callAs("admin", clientQueries.listAuditEvents, {
    from: new Date(Date.now() + 86_400_000).toISOString(),
  });
  expect(future).toMatchObject({ data: [], ok: true });
  const bad = await callAs("admin", clientQueries.listAuditEvents, {
    type: "not_an_event",
  });
  expect(bad).toMatchObject({ ok: false });
});

const submitBug = async (title: string): Promise<string> => {
  const result = await callAs("client", portal.submitClientBugAction, {
    actualBehavior: "Broken",
    browser: null,
    description: null,
    device: null,
    expectedBehavior: "Works",
    idempotencyKey: nextKey(),
    impact: "low",
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

const previewCookie = (clientId: string): string =>
  `${PORTAL_PREVIEW_COOKIE}=${encodeURIComponent(clientId)}`;

it("lets an admin read the portal as a client but never change anything", async () => {
  const bugId = await submitBug("Previewed bug");
  const cookie = previewCookie(personaId("client"));

  // Without the cookie an admin has no portal at all.
  const noCookie = await callAs("admin", portalQueries.listPortalBugs, {});
  expect(noCookie).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });

  const list = await callAsWithCookie(
    "admin",
    cookie,
    portalQueries.listPortalBugs,
    {}
  );
  expect(list.ok).toBe(true);
  expect(
    list.ok &&
      (list.data as readonly { id: string }[]).some(({ id }) => id === bugId)
  ).toBe(true);
  const detail = await callAsWithCookie(
    "admin",
    cookie,
    portalQueries.getPortalBug,
    { bugId }
  );
  expect(detail).toMatchObject({ data: { id: bugId }, ok: true });

  // Every change is refused, whatever the payload.
  const mutations: readonly (readonly [
    (input: unknown) => Promise<ActionResultLike>,
    unknown,
  ])[] = [
    [
      portal.addClientCommentAction,
      { body: "hello", bugId, idempotencyKey: nextKey() },
    ],
    [
      portal.withdrawClientBugAction,
      { bugId, expectedVersion: 1, idempotencyKey: nextKey() },
    ],
    [
      portal.confirmClientFixAction,
      { bugId, expectedVersion: 1, idempotencyKey: nextKey() },
    ],
    [portal.markAllPortalNotificationsReadAction, {}],
    [portal.attachClientFileAction, { bugId, fileId: randomUUID() }],
  ];
  for (const [action, input] of mutations) {
    // eslint-disable-next-line no-await-in-loop
    const refused = await callAsWithCookie("admin", cookie, action, input);
    expect(refused).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  }
  const comments = await authPool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM comment WHERE "authorId" = $1`,
    [personaId("admin")]
  );
  expect(comments.rows[0]?.count).toBe(0);

  // Only admins can preview, and only active clients.
  const asEmployee = await callAsWithCookie(
    "owner",
    cookie,
    portalQueries.listPortalBugs,
    {}
  );
  expect(asEmployee).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const asStaff = await callAsWithCookie(
    "admin",
    previewCookie(personaId("owner")),
    portalQueries.listPortalBugs,
    {}
  );
  expect(asStaff).toMatchObject({ ok: false });
  const nobody = await callAsWithCookie(
    "admin",
    previewCookie(randomUUID()),
    portalQueries.listPortalBugs,
    {}
  );
  expect(nobody).toMatchObject({ ok: false });
});

it("audits the start and end of a preview and refuses everyone else", async () => {
  const adminHeaders = new Headers(personaHeaders("admin"));
  adminHeaders.set("user-agent", "Admin Browser/9.0");
  await startPortalPreview(adminHeaders, personaId("client"));
  await endPortalPreview(adminHeaders, personaId("client"));
  const events = await authPool.query<{
    actorId: string;
    type: string;
    userAgent: string | null;
  }>(
    `SELECT type, "actorId", "userAgent" FROM audit_event WHERE "subjectUserId" = $1 AND type LIKE 'preview_%' ORDER BY "createdAt", id`,
    [personaId("client")]
  );
  expect(events.rows).toEqual([
    {
      actorId: personaId("admin"),
      type: "preview_started",
      userAgent: "Admin Browser/9.0",
    },
    {
      actorId: personaId("admin"),
      type: "preview_ended",
      userAgent: "Admin Browser/9.0",
    },
  ]);
  await expect(
    startPortalPreview(personaHeaders("owner"), personaId("client"))
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    startPortalPreview(personaHeaders("admin"), personaId("owner"))
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    startPortalPreview(new Headers(), personaId("client"))
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
});

it("starts and ends a preview through its link", async () => {
  const start = await previewRoute.GET(
    new Request(
      `http://localhost:3000/portal/preview?as=${personaId("client")}`,
      { headers: personaHeaders("admin") }
    )
  );
  expect(start.status).toBe(303);
  expect(start.headers.get("location")).toBe("http://localhost:3000/portal");
  const cookie = start.headers.get("set-cookie") ?? "";
  expect(cookie).toContain(PORTAL_PREVIEW_COOKIE);
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Lax");

  const refused = await previewRoute.GET(
    new Request(
      `http://localhost:3000/portal/preview?as=${personaId("client")}`,
      { headers: personaHeaders("owner") }
    )
  );
  expect(refused.headers.get("location")).toBe("http://localhost:3000/");
  expect(refused.headers.get("set-cookie")).toBeNull();

  const exitHeaders = new Headers(personaHeaders("admin"));
  exitHeaders.set(
    "cookie",
    `${exitHeaders.get("cookie")}; ${previewCookie(personaId("client"))}`
  );
  const exit = await previewRoute.GET(
    new Request("http://localhost:3000/portal/preview?exit=1", {
      headers: exitHeaders,
    })
  );
  expect(exit.headers.get("location")).toBe("http://localhost:3000/clients");
  expect(exit.headers.get("set-cookie")).toContain("Max-Age=0");
});

const monday = (time: string) => new Date(`2026-10-05T${time}:00Z`);

const calendar: SlaSettings = {
  calendar: {
    days: [1, 2, 3, 4, 5],
    endMinute: 1080,
    startMinute: 540,
    timeZone: "UTC",
  },
  targets: {
    high: { firstResponseMinutes: 240, resolutionMinutes: 1440 },
    low: { firstResponseMinutes: 1440, resolutionMinutes: 14_400 },
    medium: { firstResponseMinutes: 480, resolutionMinutes: 4800 },
    urgent: { firstResponseMinutes: 60, resolutionMinutes: 480 },
  },
};

it("summarises a company's support from its bugs", () => {
  const insight = companyInsight(
    [
      {
        clientReopenCount: 0,
        resolution: "confirmed",
        satisfaction: "up",
        status: "closed",
      },
      {
        clientReopenCount: 2,
        resolution: null,
        satisfaction: null,
        status: "triaged",
      },
      {
        clientReopenCount: 0,
        resolution: "unconfirmed",
        satisfaction: null,
        status: "closed",
      },
      {
        clientReopenCount: 0,
        resolution: "confirmed",
        satisfaction: "down",
        status: "closed",
      },
      {
        clientReopenCount: 0,
        resolution: null,
        satisfaction: null,
        status: "in_progress",
      },
    ],
    [
      {
        breachedResolution: false,
        breachedResponse: false,
        createdAt: monday("09:00"),
        firstRespondedAt: monday("10:00"),
      },
      {
        breachedResolution: true,
        breachedResponse: false,
        createdAt: monday("09:00"),
        firstRespondedAt: monday("11:00"),
      },
      {
        breachedResolution: false,
        breachedResponse: false,
        createdAt: monday("09:00"),
        firstRespondedAt: null,
      },
      {
        breachedResolution: false,
        breachedResponse: true,
        createdAt: monday("09:00"),
        firstRespondedAt: null,
      },
    ],
    calendar
  );
  expect(insight).toEqual({
    // (60 + 120) / 2 business minutes.
    averageFirstResponseMinutes: 90,
    // One reopened of four handed over (two confirmed, one unconfirmed, one reopened).
    reopenRate: 0.25,
    slaBreachRate: 0.5,
    thumbsUpRate: 0.5,
  });
  expect(companyInsight([], [], calendar)).toEqual({
    averageFirstResponseMinutes: null,
    reopenRate: null,
    slaBreachRate: null,
    thumbsUpRate: null,
  });
});

it("gives admins the insight on the company page", async () => {
  const company = await callAs("admin", clientQueries.getClientCompany, {
    companyId: ids.clientCompanyId,
  });
  expect(company).toMatchObject({
    data: {
      insight: {
        averageFirstResponseMinutes: null,
        reopenRate: null,
        slaBreachRate: expect.any(Number),
        thumbsUpRate: null,
      },
    },
    ok: true,
  });
});
