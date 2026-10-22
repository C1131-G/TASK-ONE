import { randomUUID } from "node:crypto";

import { db } from "@/src/prisma/db";

import type { WebhookDeliverySummary } from "./webhook-contracts";
import { queueDeliveryJob } from "./webhook-enqueue";
import { notFound, requireAdmin, toDeliverySummary } from "./webhook-internal";

const MAX_DELIVERY_PAGE = 100;

export const listEndpointDeliveries = async (
  actorId: string,
  endpointId: string,
  limit: number
): Promise<readonly WebhookDeliverySummary[]> => {
  await requireAdmin(actorId);
  const rows = await db.orm.public.WebhookDelivery.where({ endpointId })
    .orderBy((delivery) => delivery.createdAt.desc())
    .limit(Math.max(1, Math.min(MAX_DELIVERY_PAGE, Math.trunc(limit))))
    .all();
  return rows.map(toDeliverySummary);
};

/** Resets one delivery to pending and queues it again under a fresh job key. */
export const redeliver = async (
  actorId: string,
  deliveryId: string
): Promise<WebhookDeliverySummary> => {
  await requireAdmin(actorId);
  return db.transaction(async (transaction) => {
    const now = new Date();
    const reset = await transaction.orm.public.WebhookDelivery.where({
      id: deliveryId,
    }).update({
      attempts: 0,
      deliveredAt: null,
      lastError: null,
      responseBody: null,
      responseCode: null,
      status: "pending",
      updatedAt: now,
    });
    if (!reset) {
      throw notFound();
    }
    await queueDeliveryJob(transaction, {
      dedupeKey: `webhook:${reset.endpointId}:${reset.eventId}:redeliver:${randomUUID()}`,
      deliveryId,
      now,
    });
    return toDeliverySummary(reset);
  });
};
