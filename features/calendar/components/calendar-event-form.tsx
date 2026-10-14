/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDateTimePicker } from "@/components/workspace/workspace-date-time-picker";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import { createCalendarEventAction } from "@/features/calendar/calendar-actions";

const CalendarEventForm = () => {
  const router = useRouter();
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
      router.refresh();
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
        <label className="field" htmlFor="metsys-calendar-event-form-field-67">
          <span>Event title</span>
          <WorkspaceInput
            autoComplete="off"
            className="input"
            maxLength={160}
            name="title"
            required
            id="metsys-calendar-event-form-field-67"
          />
        </label>
        <div className="row">
          <label
            className="field"
            htmlFor="metsys-calendar-event-form-field-78"
          >
            <span>Starts</span>
            <WorkspaceDateTimePicker
              ariaLabel="Choose event start date and time"
              className="input"
              id="metsys-calendar-event-form-field-78"
              name="startsAt"
              required
            />
          </label>
          <label
            className="field"
            htmlFor="metsys-calendar-event-form-field-87"
          >
            <span>Ends</span>
            <WorkspaceDateTimePicker
              ariaLabel="Choose event end date and time"
              className="input"
              id="metsys-calendar-event-form-field-87"
              name="endsAt"
            />
          </label>
        </div>
        <div className="row">
          <label
            className="field grow"
            htmlFor="metsys-calendar-event-form-field-97"
          >
            <span>Location</span>
            <WorkspaceInput
              className="input"
              maxLength={160}
              name="location"
              id="metsys-calendar-event-form-field-97"
            />
          </label>
          <label
            className="field grow"
            htmlFor="metsys-calendar-event-form-field-101"
          >
            <span>Description</span>
            <WorkspaceInput
              className="input"
              maxLength={1000}
              name="description"
              id="metsys-calendar-event-form-field-101"
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
