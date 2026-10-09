/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteCalendarEventAction,
  updateCalendarEventAction,
} from "@/app/actions/calendar";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";
import type { CalendarEventSummary } from "@/src/server/calendar/calendar-contracts";

const toLocalInputValue = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export const CalendarEventManager = ({
  events,
  isAdmin,
}: {
  readonly events: readonly CalendarEventSummary[];
  readonly isAdmin: boolean;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const updateEvent = (event: CalendarEventSummary, formData: FormData) =>
    startTransition(async () => {
      const startsAt = String(formData.get("startsAt") ?? "");
      const endsAt = String(formData.get("endsAt") ?? "");
      const result = await updateCalendarEventAction({
        attendeeIds: event.attendeeIds,
        description: String(formData.get("description") ?? "").trim() || null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        eventId: event.id,
        idempotencyKey: crypto.randomUUID(),
        location: String(formData.get("location") ?? "").trim() || null,
        projectId: event.projectId,
        startsAt: new Date(startsAt).toISOString(),
        title: String(formData.get("title") ?? "").trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });

  const deleteEvent = (eventId: string) =>
    startTransition(async () => {
      const result = await deleteCalendarEventAction({
        eventId,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });

  return (
    <section className="panel">
      <div className="panel-h">
        <h2>Events this month</h2>
      </div>
      {error ? (
        <p className="panel-b error" role="alert">
          {error}
        </p>
      ) : null}
      {events.length ? (
        <div className="panel-b feed lined">
          {events.map((event) => (
            <details className="calendar-event-row" key={event.id}>
              <summary className="row">
                <span aria-hidden="true" className="pdot" />
                <span className="trunc grow">{event.title}</span>
                <time
                  className="num faint"
                  dateTime={event.startsAt.toISOString()}
                >
                  {event.startsAt.toLocaleString()}
                </time>
              </summary>
              {isAdmin ? (
                <form
                  action={(formData) => updateEvent(event, formData)}
                  className="panel-b stack"
                >
                  <label className="field">
                    <span>Title</span>
                    <WorkspaceInput
                      className="input"
                      defaultValue={event.title}
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
                        defaultValue={toLocalInputValue(event.startsAt)}
                        name="startsAt"
                        required
                        type="datetime-local"
                      />
                    </label>
                    <label className="field">
                      <span>Ends</span>
                      <WorkspaceInput
                        className="input"
                        defaultValue={
                          event.endsAt ? toLocalInputValue(event.endsAt) : ""
                        }
                        name="endsAt"
                        type="datetime-local"
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Location</span>
                    <WorkspaceInput
                      className="input"
                      defaultValue={event.location ?? ""}
                      maxLength={160}
                      name="location"
                    />
                  </label>
                  <label className="field">
                    <span>Description</span>
                    <WorkspaceTextarea
                      className="input"
                      defaultValue={event.description ?? ""}
                      maxLength={1000}
                      name="description"
                      rows={2}
                    />
                  </label>
                  <div className="acts">
                    <WorkspaceButton
                      className="btn btn-primary btn-sm"
                      disabled={pending}
                      type="submit"
                    >
                      Save event
                    </WorkspaceButton>
                    <WorkspaceButton
                      className="btn btn-secondary btn-sm"
                      disabled={pending}
                      onClick={() => deleteEvent(event.id)}
                      type="button"
                    >
                      Delete
                    </WorkspaceButton>
                  </div>
                </form>
              ) : (
                <p className="muted">
                  {event.location ?? event.description ?? "Workspace event"}
                </p>
              )}
            </details>
          ))}
        </div>
      ) : (
        <div className="panel-b muted">No events scheduled this month.</div>
      )}
    </section>
  );
};
