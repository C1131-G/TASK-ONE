/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { useId, useOptimistic, useState, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { setTaskClientVisibilityAction } from "@/features/tasks/tasks-actions";

// Lets the people who can edit a task choose whether the client portal lists
// it (title, status and due date only) in the project it belongs to.
export const TaskClientVisibility = ({
  clientVisible,
  editable,
  onReload,
  onVersionChange,
  taskId,
  version,
}: {
  readonly clientVisible: boolean;
  readonly editable: boolean;
  readonly onReload: () => Promise<void>;
  readonly onVersionChange: (version: number) => void;
  readonly taskId: string;
  readonly version: number;
}) => {
  const checkboxId = useId();
  const hintId = useId();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(clientVisible);
  const [error, setError] = useState<string | null>(null);

  const change = (visible: boolean) => {
    if (pending || !editable) {
      return;
    }
    startTransition(async () => {
      setShown(visible);
      const result = await setTaskClientVisibilityAction({
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
        taskId,
        visible,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      onVersionChange(result.data.version);
      await onReload();
    });
  };

  return (
    <section className="stack">
      <h3>Client portal</h3>
      <label className="row" htmlFor={checkboxId}>
        <Checkbox
          aria-describedby={hintId}
          checked={shown}
          disabled={!editable || pending}
          id={checkboxId}
          onCheckedChange={(checked) => change(checked === true)}
        />
        <span>Show to client</span>
      </label>
      <p className="muted" id={hintId}>
        Clients see only the title, status and due date, and only when the
        project is shared with their company.
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
};
