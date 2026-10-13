/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BugTaskDetail } from "@/features/bugs/components/bug-task-detail";
import { ProjectFiles } from "@/features/files/components/project-files";
import { TaskCommentsSection } from "@/features/tasks/components/task-details-comments";
import { TaskDetailsForm } from "@/features/tasks/components/task-details-form";
import { TaskDetailsHeading } from "@/features/tasks/components/task-details-heading";
import { TaskSubtasksSection } from "@/features/tasks/components/task-details-subtasks";
import type { TaskSubtaskView } from "@/features/tasks/components/task-details-subtasks";
import { TaskDiscardDialog } from "@/features/tasks/components/task-discard-dialog";
import { TaskRecurrenceEditor } from "@/features/tasks/components/task-recurrence-editor";
import { TaskRelationsEditor } from "@/features/tasks/components/task-relations-editor";
import { useTaskComments } from "@/features/tasks/hooks/use-task-comments";
import { useTaskPanelSave } from "@/features/tasks/hooks/use-task-panel-save";
import { useTaskSubtaskActions } from "@/features/tasks/hooks/use-task-subtask-actions";
import type { EditableTask } from "@/features/tasks/task-details-draft";
import { readTaskBundle } from "@/features/tasks/task-details-panel-data";
import type {
  EmployeeOption,
  TaskFile,
} from "@/features/tasks/task-details-panel-data";

// One panel per task. Everything it edits is read from the server when it opens,
// so a caller only needs the task's ID, project and version. Closing with unsaved
// details or a comment draft asks first.
export const TaskDetailsPanel = ({
  currentUserId,
  bugId,
  editable,
  employees,
  isAdmin,
  onOpenChange,
  onVersionChange,
  open,
  projectId,
  taskId,
  taskType = "task",
  taskTitle,
  trigger,
  version,
}: {
  readonly currentUserId: string | null;
  readonly bugId?: string;
  readonly editable: boolean;
  readonly employees: readonly EmployeeOption[];
  readonly isAdmin: boolean;
  // When open is passed, the caller owns the open state (for example a drawer
  // driven by the URL). Otherwise the trigger opens the panel.
  readonly onOpenChange?: (open: boolean) => void;
  readonly onVersionChange: (version: number) => void;
  readonly open?: boolean;
  readonly projectId: string;
  readonly taskId: string;
  readonly taskType?: "task" | "bug";
  readonly taskTitle?: string;
  readonly trigger?: ReactNode;
  readonly version: number;
}) => {
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = open ?? localOpen;
  const [task, setTask] = useState<EditableTask | null>(null);
  const [subtasks, setSubtasks] = useState<readonly TaskSubtaskView[]>([]);
  const [files, setFiles] = useState<readonly TaskFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  // A ref, not state: the dirty flag only decides what a close does.
  const detailsDirtyRef = useRef(false);
  const setDetailsDirty = useCallback((dirty: boolean) => {
    detailsDirtyRef.current = dirty;
  }, []);
  const comments = useTaskComments({ onError: setError, taskId });
  const { setComments: setCommentList } = comments;
  const subtaskActions = useTaskSubtaskActions({
    onVersionChange,
    setSubtasks,
    subtasks,
    taskId,
    version,
  });
  const visibleError = error ?? subtaskActions.error;
  const handleAddSubtask = subtaskActions.add;
  const handlePromoteSubtask = subtaskActions.promote;
  const handleRemoveSubtask = subtaskActions.remove;
  const handleReorderSubtask = subtaskActions.reorder;
  const handleToggleSubtask = subtaskActions.toggle;
  const handleUpdateSubtask = subtaskActions.edit;
  const handleCommentBodyChange = comments.setBody;
  const handleReact = comments.react;
  const handleRemoveComment = comments.remove;
  const handleSubmitComment = comments.submit;

  // Applies a bundle to the panel. The first failing read is reported; the others
  // that succeeded still show.
  const applyBundle = useCallback(
    (bundle: Awaited<ReturnType<typeof readTaskBundle>>) => {
      const failure = [
        bundle.task,
        bundle.comments,
        bundle.subtasks,
        bundle.files,
      ].find((result) => !result.ok);
      if (failure && !failure.ok) {
        setError(failure.error.message);
      } else {
        setError(null);
      }
      if (bundle.task.ok) {
        setTask(bundle.task.data);
      }
      if (bundle.comments.ok) {
        setCommentList(bundle.comments.data);
      }
      if (bundle.subtasks.ok) {
        setSubtasks(bundle.subtasks.data);
      }
      if (bundle.files.ok) {
        setFiles(bundle.files.data);
      }
    },
    [setCommentList]
  );

  const refresh = useCallback(async () => {
    applyBundle(await readTaskBundle(projectId, taskId));
  }, [applyBundle, projectId, taskId]);
  const handleSaved = useTaskPanelSave({
    onVersionChange,
    refresh,
    taskTitle: task?.title ?? taskTitle ?? "task",
  });

  // Loads when the panel opens; a late response for a previous task is dropped.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let current = true;
    const load = async () => {
      const bundle = await readTaskBundle(projectId, taskId);
      if (current) {
        applyBundle(bundle);
      }
    };
    load();
    return () => {
      current = false;
    };
  }, [applyBundle, isOpen, projectId, taskId]);

  const setOpen = (next: boolean) => {
    if (open === undefined) {
      setLocalOpen(next);
    }
    onOpenChange?.(next);
  };

  const requestOpenChange = (next: boolean) => {
    if (next) {
      setOpen(true);
      return;
    }
    if (detailsDirtyRef.current || comments.body.trim()) {
      setDiscardOpen(true);
      return;
    }
    setOpen(false);
  };

  const discardAndClose = () => {
    setDiscardOpen(false);
    comments.setBody("");
    detailsDirtyRef.current = false;
    setOpen(false);
  };

  return (
    <section className="task-details-panel">
      <Sheet onOpenChange={requestOpenChange} open={isOpen}>
        {trigger === undefined ? null : (
          <SheetTrigger asChild>{trigger}</SheetTrigger>
        )}
        <SheetContent
          className="workspace-app"
          data-workspace-sheet=""
          side="right"
        >
          <TaskDetailsHeading
            isBug={taskType === "bug"}
            title={task?.title ?? taskTitle ?? "Task details"}
          />
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-6">
            {visibleError ? (
              <p className="error" role="alert">
                {visibleError}
              </p>
            ) : null}
            {taskType === "bug" && bugId ? (
              <BugTaskDetail
                bugId={bugId}
                employees={employees}
                isAdmin={isAdmin}
                userId={currentUserId ?? ""}
              />
            ) : (
              <>
                <section className="stack">
                  <h3>Details</h3>
                  {task ? (
                    <TaskDetailsForm
                      editable={editable}
                      employees={employees}
                      key={task.version}
                      onDirtyChange={setDetailsDirty}
                      onReload={() => refresh()}
                      onSaved={handleSaved}
                      task={task}
                      version={version}
                    />
                  ) : (
                    <p className="muted">Loading task details…</p>
                  )}
                </section>
                <TaskSubtasksSection
                  editable={editable}
                  employees={employees}
                  onAdd={handleAddSubtask}
                  onPromote={handlePromoteSubtask}
                  onRemove={handleRemoveSubtask}
                  onReorder={handleReorderSubtask}
                  onToggle={handleToggleSubtask}
                  onUpdate={handleUpdateSubtask}
                  pending={subtaskActions.pending}
                  subtasks={subtasks}
                />
                {task ? (
                  <>
                    <TaskRelationsEditor
                      dependencyIds={task.dependencyIds}
                      editable={editable}
                      labelIds={task.labelIds}
                      onVersionChange={onVersionChange}
                      projectId={projectId}
                      taskId={taskId}
                      version={version}
                    />
                    <TaskRecurrenceEditor
                      dueDate={task.dueDate}
                      editable={editable}
                      onVersionChange={onVersionChange}
                      recurrence={task.recurrence}
                      taskId={taskId}
                      version={version}
                    />
                  </>
                ) : null}
              </>
            )}
            <TaskCommentsSection
              body={comments.body}
              comments={comments.comments}
              currentUserId={currentUserId}
              employees={employees}
              isAdmin={isAdmin}
              onBodyChange={handleCommentBodyChange}
              onReact={handleReact}
              onRemove={handleRemoveComment}
              onSubmit={handleSubmitComment}
              pending={comments.pending}
            />
            <section className="stack">
              <h3>Attachments</h3>
              <ProjectFiles
                canUpload={editable}
                currentUserId={currentUserId}
                initialFiles={files}
                isAdmin={isAdmin}
                projectId={projectId}
                taskId={taskId}
              />
            </section>
          </div>
        </SheetContent>
      </Sheet>
      <TaskDiscardDialog
        onDiscard={discardAndClose}
        onOpenChange={setDiscardOpen}
        open={discardOpen}
      />
    </section>
  );
};
