import { createHmac, timingSafeEqual } from "node:crypto";

// Bot and forgery checks for the public intake surfaces. Nothing here talks to
// a third party: the web form carries a signed issue time (too fast or too old
// is refused) and the inbound email endpoint takes an HMAC over the body.

// A person needs a few seconds to read and fill the form; a script does not.
export const MIN_FILL_MS = 3000;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
// Inbound signatures are valid this long either side of the request clock.
export const REPLAY_WINDOW_SECONDS = 300;

const SIGNATURE_LENGTH = 64;
const HEX_PATTERN = /^[0-9a-f]+$/u;
const DIGITS_PATTERN = /^\d{1,16}$/u;

const hmacHex = (secret: string, message: string): string =>
  createHmac("sha256", secret).update(message).digest("hex");

// Compares hex digests of equal, fixed length in constant time. Anything that
// is not a full-length hex digest is rejected before the comparison.
const sameDigest = (expected: string, candidate: string | null): boolean => {
  if (
    !candidate ||
    candidate.length !== SIGNATURE_LENGTH ||
    !HEX_PATTERN.test(candidate)
  ) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(candidate, "hex")
  );
};

export const signInboundBody = (
  secret: string,
  timestamp: string,
  rawBody: string
): string => hmacHex(secret, `inbound.${timestamp}.${rawBody}`);

export type InboundVerdict = "ok" | "invalid" | "stale";

export const verifyInboundRequest = (input: {
  readonly nowSeconds: number;
  readonly rawBody: string;
  readonly secret: string;
  readonly signature: string | null;
  readonly timestamp: string | null;
}): InboundVerdict => {
  const { timestamp } = input;
  if (!timestamp || !DIGITS_PATTERN.test(timestamp)) {
    return "invalid";
  }
  const expected = signInboundBody(input.secret, timestamp, input.rawBody);
  if (!sameDigest(expected, input.signature)) {
    return "invalid";
  }
  return Math.abs(input.nowSeconds - Number(timestamp)) > REPLAY_WINDOW_SECONDS
    ? "stale"
    : "ok";
};

const formMac = (secret: string, slug: string, issuedAt: string): string =>
  hmacHex(secret, `form.${slug}.${issuedAt}`);

export const issueFormToken = (
  secret: string,
  slug: string,
  nowMs: number
): string => {
  const issuedAt = String(nowMs);
  return `${issuedAt}.${formMac(secret, slug, issuedAt)}`;
};

export type FormTokenVerdict = "ok" | "invalid" | "too_fast" | "expired";

export const checkFormToken = (
  secret: string,
  slug: string,
  token: string,
  nowMs: number
): FormTokenVerdict => {
  const [issuedAt, mac, ...rest] = token.split(".");
  if (!issuedAt || !mac || rest.length > 0 || !DIGITS_PATTERN.test(issuedAt)) {
    return "invalid";
  }
  if (!sameDigest(formMac(secret, slug, issuedAt), mac)) {
    return "invalid";
  }
  const age = nowMs - Number(issuedAt);
  if (age < MIN_FILL_MS) {
    return "too_fast";
  }
  return age > MAX_FORM_AGE_MS ? "expired" : "ok";
};

// A keyed hash of the sender, so rate limits can count senders without the
// database holding their address.
export const hashSender = (secret: string, value: string): string =>
  hmacHex(secret, `sender.${value}`);
