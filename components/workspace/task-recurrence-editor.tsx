/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import { useState, useTransition } from "react";

import { setTaskRecurrenceAction } from "@/app/actions/tasks";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import type { TaskRecurrenceInput } from "@/src/server/work/work-contracts";

const frequencies = ["daily", "weekly", "biweekly", "monthly"] as const;
const weekdays = [
  { id: 0, name: "Sunday" },
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
] as const;

const selectFrequency = (
  value: FormDataEntryValue | null
): TaskRecurrenceInput["frequency"] =>
  frequencies.find((frequency) => frequency === value) ?? "weekly";

export const TaskRecurrenceEditor = ({
  taskId,
  dueDate,
  recurrence,
  version,
  onVersionChange,
}: {
  readonly taskId: string;
  readonly dueDate: string | null;
  readonly recurrence: TaskRecurrenceInput | null;
  readonly version: number;
  readonly onVersionChange: (version: number) => void;
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await setTaskRecurrenceAction({
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
        recurrence: {
          endsOn: String(formData.get("endsOn") ?? "") || null,
          frequency: selectFrequency(formData.get("frequency")),
          interval: Number(formData.get("interval") ?? 1),
          weekDays: formData.getAll("weekDays").map(Number),
        },
        taskId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onVersionChange(result.data.version);
      setError(null);
    });

  const clear = () =>
    startTransition(async () => {
      const result = await setTaskRecurrenceAction({
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
        recurrence: null,
        taskId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onVersionChange(result.data.version);
      setError(null);
    });

  let saveLabel = recurrence ? "Update recurrence" : "Set recurrence";
  if (pending) {
    saveLabel = "Saving…";
  }

  return (
    <details className="stack">
      <summary className="btn btn-sm btn-ghost">Repeat task</summary>
      <form action={save} className="stack">
        <div className="row">
          <label className="field">
            <span>Frequency</span>
            <select
              className="input"
              defaultValue={recurrence?.frequency ?? "weekly"}
              name="frequency"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="field">
            <span>Every</span>
            <WorkspaceInput
              className="input"
              defaultValue={recurrence?.interval ?? 1}
              max={365}
              min={1}
              name="interval"
              type="number"
            />
          </label>
          <label className="field">
            <span>Until</span>
            <WorkspaceInput
              className="input"
              defaultValue={recurrence?.endsOn ?? ""}
              name="endsOn"
              type="date"
            />
          </label>
        </div>
        <fieldset className="field">
          <legend>Repeat on weekdays (weekly schedules)</legend>
          <div className="row">
            {weekdays.map((day) => (
              <label className="row" key={day.id}>
                <input
                  defaultChecked={
                    recurrence?.weekDays.includes(day.id) ?? false
                  }
                  name="weekDays"
                  type="checkbox"
                  value={day.id}
                />
                <span>{day.name.slice(0, 3)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {dueDate ? null : (
          <p className="muted">Set a due date before enabling recurrence.</p>
        )}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="acts">
          <WorkspaceButton
            className="btn btn-sm btn-primary"
            disabled={pending || !dueDate}
            type="submit"
          >
            {saveLabel}
          </WorkspaceButton>
          {recurrence ? (
            <WorkspaceButton
              className="btn btn-sm btn-secondary"
              disabled={pending}
              onClick={clear}
              type="button"
            >
              Remove recurrence
            </WorkspaceButton>
          ) : null}
        </div>
      </form>
    </details>
  );
};
