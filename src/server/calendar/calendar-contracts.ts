import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";

export interface CalendarEventInput {
  readonly attendeeIds: readonly string[];
  readonly description: string | null;
  readonly endsAt: Date | null;
  readonly location: string | null;
  readonly projectId: string | null;
  readonly startsAt: Date;
  readonly title: string;
}

export interface CalendarEventSummary extends CalendarEventInput {
  readonly id: string;
  readonly createdById: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const CalendarEventSummarySchema = Schema.Struct({
  attendeeIds: Schema.Array(Schema.String),
  createdAt: Schema.String,
  createdById: Schema.String,
  description: Schema.NullOr(Schema.String),
  endsAt: Schema.NullOr(Schema.DateFromString),
  id: Schema.String,
  location: Schema.NullOr(Schema.String),
  projectId: Schema.NullOr(Schema.String),
  startsAt: Schema.DateFromString,
  title: Schema.String,
  updatedAt: Schema.String,
});
export const CalendarEventListSchema = Schema.Array(CalendarEventSummarySchema);
export class CalendarManagement extends Context.Service<
  CalendarManagement,
  {
    readonly listEvents: (
      userId: string,
      from: Date,
      to: Date
    ) => Effect.Effect<readonly CalendarEventSummary[], AppError>;
    readonly createEvent: (
      userId: string,
      input: CalendarEventInput
    ) => Effect.Effect<CalendarEventSummary, AppError>;
    readonly updateEvent: (
      userId: string,
      eventId: string,
      input: CalendarEventInput
    ) => Effect.Effect<CalendarEventSummary, AppError>;
    readonly deleteEvent: (
      userId: string,
      eventId: string
    ) => Effect.Effect<void, AppError>;
  }
>()("metsys/server/CalendarManagement") {}
