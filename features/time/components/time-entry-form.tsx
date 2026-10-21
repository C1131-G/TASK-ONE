/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRef, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { useFormErrors } from "@/components/workspace/use-form-errors";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceFieldError,
  WorkspaceFormError,
} from "@/components/workspace/workspace-field-error";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import {
  addTimeEntryAction,
  updateTimeEntryAction,
} from "@/features/time/time-actions";
import { formatMinutes, parseDuration } from "@/features/time/time-format";
import type { TimeEntryView } from "@/src/server/time/time-report";

export interface TaskChoice {
  readonly reference: string;
  readonly taskId: string;
  readonly title: string;
}

const NO_CHOICES: readonly TaskChoice[] = [];
const FORM_FIELDS = ["taskId", "workDate", "duration", "note"] as const;
const DURATION_HELP = "Enter a time like 1h 30m, 1:30 or 45.";

// Adds an entry, or edits the one passed in. A fixed task hides the task
// picker; otherwise the person chooses from the tasks offered.
export const TimeEntryForm = ({
  entry,
  fixedTaskId,
  idPrefix,
  onCancel,
  onSaved,
  taskChoices = NO_CHOICES,
  today,
}: {
  readonly entry?: TimeEntryView;
  readonly fixedTaskId?: string;
  readonly idPrefix: string;
  readonly onCancel?: () => void;
  // The server refreshes the page after a save; this is for lists it does not.
  readonly onSaved?: (saved: TimeEntryView) => Promise<void> | void;
  readonly taskChoices?: readonly TaskChoice[];
  readonly today: string;
}) => {
  const [pending, startTransition] = useTransition();
  const { clearErrors, errors, fieldProps, formId, formRef, showFailure } =
    useFormErrors(FORM_FIELDS);
  // One key per attempt, so a retried submit cannot log the time twice.
  const keyRef = useRef<string | null>(null);

  const submit = (formData: FormData) => {
    if (pending) {
      return;
    }
    const minutes = parseDuration(String(formData.get("duration") ?? ""));
    if (minutes === null) {
      showFailure({
        fieldErrors: { duration: DURATION_HELP },
        message: DURATION_HELP,
      });
      return;
    }
    const taskId = fixedTaskId ?? String(formData.get("taskId") ?? "");
    if (!entry && !taskId) {
      showFailure({
        fieldErrors: { taskId: "Choose a task." },
        message: "Choose a task.",
      });
      return;
    }
    clearErrors();
    const idempotencyKey = keyRef.current ?? crypto.randomUUID();
    keyRef.current = idempotencyKey;
    const changes = {
      billable: formData.get("billable") === "true",
      idempotencyKey,
      minutes,
      note: String(formData.get("note") ?? "").trim() || null,
      workDate: String(formData.get("workDate") ?? ""),
    };
    startTransition(async () => {
      const result = entry
        ? await updateTimeEntryAction({ ...changes, entryId: entry.id })
        : await addTimeEntryAction({ ...changes, taskId });
      if (!result.ok) {
        // The server names the duration "minutes".
        showFailure({
          ...result.error,
          fieldErrors: {
            ...result.error.fieldErrors,
            ...(result.error.fieldErrors?.["minutes"]
              ? { duration: result.error.fieldErrors["minutes"] }
              : {}),
          },
        });
        return;
      }
      keyRef.current = null;
      formRef.current?.reset();
      await onSaved?.(result.data);
    });
  };

  return (
    <form
      action={submit}
      aria-busy={pending || undefined}
      className="time-form"
      ref={formRef}
    >
      {fixedTaskId || entry ? null : (
        <div className="field">
          <label htmlFor={`${formId}-taskId`}>Task</label>
          <WorkspaceSelect
            ariaLabel="Task"
            className="input"
            id={`${formId}-taskId`}
            name="taskId"
            {...fieldProps("taskId")}
          >
            {taskChoices.map((choice) => (
              <WorkspaceSelectItem key={choice.taskId} value={choice.taskId}>
                {choice.reference} {choice.title}
              </WorkspaceSelectItem>
            ))}
          </WorkspaceSelect>
          <WorkspaceFieldError errors={errors} field="taskId" formId={formId} />
        </div>
      )}
      <div className="field">
        <label htmlFor={`${formId}-workDate`}>Date</label>
        <WorkspaceInput
          defaultValue={entry?.workDate ?? today}
          id={`${formId}-workDate`}
          name="workDate"
          required
          type="date"
          {...fieldProps("workDate")}
        />
        <WorkspaceFieldError errors={errors} field="workDate" formId={formId} />
      </div>
      <div className="field">
        <label htmlFor={`${formId}-duration`}>Time</label>
        <WorkspaceInput
          autoComplete="off"
          defaultValue={entry ? formatMinutes(entry.minutes) : ""}
          id={`${formId}-duration`}
          name="duration"
          placeholder="1h 30m"
          required
          {...fieldProps("duration")}
        />
        <WorkspaceFieldError errors={errors} field="duration" formId={formId} />
      </div>
      <div className="field time-form-note">
        <label htmlFor={`${formId}-note`}>Note</label>
        <WorkspaceInput
          autoComplete="off"
          defaultValue={entry?.note ?? ""}
          id={`${formId}-note`}
          maxLength={500}
          name="note"
          placeholder="What did you work on?"
          {...fieldProps("note")}
        />
        <WorkspaceFieldError errors={errors} field="note" formId={formId} />
      </div>
      <div className="time-form-actions">
        <label className="time-billable" htmlFor={`${idPrefix}-billable`}>
          <Checkbox
            defaultChecked={entry?.billable ?? false}
            id={`${idPrefix}-billable`}
            name="billable"
            value="true"
          />
          Billable
        </label>
        {onCancel ? (
          <WorkspaceButton
            className="btn btn-secondary btn-sm"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </WorkspaceButton>
        ) : null}
        <WorkspaceButton
          aria-busy={pending || undefined}
          className="btn btn-primary btn-sm"
          disabled={pending}
          type="submit"
        >
          {entry ? "Save" : "Log time"}
        </WorkspaceButton>
      </div>
      <WorkspaceFormError errors={errors} />
    </form>
  );
};
