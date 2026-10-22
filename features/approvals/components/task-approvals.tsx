/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { TaskApprovalForm } from "@/features/approvals/components/task-approval-form";
import { TaskApprovalHistory } from "@/features/approvals/components/task-approval-history";
import type { TaskApprovals as TaskApprovalsView } from "@/src/server/approvals/approval-contracts";

interface ReadyFile {
  readonly id: string;
  readonly originalName: string;
  readonly copyState: string;
}

// The drawer's client approval section: every version requested so far, and a
// form to send a new one while nothing is waiting or approved.
export const TaskApprovals = ({
  approvals,
  files,
  onChanged,
  taskId,
}: {
  readonly approvals: TaskApprovalsView | null;
  readonly files: readonly ReadyFile[];
  readonly onChanged: () => Promise<void>;
  readonly taskId: string;
}) => {
  if (!approvals) {
    return null;
  }
  const open = approvals.requests.some(
    ({ status }) => status === "pending" || status === "approved"
  );
  const canAsk =
    approvals.canRequest && approvals.companies.length > 0 && !open;
  if (approvals.requests.length === 0 && !canAsk) {
    return null;
  }
  return (
    <section aria-label="Client approval" className="stack">
      <h3>Client approval</h3>
      <TaskApprovalHistory
        canCancel={approvals.canRequest}
        onChanged={onChanged}
        requests={approvals.requests}
      />
      {canAsk ? (
        <TaskApprovalForm
          companies={approvals.companies}
          files={files.filter(({ copyState }) => copyState === "ready")}
          onRequested={onChanged}
          taskId={taskId}
        />
      ) : null}
    </section>
  );
};
