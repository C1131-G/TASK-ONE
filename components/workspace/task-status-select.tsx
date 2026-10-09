/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  changeTaskColumnAction,
  undoTaskCompletionAction,
} from "@/app/actions/tasks";
import { WorkspaceButton } from "@/components/workspace/workspace-button";

const statuses = [
  ["backlog", "Backlog"],
  ["todo", "To Do"],
  ["progress", "In Progress"],
  ["review", "Review"],
  ["done", "Done"],
] as const;

type TaskStatus = (typeof statuses)[number][0];

const TaskStatusSelect = ({
  taskId,
  version,
  status,
}: {
  readonly taskId: string;
  readonly version: number;
  readonly status: TaskStatus;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [completionUndo, setCompletionUndo] = useState<string | null>(null);

  const changeStatus = (nextStatus: TaskStatus) => {
    if (nextStatus === status) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await changeTaskColumnAction({
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
        status: nextStatus,
        taskId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setCompletionUndo(result.data.completionUndo?.undoId ?? null);
      router.refresh();
    });
  };

  const undoCompletion = () =>
    completionUndo &&
    startTransition(async () => {
      const result = await undoTaskCompletionAction({
        idempotencyKey: crypto.randomUUID(),
        undoId: completionUndo,
      });
      if (!result.ok) {
        setError(result.error.message);
        setCompletionUndo(null);
        router.refresh();
        return;
      }
      setCompletionUndo(null);
      router.refresh();
    });

  return (
    <div className="status-control-wrap">
      <label className="status-control">
        <span className="sr">Change task status</span>
        <select
          aria-invalid={error ? true : undefined}
          className={`pstatus ${status}`}
          disabled={pending}
          onChange={(event) =>
            changeStatus(event.currentTarget.value as TaskStatus)
          }
          value={status}
        >
          {statuses.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {error ? (
          <span className="error" role="alert">
            {error}
          </span>
        ) : null}
      </label>
      {completionUndo ? (
        <WorkspaceButton
          className="btn btn-sm btn-ghost"
          disabled={pending}
          onClick={undoCompletion}
          type="button"
        >
          Undo completion
        </WorkspaceButton>
      ) : null}
    </div>
  );
};

export { TaskStatusSelect };
