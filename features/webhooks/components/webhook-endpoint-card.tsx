/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  describeEvents,
  endpointKindLabel,
  parseSelectedEvents,
} from "@/features/webhooks/webhook-format";
import {
  removeWebhookEndpointAction,
  rotateWebhookSecretAction,
  updateWebhookEndpointAction,
} from "@/features/webhooks/webhooks-actions";
import type {
  WebhookDeliverySummary,
  WebhookEndpointSummary,
} from "@/src/server/webhooks/webhook-contracts";

import { WebhookDeliveryList } from "./webhook-delivery-list";
import { WebhookEventFields } from "./webhook-event-fields";
import { WebhookSecretNotice } from "./webhook-secret-notice";

export const WebhookEndpointCard = ({
  deliveries,
  endpoint,
}: {
  readonly deliveries: readonly WebhookDeliverySummary[];
  readonly endpoint: WebhookEndpointSummary;
}) => {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const update = (
    changes: {
      readonly name: string;
      readonly events: readonly string[];
      readonly enabled: boolean;
      readonly url?: string;
    },
    done?: () => void
  ) =>
    startTransition(async () => {
      setFailure(null);
      const result = await updateWebhookEndpointAction({
        ...changes,
        endpointId: endpoint.id,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setFailure(result.error.message);
        return;
      }
      done?.();
    });

  const save = (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const url = String(formData.get("url") ?? "").trim();
    update({
      enabled: endpoint.enabled,
      events: parseSelectedEvents(formData),
      name: String(formData.get("name") ?? "").trim(),
      ...(url ? { url } : {}),
    });
  };

  const rotate = () =>
    startTransition(async () => {
      setFailure(null);
      const result = await rotateWebhookSecretAction({
        endpointId: endpoint.id,
      });
      if (!result.ok) {
        setFailure(result.error.message);
        return;
      }
      setSecret(result.data.secret);
    });

  const remove = () =>
    startTransition(async () => {
      setFailure(null);
      const result = await removeWebhookEndpointAction({
        endpointId: endpoint.id,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setFailure(result.error.message);
      }
    });

  return (
    <article
      aria-label={endpoint.name}
      className="panel"
      data-webhook-endpoint={endpoint.id}
    >
      <div className="panel-h">
        <h3>{endpoint.name}</h3>
        <p>
          {endpointKindLabel(endpoint.kind)} ·{" "}
          <span className={`badge ${endpoint.enabled ? "green" : "gray"}`}>
            {endpoint.enabled ? "Enabled" : "Disabled"}
          </span>
        </p>
      </div>
      <div className="panel-b stack">
        <dl className="stack">
          <div>
            <dt className="muted">Destination</dt>
            <dd>
              <code>{endpoint.displayUrl}</code>
            </dd>
          </div>
          <div>
            <dt className="muted">Events</dt>
            <dd>{describeEvents(endpoint.events)}</dd>
          </div>
          {endpoint.secretHint ? (
            <div>
              <dt className="muted">Signing secret</dt>
              <dd>Ends in {endpoint.secretHint}</dd>
            </div>
          ) : null}
        </dl>
        {secret ? (
          <WebhookSecretNotice
            endpointName={endpoint.name}
            onDismiss={() => setSecret(null)}
            secret={secret}
          />
        ) : null}
        {failure ? <p role="alert">{failure}</p> : null}
        <div className="row">
          <WorkspaceButton
            aria-busy={pending || undefined}
            className="btn btn-secondary btn-sm"
            disabled={pending}
            onClick={() =>
              update({
                enabled: !endpoint.enabled,
                events: endpoint.events,
                name: endpoint.name,
              })
            }
            type="button"
          >
            {endpoint.enabled ? "Disable" : "Enable"}
          </WorkspaceButton>
          {endpoint.kind === "generic" ? (
            <WorkspaceConfirmDialog
              confirmLabel="Generate new secret"
              description="The current secret stops verifying right away. Update your receiver with the new one."
              onConfirm={rotate}
              title="Generate a new signing secret?"
            >
              <WorkspaceButton
                className="btn btn-secondary btn-sm"
                disabled={pending}
                type="button"
              >
                New secret
              </WorkspaceButton>
            </WorkspaceConfirmDialog>
          ) : null}
          <WorkspaceConfirmDialog
            confirmLabel="Remove endpoint"
            description="Pending deliveries and the delivery log for this endpoint are deleted."
            onConfirm={remove}
            title={`Remove ${endpoint.name}?`}
          >
            <WorkspaceButton
              className="btn btn-danger-ghost btn-sm"
              disabled={pending}
              type="button"
            >
              Remove
            </WorkspaceButton>
          </WorkspaceConfirmDialog>
        </div>
        <details>
          <summary>Edit endpoint</summary>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              save(event.currentTarget);
            }}
          >
            <div className="field">
              <label htmlFor={`${endpoint.id}-name`}>Name</label>
              <WorkspaceInput
                className="input"
                defaultValue={endpoint.name}
                id={`${endpoint.id}-name`}
                maxLength={80}
                name="name"
                required
              />
            </div>
            <div className="field">
              <label htmlFor={`${endpoint.id}-url`}>New URL</label>
              <WorkspaceInput
                className="input"
                id={`${endpoint.id}-url`}
                inputMode="url"
                name="url"
                placeholder="Leave empty to keep the current URL"
              />
            </div>
            <WebhookEventFields checked={endpoint.events} />
            <div className="row">
              <WorkspaceButton
                aria-busy={pending || undefined}
                className="btn btn-primary btn-sm"
                disabled={pending}
                type="submit"
              >
                {pending ? "Saving…" : "Save changes"}
              </WorkspaceButton>
            </div>
          </form>
        </details>
        <h4>Recent deliveries</h4>
        <WebhookDeliveryList
          deliveries={deliveries}
          endpointName={endpoint.name}
        />
      </div>
    </article>
  );
};
