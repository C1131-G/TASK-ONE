import { afterAll, afterEach, beforeAll, expect, it } from "bun:test";

import { resetRateLimits } from "../../src/server/api/rate-limit";
import {
  authPool,
  createPersona,
  ids,
  personaBearerToken,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

beforeAll(setupHarness);
afterAll(teardownHarness);
afterEach(() => {
  delete process.env["MOBILE_API_RATE_LIMIT_PER_MINUTE"];
  resetRateLimits();
});

interface Answer {
  readonly body: {
    readonly error?: {
      readonly code: string;
      readonly message: string;
      readonly reason?: string;
    };
  };
  readonly retryAfter: string | null;
  readonly status: number;
}

const answerOf = async (response: Response): Promise<Answer> => ({
  body: (await response.json()) as Answer["body"],
  retryAfter: response.headers.get("retry-after"),
  status: response.status,
});

const getMe = async (token: string): Promise<Answer> => {
  const { GET } = await import("../../app/api/v1/me/route");
  return answerOf(
    await GET(
      new Request("http://localhost:3000/api/v1/me", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      })
    )
  );
};

const portalBugs = async (token: string): Promise<Answer> => {
  const { GET } = await import("../../app/api/v1/portal/bugs/route");
  return answerOf(
    await GET(
      new Request("http://localhost:3000/api/v1/portal/bugs", {
        headers: { authorization: `Bearer ${token}` },
      })
    )
  );
};

const postPassword = async (token: string, body: string): Promise<Answer> => {
  const { POST } = await import("../../app/api/v1/me/password/route");
  return answerOf(
    await POST(
      new Request("http://localhost:3000/api/v1/me/password", {
        body,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        method: "POST",
      })
    )
  );
};

it("says why a 401 happened: no session, a deactivated account, or inactivity", async () => {
  const none = await getMe("");
  const unknown = await getMe("not-a-real-token");
  const deactivated = await getMe(personaBearerToken("deactivated"));

  expect(none.status).toBe(401);
  expect(none.body.error?.reason).toBe("session_ended");
  expect(unknown.body.error?.reason).toBe("session_ended");
  expect(deactivated.status).toBe(401);
  expect(deactivated.body.error?.reason).toBe("deactivated");

  const idle = await createPersona("employee", "idle");
  await authPool.query(
    'UPDATE "user" SET role = \'client\', "clientCompanyId" = $2, "mustChangePassword" = false, "lastActiveAt" = now() - interval \'3 hours\' WHERE id = $1',
    [idle.id, ids.clientCompanyId]
  );
  const inactive = await portalBugs(idle.bearerToken);

  expect(inactive.status).toBe(401);
  expect(inactive.body.error?.reason).toBe("inactivity");
});

it("does not add a reason to answers that are not 401", async () => {
  const forbidden = await portalBugs(personaBearerToken("owner"));

  expect(forbidden.status).toBe(403);
  expect(forbidden.body.error?.reason).toBeUndefined();
});

it("refuses a request body over 1 MiB before reading it as a password", async () => {
  const big = JSON.stringify({
    currentPassword: "x".repeat(2 * 1024 * 1024),
    newPassword: "y",
  });
  const answer = await postPassword(personaBearerToken("owner"), big);

  expect(answer.status).toBe(422);
  expect(answer.body.error?.message).toContain("too large");
});

it("answers 429 with Retry-After once a person passes the per-minute limit", async () => {
  process.env["MOBILE_API_RATE_LIMIT_PER_MINUTE"] = "3";
  resetRateLimits();
  const owner = personaBearerToken("owner");

  const first = [
    await getMe(owner),
    await getMe(owner),
    await getMe(owner),
  ].map(({ status }) => status);
  const fourth = await getMe(owner);

  expect(first).toEqual([200, 200, 200]);
  expect(fourth.status).toBe(429);
  expect(fourth.body.error?.code).toBe("RATE_LIMITED");
  expect(Number(fourth.retryAfter)).toBeGreaterThanOrEqual(1);
  // Someone else is not affected, and refused tokens use up nobody's budget.
  const admin = await getMe(personaBearerToken("admin"));
  const refused = await Promise.all(
    Array.from({ length: 5 }, () => getMe("not-a-real-token"))
  );

  expect(admin.status).toBe(200);
  expect(refused.map(({ status }) => status)).toEqual([
    401, 401, 401, 401, 401,
  ]);
});

it("logs one line per request with the request id, route, status and person, and never the body", async () => {
  const lines: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    lines.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  let answer: Answer;
  try {
    answer = await postPassword(
      personaBearerToken("owner"),
      JSON.stringify({
        currentPassword: "secret-current-value",
        newPassword: "secret-new-value-123",
      })
    );
  } finally {
    process.stdout.write = original;
  }
  const entries = lines
    .flatMap((chunk) => chunk.split("\n"))
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((entry) => entry["message"] === "Mobile API request");

  expect(answer.status).toBe(422);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    level: "info",
    method: "post",
    operationId: "changePassword",
    status: 422,
  });
  expect(typeof entries[0]?.["requestId"]).toBe("string");
  expect(typeof entries[0]?.["durationMs"]).toBe("number");
  expect(typeof entries[0]?.["userId"]).toBe("string");
  expect(lines.join("")).not.toContain("secret-current-value");
  expect(lines.join("")).not.toContain("secret-new-value");
});
