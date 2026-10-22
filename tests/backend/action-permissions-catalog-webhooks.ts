import { entry } from "./action-permissions-shared";
import type { ActionEntry } from "./action-permissions-shared";
import { ids, nextKey } from "./support/action-harness";

const webhookActions = await import("../../features/webhooks/webhooks-actions");
const webhookQueries = await import("../../features/webhooks/webhooks-queries");

// Webhook management is administrator-only end to end.
export const webhookActionCatalog: readonly ActionEntry[] = [
  entry(
    "listWebhookEndpoints",
    webhookQueries.listWebhookEndpoints,
    () => ({})
  ),
  entry("listWebhookDeliveries", webhookQueries.listWebhookDeliveries, () => ({
    endpointId: ids.random,
    limit: 10,
  })),
  entry(
    "createWebhookEndpointAction",
    webhookActions.createWebhookEndpointAction,
    () => ({
      events: ["task.created"],
      kind: "generic",
      name: "Harness permission webhook",
      url: "https://hooks.example.com/permission",
    })
  ),
  entry(
    "updateWebhookEndpointAction",
    webhookActions.updateWebhookEndpointAction,
    () => ({
      enabled: true,
      endpointId: ids.random,
      events: ["task.created"],
      idempotencyKey: nextKey(),
      name: "Harness permission webhook",
      url: "https://hooks.example.com/permission",
    })
  ),
  entry(
    "rotateWebhookSecretAction",
    webhookActions.rotateWebhookSecretAction,
    () => ({ endpointId: ids.random })
  ),
  entry(
    "removeWebhookEndpointAction",
    webhookActions.removeWebhookEndpointAction,
    () => ({ endpointId: ids.random, idempotencyKey: nextKey() })
  ),
  entry(
    "redeliverWebhookAction",
    webhookActions.redeliverWebhookAction,
    () => ({ deliveryId: ids.random, idempotencyKey: nextKey() })
  ),
];

export const webhookAdminOnlyNames: readonly string[] =
  webhookActionCatalog.map(({ name }) => name);
