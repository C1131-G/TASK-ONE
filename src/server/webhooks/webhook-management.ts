import { Context, Effect, Layer } from "effect";

import type { AppError } from "../core/action-result";
import type {
  WebhookDeliverySummary,
  WebhookEndpointChanges,
  WebhookEndpointCreated,
  WebhookEndpointInput,
  WebhookEndpointSummary,
} from "./webhook-contracts";
import { listEndpointDeliveries, redeliver } from "./webhook-delivery-ops";
import {
  createEndpoint,
  listEndpoints,
  removeEndpoint,
  rotateEndpointSecret,
  updateEndpoint,
} from "./webhook-endpoint-ops";
import { mapError } from "./webhook-internal";

export class WebhookManagement extends Context.Service<
  WebhookManagement,
  {
    readonly list: (
      actorId: string
    ) => Effect.Effect<readonly WebhookEndpointSummary[], AppError>;
    readonly create: (
      actorId: string,
      input: WebhookEndpointInput
    ) => Effect.Effect<WebhookEndpointCreated, AppError>;
    readonly update: (
      actorId: string,
      endpointId: string,
      changes: WebhookEndpointChanges
    ) => Effect.Effect<WebhookEndpointSummary, AppError>;
    readonly rotateSecret: (
      actorId: string,
      endpointId: string
    ) => Effect.Effect<{ readonly secret: string }, AppError>;
    readonly remove: (
      actorId: string,
      endpointId: string
    ) => Effect.Effect<void, AppError>;
    readonly listDeliveries: (
      actorId: string,
      endpointId: string,
      limit: number
    ) => Effect.Effect<readonly WebhookDeliverySummary[], AppError>;
    readonly redeliver: (
      actorId: string,
      deliveryId: string
    ) => Effect.Effect<WebhookDeliverySummary, AppError>;
  }
>()("metsys/server/WebhookManagement") {}

const attempt = <Value>(run: () => Promise<Value>) =>
  Effect.tryPromise({ catch: mapError, try: run });

export const WebhookManagementLive = Layer.succeed(
  WebhookManagement,
  WebhookManagement.of({
    create: (actorId, input) => attempt(() => createEndpoint(actorId, input)),
    list: (actorId) => attempt(() => listEndpoints(actorId)),
    listDeliveries: (actorId, endpointId, limit) =>
      attempt(() => listEndpointDeliveries(actorId, endpointId, limit)),
    redeliver: (actorId, deliveryId) =>
      attempt(() => redeliver(actorId, deliveryId)),
    remove: (actorId, endpointId) =>
      attempt(() => removeEndpoint(actorId, endpointId)),
    rotateSecret: (actorId, endpointId) =>
      attempt(() => rotateEndpointSecret(actorId, endpointId)),
    update: (actorId, endpointId, changes) =>
      attempt(() => updateEndpoint(actorId, endpointId, changes)),
  })
);
