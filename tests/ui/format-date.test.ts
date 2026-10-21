import { afterAll, describe, expect, it } from "bun:test";

import { VIEWER_ZONE, restoreRuntimeZone } from "./support/viewer-zone";

// Loaded after the viewer zone is set, so runtime-zone formatters use it.
const { dayKeyIn, formatDate, formatDateTime, formatRelative } =
  await import("../../lib/format-date");

// A viewer in Kuala Lumpur (UTC+8) at 07:30 local time, while UTC is still
// on the previous day.
const MORNING_IN_KUALA_LUMPUR = new Date("2026-10-19T23:30:00.000Z");

// ICU may separate the time and day period with a narrow no-break space.
const NARROW_NO_BREAK_SPACE = String.fromCodePoint(0x20_2f);
const plain = (text: string): string =>
  text.replaceAll(NARROW_NO_BREAK_SPACE, " ");

afterAll(restoreRuntimeZone);

describe("dayKeyIn", () => {
  it("keys an instant by the viewer's local calendar day", () => {
    expect(dayKeyIn(MORNING_IN_KUALA_LUMPUR)).toBe("2026-10-20");
  });

  it("keys an instant by an explicit time zone", () => {
    expect(dayKeyIn(MORNING_IN_KUALA_LUMPUR, "UTC")).toBe("2026-10-19");
    expect(dayKeyIn(new Date("2026-10-20T17:00:00.000Z"), VIEWER_ZONE)).toBe(
      "2026-10-21"
    );
  });
});

describe("formatDate", () => {
  it("formats an instant on the viewer's local day", () => {
    expect(formatDate(MORNING_IN_KUALA_LUMPUR.toISOString())).toBe(
      "Oct 20, 2026"
    );
  });

  it("keeps a date-only value on its own calendar day in every zone", () => {
    expect(formatDate("2026-10-19")).toBe("Oct 19, 2026");
    expect(formatDate("2026-10-19", "America/Los_Angeles")).toBe(
      "Oct 19, 2026"
    );
  });

  it("formats in an explicit time zone", () => {
    expect(formatDate(MORNING_IN_KUALA_LUMPUR, "UTC")).toBe("Oct 19, 2026");
  });

  it("returns an empty string for an unreadable value", () => {
    expect(formatDate("not a date")).toBe("");
  });
});

describe("formatDateTime", () => {
  it("formats the viewer's local date and time", () => {
    expect(plain(formatDateTime(MORNING_IN_KUALA_LUMPUR))).toBe(
      "Oct 20, 2026, 7:30 AM"
    );
  });

  it("formats in an explicit time zone", () => {
    expect(plain(formatDateTime(MORNING_IN_KUALA_LUMPUR, "UTC"))).toBe(
      "Oct 19, 2026, 11:30 PM"
    );
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-10-20T12:00:00.000Z");

  it("says just now for the last minute", () => {
    expect(formatRelative("2026-10-20T11:59:30.000Z", now)).toBe("just now");
  });

  it("counts minutes, hours and days in the past", () => {
    expect(formatRelative("2026-10-20T11:55:00.000Z", now)).toBe(
      "5 minutes ago"
    );
    expect(formatRelative("2026-10-20T09:00:00.000Z", now)).toBe("3 hours ago");
    expect(formatRelative("2026-10-19T12:00:00.000Z", now)).toBe("yesterday");
  });

  it("counts toward the future", () => {
    expect(formatRelative("2026-10-20T14:00:00.000Z", now)).toBe("in 2 hours");
  });

  it("falls back to the date after a week", () => {
    expect(formatRelative("2026-10-01T12:00:00.000Z", now, "UTC")).toBe(
      "Oct 1, 2026"
    );
  });
});
