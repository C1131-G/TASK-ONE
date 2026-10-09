import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { HexColorSchema } from "../core/input-schemas";

export interface TeamInput {
  readonly color: string;
  readonly description: string | null;
  readonly name: string;
}

export interface TeamSummary extends TeamInput {
  readonly id: string;
  readonly memberCount: number;
}

export const TeamSummarySchema = Schema.Struct({
  color: Schema.String,
  description: Schema.NullOr(Schema.String),
  id: Schema.String,
  memberCount: Schema.Number,
  name: Schema.String,
});

export class TeamManagement extends Context.Service<
  TeamManagement,
  {
    readonly listTeams: (
      requesterId: string
    ) => Effect.Effect<readonly TeamSummary[], AppError>;
    readonly createTeam: (
      administratorId: string,
      input: TeamInput
    ) => Effect.Effect<TeamSummary, AppError>;
    readonly updateTeam: (
      administratorId: string,
      teamId: string,
      input: TeamInput
    ) => Effect.Effect<TeamSummary, AppError>;
    readonly deleteTeam: (
      administratorId: string,
      teamId: string
    ) => Effect.Effect<void, AppError>;
  }
>()("metsys/server/TeamManagement") {}

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The team request could not be completed.",
      });

const validateInput = (input: TeamInput): TeamInput => {
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  if (!name || name.length > 80) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Team names must be between 1 and 80 characters.",
    });
  }
  if (description && description.length > 500) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Team descriptions must be 500 characters or fewer.",
    });
  }
  if (!Schema.is(HexColorSchema)(input.color)) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose a six-digit hex color.",
    });
  }
  return { color: input.color.toUpperCase(), description, name };
};

const requireActor = async (
  actorId: string,
  requireAdmin: boolean
): Promise<void> => {
  const actor = await db.orm.public.User.where({ id: actorId })
    .select("role", "mustChangePassword", "deactivatedAt")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Change your password before continuing.",
    });
  }
  if (requireAdmin && actor.role !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Administrator access is required.",
    });
  }
};

const teamSummary = (input: {
  id: string;
  name: string;
  description: string | null;
  color: string;
  memberCount: number;
}): TeamSummary => ({ ...input });

const countActiveMembers = async (teamId: string): Promise<number> => {
  const members = await db.orm.public.User.where({ teamId })
    .select("deactivatedAt")
    .all();
  return members.filter((member) => member.deactivatedAt === null).length;
};

const listTeams = (
  requesterId: string
): Effect.Effect<readonly TeamSummary[], AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await requireActor(requesterId, false);
      const [teams, members] = await Promise.all([
        db.orm.public.Team.orderBy((team) => team.name.asc()).all(),
        db.orm.public.User.where({ deactivatedAt: null })
          .select("teamId")
          .all(),
      ]);
      const memberCounts = new Map<string, number>();
      for (const member of members) {
        if (member.teamId) {
          memberCounts.set(
            member.teamId,
            (memberCounts.get(member.teamId) ?? 0) + 1
          );
        }
      }
      return teams.map((team) =>
        teamSummary({ ...team, memberCount: memberCounts.get(team.id) ?? 0 })
      );
    },
  });

const createTeam = (
  administratorId: string,
  input: TeamInput
): Effect.Effect<TeamSummary, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const validInput = validateInput(input);
      await requireActor(administratorId, true);
      return db.transaction(async (transaction) => {
        const existing = await transaction.orm.public.Team.first({
          name: validInput.name,
        });
        if (existing) {
          throw new AppError({
            code: "CONFLICT",
            message: "A team with that name already exists.",
          });
        }
        const team = await transaction.orm.public.Team.create({
          ...validInput,
          icon: "users",
          id: crypto.randomUUID(),
          updatedAt: new Date(),
        });
        await transaction.orm.public.Activity.create({
          action: "team.created",
          actorId: administratorId,
          createdAt: new Date(),
          details: { teamId: team.id },
          id: crypto.randomUUID(),
          projectId: null,
          taskId: null,
        });
        return teamSummary({ ...team, memberCount: 0 });
      });
    },
  });

const updateTeam = (
  administratorId: string,
  teamId: string,
  input: TeamInput
): Effect.Effect<TeamSummary, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const validInput = validateInput(input);
      await requireActor(administratorId, true);
      const team = await db.transaction(async (transaction) => {
        const updated = await transaction.orm.public.Team.where({
          id: teamId,
        }).update({ ...validInput, updatedAt: new Date() });
        if (!updated) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The team does not exist.",
          });
        }
        await transaction.orm.public.Activity.create({
          action: "team.updated",
          actorId: administratorId,
          createdAt: new Date(),
          details: { teamId },
          id: crypto.randomUUID(),
          projectId: null,
          taskId: null,
        });
        return updated;
      });
      return teamSummary({
        ...team,
        memberCount: await countActiveMembers(teamId),
      });
    },
  });

const deleteTeam = (
  administratorId: string,
  teamId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await requireActor(administratorId, true);
      await db.transaction(async (transaction) => {
        const team = await transaction.orm.public.Team.where({
          id: teamId,
        }).delete();
        if (!team) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The team does not exist.",
          });
        }
        await transaction.orm.public.User.where({ teamId }).updateAll({
          teamId: null,
          updatedAt: new Date(),
        });
        await transaction.orm.public.Activity.create({
          action: "team.deleted",
          actorId: administratorId,
          createdAt: new Date(),
          details: { teamId },
          id: crypto.randomUUID(),
          projectId: null,
          taskId: null,
        });
      });
    },
  });

export const TeamManagementLive = Layer.succeed(
  TeamManagement,
  TeamManagement.of({ createTeam, deleteTeam, listTeams, updateTeam })
);
