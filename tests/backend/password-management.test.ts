import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { auth } from "../../src/server/auth/auth";
import { authPool } from "../../src/server/auth/database";
import { AuthSession, AuthSessionLive } from "../../src/server/auth/session";
import {
  PasswordManagement,
  PasswordManagementLive,
} from "../../src/server/people/password-management";
import {
  UserManagement,
  UserManagementLive,
} from "../../src/server/people/user-management";

it("lets a forced-change account replace its temporary password and access the workspace", async () => {
  const email = `password-${randomUUID()}@example.test`;
  let userId: string | undefined;

  try {
    const bootstrap = Effect.gen(function* createAdmin() {
      const users = yield* UserManagement;
      return yield* users.createFirstAdmin({ email, name: "Password Admin" });
    });
    const created = await Effect.runPromise(
      Effect.provide(bootstrap, UserManagementLive)
    );
    userId = created.id;

    const signIn = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        body: JSON.stringify({
          email,
          password: created.temporaryPassword,
        }),
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.55",
        },
        method: "POST",
      })
    );
    const cookie = signIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const requestHeaders = new Headers({ cookie });

    const changePassword = Effect.gen(function* changePassword() {
      const passwords = yield* PasswordManagement;
      yield* passwords.changeOwnPassword(
        requestHeaders,
        created.temporaryPassword,
        "a-new-password-938!"
      );
      const sessions = yield* AuthSession;
      return yield* sessions.requireWorkspaceAccess(requestHeaders);
    });
    const user = await Effect.runPromise(
      Effect.provide(
        changePassword,
        Layer.mergeAll(AuthSessionLive, PasswordManagementLive)
      )
    );

    expect(signIn.status).toBe(200);
    expect(user.id).toBe(created.id);
    expect(user.mustChangePassword).toBe(false);
  } finally {
    if (userId) {
      await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
        userId,
      ]);
      await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
    }
  }
});
