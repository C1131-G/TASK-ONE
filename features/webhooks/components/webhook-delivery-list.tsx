/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { LocalTime } from "@/components/workspace/local-time";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  deliveryStatusBadge,
  describeEvents,
} from "@/features/webhooks/webhook-format";
import { redeliverWebhookAction } from "@/features/webhooks/webhooks-actions";
import type { WebhookDeliverySummary } from "@/src/server/webhooks/webhook-contracts";

export const WebhookDeliveryList = ({
  deliveries,
  endpointName,
}: {
  readonly deliveries: readonly WebhookDeliverySummary[];
  readonly endpointName: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);

  const redeliver = (deliveryId: string) =>
    startTransition(async () => {
      setFailure(null);
      const result = await redeliverWebhookAction({
        deliveryId,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setFailure(result.error.message);
      }
    });

  if (deliveries.length === 0) {
    return <p className="muted">No deliveries yet.</p>;
  }
  return (
    <div className="stack">
      {failure ? <p role="alert">{failure}</p> : null}
      <table className="tbl" data-webhook-deliveries="true">
        <caption className="sr-only">
          Recent deliveries for {endpointName}
        </caption>
        <thead>
          <tr>
            <th scope="col">Event</th>
            <th scope="col">Status</th>
            <th scope="col">Attempts</th>
            <th scope="col">Response</th>
            <th scope="col">When</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((delivery) => {
            const badge = deliveryStatusBadge(delivery.status);
            return (
              <tr key={delivery.id}>
                <td>{describeEvents([delivery.eventType])}</td>
                <td>
                  <span className={`badge ${badge.tone}`}>{badge.label}</span>
                </td>
                <td>{delivery.attempts}</td>
                <td>
                  {delivery.responseCode ?? "—"}
                  {delivery.lastError ? (
                    <span className="muted"> {delivery.lastError}</span>
                  ) : null}
                  {delivery.responseBody ? (
                    <code className="muted">
                      {" "}
                      {delivery.responseBody.slice(0, 120)}
                    </code>
                  ) : null}
                </td>
                <td>
                  <LocalTime value={delivery.createdAt} />
                </td>
                <td>
                  <WorkspaceButton
                    aria-label={`Redeliver ${describeEvents([delivery.eventType])} to ${endpointName}`}
                    className="btn btn-secondary btn-sm"
                    disabled={pending}
                    onClick={() => redeliver(delivery.id)}
                    type="button"
                  >
                    Redeliver
                  </WorkspaceButton>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
