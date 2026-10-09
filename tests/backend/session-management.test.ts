import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  SessionManagement,
  SessionManagementLive,
} from "../../src/server/people/session-management";

it("lets employees view and revoke their sessions while admins can manage another employee", async () => {
  const administratorId = randomUUID();
  const employeeId = randomUUID();
  const sessionId = randomUUID();
  const sessionToken = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false), ($5, $6, $7, $7, $8, false)',
    [
      administratorId,
      "Session Admin",
      `${administratorId}@sessions-test.example`,
      "admin",
      employeeId,
      "Session Employee",
      `${employeeId}@sessions-test.example`,
      "employee",
    ]
  );
  await authPool.query(
    'INSERT INTO session (id, token, "userId", "expiresAt") VALUES ($1, $2, $3, now() + interval \'8 hours\')',
    [sessionId, sessionToken, employeeId]
  );

  try {
    const employeeQuery = Effect.gen(function* employeeQuery() {
      const sessions = yield* SessionManagement;
      return yield* sessions.listSessions(employeeId, employeeId);
    });
    const employeeSessions = await Effect.runPromise(
      Effect.provide(employeeQuery, SessionManagementLive)
    );

    const revoke = Effect.gen(function* revokeSession() {
      const sessions = yield* SessionManagement;
      yield* sessions.revokeSession(employeeId, sessionId);
      return yield* sessions.listSessions(administratorId, employeeId);
    });
    const remaining = await Effect.runPromise(
      Effect.provide(revoke, SessionManagementLive)
    );

    expect(employeeSessions).toHaveLength(1);
    expect(employeeSessions[0]).toMatchObject({ id: sessionId });
    expect(employeeSessions[0]).not.toHaveProperty("token");
    expect(remaining).toEqual([]);

    const forbidden = Effect.gen(function* forbidden() {
      const sessions = yield* SessionManagement;
      return yield* sessions.listSessions(employeeId, administratorId);
    });
    const forbiddenResult = await runEffectResult(
      Effect.provide(forbidden, SessionManagementLive)
    );
    expect(forbiddenResult).toMatchObject({
      error: { code: "FORBIDDEN" },
      ok: false,
    });
  } finally {
    await authPool.query(
      'DELETE FROM activity WHERE "actorId" = ANY($1::text[])',
      [[administratorId, employeeId]]
    );
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [administratorId, employeeId],
    ]);
  }
});
