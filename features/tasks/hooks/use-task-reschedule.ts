"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";

import type { TaskSpan } from "@/features/tasks/task-dates";
import { sameSpan } from "@/features/tasks/task-dates";
import { rescheduleTaskAction } from "@/features/tasks/tasks-actions";

export interface ReschedulableTask extends TaskSpan {
  readonly id: string;
  readonly title: string;
  readonly version: number;
}

const describeSpan = ({ dueDate, startDate }: TaskSpan): string => {
  if (startDate && dueDate && startDate !== dueDate) {
    return `${startDate} to ${dueDate}`;
  }
  return dueDate ?? startDate ?? "no date";
};

// Moves tasks by their dates. The move shows at once and is sent with the task's
// version, so a conflicting edit from someone else is reported rather than lost.
export const useTaskReschedule = <Task extends ReschedulableTask>(
  tasks: readonly Task[]
) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // The version each move returned. A second move made before the refresh arrives
  // must send this one, not the stale version from the props.
  const knownVersions = useRef(new Map<string, number>());
  const [optimisticTasks, applyMove] = useOptimistic(
    tasks,
    (current, move: { readonly dates: TaskSpan; readonly taskId: string }) =>
      current.map((task) =>
        task.id === move.taskId ? { ...task, ...move.dates } : task
      )
  );

  // Moves run one after another. A second move made before the first returns would
  // otherwise send a version the server has already moved past.
  const queue = useRef<Promise<void> | null>(null);

  const send = async (task: Task, dates: TaskSpan) => {
    const expectedVersion = Math.max(
      task.version,
      knownVersions.current.get(task.id) ?? 0
    );
    const result = await rescheduleTaskAction({
      dueDate: dates.dueDate,
      expectedVersion,
      idempotencyKey: crypto.randomUUID(),
      startDate: dates.startDate,
      taskId: task.id,
    });
    if (!result.ok) {
      setError(result.error.message);
      setAnnouncement(`${task.title} was not moved. ${result.error.message}`);
      return;
    }
    knownVersions.current.set(task.id, result.data.version);
    setError(null);
    setAnnouncement(`${task.title} moved to ${describeSpan(dates)}.`);
  };

  const sendAfter = async (
    previous: Promise<void>,
    task: Task,
    dates: TaskSpan
  ) => {
    try {
      await previous;
    } catch {
      // The earlier move reported its own failure; this one still goes out.
    }
    await send(task, dates);
  };

  const move = (task: Task, dates: TaskSpan) => {
    if (sameSpan(task, dates)) {
      return;
    }
    startTransition(async () => {
      applyMove({ dates, taskId: task.id });
      const run = sendAfter(queue.current ?? Promise.resolve(), task, dates);
      queue.current = run;
      await run;
    });
  };

  return { announcement, error, move, pending, tasks: optimisticTasks };
};
