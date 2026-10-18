/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { use, useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BugTaskDetail } from "@/features/bugs/components/bug-task-detail";
import { ProjectFiles } from "@/features/files/components/project-files";
import { TaskCommentsSection } from "@/features/tasks/components/task-details-comments";
import { TaskDetailsHeading } from "@/features/tasks/components/task-details-heading";
import { TaskDiscardDialog } from "@/features/tasks/components/task-discard-dialog";
import { TaskWorkSections } from "@/features/tasks/components/task-work-sections";
import { useTaskBundle } from "@/features/tasks/hooks/use-task-bundle";
import { useTaskPanelSave } from "@/features/tasks/hooks/use-task-panel-save";
import { useTaskSubtaskActions } from "@/features/tasks/hooks/use-task-subtask-actions";
import type {
  EmployeeOption,
  TaskBundle,
} from "@/features/tasks/task-details-panel-data";

// One panel per task. Everything it edits is read from the server when it opens,
// so a caller only needs the task's ID, project and version. Closing with unsaved
// details or a comment draft asks first.
export const TaskDetailsPanel = ({
  currentUserId,
  bugId,
  editable,
  employees,
  initialBundlePromise = null,
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
  // The server's read for a deep-linked task, used for the first load only.
  readonly initialBundlePromise?: Promise<TaskBundle> | null;
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
  // A deep-link bundle is resolved by the nearest Suspense boundary before
  // the panel mounts; its rejection is handled by the section boundary.
  const initialBundle = initialBundlePromise ? use(initialBundlePromise) : null;
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = open ?? localOpen;
  const [discardOpen, setDiscardOpen] = useState(false);
  // A ref, not state: the dirty flag only decides what a close does.
  const detailsDirtyRef = useRef(false);
  const setDetailsDirty = useCallback((dirty: boolean) => {
    detailsDirtyRef.current = dirty;
  }, []);
  // Only a bug reported by a client company can take public replies.
  const {
    comments,
    bugHistory,
    error,
    files,
    loading,
    refresh,
    setFiles,
    setSubtasks,
    subtasks,
    task,
  } = useTaskBundle({
    initialBundle,
    projectId,
    taskId,
    ...(taskType === "bug" && bugId ? { bugId } : {}),
  });
  const subtaskActions = useTaskSubtaskActions({
    onVersionChange,
    setSubtasks,
    subtasks,
    taskId,
    version,
  });
  const visibleError = error ?? subtaskActions.error;
  const {
    react: handleReact,
    remove: handleRemoveComment,
    setBody: handleCommentBodyChange,
    setVisibility: handleVisibilityChange,
    submit: handleSubmitComment,
  } = comments;
  const handleSaved = useTaskPanelSave({
    onVersionChange,
    refresh,
    taskTitle: task?.title ?? taskTitle ?? "task",
  });

  const setOpen = (next: boolean) => {
    if (open === undefined) {
      setLocalOpen(next);
    }
    onOpenChange?.(next);
  };

  const requestOpenChange = (next: boolean) => {
    if (next) {
      if (!isOpen && !initialBundle) {
        refresh();
      }
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
    comments.setVisibility("internal");
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
                <button disabled={loading} onClick={refresh} type="button">
                  {loading ? "Retrying…" : "Retry"}
                </button>
              </p>
            ) : null}
            {taskType === "bug" && bugId ? (
              <BugTaskDetail
                employees={employees}
                history={bugHistory}
                isAdmin={isAdmin}
                onRefresh={refresh}
                userId={currentUserId ?? ""}
              />
            ) : (
              <TaskWorkSections
                editable={editable}
                employees={employees}
                onDirtyChange={setDetailsDirty}
                onReload={() => refresh()}
                onSaved={handleSaved}
                onVersionChange={onVersionChange}
                projectId={projectId}
                subtaskActions={subtaskActions}
                subtasks={subtasks}
                task={task}
                taskId={taskId}
                version={version}
              />
            )}
            <TaskCommentsSection
              body={comments.body}
              comments={comments.comments}
              currentUserId={currentUserId}
              employees={employees}
              allowPublicReplies={
                taskType === "bug" &&
                typeof bugHistory?.bug.clientCompanyId === "string"
              }
              isAdmin={isAdmin}
              onBodyChange={handleCommentBodyChange}
              onReact={handleReact}
              onRemove={handleRemoveComment}
              onSubmit={handleSubmitComment}
              onVisibilityChange={handleVisibilityChange}
              pending={comments.pending}
              visibility={comments.visibility}
            />
            <section className="stack">
              <h3>Attachments</h3>
              <ProjectFiles
                canUpload={editable}
                currentUserId={currentUserId}
                initialFiles={files}
                controlledFiles={files}
                setControlledFiles={setFiles}
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
