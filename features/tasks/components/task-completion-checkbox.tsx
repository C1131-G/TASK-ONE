/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const setCompleted = (checked: boolean) =>
    startTransition(async () => {
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
      router.refresh();
    });

  return (
    <span className="home-task-completion">
      <Checkbox
        aria-label={`${status === "done" ? "Reopen" : "Complete"} ${title}`}
        checked={status === "done"}
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
