/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createCommentAction,
  listTaskCommentsAction,
  removeCommentAction,
  toggleCommentReactionAction,
  undoCommentRemovalAction,
} from "@/app/actions/comments";
import { listTaskSubtasksAction } from "@/app/actions/subtasks";
import { listTaskFilesAction } from "@/app/actions/uploads";
import { ProjectFiles } from "@/components/workspace/project-files";
import {
  TaskCommentsSection,
  TaskSubtasksSection,
} from "@/components/workspace/task-details-sections";
import type {
  TaskCommentView,
  TaskSubtaskView,
} from "@/components/workspace/task-details-sections";
import { TaskRecurrenceEditor } from "@/components/workspace/task-recurrence-editor";
import { TaskRelationsEditor } from "@/components/workspace/task-relations-editor";
import { useTaskSubtaskActions } from "@/components/workspace/use-task-subtask-actions";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import type { TaskRecurrenceInput } from "@/src/server/work/work-contracts";

interface TaskFile {
  readonly id: string;
  readonly projectId: string;
  readonly taskId: string | null;
  readonly originalName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedById: string;
  readonly createdAt: string;
  readonly copyState: "pending" | "ready" | "failed";
}

export const TaskDetailsPanel = ({
  taskId,
  projectId,
  version,
  editable,
  currentUserId,
  isAdmin,
  labelIds,
  dependencyIds,
  recurrence,
  dueDate,
  onVersionChange,
  employees,
}: {
  readonly taskId: string;
  readonly projectId: string;
  readonly version: number;
  readonly editable: boolean;
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
  readonly labelIds: readonly string[];
  readonly dependencyIds: readonly string[];
  readonly recurrence: TaskRecurrenceInput | null;
  readonly dueDate: string | null;
  readonly onVersionChange: (version: number) => void;
  readonly employees: readonly { readonly id: string; readonly name: string }[];
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [comments, setComments] = useState<readonly TaskCommentView[]>([]);
  const [subtasks, setSubtasks] = useState<readonly TaskSubtaskView[]>([]);
  const [files, setFiles] = useState<readonly TaskFile[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const subtaskActions = useTaskSubtaskActions({
    onVersionChange,
    setSubtasks,
    subtasks,
    taskId,
    version,
  });
  const visibleError = error ?? subtaskActions.error;
  const handleAddSubtask = subtaskActions.add;
  const handleRemoveSubtask = subtaskActions.remove;
  const handleUpdateSubtask = subtaskActions.edit;
  const handleReorderSubtask = subtaskActions.reorder;
  const handlePromoteSubtask = subtaskActions.promote;
  const handleToggleSubtask = subtaskActions.toggle;

  const load = () => {
    setOpen((current) => !current);
    if (loaded) {
      return;
    }
    setLoaded(true);
    startTransition(async () => {
      const [commentResult, subtaskResult, fileResult] = await Promise.all([
        listTaskCommentsAction({ taskId }),
        listTaskSubtasksAction({ taskId }),
        listTaskFilesAction({ taskId }),
      ]);
      const failure = [commentResult, subtaskResult, fileResult].find(
        (result) => !result.ok
      );
      if (failure && !failure.ok) {
        setError(failure.error.message);
        setLoaded(false);
        return;
      }
      if (commentResult.ok) {
        setComments(commentResult.data);
      }
      if (subtaskResult.ok) {
        setSubtasks(subtaskResult.data);
      }
      if (fileResult.ok) {
        setFiles(fileResult.data);
      }
    });
  };

  const addComment = () =>
    startTransition(async () => {
      const result = await createCommentAction({
        body: commentBody.trim(),
        idempotencyKey: crypto.randomUUID(),
        taskId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setCommentBody("");
      const refreshed = await listTaskCommentsAction({ taskId });
      if (refreshed.ok) {
        setComments(refreshed.data);
      }
      router.refresh();
    });

  const removeComment = (commentId: string) =>
    startTransition(async () => {
      const result = await removeCommentAction({
        commentId,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setUndoId(result.data.undoId);
      setComments((current) =>
        current.filter((comment) => comment.id !== commentId)
      );
    });

  const undoComment = () => {
    if (!undoId) {
      return;
    }
    startTransition(async () => {
      const result = await undoCommentRemovalAction({
        idempotencyKey: crypto.randomUUID(),
        undoId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setUndoId(null);
      const refreshed = await listTaskCommentsAction({ taskId });
      if (refreshed.ok) {
        setComments(refreshed.data);
      }
    });
  };

  const toggleReaction = (comment: TaskCommentView, emoji: string) =>
    startTransition(async () => {
      const result = await toggleCommentReactionAction({
        commentId: comment.id,
        emoji,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      const refreshed = await listTaskCommentsAction({ taskId });
      if (refreshed.ok) {
        setComments(refreshed.data);
      }
    });

  return (
    <section className="task-details-panel">
      <WorkspaceButton
        aria-expanded={open}
        className="btn btn-sm btn-ghost"
        onClick={load}
        type="button"
      >
        {open ? "Hide details" : "Comments, subtasks & files"}
      </WorkspaceButton>
      {open ? (
        <div className="panel-b stack">
          {visibleError ? (
            <p className="error" role="alert">
              {visibleError}
            </p>
          ) : null}
          {pending && !loaded ? (
            <p className="muted">Loading task details…</p>
          ) : null}
          <TaskSubtasksSection
            editable={editable}
            onAdd={handleAddSubtask}
            onRemove={handleRemoveSubtask}
            onUpdate={handleUpdateSubtask}
            onReorder={handleReorderSubtask}
            onPromote={handlePromoteSubtask}
            onToggle={handleToggleSubtask}
            employees={employees}
            pending={pending || subtaskActions.pending}
            subtasks={subtasks}
          />
          <TaskRelationsEditor
            dependencyIds={dependencyIds}
            editable={editable}
            labelIds={labelIds}
            projectId={projectId}
            taskId={taskId}
            version={version}
            onVersionChange={onVersionChange}
          />
          <TaskRecurrenceEditor
            dueDate={dueDate}
            onVersionChange={onVersionChange}
            recurrence={recurrence}
            taskId={taskId}
            version={version}
          />
          <TaskCommentsSection
            body={commentBody}
            comments={comments}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onBodyChange={setCommentBody}
            onReact={toggleReaction}
            onRemove={removeComment}
            onSubmit={addComment}
            onUndo={undoComment}
            pending={pending}
            undoAvailable={undoId !== null}
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
      ) : null}
    </section>
  );
};
