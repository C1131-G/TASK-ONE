import { expect, it } from "bun:test";

import {
  buildCalendar,
  escapeIcalText,
  foldIcalLine,
} from "../../src/server/calendar/ical";

const now = new Date("2026-03-01T10:00:00.000Z");

it("escapes backslashes, separators and line breaks in text values", () => {
  expect(escapeIcalText("a;b,c\\d")).toBe("a\\;b\\,c\\\\d");
  expect(escapeIcalText("one\r\ntwo\nthree\rfour")).toBe(
    "one\\ntwo\\nthree\\nfour"
  );
});

it("folds long lines at 75 octets without splitting a multi-byte character", () => {
  const line = `SUMMARY:${"é".repeat(60)}`;
  const folded = foldIcalLine(line);
  const physical = folded.split("\r\n");
  expect(physical.length).toBeGreaterThan(1);
  for (const [index, part] of physical.entries()) {
    expect(Buffer.byteLength(part, "utf-8")).toBeLessThanOrEqual(75);
    if (index > 0) {
      expect(part.startsWith(" ")).toBe(true);
    }
  }
  const unfolded = folded.replaceAll("\r\n ", "");
  expect(unfolded).toBe(line);
  expect(foldIcalLine("SHORT:line")).toBe("SHORT:line");
});

it("writes date-only task due dates as all-day values and timed events in UTC", () => {
  const text = buildCalendar({
    events: [
      {
        description: "Bring slides",
        endsAt: new Date("2026-03-05T10:30:00.000Z"),
        id: "11111111-1111-4111-8111-111111111111",
        location: "Room 4, Floor 2",
        startsAt: new Date("2026-03-05T09:00:00.000Z"),
        title: "Planning; kickoff",
      },
    ],
    name: "Taskora",
    now,
    tasks: [
      {
        description: null,
        dueDate: "2026-03-31",
        id: "22222222-2222-4222-8222-222222222222",
        projectName: "Apollo",
        title: "Ship it",
      },
    ],
  });

  expect(text.endsWith("\r\n")).toBe(true);
  expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
  expect(text).toContain("PRODID:-//Taskora//Calendar feed//EN\r\n");
  expect(text).toContain("DTSTART;VALUE=DATE:20260331\r\n");
  expect(text).toContain("DTEND;VALUE=DATE:20260401\r\n");
  expect(text).toContain(
    "UID:task-22222222-2222-4222-8222-222222222222@taskora\r\n"
  );
  expect(text).toContain("SUMMARY:Ship it\r\n");
  expect(text).toContain("DTSTART:20260305T090000Z\r\n");
  expect(text).toContain("DTEND:20260305T103000Z\r\n");
  expect(text).toContain("SUMMARY:Planning\\; kickoff\r\n");
  expect(text).toContain("LOCATION:Room 4\\, Floor 2\r\n");
  expect(text).toContain("DTSTAMP:20260301T100000Z\r\n");
  expect(text.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
});

it("cannot be tricked into new properties by line breaks in titles", () => {
  const text = buildCalendar({
    events: [],
    name: "Taskora",
    now,
    tasks: [
      {
        description: "x\r\nATTENDEE:mailto:evil@example.com",
        dueDate: "2026-03-31",
        id: "33333333-3333-4333-8333-333333333333",
        projectName: "P",
        title: "Pwn\r\nEND:VEVENT\r\nBEGIN:VEVENT",
      },
    ],
  });
  const lines = text.split("\r\n");
  expect(lines.filter((line) => line === "BEGIN:VEVENT")).toHaveLength(1);
  expect(lines.some((line) => line.startsWith("ATTENDEE"))).toBe(false);
});

it("renders an empty feed as a valid calendar", () => {
  const text = buildCalendar({ events: [], name: "Taskora", now, tasks: [] });
  expect(text).not.toContain("BEGIN:VEVENT");
  expect(text).toContain("END:VCALENDAR\r\n");
});
