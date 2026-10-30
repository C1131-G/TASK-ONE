import { Effect } from "effect";
import { connection } from "next/server";

import {
  CalendarFeed,
  CalendarFeedLive,
} from "@/src/server/calendar/calendar-feed";
import { createFeedRateLimiter } from "@/src/server/calendar/feed-rate-limit";
import { resolveClientIp } from "@/src/server/core/client-ip";

// Subscribers poll this URL without a session; the secret in the path is the
// credential. Two guards keep that cheap to run: every client address gets a
// generous request budget, and a much smaller budget for unknown tokens.
const MINUTE_MS = 60_000;
const requestLimiter = createFeedRateLimiter({
  limit: 120,
  windowMs: MINUTE_MS,
});
const missLimiter = createFeedRateLimiter({ limit: 20, windowMs: MINUTE_MS });
const UNKNOWN_CLIENT = "unknown";
const ICS_SUFFIX = ".ics";
const POLL_CACHE_SECONDS = 300;

const plain = (
  status: number,
  body: string,
  extra: Record<string, string> = {}
): Response =>
  new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
      ...extra,
    },
    status,
  });

const tooManyRequests = (retryAfterSeconds: number): Response =>
  plain(429, "Too many requests.", {
    "retry-after": String(retryAfterSeconds),
  });

// eslint-disable-next-line func-style -- Next route handler remains a named export.
export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly token: string }> }
): Promise<Response> {
  // Feeds change with the data; never prerender or share a cached copy.
  await connection();
  const client = resolveClientIp(request.headers) ?? UNKNOWN_CLIENT;
  const blocked = missLimiter.peek(client);
  if (!blocked.allowed) {
    return tooManyRequests(blocked.retryAfterSeconds);
  }
  const overall = requestLimiter.check(client);
  if (!overall.allowed) {
    return tooManyRequests(overall.retryAfterSeconds);
  }

  const { token: rawToken } = await context.params;
  const token = rawToken.endsWith(ICS_SUFFIX)
    ? rawToken.slice(0, -ICS_SUFFIX.length)
    : rawToken;
  const outcome = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* render() {
        const feed = yield* CalendarFeed;
        return yield* feed.render(token, new Date());
      }).pipe(
        Effect.match({
          onFailure: (error) => ({ error, ok: false as const }),
          onSuccess: (calendar) => ({ calendar, ok: true as const }),
        })
      ),
      CalendarFeedLive
    )
  );

  if (outcome.ok) {
    return new Response(outcome.calendar, {
      headers: {
        "cache-control": `private, max-age=${POLL_CACHE_SECONDS}`,
        "content-disposition": 'inline; filename="taskora.ics"',
        "content-type": "text/calendar; charset=utf-8",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  }
  if (outcome.error.code === "NOT_FOUND") {
    const miss = missLimiter.check(client);
    return miss.allowed
      ? plain(404, "Not found.")
      : tooManyRequests(miss.retryAfterSeconds);
  }
  return plain(503, "The calendar feed is unavailable.", {
    "retry-after": "60",
  });
}
