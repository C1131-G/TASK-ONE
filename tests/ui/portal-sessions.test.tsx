import { expect, mock, test } from "bun:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// The real action reaches server-only code; rendering needs only its name.
mock.module("@/features/user/user-actions", () => ({
  revokeSessionAction: () => Promise.resolve({ ok: true }),
}));

const { PortalSessions } =
  await import("@/features/portal/components/portal-sessions");

interface TestSession {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

const session = (overrides: Partial<TestSession> = {}): TestSession => ({
  createdAt: "2026-10-20T08:00:00.000Z",
  expiresAt: "2026-10-20T16:00:00.000Z",
  id: "11111111-1111-4111-8111-111111111111",
  ipAddress: "203.0.113.7",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
  ...overrides,
});

const render = (sessions: readonly TestSession[]): string =>
  renderToStaticMarkup(createElement(PortalSessions, { sessions }));

test("lists each signed-in device with where it signed in from", () => {
  const markup = render([
    session(),
    session({
      id: "22222222-2222-4222-8222-222222222222",
      ipAddress: null,
      userAgent: null,
    }),
  ]);

  expect(markup).toContain("Firefox on Windows");
  expect(markup).toContain("203.0.113.7");
  expect(markup).toContain("Browser session");
  expect(markup).toContain("Unknown network");
});

test("shows a short device name instead of the raw browser string", () => {
  const markup = render([
    session({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.6778.33 Safari/537.36",
    }),
  ]);

  expect(markup).toContain("Chrome on Linux");
  expect(markup).not.toContain("HeadlessChrome");
});

test("offers a sign-out button named after the device for every session", () => {
  const markup = render([session()]);

  expect(markup).toContain("Sign out Firefox on Windows");
});

test("says so when no session is listed", () => {
  const markup = render([]);

  expect(markup).toContain("No active sessions");
  expect(markup).not.toContain("<button");
});
