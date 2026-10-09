/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createCalendarEventAction } from "@/app/actions/calendar";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";

const CalendarEventForm = () => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const createEvent = (formData: FormData) => {
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
      router.refresh();
    });
  };

  return (
    <details className="panel">
      <summary className="panel-h">
        <span className="btn btn-primary btn-sm">New event</span>
      </summary>
      <form
        className="panel-b stack"
        onSubmit={(event) => {
          event.preventDefault();
          createEvent(new FormData(event.currentTarget));
        }}
      >
        <label className="field">
          <span>Event title</span>
          <WorkspaceInput
            autoComplete="off"
            className="input"
            maxLength={160}
            name="title"
            required
          />
        </label>
        <div className="row">
          <label className="field">
            <span>Starts</span>
            <WorkspaceInput
              className="input"
              name="startsAt"
              required
              type="datetime-local"
            />
          </label>
          <label className="field">
            <span>Ends</span>
            <WorkspaceInput
              className="input"
              name="endsAt"
              type="datetime-local"
            />
          </label>
        </div>
        <div className="row">
          <label className="field grow">
            <span>Location</span>
            <WorkspaceInput className="input" maxLength={160} name="location" />
          </label>
          <label className="field grow">
            <span>Description</span>
            <WorkspaceInput
              className="input"
              maxLength={1000}
              name="description"
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
    </details>
  );
};

export { CalendarEventForm };
