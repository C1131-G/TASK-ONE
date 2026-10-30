import { Effect } from "effect";

import {
  GithubIngest,
  GithubIngestLive,
} from "@/src/server/github/github-ingest";
import type { GithubIngestOutcome } from "@/src/server/github/github-ingest";
import { checkGithubDeliveryRate } from "@/src/server/github/github-rate-limit";
import {
  failureResponse,
  json,
  readBoundedBytes,
} from "@/src/server/intake/intake-http";

// Public on purpose: GitHub cannot sign in. Every delivery proves itself with
// an HMAC of the exact request bytes under the connection's own secret, so an
// unknown repository, a disabled connection and a wrong signature all get the
// same refusal.
const MAX_BODY_BYTES = 512 * 1024;

const respond = (outcome: GithubIngestOutcome): Response => {
  switch (outcome.status) {
    case "rejected": {
      return failureResponse(
        401,
        "UNAUTHENTICATED",
        "The delivery could not be verified."
      );
    }
    case "bad_request": {
      return failureResponse(400, "BAD_REQUEST", "The delivery is not valid.");
    }
    default: {
      return json(200, outcome);
    }
  }
};

// eslint-disable-next-line func-style -- Next route handler remains a named export.
export async function POST(request: Request): Promise<Response> {
  const rate = checkGithubDeliveryRate(request.headers);
  if (!rate.allowed) {
    return failureResponse(
      429,
      "RATE_LIMITED",
      "Too many deliveries. Try again later.",
      {},
      { "retry-after": String(rate.retryAfterSeconds) }
    );
  }
  const rawBody = await readBoundedBytes(request, MAX_BODY_BYTES);
  if (!rawBody) {
    return failureResponse(413, "TOO_LARGE", "The delivery is too large.");
  }
  const outcome = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* ingest() {
        const service = yield* GithubIngest;
        return yield* service.receive({
          deliveryId: request.headers.get("x-github-delivery"),
          event: request.headers.get("x-github-event"),
          rawBody,
          signature: request.headers.get("x-hub-signature-256"),
        });
      }).pipe(
        Effect.match({
          onFailure: () => null,
          onSuccess: (value) => value,
        })
      ),
      GithubIngestLive
    )
  );
  if (!outcome) {
    return failureResponse(
      503,
      "UNAVAILABLE",
      "The delivery could not be processed. Try again later.",
      {},
      { "retry-after": "60" }
    );
  }
  return respond(outcome);
}
