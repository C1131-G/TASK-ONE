"use client";

import { useSelector } from "@tanstack/react-store";
import { useRef, useTransition } from "react";

import { useProjectViewStore } from "@/features/projects/providers/project-view-store-provider";
import { reorderTasksAction } from "@/features/tasks/tasks-actions";

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
  const [pending, startTransition] = useTransition();
  const requestInFlight = useRef(false);
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
    if (!canReorder || pending || requestInFlight.current) {
      return;
    }
    const columnTasks = tasks.filter((task) => task.status === column.id);
    const result = moveTaskInColumn(columnTasks, taskId, direction);
    if (!result) {
      return;
    }
    const title =
      columnTasks.find((task) => task.id === taskId)?.title ?? "Task";
    requestInFlight.current = true;
    startTransition(async () => {
      try {
        const response = await reorderTasksAction({
          changes: [...result.changes],
          idempotencyKey: crypto.randomUUID(),
        });
        if (response.ok) {
          onError(null);
          projectViewStore.actions.setAnnouncement(
            `${title} moved to position ${result.newIndex + 1} of ${columnTasks.length} in ${column.label}`
          );
        } else {
          onError(response.error.message);
        }
      } catch {
        onError("Tasks could not be reordered. Try again.");
      }
      requestInFlight.current = false;
    });
  };

  return { announcement, move, pending };
};
