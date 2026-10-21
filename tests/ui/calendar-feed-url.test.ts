import { expect, it } from "bun:test";

import { calendarFeedUrl } from "../../features/settings/calendar-feed-url";

it("builds an .ics feed address from the site origin and the secret token", () => {
  expect(calendarFeedUrl("https://metsys.example", "abc_DEF-123")).toBe(
    "https://metsys.example/api/calendar/abc_DEF-123.ics"
  );
});

it("ignores a trailing slash on the origin", () => {
  expect(calendarFeedUrl("https://metsys.example/", "tok")).toBe(
    "https://metsys.example/api/calendar/tok.ics"
  );
});
