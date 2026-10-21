import { describe, expect, it } from "bun:test";

import {
  isChannelAvailable,
  preferenceMap,
  preferenceOn,
} from "../../features/notifications/notification-preference-state";

describe("preferenceOn", () => {
  it("defaults in-app and push to on and email to off", () => {
    const saved = preferenceMap([]);

    expect(preferenceOn(saved, "in-app", "comment")).toBe(true);
    expect(preferenceOn(saved, "web-push", "comment")).toBe(true);
    expect(preferenceOn(saved, "email", "comment")).toBe(false);
  });

  it("uses a saved choice over the default", () => {
    const saved = preferenceMap([
      { channel: "in-app", enabled: false, eventType: "comment" },
      { channel: "email", enabled: true, eventType: "comment" },
    ]);

    expect(preferenceOn(saved, "in-app", "comment")).toBe(false);
    expect(preferenceOn(saved, "email", "comment")).toBe(true);
    expect(preferenceOn(saved, "email", "mention")).toBe(false);
  });
});

describe("isChannelAvailable", () => {
  it("offers email only for events that can be emailed", () => {
    expect(isChannelAvailable("email", "mention")).toBe(true);
    expect(isChannelAvailable("email", "assignment")).toBe(true);
    expect(isChannelAvailable("email", "comment")).toBe(true);
    expect(isChannelAvailable("email", "update")).toBe(false);
    expect(isChannelAvailable("email", "due")).toBe(false);
    expect(isChannelAvailable("web-push", "due")).toBe(true);
  });
});
