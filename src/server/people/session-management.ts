import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

export interface SessionSummary {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export class SessionManagement extends Context.Service<
  SessionManagement,
  {
    readonly listSessions: (
      requesterId: string,
      targetUserId: string
    ) => Effect.Effect<readonly SessionSummary[], AppError>;
    readonly revokeSession: (
      requesterId: string,
      sessionId: string
    ) => Effect.Effect<void, AppError>;
  }
>()("metsys/server/SessionManagement") {}

const toUnavailable = (): AppError =>
  new AppError({
    code: "UNAVAILABLE",
    message: "The session request could not be completed.",
  });

const mapError = (error: unknown): AppError =>
  error instanceof AppError ? error : toUnavailable();

const assertRequester = async (
  requesterId: string
): Promise<{ readonly role: string; readonly mustChangePassword: boolean }> => {
  const requester = await db.orm.public.User.where({ id: requesterId })
    .select("role", "mustChangePassword", "deactivatedAt")
    .first();
  if (!requester || requester.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to manage sessions.",
    });
  }
  if (requester.role !== "admin" && requester.role !== "employee") {
    throw toUnavailable();
  }
  return requester;
};

const listSessions = (
  requesterId: string,
  targetUserId: string
): Effect.Effect<readonly SessionSummary[], AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const requester = await assertRequester(requesterId);
      if (
        requesterId !== targetUserId &&
        (requester.role !== "admin" || requester.mustChangePassword)
      ) {
        throw new AppError({
          code: "FORBIDDEN",
          message: "Only admins can view another employee's sessions.",
        });
      }
      const user = await db.orm.public.User.where({ id: targetUserId })
        .select("id")
        .first();
      if (!user) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "The employee does not exist.",
        });
      }
      const now = new Date();
      const sessions = await db.orm.public.Session.where({
        userId: targetUserId,
      })
        .orderBy((session) => session.createdAt.desc())
        .all();
      const activeSessions: SessionSummary[] = [];
      for (const session of sessions) {
        if (session.expiresAt > now) {
          activeSessions.push({
            createdAt: session.createdAt.toISOString(),
            expiresAt: session.expiresAt.toISOString(),
            id: session.id,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          });
        }
      }
      return activeSessions;
    },
  });

const revokeSession = (
  requesterId: string,
  sessionId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await db.transaction(async (transaction) => {
        const requester = await transaction.orm.public.User.where({
          id: requesterId,
        })
          .select("role", "mustChangePassword", "deactivatedAt")
          .first();
        if (!requester || requester.deactivatedAt) {
          throw new AppError({
            code: "UNAUTHENTICATED",
            message: "Sign in to manage sessions.",
          });
        }
        const session = await transaction.orm.public.Session.where({
          id: sessionId,
        })
          .select("id", "userId")
          .first();
        if (!session) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The session does not exist or has already expired.",
          });
        }
        if (
          session.userId !== requesterId &&
          (requester.role !== "admin" || requester.mustChangePassword)
        ) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Only admins can revoke another employee's session.",
          });
        }

        await transaction.orm.public.Session.where({ id: sessionId }).delete();
        await transaction.orm.public.Activity.create({
          action: "session.revoked",
          actorId: requesterId,
          createdAt: new Date(),
          details: { sessionId, userId: session.userId },
          id: crypto.randomUUID(),
          projectId: null,
          taskId: null,
        });
      });
    },
  });

export const SessionManagementLive = Layer.succeed(
  SessionManagement,
  SessionManagement.of({ listSessions, revokeSession })
);
