/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { useId, useOptimistic, useState, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { setProjectClientVisibilityAction } from "@/features/projects/projects-actions";

// Administrators decide whether clients may see this project in the portal.
// Who sees it is still the client companies the project is assigned to.
export const ProjectClientVisibility = ({
  clientVisible,
  projectId,
  version,
}: {
  readonly clientVisible: boolean;
  readonly projectId: string;
  readonly version: number;
}) => {
  const checkboxId = useId();
  const hintId = useId();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(clientVisible);
  const [error, setError] = useState<string | null>(null);

  const change = (visible: boolean) => {
    if (pending) {
      return;
    }
    startTransition(async () => {
      setShown(visible);
      const result = await setProjectClientVisibilityAction({
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
        projectId,
        visible,
      });
      setError(result.ok ? null : result.error.message);
    });
  };

  return (
    <div className="stack">
      <label className="row" htmlFor={checkboxId}>
        <Checkbox
          aria-describedby={hintId}
          checked={shown}
          disabled={pending}
          id={checkboxId}
          onCheckedChange={(checked) => change(checked === true)}
        />
        <span>Visible to client</span>
      </label>
      <p className="muted" id={hintId}>
        Shared with the client companies this project is assigned to (Clients,
        then the company&rsquo;s projects). Clients see progress, milestones and
        only the tasks marked &ldquo;Show to client&rdquo;.
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};
