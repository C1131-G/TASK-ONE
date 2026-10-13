/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDatePicker } from "@/components/workspace/workspace-date-picker";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { setTaskRecurrenceAction } from "@/features/tasks/tasks-actions";
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
  editable,
}: {
  readonly taskId: string;
  readonly dueDate: string | null;
  readonly recurrence: TaskRecurrenceInput | null;
  readonly version: number;
  readonly onVersionChange: (version: number) => void;
  readonly editable: boolean;
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
    <WorkspaceDisclosure
      description="Choose how this task repeats and when recurrence ends."
      title="Repeat task"
      trigger={
        <WorkspaceButton className="btn btn-sm btn-ghost" type="button">
          Repeat task
        </WorkspaceButton>
      }
    >
      <form action={save} className="stack">
        <div className="row">
          <label className="field" htmlFor={`task-${taskId}-field-106`}>
            <span>Frequency</span>
            <WorkspaceSelect
              className="input"
              defaultValue={recurrence?.frequency ?? "weekly"}
              disabled={!editable}
              name="frequency"
              id={`task-${taskId}-field-106`}
            >
              <WorkspaceSelectItem value="daily">Daily</WorkspaceSelectItem>
              <WorkspaceSelectItem value="weekly">Weekly</WorkspaceSelectItem>
              <WorkspaceSelectItem value="biweekly">
                Every 2 weeks
              </WorkspaceSelectItem>
              <WorkspaceSelectItem value="monthly">Monthly</WorkspaceSelectItem>
            </WorkspaceSelect>
          </label>
          <label className="field" htmlFor={`task-${taskId}-field-121`}>
            <span>Every</span>
            <WorkspaceInput
              className="input"
              defaultValue={recurrence?.interval ?? 1}
              disabled={!editable}
              max={365}
              min={1}
              name="interval"
              type="number"
              id={`task-${taskId}-field-121`}
            />
          </label>
          <label className="field" htmlFor={`task-${taskId}-field-132`}>
            <span>Until</span>
            <WorkspaceDatePicker
              className="input"
              defaultValue={recurrence?.endsOn ?? ""}
              disabled={!editable}
              name="endsOn"
              id={`task-${taskId}-field-132`}
            />
          </label>
        </div>
        <fieldset className="field">
          <legend>Repeat on weekdays (weekly schedules)</legend>
          <div className="row">
            {weekdays.map((day) => (
              <label
                className="row"
                htmlFor={`task-${taskId}-weekday-${day.id}`}
                key={day.id}
              >
                <Checkbox
                  defaultChecked={
                    recurrence?.weekDays.includes(day.id) ?? false
                  }
                  disabled={!editable}
                  name="weekDays"
                  value={day.id}
                  id={`task-${taskId}-weekday-${day.id}`}
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
            disabled={!editable || pending || !dueDate}
            type="submit"
          >
            {saveLabel}
          </WorkspaceButton>
          {recurrence ? (
            <WorkspaceButton
              className="btn btn-sm btn-secondary"
              disabled={!editable || pending}
              onClick={clear}
              type="button"
            >
              Remove recurrence
            </WorkspaceButton>
          ) : null}
        </div>
      </form>
    </WorkspaceDisclosure>
  );
};
