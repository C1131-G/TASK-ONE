import { describe, expect, it } from "bun:test";

import {
  shownUnreadCount,
  withNotificationsRead,
} from "../../features/notifications/inbox-read-state";

const READ_AT = "2026-10-20T12:00:00.000Z";
const items = [
  { id: "a", readAt: null },
  { id: "b", readAt: "2026-10-19T08:00:00.000Z" },
  { id: "c", readAt: null },
];

describe("withNotificationsRead", () => {
  it("marks one unread notification read", () => {
    expect(withNotificationsRead(items, { id: "a", readAt: READ_AT })).toEqual([
      { id: "a", readAt: READ_AT },
      { id: "b", readAt: "2026-10-19T08:00:00.000Z" },
      { id: "c", readAt: null },
    ]);
  });

  it("marks every unread notification read and keeps earlier read times", () => {
    expect(
      withNotificationsRead(items, { id: "all", readAt: READ_AT })
    ).toEqual([
      { id: "a", readAt: READ_AT },
      { id: "b", readAt: "2026-10-19T08:00:00.000Z" },
      { id: "c", readAt: READ_AT },
    ]);
  });
});

describe("shownUnreadCount", () => {
  it("subtracts notifications read before the server confirms", () => {
    const shown = withNotificationsRead(items, { id: "a", readAt: READ_AT });
    // 5 unread in total, two of them loaded, one marked read here.
    expect(shownUnreadCount(5, items, shown)).toBe(4);
    expect(shownUnreadCount(5, items, items)).toBe(5);
  });
});
