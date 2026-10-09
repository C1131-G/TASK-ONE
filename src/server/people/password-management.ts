import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { auth } from "../auth/auth";
import { AppError } from "../core/action-result";

export class PasswordManagement extends Context.Service<
  PasswordManagement,
  {
    readonly changeOwnPassword: (
      headers: Headers,
      currentPassword: string,
      newPassword: string
    ) => Effect.Effect<void, AppError>;
  }
>()("metsys/server/PasswordManagement") {}

const changeOwnPassword = (
  headers: Headers,
  currentPassword: string,
  newPassword: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: (error) =>
      error instanceof AppError
        ? error
        : new AppError({
            code: "VALIDATION_FAILED",
            message:
              "Check your current password and new password, then try again.",
          }),
    try: async () => {
      if (newPassword.length < 12 || newPassword.length > 128) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "New passwords must be between 12 and 128 characters.",
        });
      }

      const session = await auth.api.getSession({ headers });
      if (!session) {
        throw new AppError({
          code: "UNAUTHENTICATED",
          message: "Sign in to change your password.",
        });
      }

      await auth.api.changePassword({
        body: {
          currentPassword,
          newPassword,
          revokeOtherSessions: false,
        },
        headers,
      });

      await db.transaction(async (transaction) => {
        const updated = await transaction.orm.public.User.where({
          deactivatedAt: null,
          id: session.user.id,
        }).updateAndCount({ mustChangePassword: false, updatedAt: new Date() });
        if (!updated) {
          throw new AppError({
            code: "UNAUTHENTICATED",
            message: "This account is unavailable.",
          });
        }
        await transaction.orm.public.Activity.create({
          action: "user.password_changed",
          actorId: session.user.id,
          createdAt: new Date(),
          details: { userId: session.user.id },
          id: crypto.randomUUID(),
          projectId: null,
          taskId: null,
        });
      });
    },
  });

export const PasswordManagementLive = Layer.succeed(
  PasswordManagement,
  PasswordManagement.of({ changeOwnPassword })
);
