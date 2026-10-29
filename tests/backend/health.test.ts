import { expect, it, mock } from "bun:test";

import { readinessResponse } from "../../src/server/health/readiness";

// `connection()` only opts the route out of prerendering; outside a Next.js
// request scope it throws, so the handlers are called with it stubbed.
mock.module("next/server", () => ({ connection: () => Promise.resolve() }));

// The route wiring test below must not depend on a reachable MinIO or on the
// shared database: CI runs this suite without object storage, so the real
// probes would answer 503 there. The probes themselves are covered by the
// tests that inject their own.
mock.module("../../src/server/health/live-probes", () => ({
  liveReadinessProbes: {
    database: () => Promise.resolve(),
    storage: () => Promise.resolve(),
  },
}));

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const passing = () => Promise.resolve();
const SLOW_PROBE_MS = 200;
const slow = () => Bun.sleep(SLOW_PROBE_MS);
const SECRET_DETAIL = "password authentication failed for user taskora";

it("reports liveness without touching any dependency", async () => {
  const { GET } = await import("../../app/api/health/live/route");
  const response = await GET();

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok" });
});

it("keeps /api/health as the readiness check for the container", async () => {
  const { GET } = await import("../../app/api/health/route");
  const ready = await import("../../app/api/health/ready/route");
  expect(ready.GET).toBe(GET);
  const response = await GET();

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toMatchObject({
    checks: { database: "ok" },
    status: "ok",
  });
});

it("is ready when every configured dependency answers", async () => {
  const response = await readinessResponse({
    database: passing,
    storage: passing,
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    checks: { database: "ok", storage: "ok" },
    status: "ok",
  });
});

it("skips storage when it is not configured", async () => {
  const response = await readinessResponse({ database: passing });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    checks: { database: "ok", storage: "skipped" },
    status: "ok",
  });
});

it("is unavailable without leaking why a dependency failed", async () => {
  const response = await readinessResponse({
    database: () => Promise.reject(new Error(SECRET_DETAIL)),
    storage: passing,
  });
  const body = await response.text();

  expect(response.status).toBe(503);
  expect(JSON.parse(body)).toEqual({
    checks: { database: "unavailable", storage: "ok" },
    status: "unavailable",
  });
  expect(body).not.toContain(SECRET_DETAIL);
});

it("fails a dependency that does not answer within the timeout", async () => {
  let aborted = false;
  const startedAt = Date.now();
  const response = await readinessResponse(
    {
      database: passing,
      storage: (signal) => {
        const { promise, reject } = Promise.withResolvers<undefined>();
        signal.addEventListener("abort", () => {
          aborted = true;
          reject(new Error("aborted"));
        });
        return promise;
      },
    },
    { timeoutMs: 50 }
  );

  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    checks: { database: "ok", storage: "unavailable" },
    status: "unavailable",
  });
  expect(aborted).toBe(true);
  expect(Date.now() - startedAt).toBeLessThan(1000);
});

it("is unavailable when only storage fails", async () => {
  const response = await readinessResponse({
    database: passing,
    storage: () => Promise.reject(new Error(SECRET_DETAIL)),
  });
  const body = await response.text();

  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(JSON.parse(body)).toEqual({
    checks: { database: "ok", storage: "unavailable" },
    status: "unavailable",
  });
  expect(body).not.toContain(SECRET_DETAIL);
});

it("reports every failing dependency when several are down", async () => {
  const response = await readinessResponse({
    database: () => Promise.reject(new Error(SECRET_DETAIL)),
    storage: () => Promise.reject(new Error(SECRET_DETAIL)),
  });

  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    checks: { database: "unavailable", storage: "unavailable" },
    status: "unavailable",
  });
});

it("probes dependencies concurrently so slow checks do not stack", async () => {
  const startedAt = Date.now();
  const response = await readinessResponse({ database: slow, storage: slow });

  expect(response.status).toBe(200);
  expect(Date.now() - startedAt).toBeLessThan(380);
});

it("keeps liveness answering 200 on repeated calls", async () => {
  const { GET } = await import("../../app/api/health/live/route");
  const responses = await Promise.all([GET(), GET(), GET()]);

  expect(responses.map(({ status }) => status)).toEqual([200, 200, 200]);
});
