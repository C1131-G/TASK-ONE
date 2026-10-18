import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { AuthSession, AuthSessionLive } from "../../src/server/auth/session";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  PasswordManagement,
  PasswordManagementLive,
} from "../../src/server/people/password-management";
import { authPool, callAs, nextKey, personaId } from "./support/action-harness";
import {
  clientQueries,
  clients,
  people,
  createClient,
  signIn,
  cookieOf,
  lastActiveMs,
  installHooks,
} from "./support/client-security-fixtures";

installHooks();

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
