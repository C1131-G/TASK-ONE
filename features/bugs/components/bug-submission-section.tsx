/* eslint-disable shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

import { Button } from "@/components/ui/button";
import { submitBugApprovalAction } from "@/features/bugs/bugs-actions";

import type { BugActionRunner, BugHistory } from "../bug-workflow-ui-shared";

export const BugSubmissionSection = ({
  canEdit,
  history,
  isReadOnly,
  latestAttempt,
  pending,
  runAction,
}: {
  readonly canEdit: boolean;
  readonly history: BugHistory;
  readonly isReadOnly: boolean;
  readonly latestAttempt: BugHistory["attempts"][number] | null;
  readonly pending: boolean;
  readonly runAction: BugActionRunner;
}) => {
  if (
    isReadOnly ||
    !canEdit ||
    history.bug.status !== "in_verification" ||
    !latestAttempt
  ) {
    return null;
  }
  const beforeExists = history.evidence.some(({ kind }) => kind === "before");
  const afterExists = history.evidence.some(({ kind }) => kind === "after");
  return (
    <section className="panel panel-b bug-detail-section">
      <h2>Submit for admin approval</h2>
      <p className="muted">
        Approval captures an immutable snapshot of this verified fix and its
        before and after evidence.
      </p>
      <Button
        disabled={pending || !beforeExists || !afterExists}
        onClick={() =>
          runAction(
            submitBugApprovalAction({
              bugId: history.bug.id,
              expectedVersion: history.bug.version,
              fixAttemptId: latestAttempt.id,
            })
          )
        }
        type="button"
      >
        Submit for approval
      </Button>
    </section>
  );
};
