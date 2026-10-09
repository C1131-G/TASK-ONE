import "dotenv/config";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { createAccessControl } from "better-auth/plugins/access";
import { admin } from "better-auth/plugins/admin";

import { db } from "@/src/prisma/db";

import { authPool } from "./database";

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
    before: createAuthMiddleware(async (context) => {
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
      roles: { admin: adminRole, employee: employeeRole },
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
