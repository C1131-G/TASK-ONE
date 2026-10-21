/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { Play, Stop } from "@phosphor-icons/react";
import { useOptimistic, useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import type { TaskChoice } from "@/features/time/components/time-entry-form";
import { useNowSeconds } from "@/features/time/hooks/use-now-seconds";
import {
  startTimerAction,
  stopTimerAction,
} from "@/features/time/time-actions";
import { formatClock } from "@/features/time/time-format";
import type { RunningTimer } from "@/src/server/time/time-tracking";

const MS_PER_SECOND = 1000;
const NO_CHOICES: readonly TaskChoice[] = [];

const ElapsedClock = ({ startedAt }: { readonly startedAt: string }) => {
  const nowSeconds = useNowSeconds();
  const elapsed =
    nowSeconds === 0
      ? 0
      : Math.max(
          0,
          nowSeconds - Math.floor(Date.parse(startedAt) / MS_PER_SECOND)
        );
  return (
    <time className="timer-clock" suppressHydrationWarning>
      {nowSeconds === 0 ? "--:--:--" : formatClock(elapsed)}
    </time>
  );
};

// Start and stop the one running timer. A fixed task starts that task; without
// one, the person picks from the choices. Starting while another timer runs
// stops it and saves its time.
export const TimerControl = ({
  fixedTask,
  onChanged,
  taskChoices = NO_CHOICES,
  timer,
}: {
  readonly fixedTask?: TaskChoice;
  readonly onChanged?: () => Promise<void> | void;
  readonly taskChoices?: readonly TaskChoice[];
  readonly timer: RunningTimer | null;
}) => {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  const [choiceId, setChoiceId] = useState("");
  const [shown, setShown] = useOptimistic(
    timer,
    (_current, next: RunningTimer | null) => next
  );
  const choice =
    fixedTask ?? taskChoices.find(({ taskId }) => taskId === choiceId);

  const start = () => {
    if (!choice) {
      setFailure("Choose a task to time.");
      return;
    }
    startTransition(async () => {
      setFailure(null);
      setShown({
        billable: false,
        note: null,
        startedAt: new Date().toISOString(),
        taskId: choice.taskId,
        taskReference: choice.reference,
        taskTitle: choice.title,
      });
      const result = await startTimerAction({
        billable: false,
        idempotencyKey: crypto.randomUUID(),
        note: null,
        taskId: choice.taskId,
      });
      if (!result.ok) {
        setFailure(result.error.message);
        return;
      }
      await onChanged?.();
    });
  };

  const stop = () =>
    startTransition(async () => {
      setFailure(null);
      setShown(null);
      const result = await stopTimerAction({
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setFailure(result.error.message);
        return;
      }
      await onChanged?.();
    });

  const runningHere = shown !== null && shown.taskId === fixedTask?.taskId;
  return (
    <div aria-busy={pending || undefined} className="timer-control">
      {shown ? (
        <div className="timer-running" role="timer">
          <span className="timer-task">
            <strong>{shown.taskReference}</strong> {shown.taskTitle}
          </span>
          <ElapsedClock startedAt={shown.startedAt} />
          <WorkspaceButton
            className="btn btn-secondary btn-sm"
            disabled={pending}
            onClick={stop}
            type="button"
          >
            <Stop aria-hidden="true" size={14} weight="fill" />
            Stop timer
          </WorkspaceButton>
        </div>
      ) : null}
      {runningHere ? null : (
        <div className="timer-start">
          {fixedTask ? null : (
            <WorkspaceSelect
              ariaLabel="Task to time"
              className="input"
              {...(choice
                ? { displayValue: `${choice.reference} ${choice.title}` }
                : {})}
              onValueChange={setChoiceId}
              value={choiceId}
            >
              {taskChoices.map((option) => (
                <WorkspaceSelectItem key={option.taskId} value={option.taskId}>
                  {option.reference} {option.title}
                </WorkspaceSelectItem>
              ))}
            </WorkspaceSelect>
          )}
          <WorkspaceButton
            className="btn btn-primary btn-sm"
            disabled={pending}
            onClick={start}
            type="button"
          >
            <Play aria-hidden="true" size={14} weight="fill" />
            {shown ? "Switch timer to this task" : "Start timer"}
          </WorkspaceButton>
        </div>
      )}
      {failure ? (
        <p className="error" role="alert">
          {failure}
        </p>
      ) : null}
    </div>
  );
};
