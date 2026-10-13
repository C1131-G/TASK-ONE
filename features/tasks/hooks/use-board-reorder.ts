"use client";

import { useSelector } from "@tanstack/react-store";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { reorderTasksAction } from "@/features/tasks/tasks-actions";

import { useProjectViewStore } from "../../projects/providers/project-view-store-provider";
import type { OrderableTask } from "../board-order";
import { moveTaskInColumn } from "../board-order";

// Moves a card within its status column. Button, Alt+arrow and the live
// announcement all go through here so they stay consistent.
export const useBoardReorder = <
  Task extends OrderableTask & {
    readonly status: string;
    readonly title: string;
  },
>({
  canReorder,
  onError,
  tasks,
}: {
  readonly canReorder: boolean;
  readonly onError: (message: string | null) => void;
  readonly tasks: readonly Task[];
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const projectViewStore = useProjectViewStore();
  const announcement = useSelector(
    projectViewStore,
    (state) => state.announcement
  );

  const move = (
    taskId: string,
    direction: -1 | 1,
    column: { readonly id: string; readonly label: string }
  ) => {
    if (!canReorder || pending) {
      return;
    }
    const columnTasks = tasks.filter((task) => task.status === column.id);
    const result = moveTaskInColumn(columnTasks, taskId, direction);
    if (!result) {
      return;
    }
    const title =
      columnTasks.find((task) => task.id === taskId)?.title ?? "Task";
    startTransition(async () => {
      const response = await reorderTasksAction({
        changes: [...result.changes],
        idempotencyKey: crypto.randomUUID(),
      });
      if (!response.ok) {
        onError(response.error.message);
        return;
      }
      onError(null);
      projectViewStore.actions.setAnnouncement(
        `${title} moved to position ${result.newIndex + 1} of ${columnTasks.length} in ${column.label}`
      );
      router.refresh();
    });
  };

  return { announcement, move, pending };
};
