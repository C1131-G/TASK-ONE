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
} from "@/app/actions/tasks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EditableTask } from "@/components/workspace/task-details-draft";
import { TaskDetailsPanel } from "@/components/workspace/task-details-panel";
import { useTaskDrawer } from "@/components/workspace/task-drawer";
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
  const [localDetailsOpen, setLocalDetailsOpen] = useState(false);
  // Inside a page drawer the details open there, so the row renders no panel.
  const drawer = useTaskDrawer();
  const openDetails = () => {
    if (drawer) {
      drawer.openTask(task.id);
    } else {
      setLocalDetailsOpen(true);
    }
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
                <DropdownMenuItem onSelect={openDetails}>
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
      {drawer ? (
        <WorkspaceButton
          aria-label={`Open details for ${task.title}`}
          className="ibtn ibtn-sm"
          onClick={openDetails}
          size="icon-sm"
          title={`Open details for ${task.title}`}
          type="button"
        >
          <ListBullets aria-hidden="true" size={16} />
        </WorkspaceButton>
      ) : (
        <TaskDetailsPanel
          currentUserId={currentUserId}
          editable={canEdit}
          employees={employees}
          isAdmin={isAdmin}
          onOpenChange={setLocalDetailsOpen}
          onVersionChange={setVersion}
          open={localDetailsOpen}
          projectId={task.projectId}
          taskId={task.id}
          taskTitle={task.title}
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
          version={version}
        />
      )}
    </div>
  );
};

export { TaskManageControls };
