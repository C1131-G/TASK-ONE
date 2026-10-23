/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */
/* eslint-disable shadcn/no-restyle -- The sign-out button uses the workspace button classes, like the staff session list. */

"use client";

import { Devices } from "@phosphor-icons/react";
import { useState, useTransition } from "react";

import { EmptyState } from "@/components/workspace/empty-state";
import { LocalTime } from "@/components/workspace/local-time";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { revokeSessionAction } from "@/features/user/user-actions";

interface PortalSessionSummary {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

const deviceName = (session: PortalSessionSummary): string =>
  session.userAgent || "Browser session";

// Lets a client see where they are signed in and end any of those sessions,
// the same way staff can from Settings.
export const PortalSessions = ({
  sessions,
}: {
  readonly sessions: readonly PortalSessionSummary[];
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const revoke = (sessionId: string) =>
    startTransition(async () => {
      const result = await revokeSessionAction({ sessionId });
      setError(result.ok ? null : result.error.message);
    });

  if (sessions.length === 0) {
    return (
      <EmptyState
        description="Devices you sign in on appear here so you can sign them out."
        icon={Devices}
        size="compact"
        title="No active sessions"
      />
    );
  }

  return (
    <div aria-busy={pending}>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {sessions.map((session) => (
        <article className="mini" key={session.id}>
          <div className="grow">
            <strong>{deviceName(session)}</strong>
            <div className="muted">
              Started <LocalTime value={session.createdAt} /> ·{" "}
              {session.ipAddress ?? "Unknown network"}
            </div>
            <div className="muted">
              Expires <LocalTime value={session.expiresAt} />
            </div>
          </div>
          <WorkspaceConfirmDialog
            confirmLabel="Sign out"
            description={`Sign out ${deviceName(session)}? It must sign in again to continue.`}
            onConfirm={() => revoke(session.id)}
            title="Sign out this device"
          >
            <WorkspaceButton
              aria-label={`Sign out ${deviceName(session)}`}
              className="btn btn-sm btn-secondary"
              disabled={pending}
              type="button"
            >
              Sign out
            </WorkspaceButton>
          </WorkspaceConfirmDialog>
        </article>
      ))}
    </div>
  );
};
