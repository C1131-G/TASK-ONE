import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  UserManagement,
  UserManagementLive,
} from "../../src/server/people/user-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const seedAdmins = async (): Promise<[string, string]> => {
  const first = randomUUID();
  const second = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false), ($4, $5, $6, $6, \'admin\', false)',
    [
      first,
      "Admin One",
      `${first}@admin-conc.example`,
      second,
      "Admin Two",
      `${second}@admin-conc.example`,
    ]
  );
  return [first, second];
};

const removeAdmins = async (adminIds: readonly string[]) => {
  await authPool.query(
    'DELETE FROM activity WHERE "actorId" = ANY($1::text[])',
    [adminIds]
  );
  // A deactivated account references the administrator who deactivated it, so
  // it has to go first.
  await authPool.query(
    'DELETE FROM "user" WHERE id = ANY($1::text[]) AND "deactivatedById" IS NOT NULL',
    [adminIds]
  );
  await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
    adminIds,
  ]);
};

const activeAdminCount = async (adminIds: readonly string[]) => {
  const rows = await authPool.query(
    'SELECT id FROM "user" WHERE id = ANY($1::text[]) AND role = \'admin\' AND "deactivatedAt" IS NULL',
    [adminIds]
  );
  return rows.rows.length;
};

const run = <Value>(program: Effect.Effect<Value, unknown, UserManagement>) =>
  runEffectResult(Effect.provide(program, UserManagementLive));

it("keeps an administrator when two administrators deactivate each other at once", async () => {
  const admins = await seedAdmins();
  const [first, second] = admins;
  try {
    const outcomes = await Promise.all([
      run(
        Effect.gen(function* deactivateSecond() {
          const users = yield* UserManagement;
          yield* users.deactivateEmployee(first, second);
        })
      ),
      run(
        Effect.gen(function* deactivateFirst() {
          const users = yield* UserManagement;
          yield* users.deactivateEmployee(second, first);
        })
      ),
    ]);

    expect(outcomes.filter((outcome) => outcome.ok).length).toBeLessThanOrEqual(
      1
    );
    expect(await activeAdminCount(admins)).toBeGreaterThanOrEqual(1);
  } finally {
    await removeAdmins(admins);
  }
});

it("keeps an administrator when two administrators demote each other at once", async () => {
  const admins = await seedAdmins();
  const [first, second] = admins;
  try {
    const outcomes = await Promise.all([
      run(
        Effect.gen(function* demoteSecond() {
          const users = yield* UserManagement;
          yield* users.changeEmployeeRole(first, second, "employee");
        })
      ),
      run(
        Effect.gen(function* demoteFirst() {
          const users = yield* UserManagement;
          yield* users.changeEmployeeRole(second, first, "employee");
        })
      ),
    ]);

    expect(outcomes.filter((outcome) => outcome.ok).length).toBeLessThanOrEqual(
      1
    );
    expect(await activeAdminCount(admins)).toBeGreaterThanOrEqual(1);
  } finally {
    await removeAdmins(admins);
  }
});
