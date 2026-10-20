"use client";

import { useCallback, useState, useTransition } from "react";

import { useWorkspaceUndo } from "@/components/workspace/workspace-undo";
import type { TaskCommentView } from "@/features/tasks/components/task-comment-parts";
import {
  createCommentAction,
  listTaskCommentsAction,
  removeCommentAction,
  toggleCommentReactionAction,
  undoCommentRemovalAction,
} from "@/features/tasks/tasks-actions";
import type { CommentVisibility } from "@/src/server/collaboration/contracts";

// Comment state and actions for one task. A removal is undone from the global
// Undo stack, so it works after the drawer has closed.
export const useTaskComments = ({
  allowPublicReplies = false,
  initialComments = [],
  onError,
  taskId,
}: {
  readonly allowPublicReplies?: boolean;
  readonly initialComments?: readonly TaskCommentView[];
  readonly onError: (message: string | null) => void;
  readonly taskId: string;
}) => {
  const { addUndo } = useWorkspaceUndo();
  const [pending, startTransition] = useTransition();
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<CommentVisibility>("internal");

  const refresh = useCallback(async () => {
    const result = await listTaskCommentsAction({ taskId });
    if (result.ok) {
      setComments(result.data);
    }
  }, [taskId]);

  const submit = () =>
    startTransition(async () => {
      const result = await createCommentAction({
        body: body.trim(),
        idempotencyKey: crypto.randomUUID(),
        taskId,
        ...(allowPublicReplies && visibility === "public"
          ? { visibility }
          : {}),
      });
      if (!result.ok) {
        onError(result.error.message);
        return;
      }
      onError(null);
      setBody("");
      setVisibility("internal");
      await refresh();
    });

  const remove = (commentId: string) =>
    startTransition(async () => {
      const result = await removeCommentAction({
        commentId,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        onError(result.error.message);
        return;
      }
      onError(null);
      setComments((current) =>
        current.filter((comment) => comment.id !== commentId)
      );
      const { expiresAt, undoId } = result.data;
      addUndo({
        expiresAt,
        label: "Comment removed",
        run: async () => {
          const undo = await undoCommentRemovalAction({
            idempotencyKey: crypto.randomUUID(),
            undoId,
          });
          if (!undo.ok) {
            return undo.error.message;
          }
          await refresh();
          return null;
        },
      });
    });

  const react = (comment: TaskCommentView, emoji: string) =>
    startTransition(async () => {
      const result = await toggleCommentReactionAction({
        commentId: comment.id,
        emoji,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        onError(result.error.message);
        return;
      }
      await refresh();
    });

  return {
    body,
    comments,
    pending,
    react,
    refresh,
    remove,
    setBody,
    setComments,
    setVisibility,
    submit,
    visibility,
  };
};
