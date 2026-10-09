import { and, or } from "@prisma/orm-postgres/orm-client";
import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { UpdateOwnProfileInputSchema } from "./user-contracts";
import type {
  CreateEmployeeInput,
  EmployeeDirectoryEntry,
  UpdateOwnProfileInput,
} from "./user-contracts";
import {
  validationError,
  databaseError,
  serializeAdminChanges,
  requireAdmin,
  addActivity,
  validatePerson,
} from "./user-internal";

export const listEmployees = (
  requesterId: string,
  search: string
): Effect.Effect<readonly EmployeeDirectoryEntry[], AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const requester = await db.orm.public.User.where({ id: requesterId })
        .select("deactivatedAt", "mustChangePassword")
        .first();
      if (!requester || requester.deactivatedAt) {
        throw new AppError({
          code: "UNAUTHENTICATED",
          message: "Sign in to continue.",
        });
      }
      if (requester.mustChangePassword) {
        throw new AppError({
          code: "FORBIDDEN",
          message: "Change your password before continuing.",
        });
      }
      const normalizedSearch = search.trim().slice(0, 120);
      const users = await db.orm.public.User.include("team")
        .where((user) =>
          normalizedSearch
            ? and(
                user.deactivatedAt.isNull(),
                or(
                  user.name.ilike(`%${normalizedSearch}%`),
                  user.email.ilike(`%${normalizedSearch}%`),
                  user.jobTitle.ilike(`%${normalizedSearch}%`)
                )
              )
            : user.deactivatedAt.isNull()
        )
        .orderBy((user) => user.employeeNumber.asc())
        .limit(500)
        .all();
      return users.map((user) => ({
        avatar: user.image,
        email: user.email,
        employeeId: `EMP${String(user.employeeNumber).padStart(6, "0")}`,
        id: user.id,
        jobTitle: user.jobTitle,
        name: user.name,
        role: Schema.is(Schema.Literals(["admin", "employee"]))(user.role)
          ? user.role
          : "employee",
        teamId: user.teamId,
        teamName: user.team?.name ?? null,
      }));
    },
  });

export const updateEmployeeDetails = (
  administratorId: string,
  employeeId: string,
  input: Pick<CreateEmployeeInput, "email" | "jobTitle" | "teamId">
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const values = validatePerson(input.email, "employee", input.jobTitle);
      await db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        await requireAdmin(transaction, administratorId);
        if (input.teamId) {
          const team = await transaction.orm.public.Team.where({
            id: input.teamId,
          })
            .select("id")
            .first();
          if (!team) {
            throw new AppError({
              code: "NOT_FOUND",
              message: "The selected team does not exist.",
            });
          }
        }
        const target = await transaction.orm.public.User.where({
          id: employeeId,
        })
          .select("emailNormalized", "jobTitle", "teamId")
          .first();
        if (!target) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The account no longer exists.",
          });
        }
        const emailChanged = target.emailNormalized !== values.email;
        const jobTitleChanged = target.jobTitle !== values.jobTitle;
        const teamChanged = target.teamId !== input.teamId;
        await transaction.orm.public.User.where({ id: employeeId }).update({
          email: values.email,
          emailNormalized: values.email,
          ...(emailChanged ? { emailVerified: false } : {}),
          jobTitle: values.jobTitle,
          teamId: input.teamId,
          updatedAt: new Date(),
        });
        if (emailChanged) {
          await transaction.orm.public.Session.where({
            userId: employeeId,
          }).deleteAll();
        }
        await addActivity(
          transaction,
          administratorId,
          "user.details_updated",
          {
            emailChanged,
            jobTitleChanged,
            teamChanged,
            userId: employeeId,
          }
        );
      });
    },
  });

export const updateOwnProfile = (
  actorId: string,
  rawInput: UpdateOwnProfileInput
): Effect.Effect<{ readonly id: string; readonly name: string }, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      let input: UpdateOwnProfileInput;
      try {
        input = Schema.decodeUnknownSync(UpdateOwnProfileInputSchema)(rawInput);
      } catch {
        throw validationError(
          "Enter a display name between 1 and 120 characters."
        );
      }
      return db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("deactivatedAt", "mustChangePassword")
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
        const updated = await transaction.orm.public.User.where({
          deactivatedAt: null,
          id: actorId,
        }).update({ name: input.name, updatedAt: new Date() });
        if (!updated) {
          throw new AppError({
            code: "UNAUTHENTICATED",
            message: "Sign in to continue.",
          });
        }
        await addActivity(transaction, actorId, "user.profile_updated", {
          name: updated.name,
          userId: actorId,
        });
        return { id: updated.id, name: updated.name };
      });
    },
  });
