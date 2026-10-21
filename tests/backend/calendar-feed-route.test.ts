import { expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  CalendarFeed,
  CalendarFeedLive,
} from "../../src/server/calendar/calendar-feed";
import { createFeedRateLimiter } from "../../src/server/calendar/feed-rate-limit";

// `connection()` only opts the route out of prerendering.
mock.module("next/server", () => ({ connection: () => Promise.resolve() }));

const { GET } = await import("../../app/api/calendar/[token]/route");

const call = (token: string, ip: string) =>
  GET(
    new Request(`http://localhost/api/calendar/${token}`, {
      headers: { "x-forwarded-for": ip },
    }),
    { params: Promise.resolve({ token }) }
  );

it("allows a burst up to the limit, then asks the caller to wait", () => {
  let clock = 1000;
  const limiter = createFeedRateLimiter({
    limit: 2,
    now: () => clock,
    windowMs: 60_000,
  });
  expect(limiter.check("a")).toEqual({ allowed: true });
  expect(limiter.check("a")).toEqual({ allowed: true });
  expect(limiter.check("a")).toEqual({ allowed: false, retryAfterSeconds: 60 });
  expect(limiter.check("b")).toEqual({ allowed: true });
  clock += 61_000;
  expect(limiter.check("a")).toEqual({ allowed: true });
});

it("serves a calendar feed without any cookie and with the right headers", async () => {
  const userId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Route Viewer", `${userId}@feed-route.example`]
  );
  try {
    const { token } = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* rotate() {
          return yield* (yield* CalendarFeed).rotate(userId);
        }),
        CalendarFeedLive
      )
    );

    const response = await call(`${token}.ics`, "198.51.100.10");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/calendar; charset=utf-8"
    );
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const body = await response.text();
    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body).toContain("X-WR-CALNAME:Metsys - Route Viewer");

    const bare = await call(token, "198.51.100.10");
    expect(bare.status).toBe(200);
  } finally {
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});

it("answers every invalid token with the same 404 and throttles guessing", async () => {
  const ip = "203.0.113.77";
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const response = await call(randomUUID(), ip);
    statuses.push(response.status);
    if (response.status === 404) {
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).toContain("text/plain");
    }
    if (response.status === 429) {
      expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    }
  }
  expect(statuses[0]).toBe(404);
  expect(statuses).toContain(429);
});
