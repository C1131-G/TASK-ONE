import { expect, it } from "bun:test";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";
process.env["BETTER_AUTH_URL"] ??= "http://localhost:3000";

it("rejects public account registration", async () => {
  const { POST } = await import("../../app/api/auth/[...all]/route");
  const response = await POST(
    new Request("http://localhost:3000/api/auth/sign-up/email", {
      body: JSON.stringify({
        email: "public-registration@example.test",
        name: "Public User",
        password: "a-secure-test-password",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  );

  expect(response.status).toBeGreaterThanOrEqual(400);
});

it("does not expose Better Auth profile, session-management, or admin endpoints", async () => {
  const { POST } = await import("../../app/api/auth/[...all]/route");
  const blockedPaths = [
    "/api/auth/update-user",
    "/api/auth/list-sessions",
    "/api/auth/admin/set-role",
  ];

  const responses = await Promise.all(
    blockedPaths.map((path) =>
      POST(
        new Request(`http://localhost:3000${path}`, {
          body: JSON.stringify({ name: "Untrusted update" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        })
      )
    )
  );

  expect(responses.map(({ status }) => status)).toEqual([404, 404, 404]);
});

it("requires the scheduler token before running any durable jobs", async () => {
  const { POST } = await import("../../app/api/internal/jobs/route");
  const response = await POST(
    new Request("http://localhost:3000/api/internal/jobs", {
      body: JSON.stringify({ limit: 1 }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  );
  const result = (await response.json()) as {
    ok: boolean;
    error?: { code: string; requestId: string };
  };

  expect(response.status).toBe(401);
  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe("UNAUTHENTICATED");
  expect(result.error?.requestId).toBeTruthy();
});
