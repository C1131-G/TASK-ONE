import { createFeedRateLimiter } from "../calendar/feed-rate-limit";
import type { RateLimitDecision } from "../calendar/feed-rate-limit";
import { resolveClientIp } from "../core/client-ip";

// GitHub delivers from a small set of shared addresses and sends a burst when
// many repositories change together, so the budget is generous. It exists to
// stop a flood of forged deliveries before each one costs a signature check
// and a connection lookup; it is a safety net, not a quota.
export const GITHUB_DELIVERY_RATE_LIMIT = 600;
const WINDOW_MS = 60_000;
const UNKNOWN_CLIENT = "unknown";

const limiter = createFeedRateLimiter({
  limit: GITHUB_DELIVERY_RATE_LIMIT,
  windowMs: WINDOW_MS,
});

/** Counts one delivery attempt for the caller's trusted client address. */
export const checkGithubDeliveryRate = (headers: Headers): RateLimitDecision =>
  limiter.check(resolveClientIp(headers) ?? UNKNOWN_CLIENT);
