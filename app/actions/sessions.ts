"use server";

import { Effect, Schema } from "effect";
import { headers } from "next/headers";

import { AuthSessionLive, AuthSession } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { requireAdmin } from "@/src/server/core/admin-action";
import { UUIDSchema } from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";
import {
  SessionManagement,
  SessionManagementLive,
  SessionSummarySchema,
} from "@/src/server/people/session-management";

const noInput = Schema.Struct({});

const getRequestHeaders = () =>
  Effect.tryPromise({
    catch: () =>
      new AppError({
        code: "UNAVAILABLE",
        message: "The request could not be completed.",
      }),
    try: () => headers(),
  });

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listMySessionsAction(input: unknown) {
  const result = await runServerAction(
    input,
    noInput,
    () =>
      Effect.gen(function* listMySessions() {
        const requestHeaders = yield* getRequestHeaders();
        const session = yield* AuthSession;
        const user = yield* session.requireAuthenticated(requestHeaders);
        const management = yield* SessionManagement;
        return yield* management.listSessions(user.id, user.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(SessionManagementLive)
      ),
    undefined,
    Schema.Array(SessionSummarySchema)
  );
  return result;
}

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listEmployeeSessionsAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({ employeeId: UUIDSchema }),
    (validated) =>
      Effect.gen(function* listEmployeeSessions() {
        const requestHeaders = yield* getRequestHeaders();
        const administrator = yield* requireAdmin(requestHeaders);
        const management = yield* SessionManagement;
        return yield* management.listSessions(
          administrator.id,
          validated.employeeId
        );
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(SessionManagementLive)
      ),
    undefined,
    Schema.Array(SessionSummarySchema)
  );
  return result;
}

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function revokeSessionAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({ sessionId: Schema.String }),
    (validated) =>
      Effect.gen(function* revokeSession() {
        const requestHeaders = yield* getRequestHeaders();
        const session = yield* AuthSession;
        const user = yield* session.requireAuthenticated(requestHeaders);
        const management = yield* SessionManagement;
        yield* management.revokeSession(user.id, validated.sessionId);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(SessionManagementLive)
      ),
    undefined,
    Schema.Undefined
  );
  return result;
}
