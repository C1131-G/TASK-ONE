/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { useOptimistic, useState, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { changeTaskColumnAction } from "@/features/tasks/tasks-actions";

const TaskCompletionCheckbox = ({
  taskId,
  title,
  status,
  version,
}: {
  readonly taskId: string;
  readonly title: string;
  readonly status: "backlog" | "todo" | "progress" | "review" | "done";
  readonly version: number;
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The box ticks at once; the action's revalidation brings the saved status,
  // and a failed save falls back to it.
  const [completed, setOptimisticCompleted] = useOptimistic(status === "done");

  const setCompleted = (checked: boolean) =>
    startTransition(async () => {
      setOptimisticCompleted(checked);
      const result = await changeTaskColumnAction({
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
        status: checked ? "done" : "todo",
        taskId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
    });

  return (
    <span className="home-task-completion">
      <Checkbox
        aria-label={`${completed ? "Reopen" : "Complete"} ${title}`}
        checked={completed}
        disabled={pending}
        onCheckedChange={(checked) => {
          if (typeof checked === "boolean") {
            setCompleted(checked);
          }
        }}
      />
      {error ? (
        <span className="task-completion-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
};

export { TaskCompletionCheckbox };
