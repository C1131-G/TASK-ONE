import { expect, it } from "bun:test";

import {
  businessDeadline,
  businessElapsedMs,
} from "../../src/server/work/business-time";
import type { BusinessCalendar } from "../../src/server/work/business-time";

const HOUR_MS = 60 * 60 * 1000;
const at = (iso: string): Date => new Date(iso);

// Monday to Friday, 09:00 to 18:00.
const weekdays = (timeZone: string): BusinessCalendar => ({
  days: [1, 2, 3, 4, 5],
  endMinute: 18 * 60,
  startMinute: 9 * 60,
  timeZone,
});

const utc = weekdays("UTC");

it("counts only business hours between two instants", () => {
  // Monday 2026-10-12.
  expect(
    businessElapsedMs(
      at("2026-10-12T10:00:00Z"),
      at("2026-10-12T12:30:00Z"),
      utc
    )
  ).toBe(2.5 * HOUR_MS);
  expect(
    businessElapsedMs(
      at("2026-10-12T07:00:00Z"),
      at("2026-10-12T20:00:00Z"),
      utc
    )
  ).toBe(9 * HOUR_MS);
  expect(
    businessElapsedMs(
      at("2026-10-12T20:00:00Z"),
      at("2026-10-13T07:00:00Z"),
      utc
    )
  ).toBe(0);
});

it("skips nights and weekends when counting elapsed time", () => {
  // Friday 17:00 to Monday 10:00 is one hour on Friday plus one on Monday.
  expect(
    businessElapsedMs(
      at("2026-10-16T17:00:00Z"),
      at("2026-10-19T10:00:00Z"),
      utc
    )
  ).toBe(2 * HOUR_MS);
  // A whole week of business days.
  expect(
    businessElapsedMs(
      at("2026-10-12T00:00:00Z"),
      at("2026-10-19T00:00:00Z"),
      utc
    )
  ).toBe(5 * 9 * HOUR_MS);
});

it("reports negative elapsed time when the end comes first", () => {
  expect(
    businessElapsedMs(
      at("2026-10-12T12:00:00Z"),
      at("2026-10-12T10:00:00Z"),
      utc
    )
  ).toBe(-2 * HOUR_MS);
});

it("adds business time to an instant inside the working day", () => {
  expect(
    businessDeadline(at("2026-10-12T10:00:00Z"), 120, utc).toISOString()
  ).toBe("2026-10-12T12:00:00.000Z");
  expect(
    businessDeadline(at("2026-10-12T10:00:00Z"), 0, utc).toISOString()
  ).toBe("2026-10-12T10:00:00.000Z");
});

it("rolls a deadline over the night", () => {
  // Monday 17:00 plus two hours: one hour left on Monday, one on Tuesday.
  expect(
    businessDeadline(at("2026-10-12T17:00:00Z"), 120, utc).toISOString()
  ).toBe("2026-10-13T10:00:00.000Z");
  // A deadline that lands exactly on closing time stays on that day.
  expect(
    businessDeadline(at("2026-10-12T16:00:00Z"), 120, utc).toISOString()
  ).toBe("2026-10-12T18:00:00.000Z");
});

it("rolls a deadline over the weekend", () => {
  // Friday 17:00 plus two hours lands on Monday 10:00.
  expect(
    businessDeadline(at("2026-10-16T17:00:00Z"), 120, utc).toISOString()
  ).toBe("2026-10-19T10:00:00.000Z");
  // Starting on a Saturday waits for Monday's opening.
  expect(
    businessDeadline(at("2026-10-17T12:00:00Z"), 60, utc).toISOString()
  ).toBe("2026-10-19T10:00:00.000Z");
  // Starting before opening waits for opening.
  expect(
    businessDeadline(at("2026-10-12T05:00:00Z"), 30, utc).toISOString()
  ).toBe("2026-10-12T09:30:00.000Z");
});

it("spans several days for a long target", () => {
  // 20 business hours from Monday 09:00 is Wednesday 13:00 (9 + 9 + 2).
  expect(
    businessDeadline(at("2026-10-12T09:00:00Z"), 20 * 60, utc).toISOString()
  ).toBe("2026-10-14T11:00:00.000Z");
});

it("keeps deadline and elapsed time consistent with each other", () => {
  const start = at("2026-10-15T15:20:00Z");
  for (const minutes of [1, 45, 300, 1440, 4800]) {
    const due = businessDeadline(start, minutes, utc);
    expect(businessElapsedMs(start, due, utc)).toBe(minutes * 60_000);
  }
});

it("works in the company's time zone, not UTC", () => {
  // 09:00 to 18:00 in Kolkata (UTC+5:30) is 03:30 to 12:30 UTC.
  const kolkata = weekdays("Asia/Kolkata");
  expect(
    businessElapsedMs(
      at("2026-10-12T00:00:00Z"),
      at("2026-10-13T00:00:00Z"),
      kolkata
    )
  ).toBe(9 * HOUR_MS);
  expect(
    businessDeadline(at("2026-10-12T11:30:00Z"), 120, kolkata).toISOString()
  ).toBe("2026-10-13T04:30:00.000Z");
  // A late-evening UTC instant is already the next local day in Kolkata.
  expect(
    businessDeadline(at("2026-10-16T22:30:00Z"), 60, kolkata).toISOString()
  ).toBe("2026-10-19T04:30:00.000Z");
});

it("handles a zone behind UTC across the date line", () => {
  const losAngeles = weekdays("America/Los_Angeles");
  // Monday 2026-10-12 09:00 PDT is 16:00 UTC.
  expect(
    businessDeadline(at("2026-10-12T15:00:00Z"), 60, losAngeles).toISOString()
  ).toBe("2026-10-12T17:00:00.000Z");
});

it("follows clock changes: a spring-forward day is 23 hours long", () => {
  const allDay: BusinessCalendar = {
    days: [0, 1, 2, 3, 4, 5, 6],
    endMinute: 1440,
    startMinute: 0,
    timeZone: "America/New_York",
  };
  // 2026-03-08 in New York runs 05:00Z to 04:00Z the next day.
  expect(
    businessElapsedMs(
      at("2026-03-08T05:00:00Z"),
      at("2026-03-09T04:00:00Z"),
      allDay
    )
  ).toBe(23 * HOUR_MS);
  // The fall-back day is 25 hours long.
  expect(
    businessElapsedMs(
      at("2026-11-01T04:00:00Z"),
      at("2026-11-02T05:00:00Z"),
      allDay
    )
  ).toBe(25 * HOUR_MS);
});

it("keeps the local opening time across a clock change", () => {
  const newYork = weekdays("America/New_York");
  // Friday 17:30 EST leaves 30 minutes; the rest waits for Monday 09:00 EDT
  // (13:00Z, an hour earlier in UTC than the same local time before the change).
  expect(
    businessDeadline(at("2026-03-06T22:30:00Z"), 60, newYork).toISOString()
  ).toBe("2026-03-09T13:30:00.000Z");
  // Friday 17:00 EST to Monday 10:00 EDT counts one business hour each side.
  expect(
    businessElapsedMs(
      at("2026-03-06T22:00:00Z"),
      at("2026-03-09T14:00:00Z"),
      newYork
    )
  ).toBe(2 * HOUR_MS);
});

it("treats an empty calendar as plain elapsed time", () => {
  const none: BusinessCalendar = { ...utc, days: [] };
  expect(
    businessDeadline(at("2026-10-12T10:00:00Z"), 90, none).toISOString()
  ).toBe("2026-10-12T11:30:00.000Z");
});

it("supports a partial-week calendar", () => {
  const tuesdayToThursday: BusinessCalendar = { ...utc, days: [2, 3, 4] };
  // Monday has no hours, so work starts Tuesday 09:00.
  expect(
    businessDeadline(
      at("2026-10-12T09:00:00Z"),
      60,
      tuesdayToThursday
    ).toISOString()
  ).toBe("2026-10-13T10:00:00.000Z");
  // Thursday evening waits until next Tuesday.
  expect(
    businessDeadline(
      at("2026-10-15T17:30:00Z"),
      60,
      tuesdayToThursday
    ).toISOString()
  ).toBe("2026-10-20T09:30:00.000Z");
});
