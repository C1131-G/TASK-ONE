/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  archiveTaskAction,
  duplicateTaskAction,
  undoTaskArchiveAction,
  undoTaskCompletionAction,
} from "@/app/actions/tasks";
import { TaskDetailsPanel } from "@/components/workspace/task-details-panel";
import { TaskEditForm } from "@/components/workspace/task-edit-form";
import type { EditableTask } from "@/components/workspace/task-edit-form";
import { WorkspaceButton } from "@/components/workspace/workspace-button";

interface EmployeeOption {
  readonly id: string;
  readonly name: string;
}

const TaskManageControls = ({
  task,
  isAdmin,
  employees,
  currentUserId,
}: {
  readonly task: EditableTask;
  readonly isAdmin: boolean;
  readonly employees: readonly EmployeeOption[];
  readonly currentUserId: string | null;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [versionState, setVersionState] = useState({
    sourceVersion: task.version,
    value: task.version,
  });
  const version =
    versionState.sourceVersion === task.version
      ? versionState.value
      : task.version;
  const setVersion = (value: number) =>
    setVersionState({ sourceVersion: task.version, value });
  const [error, setError] = useState<string | null>(null);
  const [completionUndo, setCompletionUndo] = useState<{
    readonly undoId: string;
    readonly expiresAt: string;
  } | null>(null);
  const [archiveUndo, setArchiveUndo] = useState<{
    readonly undoId: string;
    readonly expiresAt: string;
  } | null>(null);

  const duplicate = () =>
    startTransition(async () => {
      const result = await duplicateTaskAction({
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
        taskId: task.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });

  const archive = () =>
    startTransition(async () => {
      const result = await archiveTaskAction({
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
        taskId: task.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setArchiveUndo(result.data);
      setError(null);
    });

  const undoCompletion = () =>
    completionUndo &&
    startTransition(async () => {
      const result = await undoTaskCompletionAction({
        idempotencyKey: crypto.randomUUID(),
        undoId: completionUndo.undoId,
      });
      if (!result.ok) {
        setError(result.error.message);
        setCompletionUndo(null);
        router.refresh();
        return;
      }
      setCompletionUndo(null);
      setError(null);
      router.refresh();
    });

  const undoArchive = () =>
    archiveUndo &&
    startTransition(async () => {
      const result = await undoTaskArchiveAction({
        idempotencyKey: crypto.randomUUID(),
        undoId: archiveUndo.undoId,
      });
      if (!result.ok) {
        setError(result.error.message);
        setArchiveUndo(null);
        router.refresh();
        return;
      }
      setArchiveUndo(null);
      setError(null);
      router.refresh();
    });

  return (
    <div className="task-manage">
      <TaskEditForm
        employees={employees}
        onCompletionUndo={setCompletionUndo}
        onVersionChange={setVersion}
        task={task}
        version={version}
      />
      <WorkspaceButton
        aria-label={`Duplicate ${task.title}`}
        className="ibtn ibtn-sm"
        disabled={pending}
        onClick={duplicate}
        type="button"
      >
        Duplicate
      </WorkspaceButton>
      {isAdmin && archiveUndo ? (
        <WorkspaceButton
          className="btn btn-sm btn-secondary"
          disabled={pending}
          onClick={undoArchive}
          type="button"
        >
          Undo archive
        </WorkspaceButton>
      ) : null}
      {isAdmin && !archiveUndo ? (
        <WorkspaceButton
          aria-label={`Archive ${task.title}`}
          className="ibtn ibtn-sm"
          disabled={pending}
          onClick={archive}
          type="button"
        >
          Archive
        </WorkspaceButton>
      ) : null}
      {completionUndo ? (
        <WorkspaceButton
          className="btn btn-sm btn-secondary"
          disabled={pending}
          onClick={undoCompletion}
          type="button"
        >
          Undo completion
        </WorkspaceButton>
      ) : null}
      {archiveUndo ? (
        <span className="faint">
          Archived. Undo is available for five minutes.
        </span>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <TaskDetailsPanel
        currentUserId={currentUserId}
        editable={
          isAdmin ||
          task.createdById === currentUserId ||
          task.assigneeIds.includes(currentUserId ?? "")
        }
        isAdmin={isAdmin}
        projectId={task.projectId}
        taskId={task.id}
        version={version}
        onVersionChange={setVersion}
        employees={employees}
        labelIds={task.labelIds}
        dependencyIds={task.dependencyIds}
        recurrence={task.recurrence}
        dueDate={task.dueDate}
      />
    </div>
  );
};

export { TaskManageControls };
