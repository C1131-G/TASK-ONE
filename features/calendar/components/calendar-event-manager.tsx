/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { CalendarBlank } from "@phosphor-icons/react";

import { EmptyState } from "@/components/workspace/empty-state";
import { LocalTime } from "@/components/workspace/local-time";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import { CalendarEventEditForm } from "@/features/calendar/components/calendar-event-edit-form";
import { CalendarEventForm } from "@/features/calendar/components/calendar-event-form";
import type { CalendarEventSummary } from "@/src/server/calendar/calendar-contracts";

export const CalendarEventManager = ({
  events,
  isAdmin,
  period = "month",
}: {
  readonly events: readonly CalendarEventSummary[];
  readonly isAdmin: boolean;
  readonly period?: "month" | "week";
}) => (
  <section className="panel">
    <div className="panel-h">
      <h2>Events this {period}</h2>
    </div>
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
                <LocalTime className="num faint" value={event.startsAt} />
              </WorkspaceButton>
            }
          >
            {isAdmin ? (
              <CalendarEventEditForm event={event} />
            ) : (
              <p className="muted">
                {event.location ?? event.description ?? "Workspace event"}
              </p>
            )}
          </WorkspaceDisclosure>
        ))}
      </div>
    ) : (
      <EmptyState
        action={isAdmin ? <CalendarEventForm /> : null}
        description={
          isAdmin
            ? "Schedule a meeting, review or reminder so everyone sees it on the calendar."
            : "Workspace events your admins schedule appear here."
        }
        icon={CalendarBlank}
        title={`No events this ${period}`}
      />
    )}
  </section>
);
