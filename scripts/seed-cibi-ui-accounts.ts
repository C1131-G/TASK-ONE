import "dotenv/config";
import { Effect } from "effect";

import { db } from "../src/prisma/db";
import { authPool } from "../src/server/auth/database";
import {
  UserManagement,
  UserManagementLive,
} from "../src/server/people/user-management";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be configured before seeding UI accounts."
  );
}

const database = new URL(databaseUrl);
const databaseName = decodeURIComponent(database.pathname.slice(1));
if (
  process.env["NODE_ENV"] === "production" ||
  !["localhost", "127.0.0.1", "::1"].includes(database.hostname) ||
  !databaseName.startsWith("metsys") ||
  databaseName.endsWith("_test")
) {
  throw new Error(
    "UI accounts can only be seeded into a local, non-test Metsys database."
  );
}

const accountDefinitions = [
  {
    email: "cibi@admin.metsys.test",
    jobTitle: "Studio Administrator",
    name: "Cibi Admin",
    role: "admin",
  },
  {
    email: "cibi@employee.metsys.test",
    jobTitle: "Studio Employee",
    name: "Cibi Employee",
    role: "employee",
  },
] as const;

const createAccounts = Effect.gen(function* seedAccounts() {
  const administrator = yield* Effect.promise(() =>
    db.orm.public.User.where({
      deactivatedAt: null,
      mustChangePassword: false,
      role: "admin",
    })
      .select("id")
      .first()
  );
  if (!administrator) {
    throw new Error(
      "An active admin with a completed password setup is required to seed UI accounts."
    );
  }

  for (const account of accountDefinitions) {
    const existing = yield* Effect.promise(() =>
      db.orm.public.User.where({ emailNormalized: account.email })
        .select("id")
        .first()
    );
    if (existing) {
      throw new Error(
        `The UI account ${account.email} already exists; refusing to replace its credentials.`
      );
    }
  }

  const management = yield* UserManagement;
  for (const account of accountDefinitions) {
    const created = yield* management.createEmployee(administrator.id, {
      email: account.email,
      jobTitle: account.jobTitle,
      name: account.name,
      role: account.role,
      teamId: null,
    });
    process.stdout.write(
      `${created.role === "admin" ? "Admin" : "Employee"}\nEmployee ID: ${created.employeeId}\nEmail: ${created.email}\nTemporary password: ${created.temporaryPassword}\nChange password at first sign-in.\n\n`
    );
  }
});

try {
  await Effect.runPromise(
    createAccounts.pipe(Effect.provide(UserManagementLive))
  );
} finally {
  await authPool.end();
}
