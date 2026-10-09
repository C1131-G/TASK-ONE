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

it("bootstraps the first admin once with a forced password change", async () => {
  const email = `bootstrap-${randomUUID()}@example.test`;

  try {
    const createProgram = Effect.gen(function* bootstrap() {
      const management = yield* UserManagement;
      return yield* management.createFirstAdmin({
        email,
        name: "First Admin",
      });
    });
    const first = await Effect.runPromise(
      Effect.provide(createProgram, UserManagementLive)
    );
    const signIn = await auth.api.signInEmail({
      body: { email, password: first.temporaryPassword },
      headers: new Headers({ "x-forwarded-for": "198.51.100.41" }),
    });
    expect(signIn.user.email).toBe(email);
    expect(first.role).toBe("admin");

    const secondProgram = Effect.gen(function* secondBootstrap() {
      const management = yield* UserManagement;
      return yield* management.createFirstAdmin({
        email: `second-${email}`,
        name: "Second Admin",
      });
    });
    const second = await runEffectResult(
      Effect.provide(secondProgram, UserManagementLive)
    );
    expect(second).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
  } finally {
    await authPool.query(
      'DELETE FROM activity WHERE "actorId" IN (SELECT id FROM "user" WHERE "emailNormalized" = $1)',
      [email]
    );
    await authPool.query('DELETE FROM "user" WHERE "emailNormalized" = $1', [
      email,
    ]);
  }
});

it("lets admins update an employee's login email, title, and optional team", async () => {
  const administratorId = randomUUID();
  const employeeId = randomUUID();
  const teamId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false), ($5, $6, $7, $7, $8, false)',
    [
      administratorId,
      "Details Admin",
      `${administratorId}@details-test.example`,
      "admin",
      employeeId,
      "Employee Details",
      `${employeeId}@details-test.example`,
      "employee",
    ]
  );
  await authPool.query("INSERT INTO team (id, name) VALUES ($1, $2)", [
    teamId,
    `Research ${teamId.slice(0, 5)}`,
  ]);

  try {
    const program = Effect.gen(function* updateDetails() {
      const management = yield* UserManagement;
      yield* management.updateEmployeeDetails(administratorId, employeeId, {
        email: "  person@example.test ",
        jobTitle: "Research Lead",
        teamId,
      });
      return yield* management.listEmployees(
        administratorId,
        "Employee Details"
      );
    });
    const result = await Effect.runPromise(
      Effect.provide(program, UserManagementLive)
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      email: "person@example.test",
      jobTitle: "Research Lead",
      teamId,
    });
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      administratorId,
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [administratorId, employeeId],
    ]);
    await authPool.query("DELETE FROM team WHERE id = $1", [teamId]);
  }
});

it("keeps at least one active administrator when deactivating an admin", async () => {
  const administratorId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", "emailVerified", role, "mustChangePassword") VALUES ($1, $2, $3, $4, true, $5, false)',
    [
      administratorId,
      "Last Administrator",
      `last-${administratorId}@example.test`,
      `last-${administratorId}@example.test`,
      "admin",
    ]
  );

  try {
    const program = Effect.gen(function* program() {
      const management = yield* UserManagement;
      return yield* management.deactivateEmployee(
        administratorId,
        administratorId
      );
    });
    const result = await runEffectResult(
      Effect.provide(program, UserManagementLive)
    );
    expect(result).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      administratorId,
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [administratorId]);
  }
});

it("reactivates a deactivated employee through the admin service", async () => {
  const administratorId = randomUUID();
  const employeeId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false), ($5, $6, $7, $7, $8, false)',
    [
      administratorId,
      "Reactivation Admin",
      `reactivation-admin-${administratorId}@example.test`,
      "admin",
      employeeId,
      "Reactivation Employee",
      `reactivation-employee-${employeeId}@example.test`,
      "employee",
    ]
  );
  await authPool.query(
    'UPDATE "user" SET "deactivatedAt" = now(), "deactivatedById" = $1 WHERE id = $2',
    [administratorId, employeeId]
  );

  try {
    const program = Effect.gen(function* reactivate() {
      const management = yield* UserManagement;
      yield* management.reactivateEmployee(administratorId, employeeId);
      return yield* management.listEmployees(
        administratorId,
        "Reactivation Employee"
      );
    });
    const result = await Effect.runPromise(
      Effect.provide(program, UserManagementLive)
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(employeeId);
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      administratorId,
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [administratorId, employeeId],
    ]);
  }
});

it("keeps the last active administrator from being demoted", async () => {
  const administratorId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", "emailVerified", role, "mustChangePassword") VALUES ($1, $2, $3, $4, true, $5, false)',
    [
      administratorId,
      "Last Administrator",
      `last-role-${administratorId}@example.test`,
      `last-role-${administratorId}@example.test`,
      "admin",
    ]
  );

  try {
    const program = Effect.gen(function* program() {
      const management = yield* UserManagement;
      return yield* management.changeEmployeeRole(
        administratorId,
        administratorId,
        "employee"
      );
    });
    const result = await runEffectResult(
      Effect.provide(program, UserManagementLive)
    );
    expect(result).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      administratorId,
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [administratorId]);
  }
});

it("resets credentials using Better Auth hashing and forces a new password", async () => {
  const administratorId = randomUUID();
  const employeeEmail = `reset-${randomUUID()}@example.test`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", "emailVerified", role, "mustChangePassword") VALUES ($1, $2, $3, $4, true, $5, false)',
    [
      administratorId,
      "Test Administrator",
      `admin-reset-${administratorId}@example.test`,
      `admin-reset-${administratorId}@example.test`,
      "admin",
    ]
  );

  try {
    const createProgram = Effect.gen(function* createProgram() {
      const management = yield* UserManagement;
      return yield* management.createEmployee(administratorId, {
        email: employeeEmail,
        jobTitle: null,
        name: "Reset Test",
        role: "employee",
        teamId: null,
      });
    });
    const created = await Effect.runPromise(
      Effect.provide(createProgram, UserManagementLive)
    );

    const resetProgram = Effect.gen(function* resetProgram() {
      const management = yield* UserManagement;
      return yield* management.resetEmployeePassword(
        administratorId,
        created.id
      );
    });
    const reset = await Effect.runPromise(
      Effect.provide(resetProgram, UserManagementLive)
    );
    const signInResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        body: JSON.stringify({
          email: employeeEmail,
          password: reset.temporaryPassword,
        }),
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.42",
        },
        method: "POST",
      })
    );
    const signInBody = (await signInResponse.json()) as {
      user?: { email?: string };
    };
    expect(reset.employeeId).toBe(created.id);
    expect(signInResponse.status).toBe(200);
    expect(signInBody.user?.email).toBe(employeeEmail);
    expect(signInResponse.headers.getSetCookie().length).toBeGreaterThan(0);
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
