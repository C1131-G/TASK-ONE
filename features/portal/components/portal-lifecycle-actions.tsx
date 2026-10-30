"use client";

/* eslint-disable shadcn/no-restyle -- Preserve established portal classes on shared controls. */

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in apps/web/app/workspace-styles/portal.css. */

import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceTextarea } from "@/components/workspace/workspace-controls";
import {
  addClientCommentAction,
  rateClientBugAction,
} from "@/features/portal/portal-bug-actions";
import type { PortalBugDetail } from "@/src/server/portal/portal-contracts";

import { FieldError, SatisfactionPicker } from "./portal-lifecycle-fields";
import {
  COMMENT_MAX,
  REPLY_MAX,
  useLifecycleAction,
} from "./portal-lifecycle-support";
import type { Satisfaction } from "./portal-lifecycle-support";
import { ConfirmForm, ReopenForm } from "./portal-verify-forms";

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
        <WorkspaceTextarea
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
        <WorkspaceButton
          className="btn btn-primary btn-sm"
          disabled={action.pending}
          type="submit"
        >
          {action.pending ? "Sending…" : "Send reply"}
        </WorkspaceButton>
      </div>
      {sent ? <output className="hint">Reply sent. Thank you.</output> : null}
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
            <WorkspaceButton
              className="btn btn-secondary btn-sm"
              onClick={() => setReopening(true)}
              ref={triggerRef}
              type="button"
            >
              Still broken
            </WorkspaceButton>
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
        <WorkspaceTextarea
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
        <WorkspaceButton
          className="btn btn-primary btn-sm"
          disabled={action.pending}
          type="submit"
        >
          {action.pending ? "Saving…" : "Send rating"}
        </WorkspaceButton>
      </div>
    </form>
  );
};

export { RatingCard, ReplyBox, VerifyActions };
