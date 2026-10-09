import { and } from "@prisma/orm-postgres/orm-client";
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

      const passwordContext = await auth.$context;

      await db.transaction(async (transaction) => {
        const credential = await transaction.orm.public.Account.where({
          providerId: "credential",
          userId: session.user.id,
        })
          .select("id", "password")
          .first();
        if (
          !credential?.password ||
          !(await passwordContext.password.verify({
            hash: credential.password,
            password: currentPassword,
          }))
        ) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Check your current password and try again.",
          });
        }
        const passwordHash = await passwordContext.password.hash(newPassword);
        await transaction.orm.public.Account.where({
          id: credential.id,
        }).update({
          password: passwordHash,
          updatedAt: new Date(),
        });
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
        await transaction.orm.public.Session.where((activeSession) =>
          and(
            activeSession.userId.eq(session.user.id),
            activeSession.token.neq(session.session.token)
          )
        ).deleteAll();
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
