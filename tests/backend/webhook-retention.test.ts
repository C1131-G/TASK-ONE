import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { parseRetentionEnv } from "../../src/server/core/env";
import {
  DEFAULT_RETENTION_POLICY,
  purgeExpiredData,
  retentionPolicyFromEnv,
} from "../../src/server/jobs/data-retention";

const DAY_MS = 86_400_000;
const now = new Date();
const daysAgo = (days: number): Date => new Date(now.getTime() - days * DAY_MS);
const userId = randomUUID();
const endpointId = randomUUID();
const deliveries = {
  deadNew: randomUUID(),
  deadOld: randomUUID(),
  pendingOld: randomUUID(),
  retryingOld: randomUUID(),
  succeededNew: randomUUID(),
  succeededOld: randomUUID(),
};

const insertDelivery = (id: string, status: string, createdAt: Date) =>
  authPool.query(
    'INSERT INTO webhook_delivery (id, "endpointId", "eventId", "eventType", payload, status, "createdAt", "updatedAt") VALUES ($1, $2, $3, \'task.created\', \'{}\'::json, $4, $5, $5)',
    [id, endpointId, randomUUID(), status, createdAt]
  );

beforeAll(async () => {
  await authPool.query(
    "INSERT INTO webhook_endpoint (id, name, kind, url, events, \"createdById\") VALUES ($1, 'Retention', 'generic', 'https://example.com/hook', '{task.created}', $2)",
    [endpointId, userId]
  );
  await insertDelivery(deliveries.succeededOld, "succeeded", daysAgo(31));
  await insertDelivery(deliveries.deadOld, "dead", daysAgo(45));
  await insertDelivery(deliveries.succeededNew, "succeeded", daysAgo(29));
  await insertDelivery(deliveries.deadNew, "dead", daysAgo(2));
  // Work still in flight is never purged, however old.
  await insertDelivery(deliveries.pendingOld, "pending", daysAgo(90));
  await insertDelivery(deliveries.retryingOld, "retrying", daysAgo(90));
});

afterAll(async () => {
  await authPool.query("DELETE FROM webhook_endpoint WHERE id = $1", [
    endpointId,
  ]);
});

const remaining = async () => {
  const rows = await authPool.query<{ id: string }>(
    'SELECT id FROM webhook_delivery WHERE "endpointId" = $1',
    [endpointId]
  );
  return rows.rows.map(({ id }) => id).toSorted();
};

it("keeps delivery logs for 30 days by default and accepts an override", () => {
  expect(DEFAULT_RETENTION_POLICY.webhookDeliveryDays).toBe(30);
  expect(
    retentionPolicyFromEnv({ RETENTION_WEBHOOK_DELIVERY_DAYS: "7" })
      .webhookDeliveryDays
  ).toBe(7);
  expect(() =>
    parseRetentionEnv({ RETENTION_WEBHOOK_DELIVERY_DAYS: "0" })
  ).toThrow();
});

it("purges finished delivery rows past the window and keeps the rest", async () => {
  const report = await Effect.runPromise(
    purgeExpiredData({ batchSize: 1, now })
  );
  expect(report.webhookDeliveries).toBeGreaterThanOrEqual(2);
  expect(await remaining()).toEqual(
    [
      deliveries.succeededNew,
      deliveries.deadNew,
      deliveries.pendingOld,
      deliveries.retryingOld,
    ].toSorted()
  );
});
