import { expect, it } from "bun:test";

import {
  MIN_FILL_MS,
  REPLAY_WINDOW_SECONDS,
  checkFormToken,
  issueFormToken,
  signInboundBody,
  verifyInboundRequest,
} from "../../src/server/intake/intake-guard";

const SECRET = "intake-test-secret-that-is-long-enough-1234";
const BODY = JSON.stringify({ subject: "Hello" });
const NOW = 1_800_000_000;

const signed = (timestamp: number, body = BODY, secret = SECRET) => ({
  rawBody: body,
  secret: SECRET,
  signature: signInboundBody(secret, String(timestamp), body),
  timestamp: String(timestamp),
});

it("accepts a fresh, correctly signed inbound request", () => {
  expect(verifyInboundRequest({ ...signed(NOW), nowSeconds: NOW })).toBe("ok");
});

it("rejects a signature made with another secret or over another body", () => {
  expect(
    verifyInboundRequest({
      ...signed(NOW, BODY, "another-secret-another-secret-123456"),
      nowSeconds: NOW,
    })
  ).toBe("invalid");
  expect(
    verifyInboundRequest({
      ...signed(NOW),
      nowSeconds: NOW,
      rawBody: `${BODY} `,
    })
  ).toBe("invalid");
});

it("rejects missing, malformed and wrong-length signatures without throwing", () => {
  for (const signature of ["", "zz", "abcd", "0".repeat(64), null]) {
    expect(
      verifyInboundRequest({
        ...signed(NOW),
        nowSeconds: NOW,
        signature,
      })
    ).toBe("invalid");
  }
});

it("rejects a replay outside the window, in either direction", () => {
  const old = NOW - REPLAY_WINDOW_SECONDS - 1;
  expect(verifyInboundRequest({ ...signed(old), nowSeconds: NOW })).toBe(
    "stale"
  );
  const future = NOW + REPLAY_WINDOW_SECONDS + 1;
  expect(verifyInboundRequest({ ...signed(future), nowSeconds: NOW })).toBe(
    "stale"
  );
  expect(
    verifyInboundRequest({
      ...signed(NOW - REPLAY_WINDOW_SECONDS),
      nowSeconds: NOW,
    })
  ).toBe("ok");
});

it("treats a non-numeric timestamp as invalid", () => {
  expect(
    verifyInboundRequest({
      nowSeconds: NOW,
      rawBody: BODY,
      secret: SECRET,
      signature: signInboundBody(SECRET, "abc", BODY),
      timestamp: "abc",
    })
  ).toBe("invalid");
});

it("checks form tokens for age, tampering and the form they were issued for", () => {
  const issuedAt = 1_800_000_000_000;
  const token = issueFormToken(SECRET, "slug-a", issuedAt);
  expect(checkFormToken(SECRET, "slug-a", token, issuedAt + 1000)).toBe(
    "too_fast"
  );
  expect(
    checkFormToken(SECRET, "slug-a", token, issuedAt + MIN_FILL_MS + 1)
  ).toBe("ok");
  expect(checkFormToken(SECRET, "slug-b", token, issuedAt + 60_000)).toBe(
    "invalid"
  );
  expect(
    checkFormToken(SECRET, "slug-a", `1.${token}`, issuedAt + 60_000)
  ).toBe("invalid");
  expect(checkFormToken(SECRET, "slug-a", "", issuedAt + 60_000)).toBe(
    "invalid"
  );
  expect(
    checkFormToken(SECRET, "slug-a", token, issuedAt + 48 * 60 * 60 * 1000)
  ).toBe("expired");
});
