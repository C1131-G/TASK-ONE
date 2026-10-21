/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useOptimistic, useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { TimeEntryForm } from "@/features/time/components/time-entry-form";
import { deleteTimeEntryAction } from "@/features/time/time-actions";
import { formatMinutes } from "@/features/time/time-format";
import type { TimeEntryView } from "@/src/server/time/time-report";

// Entries the person may change: their own, or anyone's for an administrator.
export const TimeEntryList = ({
  currentUserId,
  entries,
  isAdmin,
  onChanged,
  showPerson = false,
  showTask = false,
  today,
}: {
  readonly currentUserId: string | null;
  readonly entries: readonly TimeEntryView[];
  readonly isAdmin: boolean;
  // Called after a change is saved, for lists the server does not refresh.
  readonly onChanged?: () => Promise<void> | void;
  readonly showPerson?: boolean;
  readonly showTask?: boolean;
  readonly today: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [visible, removeVisible] = useOptimistic(
    entries,
    (current, removedId: string) =>
      current.filter((entry) => entry.id !== removedId)
  );

  const remove = (entryId: string) =>
    startTransition(async () => {
      setFailure(null);
      removeVisible(entryId);
      const result = await deleteTimeEntryAction({
        entryId,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setFailure(result.error.message);
        return;
      }
      await onChanged?.();
    });

  if (visible.length === 0) {
    return <p className="muted">No time logged yet.</p>;
  }
  return (
    <>
      {failure ? (
        <p className="error" role="alert">
          {failure}
        </p>
      ) : null}
      <ul aria-busy={pending || undefined} className="time-entries">
        {visible.map((entry) => {
          const mayChange = isAdmin || entry.userId === currentUserId;
          if (editingId === entry.id) {
            return (
              <li key={entry.id}>
                <TimeEntryForm
                  entry={entry}
                  idPrefix={`edit-${entry.id}`}
                  onCancel={() => setEditingId(null)}
                  onSaved={async () => {
                    setEditingId(null);
                    await onChanged?.();
                  }}
                  today={today}
                />
              </li>
            );
          }
          return (
            <li className="time-entry" key={entry.id}>
              <span className="time-entry-minutes">
                {formatMinutes(entry.minutes)}
              </span>
              <span className="time-entry-body">
                <span>
                  {showTask ? (
                    <>
                      <strong>{entry.taskReference}</strong> {entry.taskTitle}
                      {" · "}
                    </>
                  ) : null}
                  {showPerson ? `${entry.userName} · ` : null}
                  <time dateTime={entry.workDate}>{entry.workDate}</time>
                </span>
                {entry.note ? (
                  <span className="muted">{entry.note}</span>
                ) : null}
              </span>
              {entry.billable ? (
                <span className="badge green">Billable</span>
              ) : null}
              {mayChange ? (
                <span className="time-entry-actions">
                  <WorkspaceButton
                    aria-label={`Edit ${formatMinutes(entry.minutes)} entry on ${entry.workDate}`}
                    className="btn btn-ghost btn-xs"
                    onClick={() => setEditingId(entry.id)}
                    type="button"
                  >
                    Edit
                  </WorkspaceButton>
                  <WorkspaceButton
                    aria-label={`Delete ${formatMinutes(entry.minutes)} entry on ${entry.workDate}`}
                    className="btn btn-danger-ghost btn-xs"
                    onClick={() => remove(entry.id)}
                    type="button"
                  >
                    Delete
                  </WorkspaceButton>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
};
