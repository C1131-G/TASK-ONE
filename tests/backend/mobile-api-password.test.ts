import { afterAll, beforeAll, expect, it } from "bun:test";

import { auth } from "../../src/server/auth/auth";
import { withResolvedClientIp } from "../../src/server/core/client-ip";
import {
  authPool,
  createPersona,
  personaBearerToken,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

beforeAll(setupHarness);
afterAll(teardownHarness);

const CURRENT = "current-password-1234";
const NEXT = "next-password-5678-ok";

interface Account {
  readonly bearerToken: string;
  readonly email: string;
  readonly id: string;
}

// A forced-change employee whose password the test knows.
const forcedAccount = async (): Promise<Account> => {
  const persona = await createPersona("employee", "pw");
  const context = await auth.$context;
  const hash = await context.password.hash(CURRENT);
  await authPool.query(
    'UPDATE account SET password = $2 WHERE "userId" = $1 AND "providerId" = \'credential\'',
    [persona.id, hash]
  );
  const row = await authPool.query<{ email: string }>(
    'SELECT email FROM "user" WHERE id = $1',
    [persona.id]
  );
  return {
    bearerToken: persona.bearerToken,
    email: row.rows[0]?.email ?? "",
    id: persona.id,
  };
};

let signInCounter = 100;

const signIn = async (email: string, password: string): Promise<Response> => {
  signInCounter += 1;
  const ip = `203.0.113.${signInCounter % 250}`;
  await authPool.query('DELETE FROM "rateLimit" WHERE key LIKE $1', [`${ip}%`]);
  return auth.handler(
    withResolvedClientIp(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        body: JSON.stringify({ email, password }),
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        method: "POST",
      })
    )
  );
};

const changePassword = async (
  token: string,
  body: unknown
): Promise<Response> => {
  const { POST } = await import("../../apps/web/app/api/v1/me/password/route");
  return POST(
    new Request("http://localhost:3000/api/v1/me/password", {
      body: JSON.stringify(body),
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        "content-type": "application/json",
      },
      method: "POST",
    })
  );
};

const workWith = async (token: string): Promise<Response> => {
  const { GET } =
    await import("../../apps/web/app/api/v1/workspace/me/work/route");
  return GET(
    new Request("http://localhost:3000/api/v1/workspace/me/work", {
      headers: { authorization: `Bearer ${token}` },
    })
  );
};

const statusOf = async (response: Promise<Response>): Promise<number> => {
  const settled = await response;
  return settled.status;
};

interface Failure {
  readonly error: { readonly code: string; readonly message: string };
}

it("lets a forced-change account replace its password and then use the workspace", async () => {
  const account = await forcedAccount();

  expect(await statusOf(workWith(account.bearerToken))).toBe(403);

  const response = await changePassword(account.bearerToken, {
    currentPassword: CURRENT,
    newPassword: NEXT,
  });
  const body = (await response.json()) as { data: { changed: boolean } };

  expect(response.status).toBe(200);
  expect(body.data.changed).toBe(true);
  expect(await statusOf(workWith(account.bearerToken))).toBe(200);
  expect(await statusOf(signIn(account.email, NEXT))).toBe(200);
  expect(await statusOf(signIn(account.email, CURRENT))).not.toBe(200);
});

it("answers 422 for a wrong current password and leaves the password alone", async () => {
  const account = await forcedAccount();

  const response = await changePassword(account.bearerToken, {
    currentPassword: "not-the-password-1",
    newPassword: NEXT,
  });

  expect(response.status).toBe(422);
  expect(await statusOf(signIn(account.email, CURRENT))).toBe(200);
});

it("refuses new passwords outside 12 to 128 characters", async () => {
  const account = await forcedAccount();

  for (const newPassword of ["short", "x".repeat(129)]) {
    // eslint-disable-next-line no-await-in-loop
    const response = await changePassword(account.bearerToken, {
      currentPassword: CURRENT,
      newPassword,
    });

    expect(response.status).toBe(422);
  }
  expect(await statusOf(signIn(account.email, CURRENT))).toBe(200);
});

it("locks the account after repeated wrong current passwords", async () => {
  const account = await forcedAccount();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const wrong = await changePassword(account.bearerToken, {
      currentPassword: `wrong-password-${attempt}`,
      newPassword: NEXT,
    });

    expect(wrong.status).toBe(422);
  }
  const locked = await changePassword(account.bearerToken, {
    currentPassword: CURRENT,
    newPassword: NEXT,
  });
  const body = (await locked.json()) as Failure;

  expect(locked.status).toBe(429);
  expect(body.error.code).toBe("RATE_LIMITED");
  // Nothing changed, even though the right password was sent.
  await authPool.query(
    'UPDATE "user" SET "failedLoginCount" = 0, "lockedUntil" = NULL WHERE id = $1',
    [account.id]
  );
  expect(await statusOf(signIn(account.email, CURRENT))).toBe(200);
});

it("signs the account's other devices out and keeps this one", async () => {
  const account = await forcedAccount();
  const second = await signIn(account.email, CURRENT);
  const otherToken = second.headers.get("set-auth-token") ?? "";
  expect(otherToken).not.toBe("");

  const response = await changePassword(account.bearerToken, {
    currentPassword: CURRENT,
    newPassword: NEXT,
  });
  const { GET } = await import("../../apps/web/app/api/v1/me/route");
  const meWith = (token: string) =>
    GET(
      new Request("http://localhost:3000/api/v1/me", {
        headers: { authorization: `Bearer ${token}` },
      })
    );

  expect(response.status).toBe(200);
  expect(await statusOf(meWith(account.bearerToken))).toBe(200);
  expect(await statusOf(meWith(otherToken))).toBe(401);
});

it("answers 401 before reading the body when the token is missing or unknown", async () => {
  for (const token of ["", "not-a-real-token"]) {
    // eslint-disable-next-line no-await-in-loop
    const response = await changePassword(token, { nonsense: true });

    expect(response.status).toBe(401);
  }
});

it("works for a signed-in account that is not forced to change", async () => {
  const response = await changePassword(personaBearerToken("owner"), {
    currentPassword: "unknown-to-this-test",
    newPassword: NEXT,
  });

  // Reaches the service (wrong current password), not a gate refusal.
  expect(response.status).toBe(422);
});
