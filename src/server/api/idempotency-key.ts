import { Effect } from "effect";

import { IDEMPOTENCY_KEY_HEADER } from "../../mobile-api/idempotency";
import { AppError } from "../core/action-result";

// Matches the bounds Idempotency.run enforces, so a bad key is refused before
// any work starts.
const MIN_KEY_LENGTH = 8;
const MAX_KEY_LENGTH = 128;

// Every write the app sends carries a key it reuses on retry, so a dropped
// connection never creates the same record twice.
export const readIdempotencyKey = (
  headers: Headers
): Effect.Effect<string, AppError> => {
  const key = headers.get(IDEMPOTENCY_KEY_HEADER)?.trim() ?? "";
  if (key.length >= MIN_KEY_LENGTH && key.length <= MAX_KEY_LENGTH) {
    return Effect.succeed(key);
  }
  const message = key
    ? `Send an ${IDEMPOTENCY_KEY_HEADER} of ${MIN_KEY_LENGTH} to ${MAX_KEY_LENGTH} characters.`
    : `Send an ${IDEMPOTENCY_KEY_HEADER} header with every write.`;
  return Effect.fail(
    new AppError({
      code: "VALIDATION_FAILED",
      fieldErrors: { [IDEMPOTENCY_KEY_HEADER]: message },
      message,
    })
  );
};
