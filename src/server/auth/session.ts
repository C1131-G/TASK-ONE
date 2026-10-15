import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { auth } from "./auth";

export type UserRole = "admin" | "employee" | "client";

export interface AuthenticatedUser {
  readonly id: string;
  readonly role: UserRole;
  readonly clientCompanyId: string | null;
  readonly employeeNumber: number;
  readonly mustChangePassword: boolean;
  readonly name: string;
  readonly timeZone: string | null;
}

export type WorkspaceUser = AuthenticatedUser & {
  readonly role: "admin" | "employee";
};

export interface PortalUser extends AuthenticatedUser {
  readonly clientCompanyId: string;
  readonly clientCompanyName: string;
}

export class AuthSession extends Context.Service<
  AuthSession,
  {
    readonly requireAuthenticated: (
      headers: Headers
    ) => Effect.Effect<AuthenticatedUser, AppError>;
    readonly requireWorkspaceAccess: (
      headers: Headers
    ) => Effect.Effect<WorkspaceUser, AppError>;
    readonly requirePortalAccess: (
      headers: Headers
    ) => Effect.Effect<PortalUser, AppError>;
  }
>()("metsys/server/AuthSession") {}

const notAuthenticated = () =>
  new AppError({
    code: "UNAUTHENTICATED",
    message: "Sign in to continue.",
  });

const unavailable = () =>
  new AppError({
    code: "UNAVAILABLE",
    message: "The authentication service is unavailable.",
  });

const loadSessionUser = (
  headers: Headers
): Effect.Effect<AuthenticatedUser, AppError> =>
  Effect.gen(function* resolveSessionUser() {
    const session = yield* Effect.tryPromise({
      catch: unavailable,
      try: () => auth.api.getSession({ headers }),
    });

    if (!session) {
      return yield* Effect.fail(notAuthenticated());
    }

    const user = yield* Effect.tryPromise({
      catch: unavailable,
      try: () =>
        db.orm.public.User.where({ id: session.user.id })
          .select(
            "role",
            "employeeNumber",
            "mustChangePassword",
            "name",
            "deactivatedAt",
            "timeZone",
            "clientCompanyId"
          )
          .first(),
    });

    if (!user || user.deactivatedAt) {
      return yield* Effect.fail(notAuthenticated());
    }

    if (
      user.role !== "admin" &&
      user.role !== "employee" &&
      user.role !== "client"
    ) {
      return yield* Effect.fail(unavailable());
    }

    return {
      clientCompanyId: user.clientCompanyId,
      employeeNumber: user.employeeNumber,
      id: session.user.id,
      mustChangePassword: user.mustChangePassword,
      name: user.name,
      role: user.role,
      timeZone: user.timeZone,
    };
  });

const mustChangePassword = () =>
  new AppError({
    code: "FORBIDDEN",
    message: "Change your password before continuing.",
  });

const workspaceOnly = () =>
  new AppError({
    code: "FORBIDDEN",
    message: "This area is only available to workspace members.",
  });

const portalOnly = () =>
  new AppError({
    code: "FORBIDDEN",
    message: "The client portal is only available to client accounts.",
  });

export const isWorkspaceUser = (
  user: AuthenticatedUser
): user is WorkspaceUser => user.role === "admin" || user.role === "employee";

const requireWorkspaceUser = (
  headers: Headers
): Effect.Effect<WorkspaceUser, AppError> =>
  Effect.gen(function* checkWorkspaceAccess() {
    const user = yield* loadSessionUser(headers);
    if (user.mustChangePassword) {
      return yield* Effect.fail(mustChangePassword());
    }
    // Client accounts never reach workspace data, whatever the route.
    if (!isWorkspaceUser(user)) {
      return yield* Effect.fail(workspaceOnly());
    }
    return user;
  });

const requirePortalUser = (
  headers: Headers
): Effect.Effect<PortalUser, AppError> =>
  Effect.gen(function* checkPortalAccess() {
    const user = yield* loadSessionUser(headers);
    if (user.mustChangePassword) {
      return yield* Effect.fail(mustChangePassword());
    }
    if (user.role !== "client" || !user.clientCompanyId) {
      return yield* Effect.fail(portalOnly());
    }
    const companyId = user.clientCompanyId;
    const company = yield* Effect.tryPromise({
      catch: unavailable,
      try: () =>
        db.orm.public.ClientCompany.where({ id: companyId })
          .select("name", "deactivatedAt")
          .first(),
    });
    if (!company || company.deactivatedAt) {
      return yield* Effect.fail(notAuthenticated());
    }
    return {
      ...user,
      clientCompanyId: companyId,
      clientCompanyName: company.name,
    };
  });

export const AuthSessionLive = Layer.succeed(
  AuthSession,
  AuthSession.of({
    requireAuthenticated: loadSessionUser,
    requirePortalAccess: requirePortalUser,
    requireWorkspaceAccess: requireWorkspaceUser,
  })
);
