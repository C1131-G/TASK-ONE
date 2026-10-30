"use client";

/* eslint-disable shadcn/no-restyle -- Preserve established portal classes on shared controls. */

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in apps/web/app/workspace-styles/portal.css. */

import { useId, useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceTextarea } from "@/components/workspace/workspace-controls";
import { decideApprovalAction } from "@/features/portal/portal-approval-actions";
import { MAX_APPROVAL_TEXT } from "@/src/server/approvals/approval-contracts";
import type { ApprovalDecision } from "@/src/server/approvals/approval-contracts";

// Approve, or ask for changes with a comment. The server records the first
// decision only, so the buttons lock while a request runs and a stale page
// shows the earlier answer instead of overwriting it.
export const PortalApprovalDecision = ({
  requestId,
}: {
  readonly requestId: string;
}) => {
  const commentId = useId();
  const errorId = useId();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: ApprovalDecision) => {
    if (decision === "request_changes" && comment.trim() === "") {
      setError("Tell the team what needs to change.");
      return;
    }
    startTransition(async () => {
      const result = await decideApprovalAction({
        comment,
        decision,
        idempotencyKey: crypto.randomUUID(),
        requestId,
      });
      setError(result.ok ? null : result.error.message);
    });
  };

  return (
    <section aria-labelledby="portal-decision-h" className="panel portal-panel">
      <h2 className="sec" id="portal-decision-h">
        Your decision
      </h2>
      <div className="field">
        <label className="label" htmlFor={commentId}>
          Comment (required to request changes)
        </label>
        <WorkspaceTextarea
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className="textarea"
          disabled={pending}
          id={commentId}
          maxLength={MAX_APPROVAL_TEXT}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          value={comment}
        />
      </div>
      {error ? (
        <p className="err" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      <div className="row">
        <WorkspaceButton
          aria-busy={pending || undefined}
          className="btn btn-primary"
          disabled={pending}
          onClick={() => decide("approve")}
          type="button"
        >
          Approve
        </WorkspaceButton>
        <WorkspaceButton
          aria-busy={pending || undefined}
          className="btn btn-secondary"
          disabled={pending}
          onClick={() => decide("request_changes")}
          type="button"
        >
          Request changes
        </WorkspaceButton>
      </div>
    </section>
  );
};
