import { describe, expect, it } from "bun:test";
import { randomInt } from "node:crypto";

import { requestMetadata } from "../../src/server/audit/audit-log";
import {
  RESOLVED_CLIENT_IP_HEADER,
  readClientIpConfig,
  resolveClientIp,
  withResolvedClientIp,
} from "../../src/server/core/client-ip";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";
process.env["BETTER_AUTH_URL"] ??= "http://localhost:3000";

const forwardedFor = readClientIpConfig({});
const SIGN_IN_LIMIT = 5;

describe("resolveClientIp", () => {
  it("defaults to the last X-Forwarded-For entry behind one proxy", () => {
    expect(forwardedFor).toEqual({ header: "x-forwarded-for", proxyHops: 1 });
  });

  it("ignores spoofed left-most X-Forwarded-For entries", () => {
    const first = new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" });
    const second = new Headers({
      "x-forwarded-for": "8.8.8.8, 9.9.9.9, 203.0.113.9",
    });

    expect(resolveClientIp(first, forwardedFor)).toBe("203.0.113.9");
    expect(resolveClientIp(second, forwardedFor)).toBe("203.0.113.9");
  });

  it("counts trusted proxy hops from the right", () => {
    const config = readClientIpConfig({ TRUSTED_PROXY_HOPS: "2" });
    const headers = new Headers({
      "x-forwarded-for": "1.1.1.1, 203.0.113.9, 10.0.0.2",
    });

    expect(resolveClientIp(headers, config)).toBe("203.0.113.9");
    expect(
      resolveClientIp(new Headers({ "x-forwarded-for": "203.0.113.9" }), config)
    ).toBeUndefined();
  });

  it("honours the configured header and ignores X-Forwarded-For", () => {
    const config = readClientIpConfig({
      TRUSTED_IP_HEADER: "CF-Connecting-IP",
    });
    const headers = new Headers({
      "cf-connecting-ip": "198.51.100.7",
      "x-forwarded-for": "1.1.1.1",
    });

    expect(resolveClientIp(headers, config)).toBe("198.51.100.7");
    expect(
      resolveClientIp(new Headers({ "x-forwarded-for": "1.1.1.1" }), config)
    ).toBeUndefined();
  });

  it("reads a missing or malformed header as unknown", () => {
    expect(resolveClientIp(new Headers(), forwardedFor)).toBeUndefined();
    expect(resolveClientIp(undefined, forwardedFor)).toBeUndefined();
    expect(
      resolveClientIp(
        new Headers({ "x-forwarded-for": "not-an-ip" }),
        forwardedFor
      )
    ).toBeUndefined();
    expect(requestMetadata(new Headers()).ip).toBeNull();
  });

  it("rejects an invalid proxy hop count", () => {
    expect(() => readClientIpConfig({ TRUSTED_PROXY_HOPS: "0" })).toThrow();
  });
});

describe("withResolvedClientIp", () => {
  it("replaces a client-supplied resolved IP header", () => {
    const request = withResolvedClientIp(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: {
          [RESOLVED_CLIENT_IP_HEADER]: "6.6.6.6",
          "x-forwarded-for": "6.6.6.6, 203.0.113.9",
        },
      }),
      forwardedFor
    );

    expect(request.headers.get(RESOLVED_CLIENT_IP_HEADER)).toBe("203.0.113.9");
  });

  it("drops a client-supplied resolved IP header when nothing resolves", () => {
    const request = withResolvedClientIp(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { [RESOLVED_CLIENT_IP_HEADER]: "6.6.6.6" },
      }),
      forwardedFor
    );

    expect(request.headers.has(RESOLVED_CLIENT_IP_HEADER)).toBe(false);
  });
});

it("keeps rate limiting sign-in when the left-most X-Forwarded-For rotates", async () => {
  const { POST } = await import("../../app/api/auth/[...all]/route");
  const { authPool } = await import("../../src/server/auth/database");
  const clientIp = `100.64.${randomInt(256)}.${randomInt(1, 255)}`;
  const email = `nobody-${clientIp}@example.test`;
  const attempt = (spoofed: number) =>
    POST(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        body: JSON.stringify({
          email,
          password: "not-the-right-password",
        }),
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `192.0.2.${spoofed}, ${clientIp}`,
        },
        method: "POST",
      })
    );

  const statuses: number[] = [];
  try {
    for (let spoofed = 1; spoofed <= SIGN_IN_LIMIT + 1; spoofed += 1) {
      // Sequential so each attempt is counted before the next one is checked.
      // eslint-disable-next-line no-await-in-loop
      const response = await attempt(spoofed);
      statuses.push(response.status);
    }
    const audited = await authPool.query<{ ip: string | null }>(
      "SELECT DISTINCT ip FROM audit_event WHERE details->>'email' = $1",
      [email]
    );

    expect(statuses.slice(0, SIGN_IN_LIMIT)).not.toContain(429);
    expect(statuses.at(-1)).toBe(429);
    expect(audited.rows).toEqual([{ ip: clientIp }]);
  } finally {
    await authPool.query(
      "DELETE FROM audit_event WHERE details->>'email' = $1",
      [email]
    );
  }
});
