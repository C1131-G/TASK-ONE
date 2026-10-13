/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";
import { WorkspaceDateTimePicker } from "@/components/workspace/workspace-date-time-picker";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import {
  deleteCalendarEventAction,
  updateCalendarEventAction,
} from "@/features/calendar/calendar-actions";
import type { CalendarEventSummary } from "@/src/server/calendar/calendar-contracts";

const toLocalInputValue = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export const CalendarEventManager = ({
  events,
  isAdmin,
  period = "month",
}: {
  readonly events: readonly CalendarEventSummary[];
  readonly isAdmin: boolean;
  readonly period?: "month" | "week";
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const updateEvent = (event: CalendarEventSummary, formData: FormData) => {
    const startsAt = String(formData.get("startsAt") ?? "");
    const endsAt = String(formData.get("endsAt") ?? "");
    if (!startsAt) {
      setError("Choose a start time.");
      return;
    }
    setError(null);
    startTransition(async () => {
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
      router.refresh();
    });
  };

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
        <h2>Events this {period}</h2>
      </div>
      {error ? (
        <p className="panel-b error" role="alert">
          {error}
        </p>
      ) : null}
      {events.length ? (
        <div className="panel-b feed lined">
          {events.map((event) => (
            <WorkspaceDisclosure
              description={
                isAdmin
                  ? "View or update this workspace calendar event."
                  : "View this workspace calendar event."
              }
              key={event.id}
              title={event.title}
              trigger={
                <WorkspaceButton
                  className="row w-full justify-start text-left"
                  type="button"
                >
                  <span aria-hidden="true" className="pdot" />
                  <span className="trunc grow">{event.title}</span>
                  <time
                    className="num faint"
                    dateTime={event.startsAt.toISOString()}
                  >
                    {event.startsAt.toLocaleString()}
                  </time>
                </WorkspaceButton>
              }
            >
              {isAdmin ? (
                <form
                  action={(formData) => updateEvent(event, formData)}
                  className="panel-b stack"
                >
                  <label
                    className="field"
                    htmlFor={`event-${event.id}-field-116`}
                  >
                    <span>Title</span>
                    <WorkspaceInput
                      className="input"
                      defaultValue={event.title}
                      maxLength={160}
                      name="title"
                      required
                      id={`event-${event.id}-field-116`}
                    />
                  </label>
                  <div className="row">
                    <label
                      className="field"
                      htmlFor={`event-${event.id}-field-127`}
                    >
                      <span>Starts</span>
                      <WorkspaceDateTimePicker
                        ariaLabel={`Choose start date and time for ${event.title}`}
                        className="input"
                        id={`event-${event.id}-field-127`}
                        name="startsAt"
                        required
                        defaultValue={toLocalInputValue(event.startsAt)}
                      />
                    </label>
                    <label
                      className="field"
                      htmlFor={`event-${event.id}-field-137`}
                    >
                      <span>Ends</span>
                      <WorkspaceDateTimePicker
                        ariaLabel={`Choose end date and time for ${event.title}`}
                        className="input"
                        id={`event-${event.id}-field-137`}
                        name="endsAt"
                        defaultValue={
                          event.endsAt ? toLocalInputValue(event.endsAt) : ""
                        }
                      />
                    </label>
                  </div>
                  <label
                    className="field"
                    htmlFor={`event-${event.id}-field-149`}
                  >
                    <span>Location</span>
                    <WorkspaceInput
                      className="input"
                      defaultValue={event.location ?? ""}
                      maxLength={160}
                      name="location"
                      id={`event-${event.id}-field-149`}
                    />
                  </label>
                  <label
                    className="field"
                    htmlFor={`event-${event.id}-field-174`}
                  >
                    <span>Description</span>
                    <WorkspaceTextarea
                      className="input"
                      defaultValue={event.description ?? ""}
                      maxLength={1000}
                      name="description"
                      rows={2}
                      id={`event-${event.id}-field-174`}
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
                    <WorkspaceConfirmDialog
                      confirmLabel="Delete event"
                      description={`Delete “${event.title}” from the workspace calendar?`}
                      onConfirm={() => deleteEvent(event.id)}
                      title="Delete calendar event"
                    >
                      <WorkspaceButton
                        className="btn btn-secondary btn-sm"
                        disabled={pending}
                        type="button"
                      >
                        Delete
                      </WorkspaceButton>
                    </WorkspaceConfirmDialog>
                  </div>
                </form>
              ) : (
                <p className="muted">
                  {event.location ?? event.description ?? "Workspace event"}
                </p>
              )}
            </WorkspaceDisclosure>
          ))}
        </div>
      ) : (
        <div className="panel-b muted">No events scheduled this month.</div>
      )}
    </section>
  );
};
