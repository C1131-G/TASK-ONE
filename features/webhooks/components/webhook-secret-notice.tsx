/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useId, useState } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";

// The signing secret exists in the browser only until the page is left; the
// server keeps it encrypted and cannot show it again.
export const WebhookSecretNotice = ({
  endpointName,
  onDismiss,
  secret,
}: {
  readonly endpointName: string;
  readonly onDismiss: () => void;
  readonly secret: string;
}) => {
  const inputId = useId();
  const [copied, setCopied] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setFailure(null);
    } catch {
      setFailure("Copy failed. Select the secret and copy it by hand.");
    }
  };

  return (
    <output className="field" data-webhook-secret="true">
      <label htmlFor={inputId}>Signing secret for {endpointName}</label>
      <input
        className="input"
        id={inputId}
        onFocus={(event) => event.currentTarget.select()}
        readOnly
        value={secret}
      />
      <p className="muted">
        Copy it now. It is shown only once; if you lose it, generate a new one.
        Use it to verify the signature on each delivery.
      </p>
      {failure ? <p role="alert">{failure}</p> : null}
      <div className="row">
        <WorkspaceButton
          className="btn btn-secondary btn-sm"
          onClick={copy}
          type="button"
        >
          {copied ? "Copied" : "Copy secret"}
        </WorkspaceButton>
        <WorkspaceButton
          className="btn btn-ghost btn-sm"
          onClick={onDismiss}
          type="button"
        >
          I have saved it
        </WorkspaceButton>
      </div>
    </output>
  );
};
