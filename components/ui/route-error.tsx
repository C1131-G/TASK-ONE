"use client";

import Link from "next/link";
import { useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";

export const RouteError = ({
  homeHref = "/",
  reset,
  title,
}: {
  // Where "Go to Home" leads; the portal's home is its own landing page.
  readonly homeHref?: "/" | "/portal";
  readonly reset: () => void;
  readonly title: string;
}) => {
  const [pending, startTransition] = useTransition();

  return (
    <div className="page">
      <section aria-live="polite" className="panel panel-b" role="alert">
        <h1>{title}</h1>
        <p>Something went wrong. Trying again is safe.</p>
        <div className="acts">
          <WorkspaceButton
            aria-busy={pending || undefined}
            className="btn btn-primary btn-sm"
            disabled={pending}
            onClick={() => startTransition(() => reset())}
            type="button"
          >
            {pending ? "Retrying…" : "Try again"}
          </WorkspaceButton>
          <WorkspaceButton asChild className="btn btn-secondary btn-sm">
            <Link href={homeHref}>Go to Home</Link>
          </WorkspaceButton>
        </div>
      </section>
    </div>
  );
};
