import "dotenv/config";
import { Effect } from "effect";

import { db } from "../src/prisma/db";
import {
  UserManagement,
  UserManagementLive,
} from "../src/server/people/user-management";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be configured before seeding test users.");
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
    "Test users can only be seeded into a local, non-test Metsys database."
  );
}

const adminEmail = "test-admin@metsys.test";
const employeeEmail = "test-employee@metsys.test";

const existingAdmin = await db.orm.public.User.where({
  deactivatedAt: null,
  mustChangePassword: false,
  role: "admin",
})
  .select("id")
  .first();

if (!existingAdmin) {
  throw new Error(
    "An active admin who has completed password setup is required to seed test accounts."
  );
}

const existingTestAccounts = await Promise.all(
  [adminEmail, employeeEmail].map(async (email) => ({
    email,
    user: await db.orm.public.User.where({ emailNormalized: email })
      .select("id")
      .first(),
  }))
);
const accountConflict = existingTestAccounts.find(({ user }) => user);
if (accountConflict) {
  throw new Error(
    `A test account already exists for ${accountConflict.email}; remove or rename it before rerunning this seed.`
  );
}

const outputCredentials = (
  label: string,
  account: {
    readonly email: string;
    readonly employeeId: string;
    readonly temporaryPassword: string;
  }
): void => {
  process.stdout.write(
    `${label}\nEmployee ID: ${account.employeeId}\nEmail: ${account.email}\nTemporary password: ${account.temporaryPassword}\nChange password after sign-in.\n\n`
  );
};

const program = Effect.gen(function* seedTestUsers() {
  const userManagement = yield* UserManagement;
  const admin = yield* userManagement.createEmployee(existingAdmin.id, {
    email: adminEmail,
    jobTitle: "Studio Administrator",
    name: "Test Admin",
    role: "admin",
    teamId: null,
  });
  outputCredentials("Test admin", admin);

  const employee = yield* userManagement.createEmployee(existingAdmin.id, {
    email: employeeEmail,
    jobTitle: "Designer",
    name: "Test Employee",
    role: "employee",
    teamId: null,
  });
  outputCredentials("Test employee", employee);
});

await Effect.runPromise(program.pipe(Effect.provide(UserManagementLive)));
