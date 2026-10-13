import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { auth } from "../../src/server/auth/auth";
import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  UserManagement,
  UserManagementLive,
} from "../../src/server/people/user-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("creates an employee whose one-time password works with Better Auth", async () => {
  const administratorId = randomUUID();
  const employeeEmail = `created-${randomUUID()}@example.test`;

  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", "emailVerified", role, "mustChangePassword") VALUES ($1, $2, $3, $4, true, $5, false)',
    [
      administratorId,
      "Test Administrator",
      `admin-${administratorId}@example.test`,
      `admin-${administratorId}@example.test`,
      "admin",
    ]
  );

  try {
    const program = Effect.gen(function* program() {
      const management = yield* UserManagement;
      return yield* management.createEmployee(administratorId, {
        email: employeeEmail,
        jobTitle: "Designer",
        name: "New Employee",
        role: "employee",
        teamId: null,
      });
    });

    const result = await runEffectResult(
      Effect.provide(program, UserManagementLive),
      "req-create-employee"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.employeeId).toMatch(/^EMP\d{6}$/u);
    expect(result.data.temporaryPassword.length).toBeGreaterThanOrEqual(24);

    const signIn = await auth.api.signInEmail({
      body: { email: employeeEmail, password: result.data.temporaryPassword },
    });

    expect(signIn.user.email).toBe(employeeEmail);
  } finally {
    await authPool.query(
      'DELETE FROM activity WHERE "actorId" = $1 OR details->>\'userId\' IN (SELECT id FROM "user" WHERE id = $1 OR "emailNormalized" = $2)',
      [administratorId, employeeEmail]
    );
    await authPool.query(
      'DELETE FROM "user" WHERE id = $1 OR "emailNormalized" = $2',
      [administratorId, employeeEmail]
    );
  }
});

it("lets an active employee update their own display name", async () => {
  const employeeId = randomUUID();
  const email = `${employeeId}@profile-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [employeeId, "Old Display Name", email]
  );

  try {
    const program = Effect.gen(function* updateOwnProfile() {
      const management = yield* UserManagement;
      return yield* management.updateOwnProfile(employeeId, {
        name: "  New Display Name  ",
      });
    });
    const updated = await Effect.runPromise(
      Effect.provide(program, UserManagementLive)
    );
    expect(updated.name).toBe("New Display Name");
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      employeeId,
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [employeeId]);
  }
});
