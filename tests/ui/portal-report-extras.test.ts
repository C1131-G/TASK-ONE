import { expect, it } from "bun:test";

import { withReportExtras } from "@/features/portal/portal-report-extras";

const context = {
  language: "en-GB",
  path: "/portal/new",
  pixelRatio: 2,
  timeZone: "Asia/Kolkata",
  userAgent: "Firefox/140.0",
  viewportHeight: 800,
  viewportWidth: 1280,
};

const report = (description: string | null) => ({
  description,
  title: "Crash",
});

it("adds the technical details only when the reporter agreed", () => {
  const base = report(null);
  const sent = withReportExtras(base, {
    context,
    screenshotDescription: undefined,
    sendContext: true,
  });
  expect(sent).toMatchObject({ browserContext: context });
  const optedOut = withReportExtras(base, {
    context,
    screenshotDescription: undefined,
    sendContext: false,
  });
  expect(optedOut).not.toHaveProperty("browserContext");
  expect(
    withReportExtras(base, {
      context: undefined,
      screenshotDescription: undefined,
      sendContext: true,
    })
  ).not.toHaveProperty("browserContext");
});

it("appends the screenshot's text alternative to the description", () => {
  const withNote = withReportExtras(report("It breaks on save"), {
    context: undefined,
    screenshotDescription: "A red error banner",
    sendContext: false,
  });
  expect(withNote.description).toBe(
    "It breaks on save\n\nScreenshot: A red error banner"
  );
  const alone = withReportExtras(report(null), {
    context: undefined,
    screenshotDescription: "A red error banner",
    sendContext: false,
  });
  expect(alone.description).toBe("Screenshot: A red error banner");
  expect(
    withReportExtras(report(null), {
      context: undefined,
      screenshotDescription: undefined,
      sendContext: false,
    }).description
  ).toBeNull();
});
