import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { authPool, callAs } from "./support/action-harness";
import {
  clientQueries,
  clients,
  createClient,
  signIn,
  loginState,
  failedCount,
  auditTypes,
  installHooks,
} from "./support/client-security-fixtures";

installHooks();

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
  // A second click changes nothing and adds no second audit row.
  const again = await callAs("admin", clients.unlockUserAction, {
    userId: client.id,
  });
  expect(again).toMatchObject({ ok: true });
  const afterRepeat = await auditTypes(client.id);
  expect(
    afterRepeat.filter((type) => type === "account_unlocked")
  ).toHaveLength(1);
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
