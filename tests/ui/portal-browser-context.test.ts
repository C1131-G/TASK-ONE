import { expect, it } from "bun:test";

import {
  collectBrowserContext,
  describeBrowserContext,
} from "@/features/portal/portal-browser-context";

const source = {
  devicePixelRatio: 2,
  innerHeight: 800.4,
  innerWidth: 1280.6,
  language: "en-GB",
  pathname: "/portal/new",
  timeZone: "Asia/Kolkata",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0",
};

it("collects only the agreed non-sensitive facts", () => {
  expect(collectBrowserContext(source)).toEqual({
    language: "en-GB",
    path: "/portal/new",
    pixelRatio: 2,
    timeZone: "Asia/Kolkata",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0",
    viewportHeight: 800,
    viewportWidth: 1281,
  });
});

it("never carries a query string, fragment or extra fields", () => {
  const collected = collectBrowserContext({
    ...source,
    cookie: "session=secret",
    pathname: "/portal/new?token=abc#frag",
  } as typeof source);
  expect(collected?.path).toBe("/portal/new");
  expect(JSON.stringify(collected)).not.toContain("secret");
  expect(Object.keys(collected ?? {}).toSorted()).toEqual([
    "language",
    "path",
    "pixelRatio",
    "timeZone",
    "userAgent",
    "viewportHeight",
    "viewportWidth",
  ]);
});

it("removes markup and control characters and caps lengths to the server's", () => {
  const collected = collectBrowserContext({
    ...source,
    userAgent: `<b>${"x".repeat(400)}</b>\u0000`,
  });
  // oxlint-disable-next-line no-control-regex -- The control character is what must be gone.
  expect(collected?.userAgent).not.toMatch(/[<>\u0000]/u);
  expect(collected?.userAgent.length).toBeLessThanOrEqual(300);
});

it("sends nothing when the browser reports nothing usable", () => {
  expect(collectBrowserContext({ ...source, userAgent: "" })).toBeUndefined();
  expect(collectBrowserContext({ ...source, innerWidth: 0 })).toBeUndefined();
});

it("describes each detail in plain words for the disclosure", () => {
  const collected = collectBrowserContext(source);
  expect(collected && describeBrowserContext(collected)).toEqual([
    ["Page", "/portal/new"],
    ["Window size", "1281 × 800 pixels"],
    ["Screen sharpness", "2× pixel ratio"],
    ["Browser", "Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0"],
    ["Language", "en-GB"],
    ["Time zone", "Asia/Kolkata"],
  ]);
});
