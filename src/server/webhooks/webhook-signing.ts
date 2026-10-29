import { createHmac, timingSafeEqual } from "node:crypto";

// Receivers verify `X-Taskora-Signature` as v1=HMAC-SHA256(secret, "<timestamp>.<raw body>")
// and should reject timestamps outside a few minutes to stop replays.

export const SIGNATURE_TOLERANCE_SECONDS = 300;

export const signWebhook = (
  secret: string,
  timestampSeconds: number,
  body: string
): string =>
  `v1=${createHmac("sha256", secret).update(`${timestampSeconds}.${body}`).digest("hex")}`;

export const verifyWebhookSignature = (
  secret: string,
  timestampSeconds: number,
  body: string,
  signature: string,
  nowSeconds: number
): boolean => {
  if (Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }
  const expected = Buffer.from(signWebhook(secret, timestampSeconds, body));
  const received = Buffer.from(signature);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
};
