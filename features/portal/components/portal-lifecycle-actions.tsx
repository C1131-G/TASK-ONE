"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  addClientCommentAction,
  confirmClientFixAction,
  rateClientBugAction,
  reopenClientFixAction,
} from "@/features/portal/portal-actions";
import type { PortalBugDetail } from "@/src/server/portal/portal-contracts";

type Satisfaction = "up" | "down";

const COMMENT_MAX = 2000;
const REPLY_MAX = 10_000;

const conflictMessage =
  "This bug changed while you were looking at it. Reload the page and try again.";

interface ActionFailure {
  readonly error: { readonly code: string; readonly message: string };
}

const failureText = (failure: ActionFailure) =>
  failure.error.code === "CONFLICT" ? conflictMessage : failure.error.message;

// Shared state for a one-shot action: busy flag, visible error, and an
// idempotency key that is reused on retry until the input changes.
const useLifecycleAction = () => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const keyRef = useRef<string | null>(null);

  const touch = () => {
    keyRef.current = null;
    setError("");
  };

  const run = async (
    call: (
      idempotencyKey: string
    ) => Promise<{ ok: true } | ({ ok: false } & ActionFailure)>,
    fallback: string
  ) => {
    setPending(true);
    setError("");
    if (!keyRef.current) {
      keyRef.current = crypto.randomUUID();
    }
    try {
      const result = await call(keyRef.current);
      if (result.ok) {
        keyRef.current = null;
        router.refresh();
        setPending(false);
        return true;
      }
      setError(failureText(result));
    } catch {
      setError(fallback);
    }
    setPending(false);
    return false;
  };

  return { error, pending, run, setError, touch };
};

const FieldError = ({
  id,
  message,
}: {
  readonly id: string;
  readonly message: string;
}) =>
  message ? (
    <p className="err" id={id} role="alert">
      {message}
    </p>
  ) : null;

const SatisfactionPicker = ({
  disabled,
  legend,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly legend: string;
  readonly onChange: (value: Satisfaction | null) => void;
  readonly value: Satisfaction | null;
}) => (
  <fieldset className="portal-rate-set">
    <legend className="label">{legend}</legend>
    <div className="portal-rate-btns">
      <button
        aria-label="Good, thumbs up"
        aria-pressed={value === "up"}
        className="btn btn-secondary btn-sm"
        disabled={disabled}
        onClick={() => onChange(value === "up" ? null : "up")}
        type="button"
      >
        <ThumbsUp
          aria-hidden="true"
          size={16}
          weight={value === "up" ? "fill" : "regular"}
        />
        <span aria-hidden="true">👍</span>
      </button>
      <button
        aria-label="Not good, thumbs down"
        aria-pressed={value === "down"}
        className="btn btn-secondary btn-sm"
        disabled={disabled}
        onClick={() => onChange(value === "down" ? null : "down")}
        type="button"
      >
        <ThumbsDown
          aria-hidden="true"
          size={16}
          weight={value === "down" ? "fill" : "regular"}
        />
        <span aria-hidden="true">👎</span>
      </button>
    </div>
  </fieldset>
);

const ReplyBox = ({ bugId }: { readonly bugId: string }) => {
  const id = useId();
  const action = useLifecycleAction();
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      action.setError("Write your reply before sending.");
      return;
    }
    const ok = await action.run(
      (idempotencyKey) =>
        addClientCommentAction({ body: text, bugId, idempotencyKey }),
      "Your reply could not be sent. Try again."
    );
    if (ok) {
      setBody("");
      setSent(true);
    }
  };

  return (
    <form className="portal-composer" noValidate onSubmit={submit}>
      <div className="field">
        <label className="label" htmlFor={`${id}-reply`}>
          Your reply
        </label>
        <textarea
          aria-describedby={action.error ? `${id}-err` : undefined}
          aria-invalid={action.error ? true : undefined}
          className="textarea"
          disabled={action.pending}
          id={`${id}-reply`}
          maxLength={REPLY_MAX}
          onChange={(event) => {
            action.touch();
            setSent(false);
            setBody(event.target.value);
          }}
          rows={3}
          value={body}
        />
        <FieldError id={`${id}-err`} message={action.error} />
      </div>
      <div className="portal-form-acts">
        <button
          className="btn btn-primary btn-sm"
          disabled={action.pending}
          type="submit"
        >
          {action.pending ? "Sending…" : "Send reply"}
        </button>
      </div>
      {sent ? <output className="hint">Reply sent. Thank you.</output> : null}
    </form>
  );
};

const ConfirmForm = ({ bug }: { readonly bug: PortalBugDetail }) => {
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

const ReopenForm = ({
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

const VerifyActions = ({ bug }: { readonly bug: PortalBugDetail }) => {
  const [reopening, setReopening] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const canReopen = bug.lifecycle.verification?.canReopen ?? false;

  const cancel = () => {
    setReopening(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div className="portal-verify">
      {reopening ? null : <ConfirmForm bug={bug} />}
      {canReopen ? (
        <div className="portal-verify-reopen">
          {reopening ? (
            <ReopenForm bug={bug} onCancel={cancel} />
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setReopening(true)}
              ref={triggerRef}
              type="button"
            >
              Still broken
            </button>
          )}
        </div>
      ) : (
        <p className="portal-banner-note" role="note">
          This bug has been reopened too many times. Contact your account
          manager.
        </p>
      )}
    </div>
  );
};

const RatingCard = ({ bugId }: { readonly bugId: string }) => {
  const id = useId();
  const action = useLifecycleAction();
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null);
  const [comment, setComment] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!satisfaction) {
      action.setError("Choose thumbs up or thumbs down first.");
      return;
    }
    const text = comment.trim();
    await action.run(
      (idempotencyKey) =>
        rateClientBugAction({
          bugId,
          idempotencyKey,
          satisfaction,
          ...(text ? { comment: text } : {}),
        }),
      "Your rating could not be saved. Try again."
    );
  };

  return (
    <form
      aria-labelledby={`${id}-h`}
      className="portal-rate panel portal-panel"
      noValidate
      onSubmit={submit}
    >
      <h2 className="sec" id={`${id}-h`}>
        How was our support?
      </h2>
      <SatisfactionPicker
        disabled={action.pending}
        legend="Your rating"
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
          {action.pending ? "Saving…" : "Send rating"}
        </button>
      </div>
    </form>
  );
};

export { RatingCard, ReplyBox, VerifyActions };
