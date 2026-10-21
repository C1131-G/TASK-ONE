"use server";

import { Effect, Schema } from "effect";
import { refresh, revalidatePath } from "next/cache";

import { AuthSessionLive } from "@/src/server/auth/session";
import { requireAdmin } from "@/src/server/core/admin-action";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  WebhookDeliverySummarySchema,
  WebhookEndpointChangesSchema,
  WebhookEndpointCreatedSchema,
  WebhookEndpointInputSchema,
  WebhookEndpointSummarySchema,
  WebhookSecretSchema,
} from "@/src/server/webhooks/webhook-contracts";
import {
  WebhookManagement,
  WebhookManagementLive,
} from "@/src/server/webhooks/webhook-management";

const EndpointIdSchema = Schema.String.check(Schema.isUUID());
const RemovedSchema = Schema.Struct({ removed: Schema.Literal(true) });

const refreshWebhooks = () => {
  revalidatePath("/settings/webhooks");
  refresh();
};

// Not replayed through the idempotency store: it would keep the one-time
// signing secret. The form disables its button while the request runs.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createWebhookEndpointAction(input: unknown) {
  const result = await runServerAction(
    input,
    WebhookEndpointInputSchema,
    (validated) =>
      Effect.gen(function* createEndpoint() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const webhooks = yield* WebhookManagement;
        return yield* webhooks.create(administrator.id, validated);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WebhookManagementLive)
      ),
    undefined,
    WebhookEndpointCreatedSchema
  );
  if (result.ok) {
    refreshWebhooks();
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateWebhookEndpointAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      ...WebhookEndpointChangesSchema.fields,
      endpointId: EndpointIdSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    ({ endpointId, idempotencyKey, ...changes }) =>
      Effect.gen(function* updateEndpoint() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const webhooks = yield* WebhookManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () => webhooks.update(administrator.id, endpointId, changes),
          input: { endpointId, ...changes },
          key: idempotencyKey,
          operation: "webhooks.update",
          resultSchema: WebhookEndpointSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WebhookManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    WebhookEndpointSummarySchema
  );
  if (result.ok) {
    refreshWebhooks();
  }
  return result;
}

// Not replayed: the response carries the new one-time secret.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function rotateWebhookSecretAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({ endpointId: EndpointIdSchema }),
    ({ endpointId }) =>
      Effect.gen(function* rotateSecret() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const webhooks = yield* WebhookManagement;
        return yield* webhooks.rotateSecret(administrator.id, endpointId);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WebhookManagementLive)
      ),
    undefined,
    WebhookSecretSchema
  );
  if (result.ok) {
    refreshWebhooks();
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function removeWebhookEndpointAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      endpointId: EndpointIdSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    ({ endpointId, idempotencyKey }) =>
      Effect.gen(function* removeEndpoint() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const webhooks = yield* WebhookManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            webhooks
              .remove(administrator.id, endpointId)
              .pipe(Effect.as({ removed: true as const })),
          input: { endpointId },
          key: idempotencyKey,
          operation: "webhooks.remove",
          resultSchema: RemovedSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WebhookManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    RemovedSchema
  );
  if (result.ok) {
    refreshWebhooks();
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function redeliverWebhookAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      deliveryId: EndpointIdSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    ({ deliveryId, idempotencyKey }) =>
      Effect.gen(function* redeliver() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const webhooks = yield* WebhookManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () => webhooks.redeliver(administrator.id, deliveryId),
          input: { deliveryId },
          key: idempotencyKey,
          operation: "webhooks.redeliver",
          resultSchema: WebhookDeliverySummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WebhookManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    WebhookDeliverySummarySchema
  );
  if (result.ok) {
    refreshWebhooks();
  }
  return result;
}
