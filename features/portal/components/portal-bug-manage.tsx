"use client";

/* eslint-disable shadcn/no-restyle -- Preserve established portal classes on shared controls. */

/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle -- Portal pages reuse the workspace stylesheet classes. */

import { PencilSimple, ArrowUUpLeft } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { PortalBugForm } from "@/features/portal/components/portal-bug-form";
import { withdrawClientBugAction } from "@/features/portal/portal-bug-actions";
import type { PortalBugDetail } from "@/src/server/portal/portal-contracts";

// Edit and withdraw controls for a bug that is still Submitted. The read-only
// sections are passed as children and swapped for the form while editing.
const PortalBugManage = ({
  bug,
  children,
}: {
  readonly bug: PortalBugDetail;
  readonly children: ReactNode;
}) => {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const withdraw = () =>
    startTransition(async () => {
      setError("");
      try {
        const result = await withdrawClientBugAction({
          bugId: bug.id,
          expectedVersion: bug.version,
          idempotencyKey: crypto.randomUUID(),
        });
        if (result.ok) {
          return;
        }
        setError(
          result.error.code === "CONFLICT"
            ? "This bug changed while you were looking at it. Reload the page and try again."
            : result.error.message
        );
      } catch {
        setError("The bug could not be withdrawn. Try again.");
      }
    });

  return (
    <>
      {bug.canEdit || bug.canWithdraw ? (
        <div className="portal-manage">
          {bug.canEdit && !editing ? (
            <WorkspaceButton
              className="btn btn-secondary btn-sm"
              disabled={pending}
              onClick={() => setEditing(true)}
              type="button"
            >
              <PencilSimple aria-hidden="true" size={14} />
              Edit
            </WorkspaceButton>
          ) : null}
          {bug.canWithdraw ? (
            <WorkspaceConfirmDialog
              confirmLabel="Withdraw bug"
              description="Withdrawing tells the team you no longer need this fixed. You will not be able to edit it afterwards."
              onConfirm={withdraw}
              title="Withdraw this bug?"
            >
              <WorkspaceButton
                aria-busy={pending}
                className="btn btn-ghost btn-sm"
                disabled={pending}
                type="button"
              >
                <ArrowUUpLeft aria-hidden="true" size={14} />
                {pending ? "Withdrawing…" : "Withdraw"}
              </WorkspaceButton>
            </WorkspaceConfirmDialog>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="portal-form-error" role="alert">
          {error}
        </p>
      ) : null}
      {editing ? (
        <section aria-label="Edit bug" className="panel portal-panel">
          <PortalBugForm
            mode={{
              bug,
              kind: "edit",
              onCancel: () => setEditing(false),
              onDone: () => setEditing(false),
            }}
          />
        </section>
      ) : (
        children
      )}
    </>
  );
};

export { PortalBugManage };
