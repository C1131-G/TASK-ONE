import { Schema } from "effect";

import { inboundEmailSecret } from "@/src/server/intake/intake-config";
import { verifyInboundRequest } from "@/src/server/intake/intake-guard";
import {
  appErrorResponse,
  failureResponse,
  json,
  notFoundResponse,
  readBoundedBytes,
  runIntake,
} from "@/src/server/intake/intake-http";

// A mail gateway posts one normalised message per request. The shared secret
// never travels: each request carries a timestamp and an HMAC-SHA256 over
// `inbound.<timestamp>.<raw body>`. Raw MIME is not accepted or parsed.
const MAX_BODY_BYTES = 64 * 1024;
const MS_PER_SECOND = 1000;

const PayloadSchema = Schema.Struct({
  from: Schema.String.check(Schema.isMaxLength(998)),
  messageId: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(998)
  ),
  slug: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  subject: Schema.String.check(Schema.isMaxLength(10_000)),
  text: Schema.String.check(Schema.isMaxLength(MAX_BODY_BYTES)),
});

const rejected = (): Response =>
  failureResponse(401, "UNAUTHENTICATED", "The request could not be verified.");

const badRequest = (): Response =>
  failureResponse(400, "BAD_REQUEST", "The message payload is not valid.");

// Gateways name the header either way; accept both spellings.
const withMessageId = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  const record = value as Record<string, unknown>;
  return { ...record, messageId: record["messageId"] ?? record["message-id"] };
};

// eslint-disable-next-line func-style -- Next route handler remains a named export.
export async function POST(request: Request): Promise<Response> {
  const secret = inboundEmailSecret();
  if (!secret) {
    // Email intake is off; look like any other missing route.
    return notFoundResponse();
  }
  const bytes = await readBoundedBytes(request, MAX_BODY_BYTES);
  if (!bytes) {
    return failureResponse(413, "TOO_LARGE", "The message is too large.");
  }
  const rawBody = new TextDecoder().decode(bytes);
  const verdict = verifyInboundRequest({
    nowSeconds: Math.floor(Date.now() / MS_PER_SECOND),
    rawBody,
    secret,
    signature: request.headers.get("x-intake-signature"),
    timestamp: request.headers.get("x-intake-timestamp"),
  });
  if (verdict !== "ok") {
    return rejected();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return badRequest();
  }
  const decoded = Schema.decodeUnknownExit(PayloadSchema)(
    withMessageId(parsed)
  );
  if (decoded._tag !== "Success") {
    return badRequest();
  }
  const outcome = await runIntake((service) =>
    service.submitEmail(decoded.value)
  );
  if (!outcome.ok) {
    return appErrorResponse(outcome.error);
  }
  return json(outcome.value.duplicate ? 200 : 201, outcome.value);
}
