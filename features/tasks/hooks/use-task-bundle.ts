"use client";

import { useCallback, useEffect, useState } from "react";

import type { TaskSubtaskView } from "@/features/tasks/components/task-details-subtasks";
import { useTaskComments } from "@/features/tasks/hooks/use-task-comments";
import type { EditableTask } from "@/features/tasks/task-details-draft";
import { readTaskBundle } from "@/features/tasks/task-details-panel-data";
import type { TaskFile } from "@/features/tasks/task-details-panel-data";

// Reads everything the task panel shows while it is open, and owns the panel's
// error so the reads and the comment actions report into one place.
export const useTaskBundle = ({
  isOpen,
  projectId,
  taskId,
}: {
  readonly isOpen: boolean;
  readonly projectId: string;
  readonly taskId: string;
}) => {
  const [error, setError] = useState<string | null>(null);
  const comments = useTaskComments({ onError: setError, taskId });
  const { setComments } = comments;
  const [task, setTask] = useState<EditableTask | null>(null);
  const [subtasks, setSubtasks] = useState<readonly TaskSubtaskView[]>([]);
  const [files, setFiles] = useState<readonly TaskFile[]>([]);

  // The first failing read is reported; the reads that succeeded still show.
  const applyBundle = useCallback(
    (bundle: Awaited<ReturnType<typeof readTaskBundle>>) => {
      const failure = [
        bundle.task,
        bundle.comments,
        bundle.subtasks,
        bundle.files,
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
    },
    [setComments]
  );

  const refresh = useCallback(async () => {
    applyBundle(await readTaskBundle(projectId, taskId));
  }, [applyBundle, projectId, taskId]);

  // A late response for a previous task is dropped.
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

  return { comments, error, files, refresh, setSubtasks, subtasks, task };
};
