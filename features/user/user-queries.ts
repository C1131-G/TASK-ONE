import "server-only";
import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { requireAdmin } from "@/src/server/core/admin-action";
import { UUIDSchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  SessionManagement,
  SessionManagementLive,
  SessionSummarySchema,
} from "@/src/server/people/session-management";
import {
  PersonalPreferenceSchema,
  PersonalPreferences,
  PersonalPreferencesLive,
} from "@/src/server/preferences/personal-preferences";

export const getPersonalPreferences = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* getPreferences() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const preferences = yield* PersonalPreferences;
        return yield* preferences.get(user.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(PersonalPreferencesLive)
      ),
    undefined,
    PersonalPreferenceSchema
  );

const noInput = Schema.Struct({});

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
export const listMySessions = async (input: unknown) => {
  const result = await runServerAction(
    input,
    noInput,
    () =>
      Effect.gen(function* listMySessionsProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
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
};

export const listEmployeeSessions = async (input: unknown) => {
  const result = await runServerAction(
    input,
    Schema.Struct({ employeeId: UUIDSchema }),
    (validated) =>
      Effect.gen(function* listEmployeeSessionsProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
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
};
