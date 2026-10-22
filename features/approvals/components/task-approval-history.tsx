/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { LocalTime } from "@/components/workspace/local-time";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { cancelApprovalAction } from "@/features/approvals/approval-actions";
import { APPROVAL_STATUS_BADGES } from "@/features/approvals/approval-status";
import type { TaskApprovals } from "@/src/server/approvals/approval-contracts";

type Request = TaskApprovals["requests"][number];

// One row of the approval history. Decided versions are read only; a waiting
// one can be withdrawn by the person who asked or an administrator.
const ApprovalRow = ({
  canCancel,
  onChanged,
  request,
}: {
  readonly canCancel: boolean;
  readonly onChanged: () => Promise<void>;
  readonly request: Request;
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const badge = APPROVAL_STATUS_BADGES[request.status];

  const cancel = () => {
    startTransition(async () => {
      const result = await cancelApprovalAction({
        idempotencyKey: crypto.randomUUID(),
        requestId: request.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      await onChanged();
    });
  };

  return (
    <li className="stack" data-approval-version={request.version}>
      <div className="row">
        <strong>Version {request.version}</strong>
        <span className={`badge ${badge.tone}`}>{badge.label}</span>
        <span className="muted">{request.companyName}</span>
      </div>
      <p className="muted">
        Requested by {request.requestedByName} on{" "}
        <LocalTime value={request.requestedAt} />
      </p>
      <p>{request.message}</p>
      <ul>
        {request.files.map((file) => (
          <li key={file.fileId}>{file.fileName}</li>
        ))}
      </ul>
      {request.decidedAt ? (
        <p className="muted">
          {request.status === "approved" ? "Approved" : "Changes requested"} by{" "}
          {request.decidedByName ?? "a client"} on{" "}
          <LocalTime value={request.decidedAt} />
          {request.decisionComment ? `: ${request.decisionComment}` : ""}
        </p>
      ) : null}
      {request.status === "pending" && canCancel ? (
        <div className="row">
          <WorkspaceButton
            aria-busy={pending || undefined}
            className="btn"
            disabled={pending}
            onClick={cancel}
            type="button"
          >
            {pending ? "Withdrawing…" : "Withdraw request"}
          </WorkspaceButton>
        </div>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
};

export const TaskApprovalHistory = ({
  canCancel,
  onChanged,
  requests,
}: {
  readonly canCancel: boolean;
  readonly onChanged: () => Promise<void>;
  readonly requests: TaskApprovals["requests"];
}) => (
  <ul aria-label="Approval history" className="stack">
    {requests.map((request) => (
      <ApprovalRow
        canCancel={canCancel}
        key={request.id}
        onChanged={onChanged}
        request={request}
      />
    ))}
  </ul>
);
