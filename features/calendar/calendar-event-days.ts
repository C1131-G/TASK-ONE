import { dayKeyIn } from "@/lib/format-date";

// Task due dates are calendar days stored as UTC dates and keep their key.
// Events are instants, so they belong to the day the viewer sees them on.
const eventsByLocalDay = <Event extends { readonly startsAt: Date }>(
  events: readonly Event[],
  timeZone?: string
): Map<string, Event[]> => {
  const days = new Map<string, Event[]>();
  for (const event of events) {
    const key = dayKeyIn(event.startsAt, timeZone);
    const existing = days.get(key) ?? [];
    existing.push(event);
    days.set(key, existing);
  }
  return days;
};

export { eventsByLocalDay };
