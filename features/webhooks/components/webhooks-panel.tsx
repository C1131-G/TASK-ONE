/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { redirect } from "next/navigation";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { WebhookCreateForm } from "@/features/webhooks/components/webhook-create-form";
import { WebhookEndpointCard } from "@/features/webhooks/components/webhook-endpoint-card";
import {
  listWebhookDeliveries,
  listWebhookEndpoints,
} from "@/features/webhooks/webhooks-queries";
import { readOrThrow } from "@/lib/read-result";
import { getPageSession } from "@/src/server/auth/page-session";

const DELIVERIES_SHOWN = 10;

const WebhooksPanel = async () => {
  const session = await getPageSession();
  if (session.kind !== "authenticated" || session.user.role !== "admin") {
    redirect("/");
  }
  const endpoints = readOrThrow(
    await listWebhookEndpoints({}),
    "Webhook endpoints"
  );
  const deliveryLists = await Promise.all(
    endpoints.map((endpoint) =>
      listWebhookDeliveries({
        endpointId: endpoint.id,
        limit: DELIVERIES_SHOWN,
      })
    )
  );
  return (
    <div className="stack">
      <WebhookCreateForm />
      {endpoints.length === 0 ? (
        <section className="panel panel-b">
          <h2>No endpoints yet</h2>
          <p className="muted">
            Add an endpoint above to start receiving workspace events.
          </p>
        </section>
      ) : (
        endpoints.map((endpoint, index) => (
          <WebhookEndpointCard
            deliveries={readOrThrow(
              deliveryLists[index] ?? {
                error: {
                  code: "UNAVAILABLE",
                  message: "Deliveries are unavailable.",
                  requestId: "",
                },
                ok: false,
              },
              "Webhook deliveries"
            )}
            endpoint={endpoint}
            key={endpoint.id}
          />
        ))
      )}
    </div>
  );
};

const WebhooksPanelSkeleton = () => (
  <PanelSkeleton label="Loading webhooks…" rows={4} title="Webhooks" />
);

export { WebhooksPanel, WebhooksPanelSkeleton };
