/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { LocalTime } from "@/components/workspace/local-time";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { revokeSessionAction } from "@/features/user/user-actions";

interface SessionSummary {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export const SessionList = ({
  sessions,
}: {
  readonly sessions: readonly SessionSummary[];
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const revoke = (sessionId: string) =>
    startTransition(async () => {
      const result = await revokeSessionAction({ sessionId });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
    });

  return (
    <section className="panel">
      <div className="panel-h">
        <h2>Active sessions</h2>
      </div>
      {error ? (
        <p className="panel-b error" role="alert">
          {error}
        </p>
      ) : null}
      {sessions.length ? (
        sessions.map((session) => (
          <article className="mini" key={session.id}>
            <div className="grow">
              <strong>{session.userAgent || "Browser session"}</strong>
              <div className="muted">
                Started <LocalTime value={session.createdAt} /> ·{" "}
                {session.ipAddress ?? "Unknown network"}
              </div>
              <div className="muted">
                Expires <LocalTime value={session.expiresAt} />
              </div>
            </div>
            <WorkspaceConfirmDialog
              confirmLabel="Revoke session"
              description={`Sign out ${session.userAgent || "this browser session"}? It must sign in again to continue.`}
              onConfirm={() => revoke(session.id)}
              title="Revoke session"
            >
              <WorkspaceButton
                className="btn btn-sm btn-secondary"
                disabled={pending}
                type="button"
              >
                Revoke
              </WorkspaceButton>
            </WorkspaceConfirmDialog>
          </article>
        ))
      ) : (
        <div className="panel-b muted">No active sessions found.</div>
      )}
    </section>
  );
};
