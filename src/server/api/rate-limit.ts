import { Effect } from "effect";

import { AppError } from "../core/action-result";

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT_PER_MINUTE = 300;
// Past this many tracked people, entries whose window ended are dropped.
const PRUNE_AFTER = 10_000;

interface Window {
  count: number;
  readonly resetAt: number;
}

// One fixed window per person, held in this server process. It stops a runaway
// app or a stolen token from hammering one instance; the reverse proxy still
// owns the limit across instances (see docs/mobile-api.md).
const windows = new Map<string, Window>();

const limitPerMinute = (): number => {
  const configured = Number(process.env["MOBILE_API_RATE_LIMIT_PER_MINUTE"]);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_LIMIT_PER_MINUTE;
};

export const resetRateLimits = (): void => {
  windows.clear();
};

const prune = (now: number): void => {
  if (windows.size < PRUNE_AFTER) {
    return;
  }
  for (const [key, window] of windows) {
    if (window.resetAt <= now) {
      windows.delete(key);
    }
  }
};

// Counts one request for a signed-in person. Only requests that passed the
// session check are counted, so a bad token never uses up anyone's budget.
export const consumeRateLimit = (
  userId: string,
  now: number = Date.now()
): Effect.Effect<void, AppError> =>
  Effect.suspend(() => {
    prune(now);
    const current = windows.get(userId);
    if (!current || current.resetAt <= now) {
      windows.set(userId, { count: 1, resetAt: now + WINDOW_MS });
      return Effect.void;
    }
    if (current.count >= limitPerMinute()) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000)
      );
      return Effect.fail(
        new AppError({
          code: "RATE_LIMITED",
          details: { retryAfterSeconds },
          message: "Too many requests. Try again in a moment.",
        })
      );
    }
    current.count += 1;
    return Effect.void;
  });
