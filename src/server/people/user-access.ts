import { randomBytes } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { auth } from "../auth/auth";
import { AppError } from "../core/action-result";
import type {
  CreateEmployeeInput,
  TemporaryPasswordResult,
} from "./user-contracts";
import {
  databaseError,
  serializeAdminChanges,
  requireAdmin,
  addActivity,
} from "./user-internal";

export const changeEmployeeRole = (
  administratorId: string,
  employeeId: string,
  role: CreateEmployeeInput["role"]
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      await db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        await requireAdmin(transaction, administratorId);
        const target = await transaction.orm.public.User.where({
          deactivatedAt: null,
          id: employeeId,
        })
          .select("role")
          .first();
        if (!target) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The active account was not found.",
          });
        }
        if (target.role === role) {
          throw new AppError({
            code: "CONFLICT",
            message: "The account already has that role.",
          });
        }
        if (target.role === "admin" && role === "employee") {
          const activeAdmins = await transaction.orm.public.User.where({
            deactivatedAt: null,
            role: "admin",
          })
            .select("id")
            .all();
          if (activeAdmins.length <= 1) {
            throw new AppError({
              code: "CONFLICT",
              message: "The last active administrator cannot be demoted.",
            });
          }
        }
        await transaction.orm.public.User.where({ id: employeeId }).update({
          role,
          updatedAt: new Date(),
        });
        await transaction.orm.public.Session.where({
          userId: employeeId,
        }).deleteAll();
        await addActivity(transaction, administratorId, "user.role_changed", {
          role,
          userId: employeeId,
        });
      });
    },
  });

export const resetEmployeePassword = (
  administratorId: string,
  employeeId: string
): Effect.Effect<TemporaryPasswordResult, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const temporaryPassword = randomBytes(30).toString("base64url");
      const passwordContext = await auth.$context;
      const passwordHash =
        await passwordContext.password.hash(temporaryPassword);
      return db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        await requireAdmin(transaction, administratorId);
        const target = await transaction.orm.public.User.where({
          deactivatedAt: null,
          id: employeeId,
        })
          .select("id")
          .first();
        if (!target) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The active account was not found.",
          });
        }
        const credential = await transaction.orm.public.Account.where({
          providerId: "credential",
          userId: employeeId,
        })
          .select("id")
          .first();
        if (!credential) {
          throw new AppError({
            code: "CONFLICT",
            message: "The credential account is unavailable.",
          });
        }
        await transaction.orm.public.Account.where({
          id: credential.id,
        }).update({
          password: passwordHash,
          updatedAt: new Date(),
        });
        await transaction.orm.public.User.where({ id: employeeId }).update({
          mustChangePassword: true,
          updatedAt: new Date(),
        });
        await transaction.orm.public.Session.where({
          userId: employeeId,
        }).deleteAll();
        await addActivity(transaction, administratorId, "user.password_reset", {
          userId: employeeId,
        });
        return { employeeId, temporaryPassword };
      });
    },
  });
