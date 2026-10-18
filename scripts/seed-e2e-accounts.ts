import "dotenv/config";
import { randomUUID } from "node:crypto";

import { auth } from "../src/server/auth/auth";
import { authPool } from "../src/server/auth/database";

// Seeds the accounts the portal E2E specs sign in with: an Acme client company
// with two client users, two handlers and one linked project. It is safe to
// run again; rows are found by email or name and passwords are reset.
//
// E2E_ADMIN_PASSWORD   password for ui-admin@metsys.test (created if missing)
// E2E_PORTAL_PASSWORD  password for the handlers and the client users
export const E2E_ACCOUNTS = {
  admin: "ui-admin@metsys.test",
  clientOne: "client-one@acme.test",
  clientTwo: "client-two@acme.test",
  lockoutClient: "lockout-client@acme.test",
  newClient: "new-client@acme.test",
  handlerOne: "handler-one@metsys.test",
  handlerTwo: "handler-two@metsys.test",
} as const;

const COMPANY_NAME = "Acme";
const PROJECT_KEY = "ACMEP";

const adminPassword = process.env["E2E_ADMIN_PASSWORD"];
const employeePassword = process.env["E2E_EMPLOYEE_PASSWORD"];
const portalPassword = process.env["E2E_PORTAL_PASSWORD"];
if (!(adminPassword && employeePassword && portalPassword)) {
  throw new Error(
    "Set E2E_ADMIN_PASSWORD, E2E_EMPLOYEE_PASSWORD, and E2E_PORTAL_PASSWORD first."
  );
}

const context = await auth.$context;

interface SeedUser {
  readonly companyId?: string;
  readonly email: string;
  // Starts the account on a temporary password that must be changed.
  readonly mustChangePassword?: boolean;
  readonly name: string;
  readonly password: string;
  readonly role: "admin" | "client" | "employee";
}

const upsertUser = async (seed: SeedUser): Promise<string> => {
  const hash = await context.password.hash(seed.password);
  const existing = await authPool.query<{ id: string }>(
    'SELECT id FROM "user" WHERE "emailNormalized" = $1',
    [seed.email]
  );
  let userId = existing.rows[0]?.id;
  if (userId) {
    await authPool.query(
      'UPDATE "user" SET "deactivatedAt" = NULL, "failedLoginCount" = 0, "lockedUntil" = NULL, "mustChangePassword" = $3, "clientCompanyId" = $2 WHERE id = $1',
      [userId, seed.companyId ?? null, seed.mustChangePassword ?? false]
    );
    await authPool.query(
      'UPDATE account SET password = $2, "updatedAt" = now() WHERE "userId" = $1 AND "providerId" = \'credential\'',
      [userId, hash]
    );
    return userId;
  }
  userId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword", "clientCompanyId") VALUES ($1, $2, $3, $3, $4, $6, $5)',
    [
      userId,
      seed.name,
      seed.email,
      seed.role,
      seed.companyId ?? null,
      seed.mustChangePassword ?? false,
    ]
  );
  await authPool.query(
    'INSERT INTO account (id, "accountId", "providerId", "userId", password) VALUES ($1, $2, \'credential\', $2, $3)',
    [randomUUID(), userId, hash]
  );
  return userId;
};

const ensureCompany = async (adminId: string): Promise<string> => {
  const found = await authPool.query<{ id: string }>(
    "SELECT id FROM client_company WHERE name = $1",
    [COMPANY_NAME]
  );
  const existing = found.rows[0]?.id;
  if (existing) {
    await authPool.query(
      'UPDATE client_company SET "deactivatedAt" = NULL, "deactivatedById" = NULL WHERE id = $1',
      [existing]
    );
    return existing;
  }
  const id = randomUUID();
  await authPool.query(
    'INSERT INTO client_company (id, name, "createdById", version) VALUES ($1, $2, $3, 1)',
    [id, COMPANY_NAME, adminId]
  );
  return id;
};

const ensureProject = async (): Promise<string> => {
  const found = await authPool.query<{ id: string }>(
    "SELECT id FROM project WHERE key = $1",
    [PROJECT_KEY]
  );
  const existing = found.rows[0]?.id;
  if (existing) {
    return existing;
  }
  const id = randomUUID();
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [id, PROJECT_KEY, "Acme Web App"]
  );
  await authPool.query(
    'INSERT INTO project_task_counter ("projectId", "nextNumber", "updatedAt") VALUES ($1, 1, now())',
    [id]
  );
  return id;
};

const adminId = await upsertUser({
  email: E2E_ACCOUNTS.admin,
  name: "UI Admin",
  password: adminPassword,
  role: "admin",
});
await upsertUser({
  email: "ui-employee@metsys.test",
  name: "UI Employee",
  password: employeePassword,
  role: "employee",
});
const handlerOneId = await upsertUser({
  email: E2E_ACCOUNTS.handlerOne,
  name: "Hana Handler",
  password: portalPassword,
  role: "employee",
});
const handlerTwoId = await upsertUser({
  email: E2E_ACCOUNTS.handlerTwo,
  name: "Hugo Handler",
  password: portalPassword,
  role: "employee",
});
const companyId = await ensureCompany(adminId);
await upsertUser({
  companyId,
  email: E2E_ACCOUNTS.clientOne,
  name: "Casey Client",
  password: portalPassword,
  role: "client",
});
await upsertUser({
  companyId,
  email: E2E_ACCOUNTS.clientTwo,
  name: "Corin Client",
  password: portalPassword,
  role: "client",
});
await upsertUser({
  companyId,
  email: E2E_ACCOUNTS.lockoutClient,
  name: "Lena Lockout",
  password: portalPassword,
  role: "client",
});
// Reset on every run, so the portal spec can walk through the first sign-in
// and forced password change again.
await upsertUser({
  companyId,
  email: E2E_ACCOUNTS.newClient,
  mustChangePassword: true,
  name: "Nadia New",
  password: portalPassword,
  role: "client",
});
const projectId = await ensureProject();

const existingTeam = await authPool.query<{ id: string }>(
  "SELECT id FROM team WHERE name = $1",
  ["UI Navigation Team"]
);
const teamId = existingTeam.rows[0]?.id ?? randomUUID();
if (!existingTeam.rows[0]) {
  await authPool.query(
    "INSERT INTO team (id, name, description) VALUES ($1, $2, $3)",
    [
      teamId,
      "UI Navigation Team",
      "Synthetic team for browser navigation checks.",
    ]
  );
}
await authPool.query(
  'UPDATE "user" SET "teamId" = $2 WHERE email IN ($1, $3)',
  [E2E_ACCOUNTS.handlerOne, teamId, E2E_ACCOUNTS.handlerTwo]
);

await authPool.query(
  'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($3, $1, $2) ON CONFLICT DO NOTHING',
  [companyId, projectId, randomUUID()]
);
for (const employeeId of [handlerOneId, handlerTwoId]) {
  // eslint-disable-next-line no-await-in-loop
  await authPool.query(
    'INSERT INTO client_company_handler (id, "companyId", "employeeId", "assignedById") VALUES ($3, $1, $2, $4) ON CONFLICT DO NOTHING',
    [companyId, employeeId, randomUUID(), adminId]
  );
}

// Earlier runs may have used up the per-address sign-in allowance.
await authPool.query('DELETE FROM "rateLimit"');

process.stdout.write(
  `Seeded ${COMPANY_NAME} (${companyId}) with project ${PROJECT_KEY}, 2 handlers and 4 client users.\n`
);
await authPool.end();
