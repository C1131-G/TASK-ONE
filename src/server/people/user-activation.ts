import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import {
  databaseError,
  serializeAdminChanges,
  requireAdmin,
  addActivity,
} from "./user-internal";

export const deactivateEmployee = (
  administratorId: string,
  employeeId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      await db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        await requireAdmin(transaction, administratorId);
        const target = await transaction.orm.public.User.where({
          id: employeeId,
        })
          .select("role", "deactivatedAt")
          .first();
        if (!target) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The account no longer exists.",
          });
        }
        if (target.deactivatedAt) {
          throw new AppError({
            code: "CONFLICT",
            message: "The account is already deactivated.",
          });
        }
        if (target.role === "admin") {
          const activeAdmins = await transaction.orm.public.User.where({
            deactivatedAt: null,
            role: "admin",
          })
            .select("id")
            .all();
          if (activeAdmins.length <= 1) {
            throw new AppError({
              code: "CONFLICT",
              message: "The last active administrator cannot be deactivated.",
            });
          }
        }
        await transaction.orm.public.User.where({ id: employeeId }).update({
          deactivatedAt: new Date(),
          deactivatedById: administratorId,
          updatedAt: new Date(),
        });
        await transaction.orm.public.Session.where({
          userId: employeeId,
        }).deleteAll();
        await addActivity(transaction, administratorId, "user.deactivated", {
          userId: employeeId,
        });
      });
    },
  });

export const reactivateEmployee = (
  administratorId: string,
  employeeId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      await db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        await requireAdmin(transaction, administratorId);
        const target = await transaction.orm.public.User.where({
          id: employeeId,
        })
          .select("deactivatedAt")
          .first();
        if (!target) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The account was not found.",
          });
        }
        if (!target.deactivatedAt) {
          throw new AppError({
            code: "CONFLICT",
            message: "The account is already active.",
          });
        }
        await transaction.orm.public.User.where({ id: employeeId }).update({
          deactivatedAt: null,
          deactivatedById: null,
          updatedAt: new Date(),
        });
        await addActivity(transaction, administratorId, "user.reactivated", {
          userId: employeeId,
        });
      });
    },
  });
