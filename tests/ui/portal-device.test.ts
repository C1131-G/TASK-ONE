import { expect, test } from "bun:test";

import { describeDevice } from "@/features/portal/portal-device";

const CHROME_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.6778.33 Safari/537.36";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
const FIREFOX_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

test("names the browser and the system a session signed in from", () => {
  expect(describeDevice(CHROME_LINUX)).toBe("Chrome on Linux");
  expect(describeDevice(EDGE_WINDOWS)).toBe("Edge on Windows");
  expect(describeDevice(FIREFOX_MAC)).toBe("Firefox on macOS");
});

test("recognises phones before the desktop systems they imitate", () => {
  expect(describeDevice(SAFARI_IPHONE)).toBe("Safari on iOS");
  expect(describeDevice(CHROME_ANDROID)).toBe("Chrome on Android");
});

test("falls back to a generic name when there is no browser string", () => {
  expect(describeDevice(null)).toBe("Browser session");
  expect(describeDevice("   ")).toBe("Browser session");
});

test("keeps an unrecognised browser string short enough to display", () => {
  const unknown = "CustomClient/1.0 ".repeat(20);
  const label = describeDevice(unknown);

  expect(label.length).toBeLessThanOrEqual(60);
  expect(label.startsWith("CustomClient/1.0")).toBe(true);
});

test("names only the browser when the system is not recognised", () => {
  expect(describeDevice("Firefox/132.0")).toBe("Firefox");
});
