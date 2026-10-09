/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { revokeSessionAction } from "@/app/actions/sessions";
import { WorkspaceButton } from "@/components/workspace/workspace-button";

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
  const router = useRouter();
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
      router.refresh();
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
                Started {session.createdAt.slice(0, 16).replace("T", " ")} ·{" "}
                {session.ipAddress ?? "Unknown network"}
              </div>
              <div className="muted">
                Expires {session.expiresAt.slice(0, 16).replace("T", " ")}
              </div>
            </div>
            <WorkspaceButton
              className="btn btn-sm btn-secondary"
              disabled={pending}
              onClick={() => revoke(session.id)}
              type="button"
            >
              Revoke
            </WorkspaceButton>
          </article>
        ))
      ) : (
        <div className="panel-b muted">No active sessions found.</div>
      )}
    </section>
  );
};
