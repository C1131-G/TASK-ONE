/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { useFormErrors } from "@/components/workspace/use-form-errors";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDateTimePicker } from "@/components/workspace/workspace-date-time-picker";
import {
  WorkspaceFieldError,
  WorkspaceFormError,
} from "@/components/workspace/workspace-field-error";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import { createCalendarEventAction } from "@/features/calendar/calendar-actions";

const EVENT_FIELDS = [
  "title",
  "startsAt",
  "endsAt",
  "location",
  "description",
] as const;

const CalendarEventForm = () => {
  const [pending, startTransition] = useTransition();
  const {
    clearErrors,
    errors,
    fieldProps,
    formId: fieldId,
    formRef,
    showFailure,
  } = useFormErrors(EVENT_FIELDS);
  const [open, setOpen] = useState(false);

  const createEvent = (formData: FormData) => {
    if (pending) {
      return;
    }
    const startValue = String(formData.get("startsAt") ?? "");
    const endValue = String(formData.get("endsAt") ?? "");
    if (!startValue) {
      showFailure({
        fieldErrors: { startsAt: "Choose a start time." },
        message: "Choose a start time.",
      });
      return;
    }
    clearErrors();
    startTransition(async () => {
      const result = await createCalendarEventAction({
        attendeeIds: [],
        description: String(formData.get("description") ?? "").trim() || null,
        endsAt: endValue ? new Date(endValue).toISOString() : null,
        idempotencyKey: crypto.randomUUID(),
        location: String(formData.get("location") ?? "").trim() || null,
        projectId: null,
        startsAt: new Date(startValue).toISOString(),
        title: String(formData.get("title") ?? "").trim(),
      });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      setOpen(false);
    });
  };

  return (
    <WorkspaceModal
      description="Schedule a calendar event for your workspace."
      onOpenChange={setOpen}
      open={open}
      title="New event"
      trigger={
        <WorkspaceButton className="btn btn-primary btn-sm" type="button">
          New event
        </WorkspaceButton>
      }
    >
      <form
        aria-busy={pending || undefined}
        className="stack"
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          createEvent(new FormData(event.currentTarget));
        }}
      >
        <div className="field">
          <label htmlFor={`${fieldId}-title`}>Event title</label>
          <WorkspaceInput
            autoComplete="off"
            className="input"
            maxLength={160}
            name="title"
            required
            id={`${fieldId}-title`}
            {...fieldProps("title")}
          />
          <WorkspaceFieldError errors={errors} field="title" formId={fieldId} />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor={`${fieldId}-startsAt`}>Starts</label>
            <WorkspaceDateTimePicker
              ariaLabel="Choose event start date and time"
              className="input"
              id={`${fieldId}-startsAt`}
              name="startsAt"
              required
              {...fieldProps("startsAt")}
            />
            <WorkspaceFieldError
              errors={errors}
              field="startsAt"
              formId={fieldId}
            />
          </div>
          <div className="field">
            <label htmlFor={`${fieldId}-endsAt`}>Ends</label>
            <WorkspaceDateTimePicker
              ariaLabel="Choose event end date and time"
              className="input"
              id={`${fieldId}-endsAt`}
              name="endsAt"
              {...fieldProps("endsAt")}
            />
            <WorkspaceFieldError
              errors={errors}
              field="endsAt"
              formId={fieldId}
            />
          </div>
        </div>
        <div className="row">
          <div className="field grow">
            <label htmlFor={`${fieldId}-location`}>Location</label>
            <WorkspaceInput
              className="input"
              maxLength={160}
              name="location"
              id={`${fieldId}-location`}
              {...fieldProps("location")}
            />
            <WorkspaceFieldError
              errors={errors}
              field="location"
              formId={fieldId}
            />
          </div>
          <div className="field grow">
            <label htmlFor={`${fieldId}-description`}>Description</label>
            <WorkspaceInput
              className="input"
              maxLength={1000}
              name="description"
              id={`${fieldId}-description`}
              {...fieldProps("description")}
            />
            <WorkspaceFieldError
              errors={errors}
              field="description"
              formId={fieldId}
            />
          </div>
        </div>
        <WorkspaceFormError errors={errors} />
        <div className="acts">
          <WorkspaceButton
            aria-busy={pending || undefined}
            className="btn btn-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? "Creating…" : "Create event"}
          </WorkspaceButton>
        </div>
      </form>
    </WorkspaceModal>
  );
};

export { CalendarEventForm };
