"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createSubtaskAction,
  promoteSubtaskAction,
  removeSubtaskAction,
  reorderSubtasksAction,
  updateSubtaskAction,
} from "@/app/actions/subtasks";
import type { TaskSubtaskView } from "@/components/workspace/task-details-sections";

export const useTaskSubtaskActions = ({
  taskId,
  version,
  subtasks,
  setSubtasks,
  onVersionChange,
}: {
  readonly taskId: string;
  readonly version: number;
  readonly subtasks: readonly TaskSubtaskView[];
  readonly setSubtasks: (subtasks: readonly TaskSubtaskView[]) => void;
  readonly onVersionChange: (version: number) => void;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const add = (formData: FormData) =>
    startTransition(async () => {
      const result = await createSubtaskAction({
        assigneeId: null,
        description: null,
        dueDate: null,
        expectedTaskVersion: version,
        idempotencyKey: crypto.randomUUID(),
        taskId,
        title: String(formData.get("title") ?? "").trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onVersionChange(result.data.parentVersion);
      setSubtasks([...subtasks, result.data.subtask]);
      setError(null);
      router.refresh();
    });

  const toggle = (subtask: TaskSubtaskView) =>
    startTransition(async () => {
      const result = await updateSubtaskAction({
        assigneeId: subtask.assigneeId,
        completed: !subtask.completed,
        description: subtask.description,
        dueDate: subtask.dueDate,
        expectedTaskVersion: version,
        idempotencyKey: crypto.randomUUID(),
        subtaskId: subtask.id,
        title: subtask.title,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onVersionChange(result.data.parentVersion);
      setSubtasks(
        subtasks.map((item) =>
          item.id === subtask.id ? result.data.subtask : item
        )
      );
      setError(null);
      router.refresh();
    });

  const edit = (subtask: TaskSubtaskView, formData: FormData) =>
    startTransition(async () => {
      const result = await updateSubtaskAction({
        assigneeId: String(formData.get("assigneeId") ?? "") || null,
        completed: subtask.completed,
        description: String(formData.get("description") ?? "").trim() || null,
        dueDate: String(formData.get("dueDate") ?? "") || null,
        expectedTaskVersion: version,
        idempotencyKey: crypto.randomUUID(),
        subtaskId: subtask.id,
        title: String(formData.get("title") ?? "").trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onVersionChange(result.data.parentVersion);
      setSubtasks(
        subtasks.map((item) =>
          item.id === subtask.id ? result.data.subtask : item
        )
      );
      setError(null);
      router.refresh();
    });

  const remove = (subtask: TaskSubtaskView) =>
    startTransition(async () => {
      const result = await removeSubtaskAction({
        expectedTaskVersion: version,
        idempotencyKey: crypto.randomUUID(),
        subtaskId: subtask.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onVersionChange(result.data.parentVersion);
      setSubtasks(subtasks.filter((item) => item.id !== subtask.id));
      setError(null);
      router.refresh();
    });

  const reorder = (index: number, direction: -1 | 1) =>
    startTransition(async () => {
      const ordered = [...subtasks];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= ordered.length) {
        return;
      }
      const [selected] = ordered.splice(index, 1);
      if (!selected) {
        return;
      }
      ordered.splice(targetIndex, 0, selected);
      const result = await reorderSubtasksAction({
        expectedTaskVersion: version,
        idempotencyKey: crypto.randomUUID(),
        subtaskIds: ordered.map((item) => item.id),
        taskId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onVersionChange(result.data.parentVersion);
      setSubtasks(result.data.subtasks);
      setError(null);
      router.refresh();
    });

  const promote = (subtask: TaskSubtaskView) =>
    startTransition(async () => {
      const result = await promoteSubtaskAction({
        expectedTaskVersion: version,
        idempotencyKey: crypto.randomUUID(),
        subtaskId: subtask.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onVersionChange(version + 1);
      setSubtasks(subtasks.filter((item) => item.id !== subtask.id));
      setError(null);
      router.refresh();
    });

  return { add, edit, error, pending, promote, remove, reorder, toggle };
};
