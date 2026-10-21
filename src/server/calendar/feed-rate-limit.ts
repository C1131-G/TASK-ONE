// A small fixed-window limiter held in server memory. The feed URL needs no
// session, so this slows token guessing and runaway pollers per client address;
// it is a safety net, not a quota (each instance counts on its own).

const MAX_TRACKED_KEYS = 10_000;

export type RateLimitDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

export interface FeedRateLimiter {
  // Counts one hit for the key and says whether it is still within the limit.
  readonly check: (key: string) => RateLimitDecision;
  // Reads the key's state without counting a hit.
  readonly peek: (key: string) => RateLimitDecision;
}

interface Window {
  count: number;
  resetsAt: number;
}

export const createFeedRateLimiter = ({
  limit,
  now = Date.now,
  windowMs,
}: {
  readonly limit: number;
  readonly now?: () => number;
  readonly windowMs: number;
}): FeedRateLimiter => {
  const windows = new Map<string, Window>();

  const evictExpired = (current: number) => {
    for (const [key, window] of windows) {
      if (window.resetsAt <= current) {
        windows.delete(key);
      }
    }
  };

  const decide = (window: Window, current: number): RateLimitDecision =>
    window.count >= limit
      ? {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((window.resetsAt - current) / 1000)
          ),
        }
      : { allowed: true };

  return {
    check: (key) => {
      const current = now();
      if (windows.size >= MAX_TRACKED_KEYS) {
        evictExpired(current);
      }
      const existing = windows.get(key);
      if (!existing || existing.resetsAt <= current) {
        windows.set(key, { count: 1, resetsAt: current + windowMs });
        return { allowed: true };
      }
      const decision = decide(existing, current);
      if (decision.allowed) {
        existing.count += 1;
      }
      return decision;
    },
    peek: (key) => {
      const current = now();
      const existing = windows.get(key);
      return existing && existing.resetsAt > current
        ? decide(existing, current)
        : { allowed: true };
    },
  };
};
