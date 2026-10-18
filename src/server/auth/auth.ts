import "server-only";
import "dotenv/config";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { createAccessControl } from "better-auth/plugins/access";
import { admin } from "better-auth/plugins/admin";

import { db } from "@/src/prisma/db";

import { recordAuditEvent } from "../audit/audit-log";
import { authPool } from "./database";
import {
  LOGIN_LOCK_MINUTES,
  clearExpiredLock,
  findSignInTarget,
  isLocked,
  normalizeEmail,
  recordFailedSignIn,
  recordSuccessfulSignIn,
} from "./lockout";

const authSecret = process.env["BETTER_AUTH_SECRET"];
if (!authSecret || authSecret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
}

const statement = {
  session: [],
  user: [],
} as const;

const accessControl = createAccessControl(statement);
const adminRole = accessControl.newRole({ session: [], user: [] });
const employeeRole = accessControl.newRole({ session: [], user: [] });
const clientRole = accessControl.newRole({ session: [], user: [] });

const INVALID_SIGN_IN = "Invalid email or password.";

interface SignInContext {
  readonly body?: unknown;
  readonly headers?: Headers | undefined;
  readonly context: { readonly returned?: unknown };
}

const emailOf = (context: SignInContext): string | null => {
  const { body } = context;
  return typeof body === "object" && body !== null && "email" in body
    ? normalizeEmail(body.email)
    : null;
};

// A locked account is refused with the same message as a wrong password, so
// the response never confirms that the account exists or is locked.
const rejectLockedSignIn = async (context: SignInContext): Promise<void> => {
  const email = emailOf(context);
  if (!email) {
    return;
  }
  const now = new Date();
  const target = await findSignInTarget(email);
  await clearExpiredLock(target, now);
  if (isLocked(target, now)) {
    // The refusal below skips the after-hook, so the attempt is audited here.
    try {
      await recordAuditEvent(db, {
        details: { reason: "locked" },
        headers: context.headers ?? null,
        subjectUserId: target?.id ?? null,
        type: "login_blocked",
      });
    } catch {
      // The trail must never turn a refusal into a server error.
    }
    throw new APIError("UNAUTHORIZED", { message: INVALID_SIGN_IN });
  }
};

// Counts failures, locks after too many, resets on success, and writes each
// outcome to the audit trail.
const auditSignInOutcome = async (context: SignInContext): Promise<void> => {
  const email = emailOf(context);
  if (!email) {
    return;
  }
  const now = new Date();
  const headers = context.headers ?? null;
  const target = await findSignInTarget(email);
  const failed = context.context.returned instanceof APIError;
  const subjectUserId = target?.id ?? null;
  try {
    if (failed && target && isLocked(target, now)) {
      await recordAuditEvent(db, {
        details: { reason: "locked" },
        headers,
        subjectUserId,
        type: "login_blocked",
      });
      return;
    }
    if (failed) {
      const outcome = target ? await recordFailedSignIn(target.id) : null;
      await recordAuditEvent(db, {
        details: target ? { attempts: outcome?.count ?? 0 } : { email },
        headers,
        subjectUserId,
        type: "login_failed",
      });
      if (outcome?.locked) {
        await recordAuditEvent(db, {
          details: { minutes: LOGIN_LOCK_MINUTES },
          headers,
          subjectUserId,
          type: "account_locked",
        });
      }
      return;
    }
    if (target) {
      await recordSuccessfulSignIn(target.id);
      await recordAuditEvent(db, {
        headers,
        subjectUserId,
        type: "login_succeeded",
      });
    }
  } catch {
    // Counting and auditing must never turn a sign-in into a server error.
  }
};

const unrestrictedAuthPaths = new Set([
  "/change-password",
  "/sign-out",
  "/get-session",
]);

export const auth = betterAuth({
  appName: "Metsys",
  baseURL: process.env["BETTER_AUTH_URL"],
  database: authPool,
  databaseHooks: {
    user: {
      create: {
        before: (user) =>
          Promise.resolve({
            data: {
              ...user,
              email: user.email.trim().toLowerCase(),
              emailNormalized: user.email.trim().toLowerCase(),
              mustChangePassword: true,
            },
          }),
      },
      update: {
        before: (user) =>
          typeof user.email === "string"
            ? Promise.resolve({
                data: {
                  ...user,
                  email: user.email.trim().toLowerCase(),
                  emailNormalized: user.email.trim().toLowerCase(),
                },
              })
            : Promise.resolve(),
      },
    },
  },
  emailAndPassword: {
    disableSignUp: true,
    enabled: true,
    maxPasswordLength: 128,
    minPasswordLength: 12,
    revokeSessionsOnPasswordReset: true,
  },
  hooks: {
    after: createAuthMiddleware(async (context) => {
      if (context.path !== "/sign-in/email") {
        return;
      }
      await auditSignInOutcome(context);
    }),
    before: createAuthMiddleware(async (context) => {
      if (context.path === "/sign-in/email") {
        await rejectLockedSignIn(context);
        return;
      }
      const { session } = context.context;
      if (!session) {
        return;
      }

      const user = await db.orm.public.User.where({ id: session.user.id })
        .select("deactivatedAt", "mustChangePassword")
        .first();

      if (!user || user.deactivatedAt) {
        throw new APIError("UNAUTHORIZED", {
          message: "This account is unavailable.",
        });
      }

      if (unrestrictedAuthPaths.has(context.path)) {
        return;
      }

      if (user.mustChangePassword) {
        throw new APIError("FORBIDDEN", {
          message: "Change your password before continuing.",
        });
      }
    }),
  },
  plugins: [
    admin({
      ac: accessControl,
      adminRoles: ["admin"],
      defaultRole: "employee",
      roles: { admin: adminRole, client: clientRole, employee: employeeRole },
    }),
  ],
  rateLimit: {
    customRules: {
      "/change-password": { max: 5, window: 60 },
      "/sign-in/email": { max: 5, window: 60 },
    },
    enabled: true,
    max: 100,
    storage: "database",
    window: 60,
  },
  secret: authSecret,
  session: {
    cookieCache: { enabled: false },
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 60 * 8 + 1,
  },
  trustedOrigins: process.env["BETTER_AUTH_TRUSTED_ORIGINS"]
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  user: {
    additionalFields: {
      clientCompanyId: { input: false, required: false, type: "string" },
      deactivatedAt: {
        input: false,
        required: false,
        returned: false,
        type: "date",
      },
      deactivatedById: {
        input: false,
        required: false,
        returned: false,
        type: "string",
      },
      emailNormalized: {
        input: false,
        required: false,
        returned: false,
        type: "string",
      },
      employeeNumber: { input: false, type: "number" },
      jobTitle: { input: false, required: false, type: "string" },
      mustChangePassword: { input: false, type: "boolean" },
      teamId: { input: false, required: false, type: "string" },
      timeZone: { required: false, type: "string" },
    },
    deleteUser: { enabled: false },
  },
});
