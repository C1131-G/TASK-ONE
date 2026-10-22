/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { useId } from "react";

import { useHydrated } from "@/components/workspace/use-hydrated";
import { GITHUB_ROUTE_PATH } from "@/src/server/github/github-contracts";

// The address is the same for every connection; the repository named in each
// delivery selects the connection. The full URL needs the browser's origin.
export const GithubWebhookUrl = () => {
  const inputId = useId();
  const hydrated = useHydrated();
  const url = hydrated
    ? `${window.location.origin}${GITHUB_ROUTE_PATH}`
    : GITHUB_ROUTE_PATH;
  return (
    <div className="field" data-github-webhook-url="true">
      <label htmlFor={inputId}>Payload URL</label>
      <input
        className="input"
        id={inputId}
        onFocus={(event) => event.currentTarget.select()}
        readOnly
        value={url}
      />
      <p className="muted">
        In the repository, open Settings, then Webhooks, and add a webhook with
        this URL. Choose the content type application/json, paste the secret
        shown when you connect, and select the Pull requests event.
      </p>
    </div>
  );
};
