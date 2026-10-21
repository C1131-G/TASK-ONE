"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  confirmClientFixAction,
  reopenClientFixAction,
} from "@/features/portal/portal-bug-actions";
import type { PortalBugDetail } from "@/src/server/portal/portal-contracts";

import { FieldError, SatisfactionPicker } from "./portal-lifecycle-fields";
import {
  COMMENT_MAX,
  REPLY_MAX,
  useLifecycleAction,
} from "./portal-lifecycle-support";
import type { Satisfaction } from "./portal-lifecycle-support";

export const ConfirmForm = ({ bug }: { readonly bug: PortalBugDetail }) => {
  const id = useId();
  const action = useLifecycleAction();
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null);
  const [comment, setComment] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = comment.trim();
    await action.run(
      (idempotencyKey) =>
        confirmClientFixAction({
          bugId: bug.id,
          expectedVersion: bug.version,
          idempotencyKey,
          ...(satisfaction ? { satisfaction } : {}),
          ...(text ? { comment: text } : {}),
        }),
      "The fix could not be confirmed. Try again."
    );
  };

  return (
    <form className="portal-composer" noValidate onSubmit={submit}>
      <SatisfactionPicker
        disabled={action.pending}
        legend="How did we do? (optional)"
        onChange={(value) => {
          action.touch();
          setSatisfaction(value);
        }}
        value={satisfaction}
      />
      <div className="field">
        <label className="label" htmlFor={`${id}-comment`}>
          Comment <span className="faint">(optional)</span>
        </label>
        <textarea
          aria-describedby={action.error ? `${id}-err` : undefined}
          className="textarea"
          disabled={action.pending}
          id={`${id}-comment`}
          maxLength={COMMENT_MAX}
          onChange={(event) => {
            action.touch();
            setComment(event.target.value);
          }}
          rows={2}
          value={comment}
        />
        <FieldError id={`${id}-err`} message={action.error} />
      </div>
      <div>
        <button
          className="btn btn-primary btn-sm"
          disabled={action.pending}
          type="submit"
        >
          {action.pending ? "Confirming…" : "Confirm it works"}
        </button>
      </div>
    </form>
  );
};

export const ReopenForm = ({
  bug,
  onCancel,
}: {
  readonly bug: PortalBugDetail;
  readonly onCancel: () => void;
}) => {
  const id = useId();
  const action = useLifecycleAction();
  const [reason, setReason] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Mounted on demand, so move focus into it for keyboard and screen readers.
  const focusRef = (node: HTMLTextAreaElement | null) => {
    areaRef.current = node;
    node?.focus();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = reason.trim();
    if (!text) {
      action.setError("Tell us what is still broken.");
      areaRef.current?.focus();
      return;
    }
    await action.run(
      (idempotencyKey) =>
        reopenClientFixAction({
          bugId: bug.id,
          expectedVersion: bug.version,
          idempotencyKey,
          reason: text,
        }),
      "The bug could not be reopened. Try again."
    );
  };

  return (
    <form
      aria-label="Report that the bug is still broken"
      className="portal-composer"
      noValidate
      onSubmit={submit}
    >
      <div className="field">
        <label className="label" htmlFor={`${id}-reason`}>
          What is still broken?
        </label>
        <textarea
          aria-describedby={action.error ? `${id}-err` : undefined}
          aria-invalid={action.error ? true : undefined}
          aria-required="true"
          className="textarea"
          disabled={action.pending}
          id={`${id}-reason`}
          maxLength={REPLY_MAX}
          onChange={(event) => {
            action.touch();
            setReason(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onCancel();
            }
          }}
          ref={focusRef}
          rows={3}
          value={reason}
        />
        <FieldError id={`${id}-err`} message={action.error} />
      </div>
      <div className="portal-form-acts">
        <button
          className="btn btn-primary btn-sm"
          disabled={action.pending}
          type="submit"
        >
          {action.pending ? "Sending…" : "Send back to the team"}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={action.pending}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
