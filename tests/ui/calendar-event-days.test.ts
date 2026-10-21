import { afterAll, describe, expect, it } from "bun:test";

import { restoreRuntimeZone } from "./support/viewer-zone";

// Loaded after the viewer zone is set, so runtime-zone formatters use it.
const { eventsByLocalDay } =
  await import("../../features/calendar/calendar-event-days");

afterAll(restoreRuntimeZone);

// 01:00 on 21 October in Kuala Lumpur, still 20 October in UTC.
const lateEvent = { id: "late", startsAt: new Date("2026-10-20T17:00:00Z") };
const noonEvent = { id: "noon", startsAt: new Date("2026-10-21T04:00:00Z") };

describe("eventsByLocalDay", () => {
  it("files timed events under the viewer's local day", () => {
    const days = eventsByLocalDay([lateEvent, noonEvent]);
    expect(days.get("2026-10-21")?.map(({ id }) => id)).toEqual([
      "late",
      "noon",
    ]);
    expect(days.has("2026-10-20")).toBe(false);
  });

  it("files events under the day of an explicit time zone", () => {
    const days = eventsByLocalDay([lateEvent, noonEvent], "UTC");
    expect(days.get("2026-10-20")?.map(({ id }) => id)).toEqual(["late"]);
    expect(days.get("2026-10-21")?.map(({ id }) => id)).toEqual(["noon"]);
  });
});
