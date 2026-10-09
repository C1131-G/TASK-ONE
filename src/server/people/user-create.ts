import { randomBytes } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { auth } from "../auth/auth";
import { AppError } from "../core/action-result";
import type { CreateEmployeeInput, CreatedEmployee } from "./user-contracts";
import {
  databaseError,
  serializeAdminChanges,
  requireAdmin,
  validatePerson,
  createCredentialUser,
} from "./user-internal";

export const createEmployee = (
  administratorId: string,
  input: CreateEmployeeInput
): Effect.Effect<CreatedEmployee, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const values = validatePerson(input.email, input.name, input.jobTitle);
      const temporaryPassword = randomBytes(30).toString("base64url");
      const passwordContext = await auth.$context;
      const passwordHash =
        await passwordContext.password.hash(temporaryPassword);
      return db.transaction(async (transaction) => {
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
        return createCredentialUser(transaction, {
          ...values,
          activityAction: "user.created",
          actorId: administratorId,
          passwordHash,
          role: input.role,
          teamId: input.teamId,
          temporaryPassword,
        });
      });
    },
  });

export const createFirstAdmin = (input: {
  readonly email: string;
  readonly name: string;
}): Effect.Effect<CreatedEmployee, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const values = validatePerson(input.email, input.name, null);
      const temporaryPassword = randomBytes(30).toString("base64url");
      const passwordContext = await auth.$context;
      const passwordHash =
        await passwordContext.password.hash(temporaryPassword);
      return db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        const existingAdmin = await transaction.orm.public.User.where({
          role: "admin",
        })
          .select("id")
          .first();
        if (existingAdmin) {
          throw new AppError({
            code: "CONFLICT",
            message: "An administrator account already exists.",
          });
        }
        return createCredentialUser(transaction, {
          ...values,
          activityAction: "user.bootstrap_admin_created",
          passwordHash,
          role: "admin",
          teamId: null,
          temporaryPassword,
        });
      });
    },
  });
