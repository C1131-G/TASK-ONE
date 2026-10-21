/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useOptimistic, useState, useTransition } from "react";

import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { useWorkspaceUndo } from "@/components/workspace/workspace-undo";
import {
  changeTaskColumnAction,
  undoTaskCompletionAction,
} from "@/features/tasks/tasks-actions";

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
  const { addUndo } = useWorkspaceUndo();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The select shows the new status at once; the action's refresh brings the
  // saved status, and a refused change falls back to it with the error shown.
  const [shownStatus, setShownStatus] = useOptimistic(status);

  const changeStatus = (nextStatus: TaskStatus) => {
    if (pending || nextStatus === shownStatus) {
      return;
    }
    setError(null);
    startTransition(async () => {
      setShownStatus(nextStatus);
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
      const { completionUndo } = result.data;
      if (completionUndo) {
        addUndo({
          expiresAt: completionUndo.expiresAt,
          label: "Task completed",
          run: async () => {
            const undoResult = await undoTaskCompletionAction({
              idempotencyKey: crypto.randomUUID(),
              undoId: completionUndo.undoId,
            });
            if (!undoResult.ok) {
              return undoResult.error.message;
            }
            return null;
          },
        });
      }
    });
  };

  return (
    <div className="status-control-wrap">
      <label className="status-control">
        <span className="sr">Change task status</span>
        <WorkspaceSelect
          {...(error ? { ariaInvalid: true } : {})}
          className="pstatus"
          disabled={pending}
          onValueChange={(nextStatus) => {
            const selectedStatus = statuses.find(
              ([value]) => value === nextStatus
            )?.[0];
            if (selectedStatus) {
              changeStatus(selectedStatus);
            }
          }}
          status={shownStatus}
          value={shownStatus}
        >
          {statuses.map(([value, label]) => (
            <WorkspaceSelectItem key={value} value={value}>
              {label}
            </WorkspaceSelectItem>
          ))}
        </WorkspaceSelect>
        {error ? (
          <span className="error" role="alert">
            {error}
          </span>
        ) : null}
      </label>
    </div>
  );
};

export { TaskStatusSelect };
