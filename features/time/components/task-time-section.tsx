/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { TimeEntryForm } from "@/features/time/components/time-entry-form";
import { TimeEntryList } from "@/features/time/components/time-entry-list";
import { TimerControl } from "@/features/time/components/timer-control";
import { formatMinutes, localToday } from "@/features/time/time-format";
import type { RunningTimer, TaskTime } from "@/src/server/time/time-tracking";

// Time on one task or bug: a timer, a manual entry form, the running total
// and every entry. The drawer owns the data and reloads it after a change.
export const TaskTimeSection = ({
  currentUserId,
  isAdmin,
  onChanged,
  taskId,
  taskTitle,
  time,
  timer,
}: {
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
  readonly onChanged: () => Promise<void>;
  readonly taskId: string;
  readonly taskTitle?: string | undefined;
  readonly time: TaskTime | null;
  readonly timer: RunningTimer | null;
}) => {
  const [adding, setAdding] = useState(false);
  const today = localToday();
  return (
    <section aria-label="Time tracking" className="stack time-section">
      <div className="time-section-head">
        <h3>Time</h3>
        {time ? (
          <p className="muted time-totals">
            <strong>{formatMinutes(time.totalMinutes)}</strong> logged,{" "}
            {formatMinutes(time.billableMinutes)} billable
          </p>
        ) : null}
      </div>
      <TimerControl
        fixedTask={{ reference: "", taskId, title: taskTitle ?? "This task" }}
        onChanged={onChanged}
        timer={timer}
      />
      {adding ? (
        <TimeEntryForm
          fixedTaskId={taskId}
          idPrefix={`task-${taskId}`}
          onCancel={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await onChanged();
          }}
          today={today}
        />
      ) : (
        <div>
          <WorkspaceButton
            className="btn btn-secondary btn-sm"
            onClick={() => setAdding(true)}
            type="button"
          >
            Log time manually
          </WorkspaceButton>
        </div>
      )}
      {time ? (
        <TimeEntryList
          currentUserId={currentUserId}
          entries={time.entries}
          isAdmin={isAdmin}
          onChanged={onChanged}
          showPerson
          today={today}
        />
      ) : (
        <p className="muted">Loading time…</p>
      )}
    </section>
  );
};
