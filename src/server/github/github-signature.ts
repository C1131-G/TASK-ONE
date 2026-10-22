import { createHmac, timingSafeEqual } from "node:crypto";

// GitHub signs the exact request bytes with HMAC-SHA256 and sends
// `X-Hub-Signature-256: sha256=<hex>`. Verification must use those bytes, not a
// re-serialised copy of the parsed JSON.

const PREFIX = "sha256=";
const HEX_DIGEST_LENGTH = 64;
const HEX_PATTERN = /^[0-9a-f]{64}$/u;

export const signGithubBody = (secret: string, rawBody: Uint8Array): string =>
  `${PREFIX}${createHmac("sha256", secret).update(rawBody).digest("hex")}`;

export const verifyGithubSignature = (
  secret: string,
  rawBody: Uint8Array,
  header: string | null
): boolean => {
  if (!header?.startsWith(PREFIX)) {
    return false;
  }
  const candidate = header.slice(PREFIX.length);
  // Anything but a full-length lowercase hex digest fails before the compare,
  // so the constant-time check always sees buffers of equal length.
  if (candidate.length !== HEX_DIGEST_LENGTH || !HEX_PATTERN.test(candidate)) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(candidate, "hex"));
};
