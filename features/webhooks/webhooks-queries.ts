import "server-only";
import { Effect, Schema } from "effect";

import { AuthSessionLive } from "@/src/server/auth/session";
import { requireAdmin } from "@/src/server/core/admin-action";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  WebhookDeliveryListSchema,
  WebhookEndpointListSchema,
} from "@/src/server/webhooks/webhook-contracts";
import {
  WebhookManagement,
  WebhookManagementLive,
} from "@/src/server/webhooks/webhook-management";

export const listWebhookEndpoints = async (input: unknown = {}) =>
  await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* listEndpoints() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const webhooks = yield* WebhookManagement;
        return yield* webhooks.list(administrator.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WebhookManagementLive)
      ),
    undefined,
    WebhookEndpointListSchema
  );

export const listWebhookDeliveries = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({
      endpointId: Schema.String.check(Schema.isUUID()),
      limit: Schema.Number.check(Schema.isInt()),
    }),
    ({ endpointId, limit }) =>
      Effect.gen(function* listDeliveries() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const webhooks = yield* WebhookManagement;
        return yield* webhooks.listDeliveries(
          administrator.id,
          endpointId,
          limit
        );
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WebhookManagementLive)
      ),
    undefined,
    WebhookDeliveryListSchema
  );
