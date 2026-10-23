import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  callAs,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { ActionResultLike } from "./support/action-harness";

const sessions = await import("../../features/user/actions/user-sessions");
const userQueries = await import("../../features/user/user-queries");

beforeAll(setupHarness);
afterAll(teardownHarness);

interface SessionRow {
  readonly id: string;
}

const listIds = async (persona: "admin" | "client"): Promise<string[]> => {
  const result = (await callAs(
    persona,
    userQueries.listMySessions,
    {}
  )) as ActionResultLike & { data?: readonly SessionRow[] };
  expect(result.ok).toBe(true);
  return (result.data ?? []).map((row) => row.id);
};

const insertSession = async (userId: string): Promise<string> => {
  const id = randomUUID();
  await authPool.query(
    'INSERT INTO session (id, token, "userId", "expiresAt", "createdAt", "updatedAt", "ipAddress", "userAgent") VALUES ($1, $2, $3, now() + interval \'1 hour\', now(), now(), $4, $5)',
    [id, randomUUID(), userId, "203.0.113.7", "Second device"]
  );
  return id;
};

const sessionExists = async (id: string): Promise<boolean> => {
  const result = await authPool.query("SELECT 1 FROM session WHERE id = $1", [
    id,
  ]);
  return result.rowCount === 1;
};

it("lets a client list only their own sessions", async () => {
  const ownId = await insertSession(personaId("client"));
  const adminIds = await listIds("admin");
  const clientIds = await listIds("client");

  expect(clientIds).toContain(ownId);
  for (const adminId of adminIds) {
    expect(clientIds).not.toContain(adminId);
  }
  await authPool.query("DELETE FROM session WHERE id = $1", [ownId]);
});

it("lets a client sign out one of their own other devices", async () => {
  const ownId = await insertSession(personaId("client"));

  const result = await callAs("client", sessions.revokeSessionAction, {
    sessionId: ownId,
  });

  expect(result.ok).toBe(true);
  expect(await sessionExists(ownId)).toBe(false);
});

it("refuses to let a client revoke someone else's session", async () => {
  const [adminSessionId] = await listIds("admin");
  expect(adminSessionId).toBeDefined();

  const result = await callAs("client", sessions.revokeSessionAction, {
    sessionId: adminSessionId,
  });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe("FORBIDDEN");
  }
  expect(await sessionExists(adminSessionId ?? "")).toBe(true);
});
