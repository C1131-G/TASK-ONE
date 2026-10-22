"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { useId } from "react";

import { describeBrowserContext } from "@/features/portal/portal-browser-context";
import type { CollectedBrowserContext } from "@/features/portal/portal-browser-context";

// Shows every technical detail that would be sent, and lets the reporter opt
// out. Nothing is sent unless the box is ticked.
const PortalContextDisclosure = ({
  context,
  disabled,
  onToggle,
  sendContext,
}: {
  readonly context: CollectedBrowserContext;
  readonly disabled: boolean;
  readonly onToggle: (send: boolean) => void;
  readonly sendContext: boolean;
}) => {
  const checkboxId = useId();
  return (
    <div className="field portal-context">
      <div className="portal-context-opt">
        <input
          checked={sendContext}
          disabled={disabled}
          id={checkboxId}
          onChange={(event) => onToggle(event.target.checked)}
          type="checkbox"
        />
        <label htmlFor={checkboxId}>
          Send these technical details with my report
        </label>
      </div>
      <details className="portal-context-details">
        <summary>Technical details we&apos;ll send</summary>
        <p className="hint">
          Only what is listed here. We never send cookies, saved data, the
          address&apos;s query part or anything you typed. Only our team sees
          it.
        </p>
        <dl className="portal-context-list">
          {describeBrowserContext(context).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
};

export { PortalContextDisclosure };
