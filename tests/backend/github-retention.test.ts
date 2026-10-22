import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { purgeExpiredData } from "../../src/server/jobs/data-retention";

const DAY_MS = 86_400_000;
const now = new Date();
const daysAgo = (days: number): Date => new Date(now.getTime() - days * DAY_MS);
const userId = randomUUID();
const projectId = randomUUID();
const connectionId = randomUUID();
const oldId = randomUUID();
const recentId = randomUUID();

const insertDelivery = (id: string, createdAt: Date) =>
  authPool.query(
    'INSERT INTO github_delivery (id, "connectionId", "deliveryId", event, "createdAt") VALUES ($1, $2, $3, \'pull_request\', $4)',
    [id, connectionId, randomUUID(), createdAt]
  );

beforeAll(async () => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, \'Retention\', $2, $2, \'admin\', false)',
    [userId, `${userId}@github-retention.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, 'Retention project')",
    [projectId, `GR${projectId.replaceAll("-", "").slice(0, 6).toUpperCase()}`]
  );
  await authPool.query(
    'INSERT INTO github_connection (id, "repoFullName", "projectId", "secretCiphertext", "secretHint", "createdById") VALUES ($1, $2, $3, \'unused\', \'0000\', $4)',
    [
      connectionId,
      `acme/retention-${connectionId.slice(0, 8)}`,
      projectId,
      userId,
    ]
  );
  await insertDelivery(oldId, daysAgo(31));
  await insertDelivery(recentId, daysAgo(2));
});

afterAll(async () => {
  await authPool.query("DELETE FROM github_connection WHERE id = $1", [
    connectionId,
  ]);
  await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
});

it("purges delivery ids past the window so the dedupe table stays bounded", async () => {
  const report = await Effect.runPromise(
    purgeExpiredData({ batchSize: 1, now })
  );
  expect(report.githubDeliveries).toBeGreaterThanOrEqual(1);
  const rows = await authPool.query<{ id: string }>(
    'SELECT id FROM github_delivery WHERE "connectionId" = $1',
    [connectionId]
  );
  expect(rows.rows.map(({ id }) => id)).toEqual([recentId]);
});
