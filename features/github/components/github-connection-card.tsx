/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import {
  rotateGithubSecretAction,
  updateGithubConnectionAction,
} from "@/features/github/github-actions";
import { WebhookSecretNotice } from "@/features/webhooks/components/webhook-secret-notice";
import type { GithubConnectionSummary } from "@/src/server/github/github-contracts";

export const GithubConnectionCard = ({
  connection,
}: {
  readonly connection: GithubConnectionSummary;
}) => {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const update = (changes: {
    readonly autoCompleteOnMerge: boolean;
    readonly enabled: boolean;
  }) =>
    startTransition(async () => {
      setFailure(null);
      const result = await updateGithubConnectionAction({
        ...changes,
        connectionId: connection.id,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setFailure(result.error.message);
      }
    });

  const rotate = () =>
    startTransition(async () => {
      setFailure(null);
      const result = await rotateGithubSecretAction({
        connectionId: connection.id,
      });
      if (!result.ok) {
        setFailure(result.error.message);
        return;
      }
      setSecret(result.data.secret);
    });

  return (
    <article
      aria-label={connection.repoFullName}
      className="panel"
      data-github-connection={connection.id}
    >
      <div className="panel-h">
        <h3>{connection.repoFullName}</h3>
        <p>
          {connection.projectKey} {connection.projectName} ·{" "}
          <span className={`badge ${connection.enabled ? "green" : "gray"}`}>
            {connection.enabled ? "Enabled" : "Disabled"}
          </span>
        </p>
      </div>
      <div className="panel-b stack">
        <dl className="stack">
          <div>
            <dt className="muted">Secret</dt>
            <dd>Ends in {connection.secretHint}</dd>
          </div>
          <div>
            <dt className="muted">When a pull request is merged</dt>
            <dd>
              {connection.autoCompleteOnMerge
                ? "The linked task is marked done."
                : "The linked task is left as it is."}
            </dd>
          </div>
        </dl>
        {secret ? (
          <WebhookSecretNotice
            endpointName={connection.repoFullName}
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
                autoCompleteOnMerge: connection.autoCompleteOnMerge,
                enabled: !connection.enabled,
              })
            }
            type="button"
          >
            {connection.enabled ? "Disable" : "Enable"}
          </WorkspaceButton>
          <WorkspaceButton
            aria-busy={pending || undefined}
            className="btn btn-secondary btn-sm"
            disabled={pending}
            onClick={() =>
              update({
                autoCompleteOnMerge: !connection.autoCompleteOnMerge,
                enabled: connection.enabled,
              })
            }
            type="button"
          >
            {connection.autoCompleteOnMerge
              ? "Stop completing on merge"
              : "Complete on merge"}
          </WorkspaceButton>
          <WorkspaceConfirmDialog
            confirmLabel="Generate new secret"
            description="The current secret stops verifying right away. Update the webhook in GitHub with the new one."
            onConfirm={rotate}
            title="Generate a new secret?"
          >
            <WorkspaceButton
              className="btn btn-secondary btn-sm"
              disabled={pending}
              type="button"
            >
              New secret
            </WorkspaceButton>
          </WorkspaceConfirmDialog>
        </div>
      </div>
    </article>
  );
};
