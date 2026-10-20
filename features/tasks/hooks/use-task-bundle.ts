"use client";

import { useCallback, useRef, useState } from "react";

import type { TaskSubtaskView } from "@/features/tasks/components/task-details-subtasks";
import { useTaskComments } from "@/features/tasks/hooks/use-task-comments";
import type { EditableTask } from "@/features/tasks/task-details-draft";
import type {
  TaskBundle,
  TaskFile,
} from "@/features/tasks/task-details-panel-data";
import { getTaskBundleAction } from "@/features/tasks/tasks-actions";

// Reads everything the task panel shows while it is open, and owns the panel's
// error so the reads and the comment actions report into one place. A deep link
// hands in the server's read as initialBundle, so the first load skips a round trip.
export const useTaskBundle = ({
  initialBundle,
  projectId,
  taskId,
  bugId,
}: {
  readonly initialBundle: TaskBundle | null;
  readonly projectId: string;
  readonly taskId: string;
  readonly bugId?: string;
}) => {
  const [bugHistory, setBugHistory] = useState(
    initialBundle?.bugHistory?.ok ? initialBundle.bugHistory.data : null
  );
  const initialFailure = initialBundle
    ? [
        initialBundle.task,
        initialBundle.comments,
        initialBundle.subtasks,
        initialBundle.files,
        ...(initialBundle.bugHistory ? [initialBundle.bugHistory] : []),
      ].find((result) => !result.ok)
    : undefined;
  const [error, setError] = useState<string | null>(
    initialFailure && !initialFailure.ok ? initialFailure.error.message : null
  );
  const [loading, setLoading] = useState(false);
  const comments = useTaskComments({
    allowPublicReplies: typeof bugHistory?.bug.clientCompanyId === "string",
    initialComments: initialBundle?.comments.ok
      ? initialBundle.comments.data
      : [],
    onError: setError,
    taskId,
  });
  const { setComments } = comments;
  const [task, setTask] = useState<EditableTask | null>(() =>
    initialBundle?.task.ok ? initialBundle.task.data : null
  );
  const [subtasks, setSubtasks] = useState<readonly TaskSubtaskView[]>(
    initialBundle?.subtasks.ok ? initialBundle.subtasks.data : []
  );
  const [files, setFiles] = useState<readonly TaskFile[]>(
    initialBundle?.files.ok ? initialBundle.files.data : []
  );
  const requestSequence = useRef(0);

  // The first failing read is reported; the reads that succeeded still show.
  const applyBundle = useCallback(
    (bundle: TaskBundle) => {
      const failure = [
        bundle.task,
        bundle.comments,
        bundle.subtasks,
        bundle.files,
        ...(bundle.bugHistory ? [bundle.bugHistory] : []),
      ].find((result) => !result.ok);
      setError(failure && !failure.ok ? failure.error.message : null);
      if (bundle.task.ok) {
        setTask(bundle.task.data);
      }
      if (bundle.comments.ok) {
        setComments(bundle.comments.data);
      }
      if (bundle.subtasks.ok) {
        setSubtasks(bundle.subtasks.data);
      }
      if (bundle.files.ok) {
        setFiles(bundle.files.data);
      }
      if (bundle.bugHistory?.ok) {
        setBugHistory(bundle.bugHistory.data);
      }
    },
    [setComments]
  );

  const refresh = useCallback(async () => {
    requestSequence.current += 1;
    const requestId = requestSequence.current;
    setLoading(true);
    try {
      const bundle = await getTaskBundleAction(projectId, taskId, bugId);
      if (requestId === requestSequence.current) {
        applyBundle(bundle);
      }
    } catch {
      if (requestId === requestSequence.current) {
        setError("Task details could not be refreshed. Try again.");
      }
    }
    if (requestId === requestSequence.current) {
      setLoading(false);
    }
  }, [applyBundle, bugId, projectId, taskId]);

  return {
    bugHistory,
    comments,
    error,
    files,
    loading,
    refresh,
    setFiles,
    setSubtasks,
    subtasks,
    task,
  };
};
