import { randomUUID } from "node:crypto";

import type { db } from "@/src/prisma/db";

import {
  WEBHOOK_DELIVERY_JOB,
  WEBHOOK_MAX_ATTEMPTS,
} from "./webhook-contracts";
import { buildWebhookEvent } from "./webhook-events";
import type { EventSource, WebhookEventType } from "./webhook-events";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface QueuedDelivery {
  readonly deliveryId: string;
  readonly dedupeKey: string;
  readonly now: Date;
}

export const queueDeliveryJob = (
  transaction: Transaction,
  { dedupeKey, deliveryId, now }: QueuedDelivery
) =>
  transaction.orm.public.Job.create({
    availableAt: now,
    createdAt: now,
    dedupeKey,
    id: randomUUID(),
    kind: WEBHOOK_DELIVERY_JOB,
    maxAttempts: WEBHOOK_MAX_ATTEMPTS,
    payload: { deliveryId },
    updatedAt: now,
  });

export interface EmittedEvent {
  readonly eventId?: string;
  readonly now: Date;
  readonly data: EventSource["data"];
}

/**
 * Records the event for every enabled endpoint subscribed to it and queues one
 * delivery job each. Runs inside the caller's transaction, so a rolled-back
 * change sends nothing. A repeated (endpoint, event) pair is a no-op.
 */
export const enqueueWebhookEvent = async (
  transaction: Transaction,
  type: WebhookEventType,
  emitted: EmittedEvent
): Promise<void> => {
  const endpoints = await transaction.orm.public.WebhookEndpoint.where({
    enabled: true,
  }).all();
  const subscribed = endpoints.filter(({ events }) => events.includes(type));
  if (subscribed.length === 0) {
    return;
  }
  const eventId = emitted.eventId ?? randomUUID();
  const event = buildWebhookEvent(type, {
    createdAt: emitted.now,
    data: emitted.data,
    id: eventId,
  });
  await Promise.all(
    subscribed.map(async (endpoint) => {
      const existing = await transaction.orm.public.WebhookDelivery.where({
        endpointId: endpoint.id,
        eventId,
      }).first();
      if (existing) {
        return;
      }
      const deliveryId = randomUUID();
      await transaction.orm.public.WebhookDelivery.create({
        attempts: 0,
        createdAt: emitted.now,
        endpointId: endpoint.id,
        eventId,
        eventType: type,
        id: deliveryId,
        // Spread so the interface becomes a plain object a JSON column accepts.
        payload: { ...event },
        status: "pending",
        updatedAt: emitted.now,
      });
      await queueDeliveryJob(transaction, {
        dedupeKey: `webhook:${endpoint.id}:${eventId}`,
        deliveryId,
        now: emitted.now,
      });
    })
  );
};
