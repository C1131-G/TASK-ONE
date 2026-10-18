import "server-only";
import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { auth } from "./auth";
import type {
  AuthenticatedUser,
  PortalUser,
  WorkspaceUser,
} from "./session-types";

// Clients are signed out after two idle hours; activity is recorded at most
// once a minute.
export const CLIENT_IDLE_LIMIT_MS = 2 * 60 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 60 * 1000;
export const PORTAL_PREVIEW_COOKIE = "metsys_portal_preview";

const readCookie = (headers: Headers, name: string): string | null => {
  const cookies = headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
};

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
    readonly requirePortalView: (
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

// A client who has been idle too long loses the session; otherwise their
// activity time moves forward.
const trackClientActivity = (
  sessionId: string,
  userId: string,
  lastActiveAt: Date | null
): Effect.Effect<void, AppError> =>
  Effect.gen(function* trackActivity() {
    const now = Date.now();
    if (lastActiveAt && now - lastActiveAt.getTime() > CLIENT_IDLE_LIMIT_MS) {
      yield* Effect.tryPromise({
        catch: unavailable,
        try: () => db.orm.public.Session.where({ id: sessionId }).deleteAll(),
      });
      return yield* Effect.fail(
        new AppError({
          code: "UNAUTHENTICATED",
          details: { reason: "inactivity" },
          message: "Signed out for inactivity.",
        })
      );
    }
    if (!lastActiveAt || now - lastActiveAt.getTime() > ACTIVITY_THROTTLE_MS) {
      yield* Effect.tryPromise({
        catch: unavailable,
        try: () =>
          db.orm.public.User.where({ id: userId }).update({
            lastActiveAt: new Date(now),
          }),
      });
    }
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
            "clientCompanyId",
            "lastActiveAt"
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

    if (user.role === "client") {
      yield* trackClientActivity(
        session.session.id,
        session.user.id,
        user.lastActiveAt
      );
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

// The client's own company, which must still be active.
const toPortalUser = (
  user: AuthenticatedUser,
  preview: PortalUser["preview"]
): Effect.Effect<PortalUser, AppError> =>
  Effect.gen(function* resolvePortalUser() {
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
      preview,
    };
  });

const requirePortalUser = (
  headers: Headers
): Effect.Effect<PortalUser, AppError> =>
  Effect.gen(function* checkPortalAccess() {
    const user = yield* loadSessionUser(headers);
    if (user.mustChangePassword) {
      return yield* Effect.fail(mustChangePassword());
    }
    return yield* toPortalUser(user, null);
  });

// A signed-in client, or an admin previewing a client. Only reads use this.
const requirePortalView = (
  headers: Headers
): Effect.Effect<PortalUser, AppError> =>
  Effect.gen(function* checkPortalView() {
    const user = yield* loadSessionUser(headers);
    if (user.mustChangePassword) {
      return yield* Effect.fail(mustChangePassword());
    }
    if (user.role === "client") {
      return yield* toPortalUser(user, null);
    }
    const previewId = readCookie(headers, PORTAL_PREVIEW_COOKIE);
    if (user.role !== "admin" || !previewId) {
      return yield* Effect.fail(portalOnly());
    }
    const target = yield* Effect.tryPromise({
      catch: unavailable,
      try: () =>
        db.orm.public.User.where({ id: previewId })
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
    if (!target || target.deactivatedAt || target.role !== "client") {
      return yield* Effect.fail(portalOnly());
    }
    return yield* toPortalUser(
      {
        clientCompanyId: target.clientCompanyId,
        employeeNumber: target.employeeNumber,
        id: previewId,
        mustChangePassword: target.mustChangePassword,
        name: target.name,
        role: "client",
        timeZone: target.timeZone,
      },
      { adminId: user.id, adminName: user.name }
    );
  });

export const AuthSessionLive = Layer.succeed(
  AuthSession,
  AuthSession.of({
    requireAuthenticated: loadSessionUser,
    requirePortalAccess: requirePortalUser,
    requirePortalView,
    requireWorkspaceAccess: requireWorkspaceUser,
  })
);
