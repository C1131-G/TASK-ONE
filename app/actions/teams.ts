"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { requireAdmin } from "@/src/server/core/admin-action";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import {
  HexColorSchema,
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";
import {
  TeamManagement,
  TeamManagementLive,
  TeamSummarySchema,
} from "@/src/server/people/team-management";

const TeamInputSchema = Schema.Struct({
  color: HexColorSchema,
  description: Schema.NullOr(
    Schema.String.check(
      Schema.makeFilter((value) =>
        value.length <= 500
          ? undefined
          : "Team descriptions are limited to 500 characters."
      )
    )
  ),
  name: Schema.String.check(
    Schema.makeFilter((value) =>
      value.trim().length > 0 && value.length <= 80
        ? undefined
        : "Team names must be between 1 and 80 characters."
    )
  ),
});

const requestHeaders = () =>
  Effect.tryPromise({
    catch: () =>
      new AppError({
        code: "UNAVAILABLE",
        message: "The request could not be completed.",
      }),
    try: () => headers(),
  });

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listTeamsAction(input: unknown) {
  return await runServerAction(input, Schema.Struct({}), () =>
    Effect.gen(function* listTeams() {
      const currentHeaders = yield* requestHeaders();
      const sessions = yield* AuthSession;
      const actor = yield* sessions.requireWorkspaceAccess(currentHeaders);
      const teams = yield* TeamManagement;
      return yield* teams.listTeams(actor.id);
    }).pipe(Effect.provide(AuthSessionLive), Effect.provide(TeamManagementLive))
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createTeamAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      ...TeamInputSchema.fields,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* createTeam() {
        const currentHeaders = yield* requestHeaders();
        const administrator = yield* requireAdmin(currentHeaders);
        const teams = yield* TeamManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...teamInput } = validated;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () => teams.createTeam(administrator.id, teamInput),
          input: teamInput,
          key: idempotencyKey,
          operation: "team.create",
          resultSchema: TeamSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(TeamManagementLive),
        Effect.provide(IdempotencyLive)
      )
  );
  if (result.ok) {
    revalidatePath("/settings/teams");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateTeamAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      team: TeamInputSchema,
      teamId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* updateTeam() {
        const currentHeaders = yield* requestHeaders();
        const administrator = yield* requireAdmin(currentHeaders);
        const teams = yield* TeamManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            teams.updateTeam(
              administrator.id,
              validated.teamId,
              validated.team
            ),
          input: { team: validated.team, teamId: validated.teamId },
          key: validated.idempotencyKey,
          operation: "team.update",
          resultSchema: TeamSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(TeamManagementLive),
        Effect.provide(IdempotencyLive)
      )
  );
  if (result.ok) {
    revalidatePath("/settings/teams");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function deleteTeamAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      teamId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* deleteTeam() {
        const currentHeaders = yield* requestHeaders();
        const administrator = yield* requireAdmin(currentHeaders);
        const teams = yield* TeamManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            teams
              .deleteTeam(administrator.id, validated.teamId)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { teamId: validated.teamId },
          key: validated.idempotencyKey,
          operation: "team.delete",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(TeamManagementLive),
        Effect.provide(IdempotencyLive)
      )
  );
  if (result.ok) {
    revalidatePath("/settings/teams");
    revalidatePath("/settings/people");
  }
  return result;
}
