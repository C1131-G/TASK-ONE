import { randomUUID } from "node:crypto";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type {
  WebhookEndpointChanges,
  WebhookEndpointCreated,
  WebhookEndpointInput,
  WebhookEndpointSummary,
} from "./webhook-contracts";
import {
  notFound,
  requireAdmin,
  toEndpointSummary,
  validateDestination,
} from "./webhook-internal";
import {
  encryptSecret,
  generateSecret,
  secretHint,
  webhookKeyMaterial,
} from "./webhook-secret";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const recordActivity = (
  transaction: Transaction,
  actorId: string,
  action: string,
  endpointId: string
) =>
  transaction.orm.public.Activity.create({
    action,
    actorId,
    createdAt: new Date(),
    details: { endpointId },
    id: randomUUID(),
    projectId: null,
    taskId: null,
  });

const sealedSecret = () => {
  const secret = generateSecret();
  return {
    secret,
    stored: {
      secretCiphertext: encryptSecret(secret, webhookKeyMaterial()),
      secretHint: secretHint(secret),
    },
  };
};

const uniqueEvents = (events: readonly string[]): string[] => {
  if (events.length === 0) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      field: "events",
      message: "Choose at least one event.",
    });
  }
  return [...new Set(events)];
};

export const listEndpoints = async (
  actorId: string
): Promise<readonly WebhookEndpointSummary[]> => {
  await requireAdmin(actorId);
  const rows = await db.orm.public.WebhookEndpoint.orderBy((endpoint) =>
    endpoint.createdAt.desc()
  ).all();
  return rows.map(toEndpointSummary);
};

export const createEndpoint = async (
  actorId: string,
  input: WebhookEndpointInput
): Promise<WebhookEndpointCreated> => {
  await requireAdmin(actorId);
  const url = validateDestination(input.kind, input.url);
  const sealed = input.kind === "generic" ? sealedSecret() : undefined;
  const now = new Date();
  const row = await db.transaction(async (transaction) => {
    const created = await transaction.orm.public.WebhookEndpoint.create({
      createdAt: now,
      createdById: actorId,
      enabled: true,
      events: uniqueEvents(input.events),
      id: randomUUID(),
      kind: input.kind,
      name: input.name.trim(),
      secretCiphertext: sealed?.stored.secretCiphertext ?? null,
      secretHint: sealed?.stored.secretHint ?? null,
      updatedAt: now,
      url,
    });
    await recordActivity(transaction, actorId, "webhook.created", created.id);
    return created;
  });
  return {
    endpoint: toEndpointSummary(row),
    secret: sealed?.secret ?? null,
  };
};

export const updateEndpoint = async (
  actorId: string,
  endpointId: string,
  changes: WebhookEndpointChanges
): Promise<WebhookEndpointSummary> => {
  await requireAdmin(actorId);
  return db.transaction(async (transaction) => {
    const current = await transaction.orm.public.WebhookEndpoint.where({
      id: endpointId,
    }).first();
    if (!current) {
      throw notFound();
    }
    const url =
      changes.url === undefined
        ? current.url
        : validateDestination(
            current.kind === "slack" ? "slack" : "generic",
            changes.url
          );
    const updated = await transaction.orm.public.WebhookEndpoint.where({
      id: endpointId,
    }).update({
      enabled: changes.enabled,
      events: uniqueEvents(changes.events),
      name: changes.name.trim(),
      updatedAt: new Date(),
      url,
    });
    if (!updated) {
      throw notFound();
    }
    await recordActivity(transaction, actorId, "webhook.updated", endpointId);
    return toEndpointSummary(updated);
  });
};

export const rotateEndpointSecret = async (
  actorId: string,
  endpointId: string
): Promise<{ readonly secret: string }> => {
  await requireAdmin(actorId);
  return db.transaction(async (transaction) => {
    const current = await transaction.orm.public.WebhookEndpoint.where({
      id: endpointId,
    }).first();
    if (!current) {
      throw notFound();
    }
    if (current.kind !== "generic") {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Only signed endpoints have a secret.",
      });
    }
    const { secret, stored } = sealedSecret();
    await transaction.orm.public.WebhookEndpoint.where({
      id: endpointId,
    }).update({ ...stored, updatedAt: new Date() });
    await recordActivity(
      transaction,
      actorId,
      "webhook.secret_rotated",
      endpointId
    );
    return { secret };
  });
};

export const removeEndpoint = async (
  actorId: string,
  endpointId: string
): Promise<void> => {
  await requireAdmin(actorId);
  await db.transaction(async (transaction) => {
    const current = await transaction.orm.public.WebhookEndpoint.where({
      id: endpointId,
    }).first();
    if (!current) {
      throw notFound();
    }
    await transaction.orm.public.WebhookEndpoint.where({
      id: endpointId,
    }).deleteAll();
    await recordActivity(transaction, actorId, "webhook.removed", endpointId);
  });
};
