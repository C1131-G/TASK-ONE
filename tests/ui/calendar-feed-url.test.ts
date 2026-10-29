import { expect, it } from "bun:test";

import { calendarFeedUrl } from "../../features/settings/calendar-feed-url";

it("builds an .ics feed address from the site origin and the secret token", () => {
  expect(calendarFeedUrl("https://taskora.example", "abc_DEF-123")).toBe(
    "https://taskora.example/api/calendar/abc_DEF-123.ics"
  );
});

it("ignores a trailing slash on the origin", () => {
  expect(calendarFeedUrl("https://taskora.example/", "tok")).toBe(
    "https://taskora.example/api/calendar/tok.ics"
  );
});
