/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useId, useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDateTimePicker } from "@/components/workspace/workspace-date-time-picker";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import { createCalendarEventAction } from "@/features/calendar/calendar-actions";

const CalendarEventForm = () => {
  const fieldId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const createEvent = (formData: FormData) => {
    if (pending) {
      return;
    }
    const startValue = String(formData.get("startsAt") ?? "");
    const endValue = String(formData.get("endsAt") ?? "");
    if (!startValue) {
      setError("Choose a start time.");
      return;
    }
    setError(null);
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
        setError(result.error.message);
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
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          createEvent(new FormData(event.currentTarget));
        }}
      >
        <label className="field" htmlFor={`${fieldId}-title`}>
          <span>Event title</span>
          <WorkspaceInput
            autoComplete="off"
            className="input"
            maxLength={160}
            name="title"
            required
            id={`${fieldId}-title`}
          />
        </label>
        <div className="row">
          <label className="field" htmlFor={`${fieldId}-startsAt`}>
            <span>Starts</span>
            <WorkspaceDateTimePicker
              ariaLabel="Choose event start date and time"
              className="input"
              id={`${fieldId}-startsAt`}
              name="startsAt"
              required
            />
          </label>
          <label className="field" htmlFor={`${fieldId}-endsAt`}>
            <span>Ends</span>
            <WorkspaceDateTimePicker
              ariaLabel="Choose event end date and time"
              className="input"
              id={`${fieldId}-endsAt`}
              name="endsAt"
            />
          </label>
        </div>
        <div className="row">
          <label className="field grow" htmlFor={`${fieldId}-location`}>
            <span>Location</span>
            <WorkspaceInput
              className="input"
              maxLength={160}
              name="location"
              id={`${fieldId}-location`}
            />
          </label>
          <label className="field grow" htmlFor={`${fieldId}-description`}>
            <span>Description</span>
            <WorkspaceInput
              className="input"
              maxLength={1000}
              name="description"
              id={`${fieldId}-description`}
            />
          </label>
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="acts">
          <WorkspaceButton
            className="btn btn-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? "Saving…" : "Create event"}
          </WorkspaceButton>
        </div>
      </form>
    </WorkspaceModal>
  );
};

export { CalendarEventForm };
