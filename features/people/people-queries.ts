import "server-only";
import { Effect, Schema } from "effect";
import { cache } from "react";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  TeamManagement,
  TeamManagementLive,
  TeamSummarySchema,
} from "@/src/server/people/team-management";
import {
  EmployeeDirectorySchema,
  UserManagement,
  UserManagementLive,
} from "@/src/server/people/user-management";

export const listEmployees = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({
      search: Schema.String.check(Schema.isMaxLength(120)),
    }),
    (validated) =>
      Effect.gen(function* listEmployeesProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const management = yield* UserManagement;
        return yield* management.listEmployees(actor.id, validated.search);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(UserManagementLive)
      ),
    undefined,
    EmployeeDirectorySchema
  );

export const listTeams = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* listTeamsProgram() {
        const currentHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(currentHeaders);
        const teams = yield* TeamManagement;
        return yield* teams.listTeams(actor.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(TeamManagementLive)
      ),
    undefined,
    Schema.Array(TeamSummarySchema)
  );

// Team pages read the full list for both their title and their body; one
// request shares a single read.
export const listAllTeams = cache(async () => await listTeams({}));
