/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { DotsThree, ListBullets } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  archiveTaskAction,
  duplicateTaskAction,
  undoTaskArchiveAction,
  undoTaskCompletionAction,
} from "@/app/actions/tasks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskDetailsPanel } from "@/components/workspace/task-details-panel";
import { TaskEditForm } from "@/components/workspace/task-edit-form";
import type { EditableTask } from "@/components/workspace/task-edit-form";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { useWorkspaceUndo } from "@/components/workspace/workspace-undo";

interface EmployeeOption {
  readonly id: string;
  readonly name: string;
}

const TaskManageControls = ({
  task,
  isAdmin,
  canEdit,
  employees,
  currentUserId,
}: {
  readonly task: EditableTask;
  readonly isAdmin: boolean;
  readonly canEdit: boolean;
  readonly employees: readonly EmployeeOption[];
  readonly currentUserId: string | null;
}) => {
  const router = useRouter();
  const { addUndo } = useWorkspaceUndo();
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
  const [editOpen, setEditOpen] = useState(false);
  const registerCompletionUndo = (
    undo: {
      readonly undoId: string;
      readonly expiresAt: string;
    } | null
  ) => {
    if (!undo) {
      return;
    }
    addUndo({
      expiresAt: undo.expiresAt,
      label: `Completed “${task.title}”`,
      run: async () => {
        const result = await undoTaskCompletionAction({
          idempotencyKey: crypto.randomUUID(),
          undoId: undo.undoId,
        });
        if (!result.ok) {
          return result.error.message;
        }
        router.refresh();
        return null;
      },
    });
  };

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
      setError(null);
      addUndo({
        expiresAt: result.data.expiresAt,
        label: `Archived “${task.title}”`,
        run: async () => {
          const undoResult = await undoTaskArchiveAction({
            idempotencyKey: crypto.randomUUID(),
            undoId: result.data.undoId,
          });
          if (!undoResult.ok) {
            return undoResult.error.message;
          }
          router.refresh();
          return null;
        },
      });
    });

  return (
    <div className="task-manage">
      {canEdit ? (
        <TaskEditForm
          employees={employees}
          onCompletionUndo={registerCompletionUndo}
          onOpenChange={setEditOpen}
          onVersionChange={setVersion}
          open={editOpen}
          task={task}
          version={version}
        />
      ) : null}
      {canEdit || isAdmin ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <WorkspaceButton
              aria-label={`More actions for ${task.title}`}
              className="ibtn ibtn-sm"
              disabled={pending}
              size="icon-sm"
              type="button"
            >
              <DotsThree aria-hidden="true" size={18} weight="bold" />
            </WorkspaceButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="workspace-menu"
            data-workspace-menu=""
          >
            {canEdit ? (
              <>
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  Edit task
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={duplicate}>
                  Duplicate task
                </DropdownMenuItem>
              </>
            ) : null}
            {isAdmin && canEdit ? <DropdownMenuSeparator /> : null}
            {isAdmin ? (
              <DropdownMenuItem onSelect={archive} variant="destructive">
                Archive task
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <TaskDetailsPanel
        currentUserId={currentUserId}
        editable={canEdit}
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
        trigger={
          <WorkspaceButton
            aria-label={`Open details for ${task.title}`}
            className="ibtn ibtn-sm"
            size="icon-sm"
            title={`Open details for ${task.title}`}
            type="button"
          >
            <ListBullets aria-hidden="true" size={16} />
          </WorkspaceButton>
        }
      />
    </div>
  );
};

export { TaskManageControls };
