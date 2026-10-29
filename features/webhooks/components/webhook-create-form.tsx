/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { useFormErrors } from "@/components/workspace/use-form-errors";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceFieldError,
  WorkspaceFormError,
} from "@/components/workspace/workspace-field-error";
import { parseSelectedEvents } from "@/features/webhooks/webhook-format";
import { createWebhookEndpointAction } from "@/features/webhooks/webhooks-actions";

import { WebhookEventFields } from "./webhook-event-fields";
import { WebhookSecretNotice } from "./webhook-secret-notice";

const FIELDS = ["name", "kind", "url", "events"] as const;

interface Revealed {
  readonly name: string;
  readonly secret: string;
}

export const WebhookCreateForm = () => {
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<"generic" | "slack">("generic");
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const { clearErrors, errors, fieldProps, formId, formRef, showFailure } =
    useFormErrors(FIELDS);

  const create = (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    startTransition(async () => {
      const result = await createWebhookEndpointAction({
        events: parseSelectedEvents(formData),
        kind,
        name,
        url: String(formData.get("url") ?? "").trim(),
      });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      clearErrors();
      form.reset();
      setRevealed(
        result.data.secret ? { name, secret: result.data.secret } : null
      );
    });
  };

  return (
    <section className="panel" data-webhook-create="true">
      <div className="panel-h">
        <h2>Add an endpoint</h2>
        <p>
          Send workspace events to your own server, or post them to a Slack
          channel through an incoming webhook.
        </p>
      </div>
      <form
        aria-busy={pending || undefined}
        className="panel-b stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          create(event.currentTarget);
        }}
        ref={formRef}
      >
        <div className="field">
          <label htmlFor={`${formId}-name`}>Name</label>
          <WorkspaceInput
            className="input"
            id={`${formId}-name`}
            maxLength={80}
            name="name"
            placeholder="Build notifications"
            {...fieldProps("name")}
          />
          <WorkspaceFieldError errors={errors} field="name" formId={formId} />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-kind`}>Type</label>
          <select
            className="input"
            id={`${formId}-kind`}
            name="kind"
            onChange={(event) =>
              setKind(
                event.currentTarget.value === "slack" ? "slack" : "generic"
              )
            }
            value={kind}
          >
            <option value="generic">Signed webhook</option>
            <option value="slack">Slack incoming webhook</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${formId}-url`}>
            {kind === "slack" ? "Slack webhook URL" : "Endpoint URL"}
          </label>
          <WorkspaceInput
            className="input"
            id={`${formId}-url`}
            inputMode="url"
            name="url"
            placeholder={
              kind === "slack"
                ? "https://hooks.slack.com/services/…"
                : "https://example.com/hooks/taskora"
            }
            {...fieldProps("url")}
          />
          <WorkspaceFieldError errors={errors} field="url" formId={formId} />
        </div>
        <WebhookEventFields checked={["task.created"]} />
        <WorkspaceFieldError errors={errors} field="events" formId={formId} />
        <WorkspaceFormError errors={errors} />
        <div className="row">
          <WorkspaceButton
            aria-busy={pending || undefined}
            className="btn btn-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? "Adding…" : "Add endpoint"}
          </WorkspaceButton>
        </div>
      </form>
      {revealed ? (
        <div className="panel-b">
          <WebhookSecretNotice
            endpointName={revealed.name}
            onDismiss={() => setRevealed(null)}
            secret={revealed.secret}
          />
        </div>
      ) : null}
    </section>
  );
};
