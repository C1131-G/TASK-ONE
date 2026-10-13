/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";

const COPIED_RESET_MS = 2000;

type CopyState = "idle" | "copied" | "failed";

export const TemporaryPasswordReveal = ({
  note,
  password,
  title,
}: {
  readonly note: string;
  readonly password: string;
  readonly title: string;
}) => {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  // Timer IDs start at 1, so 0 means "no timer" and clearing it is a no-op.
  const resetTimer = useRef(0);

  const copyPassword = async () => {
    window.clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(password);
      setCopyState("copied");
      resetTimer.current = window.setTimeout(
        () => setCopyState("idle"),
        COPIED_RESET_MS
      );
    } catch {
      setCopyState("failed");
    }
  };

  const copied = copyState === "copied";

  return (
    <output className="panel-b temp-password">
      <strong>{title}</strong>
      <div className="temp-password-row">
        <code className="mono temp-password-value">{password}</code>
        <WorkspaceButton
          aria-label={
            copied ? "Temporary password copied" : "Copy temporary password"
          }
          className="btn btn-secondary btn-sm"
          onClick={copyPassword}
          type="button"
        >
          {copied ? (
            <Check aria-hidden="true" size={14} />
          ) : (
            <Copy aria-hidden="true" size={14} />
          )}
          {copied ? "Copied" : "Copy"}
        </WorkspaceButton>
      </div>
      <p className="muted">
        {copyState === "failed"
          ? "Couldn’t copy automatically. Select the password and copy it manually."
          : note}
      </p>
    </output>
  );
};
