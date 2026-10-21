"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import { useOptimistic, useState, useTransition } from "react";

import { setPortalEmailUpdatesAction } from "@/features/portal/portal-notification-actions";

const PortalEmailControl = ({ enabled }: { readonly enabled: boolean }) => {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [on, setOptimisticOn] = useOptimistic(
    enabled,
    (_current, next: boolean) => next
  );

  const toggle = () => {
    const next = !on;
    setMessage("");
    startTransition(async () => {
      setOptimisticOn(next);
      const result = await setPortalEmailUpdatesAction({
        enabled: next,
        idempotencyKey: crypto.randomUUID(),
      });
      setMessage(
        result.ok
          ? `Email updates are ${next ? "on" : "off"}.`
          : result.error.message
      );
    });
  };

  return (
    <div className="portal-stack">
      <p className="muted">
        Get an email when the status of one of your bugs changes. Every email
        has an unsubscribe link.
      </p>
      <div>
        <button
          aria-pressed={on}
          className="btn btn-secondary"
          disabled={pending}
          onClick={toggle}
          type="button"
        >
          {on ? "Turn off email updates" : "Turn on email updates"}
        </button>
      </div>
      <output aria-live="polite" className="hint">
        {message}
      </output>
    </div>
  );
};

export { PortalEmailControl };
