import { expect, it } from "bun:test";

import { Schema } from "effect";

import { BrowserContextSchema } from "../../src/server/portal/portal-browser-context";

const valid = {
  language: "en-GB",
  path: "/portal/new",
  pixelRatio: 2,
  timeZone: "Asia/Kolkata",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0",
  viewportHeight: 800,
  viewportWidth: 1280,
};

const accepts = (value: unknown): boolean =>
  Schema.is(BrowserContextSchema)(value);

it("accepts the non-sensitive context a browser reports", () => {
  expect(accepts(valid)).toBe(true);
});

it("rejects HTML, control characters and oversized text", () => {
  expect(accepts({ ...valid, userAgent: "<script>alert(1)</script>" })).toBe(
    false
  );
  expect(accepts({ ...valid, language: "en\u0000" })).toBe(false);
  expect(accepts({ ...valid, userAgent: "a".repeat(301) })).toBe(false);
  expect(accepts({ ...valid, timeZone: "z".repeat(65) })).toBe(false);
});

it("accepts only a bare path, never a query string or another origin", () => {
  expect(accepts({ ...valid, path: "/portal/new?token=abc" })).toBe(false);
  expect(accepts({ ...valid, path: "/portal/new#frag" })).toBe(false);
  expect(accepts({ ...valid, path: "https://evil.example/x" })).toBe(false);
  expect(accepts({ ...valid, path: `/${"p".repeat(300)}` })).toBe(false);
});

it("rejects impossible numbers and unknown extra keys are dropped", () => {
  expect(accepts({ ...valid, viewportWidth: 0 })).toBe(false);
  expect(accepts({ ...valid, viewportWidth: 1.5 })).toBe(false);
  expect(accepts({ ...valid, viewportHeight: 100_000 })).toBe(false);
  expect(accepts({ ...valid, pixelRatio: 99 })).toBe(false);
  expect(accepts({ ...valid, pixelRatio: Number.NaN })).toBe(false);
  const decoded = Schema.decodeUnknownSync(BrowserContextSchema)({
    ...valid,
    cookie: "session=secret",
  });
  expect(decoded).not.toHaveProperty("cookie");
});
