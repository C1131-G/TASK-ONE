import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  callAs,
  nextKey,
  personaId,
  replay,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { refreshes } from "./support/next-cache-mock";

const webhookActions = await import("../../features/webhooks/webhooks-actions");
const webhookQueries = await import("../../features/webhooks/webhooks-queries");

let createdEndpointId = "";

beforeAll(setupHarness);
afterAll(async () => {
  await authPool.query(
    'DELETE FROM webhook_endpoint WHERE "createdById" = $1',
    [personaId("admin")]
  );
  await teardownHarness();
});

it("creates an endpoint, shows the secret once, and never lists it again", async () => {
  const refreshesBefore = refreshes.count;
  const created = await callAs(
    "admin",
    webhookActions.createWebhookEndpointAction,
    {
      events: ["task.created", "project.created"],
      kind: "generic",
      name: "Harness receiver",
      url: "https://hooks.example.com/harness",
    }
  );
  if (!created.ok) {
    throw new Error(`Creating the endpoint failed: ${created.error.message}`);
  }
  createdEndpointId = created.data.endpoint.id;
  expect(created.data.secret?.startsWith("whsec_")).toBe(true);
  expect(refreshes.count).toBeGreaterThan(refreshesBefore);

  const listed = await callAs("admin", webhookQueries.listWebhookEndpoints, {});
  expect(listed.ok).toBe(true);
  expect(JSON.stringify(listed)).not.toContain(created.data.secret ?? "");
});

it("reports field errors for an unsafe URL", async () => {
  const refused = await callAs(
    "admin",
    webhookActions.createWebhookEndpointAction,
    {
      events: ["task.created"],
      kind: "generic",
      name: "Metadata probe",
      url: "https://169.254.169.254/latest/meta-data/",
    }
  );
  expect(refused).toMatchObject({
    error: {
      code: "VALIDATION_FAILED",
      fieldErrors: { url: expect.any(String) },
    },
    ok: false,
  });
});

it("replays update, redeliver and remove without acting twice", async () => {
  await replay(
    "updateWebhookEndpointAction",
    "admin",
    webhookActions.updateWebhookEndpointAction,
    {
      enabled: false,
      endpointId: createdEndpointId,
      events: ["task.created"],
      name: "Harness receiver renamed",
      url: "https://hooks.example.com/harness",
    }
  );
  const row = await authPool.query<{ enabled: boolean; name: string }>(
    "SELECT enabled, name FROM webhook_endpoint WHERE id = $1",
    [createdEndpointId]
  );
  expect(row.rows[0]).toEqual({
    enabled: false,
    name: "Harness receiver renamed",
  });

  const delivery = await authPool.query<{ id: string }>(
    "INSERT INTO webhook_delivery (id, \"endpointId\", \"eventId\", \"eventType\", payload, status) VALUES (gen_random_uuid(), $1, gen_random_uuid(), 'task.created', '{}'::json, 'dead') RETURNING id",
    [createdEndpointId]
  );
  const deliveryId = delivery.rows[0]?.id ?? "";
  await replay(
    "redeliverWebhookAction",
    "admin",
    webhookActions.redeliverWebhookAction,
    { deliveryId }
  );
  const jobs = await authPool.query(
    'SELECT id FROM job WHERE "dedupeKey" LIKE $1',
    [`webhook:${createdEndpointId}:%`]
  );
  expect(jobs.rows).toHaveLength(1);

  await replay(
    "removeWebhookEndpointAction",
    "admin",
    webhookActions.removeWebhookEndpointAction,
    { endpointId: createdEndpointId }
  );
  const gone = await authPool.query(
    "SELECT id FROM webhook_endpoint WHERE id = $1",
    [createdEndpointId]
  );
  expect(gone.rows).toHaveLength(0);
  const missing = await callAs(
    "admin",
    webhookActions.removeWebhookEndpointAction,
    { endpointId: createdEndpointId, idempotencyKey: nextKey() }
  );
  expect(missing).toMatchObject({ error: { code: "NOT_FOUND" }, ok: false });
  await authPool.query("DELETE FROM job WHERE kind = 'webhooks.deliver'");
});
