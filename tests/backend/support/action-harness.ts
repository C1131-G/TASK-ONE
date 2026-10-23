import { expect, mock } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import type { ActionResult } from "../../../src/server/core/action-result";
import "./next-cache-mock";
import { cleanActionFixtures } from "./action-fixture-cleanup";
import "./server-only-stub";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";
process.env["BETTER_AUTH_URL"] ??= "http://localhost:3000";

// Server Actions read the request headers through next/headers. Tests choose
// the "browser" by swapping the headers a persona signed in with. This module
// must be imported before any Server Action module.
let currentHeaders = new Headers();
mock.module("next/headers", () => ({
  headers: () => Promise.resolve(currentHeaders),
}));
export { revalidatedPaths, updatedTags } from "./next-cache-mock";

const { auth } = await import("../../../src/server/auth/auth");
const { withResolvedClientIp } =
  await import("../../../src/server/core/client-ip");
const { authPool } = await import("../../../src/server/auth/database");
const { UserManagement, UserManagementLive } =
  await import("../../../src/server/people/user-management");

export { authPool };

export type Persona =
  | "admin"
  | "anonymous"
  | "client"
  | "coworker"
  | "otherClient"
  | "deactivated"
  | "forced"
  | "outsider"
  | "owner";

export type ActionResultLike =
  | { readonly ok: true; readonly data: unknown }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

export type ActionFunction = (input: unknown) => Promise<ActionResultLike>;

export interface Ids {
  archivedProjectId: string;
  archivedTaskId: string;
  clientCompanyId: string;
  otherClientCompanyId: string;
  employeeId: string;
  fileId: string;
  projectId: string;
  random: string;
  taskId: string;
}

interface PersonaRecord {
  // The bearer token the mobile API accepts; empty until sign-in returns one.
  readonly bearerToken: string;
  readonly headers: Headers;
  readonly id: string;
}

export const EMAIL_DOMAIN = "action-harness.example";

const personas = new Map<Persona, PersonaRecord>();
let bootstrapAdminId = "";
let keyCounter = 0;
let signInCounter = Number.parseInt(randomUUID().slice(0, 8), 16) % 254;
let originalCompanySettings: Record<string, unknown> | null = null;
let startedAt = new Date();

export const ids: Ids = {
  archivedProjectId: "",
  archivedTaskId: "",
  clientCompanyId: "",
  employeeId: "",
  fileId: "",
  otherClientCompanyId: "",
  projectId: "",
  random: "",
  taskId: "",
};

export const nextKey = (): string => {
  keyCounter += 1;
  return `harness-key-${keyCounter}-${randomUUID().slice(0, 8)}`;
};

export const personaId = (persona: Persona): string =>
  personas.get(persona)?.id ?? "";

export const personaBearerToken = (persona: Persona): string =>
  personas.get(persona)?.bearerToken ?? "";

export const personaHeaders = (persona: Persona): Headers =>
  personas.get(persona)?.headers ?? new Headers();

export const callAs = async <Result extends ActionResultLike>(
  persona: Persona,
  action: (input: unknown) => Promise<Result>,
  input: unknown
): Promise<Result> => {
  currentHeaders = personas.get(persona)?.headers ?? new Headers();
  return await action(input);
};

// Runs an action as a persona whose browser also carries one extra cookie.
export const callAsWithCookie = async <Result extends ActionResultLike>(
  persona: Persona,
  cookie: string,
  action: (input: unknown) => Promise<Result>,
  input: unknown
): Promise<Result> => {
  const base = personas.get(persona)?.headers ?? new Headers();
  const headers = new Headers(base);
  headers.set(
    "cookie",
    [base.get("cookie"), cookie].filter(Boolean).join("; ")
  );
  currentHeaders = headers;
  return await action(input);
};

/**
 * Runs an action twice with the same idempotency key and checks that the
 * second call replays the first result exactly instead of acting again.
 */
export const replay = async <Data>(
  name: string,
  persona: Persona,
  action: (input: unknown) => Promise<ActionResult<Data>>,
  input: Record<string, unknown>
): Promise<Data> => {
  const idempotencyKey = nextKey();
  const run = () => callAs(persona, action, { ...input, idempotencyKey });
  const first = await run();
  if (!first.ok) {
    throw new Error(
      `${name} failed on the first call: ${first.error.code} ${first.error.message}`
    );
  }
  const second = await run();
  if (!second.ok) {
    throw new Error(
      `${name} failed on the replay: ${second.error.code} ${second.error.message}`
    );
  }
  expect(JSON.stringify(second.data), `${name} replay result`).toBe(
    JSON.stringify(first.data)
  );
  return first.data;
};

export const createPersona = async (
  role: "admin" | "employee",
  label: string
): Promise<PersonaRecord> => {
  const email = `${label}-${randomUUID()}@${EMAIL_DOMAIN}`;
  const created = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* createEmployee() {
        const users = yield* UserManagement;
        return yield* users.createEmployee(bootstrapAdminId, {
          email,
          jobTitle: null,
          name: `Harness ${label}`,
          role,
          teamId: null,
        });
      }),
      UserManagementLive
    )
  );
  const userRow = await authPool.query<{ id: string }>(
    'SELECT id FROM "user" WHERE "emailNormalized" = $1',
    [email.toLowerCase()]
  );
  const userId = userRow.rows[0]?.id;
  if (!userId) {
    throw new Error("The created test account could not be found.");
  }
  signInCounter = (signInCounter % 254) + 1;
  const signInIp = `198.51.100.${signInCounter}`;
  // Rate-limit rows live in the shared database, so another test file that
  // happened to use this address a moment ago can push a harness sign-in over
  // the limit on a fast machine. Start every harness sign-in from a clean slate.
  await authPool.query('DELETE FROM "rateLimit" WHERE key LIKE $1', [
    `${signInIp}%`,
  ]);
  const signIn = await auth.handler(
    withResolvedClientIp(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        body: JSON.stringify({ email, password: created.temporaryPassword }),
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": signInIp,
        },
        method: "POST",
      })
    )
  );
  if (signIn.status !== 200) {
    throw new Error(`Sign-in failed for ${label}: ${signIn.status}`);
  }
  const cookie = signIn.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return {
    bearerToken: signIn.headers.get("set-auth-token") ?? "",
    headers: new Headers({ cookie }),
    id: userId,
  };
};

export const setupHarness = async (): Promise<void> => {
  startedAt = new Date();
  const settings = await authPool.query("SELECT * FROM company_settings");
  originalCompanySettings = settings.rows[0] ?? null;

  bootstrapAdminId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false)',
    [
      bootstrapAdminId,
      "Harness Bootstrap",
      `${bootstrapAdminId}@${EMAIL_DOMAIN}`,
    ]
  );

  const admin = await createPersona("admin", "admin");
  const owner = await createPersona("employee", "owner");
  const outsider = await createPersona("employee", "outsider");
  const forced = await createPersona("employee", "forced");
  const deactivated = await createPersona("employee", "deactivated");
  await authPool.query(
    'UPDATE "user" SET "mustChangePassword" = false WHERE id = ANY($1::text[])',
    [[admin.id, owner.id, outsider.id, deactivated.id]]
  );
  await authPool.query(
    'UPDATE "user" SET "deactivatedAt" = now(), "deactivatedById" = $2 WHERE id = $1',
    [deactivated.id, bootstrapAdminId]
  );
  personas.set("admin", admin);
  personas.set("owner", owner);
  personas.set("outsider", outsider);
  personas.set("forced", forced);
  personas.set("deactivated", deactivated);

  // A client portal account. It signs in like everyone else, then becomes a
  // client of a harness company.
  const clientCompanyId = randomUUID();
  await authPool.query(
    'INSERT INTO client_company (id, name, "createdById") VALUES ($1, $2, $3)',
    [clientCompanyId, `Harness client ${clientCompanyId}`, bootstrapAdminId]
  );
  const client = await createPersona("employee", "client");
  await authPool.query(
    'UPDATE "user" SET role = \'client\', "clientCompanyId" = $2, "mustChangePassword" = false WHERE id = $1',
    [client.id, clientCompanyId]
  );
  personas.set("client", client);
  // A colleague in the same company, and a client of a different company.
  const coworker = await createPersona("employee", "coworker");
  await authPool.query(
    'UPDATE "user" SET role = \'client\', "clientCompanyId" = $2, "mustChangePassword" = false WHERE id = $1',
    [coworker.id, clientCompanyId]
  );
  personas.set("coworker", coworker);
  const otherClientCompanyId = randomUUID();
  await authPool.query(
    'INSERT INTO client_company (id, name, "createdById") VALUES ($1, $2, $3)',
    [
      otherClientCompanyId,
      `Harness other client ${otherClientCompanyId}`,
      bootstrapAdminId,
    ]
  );
  const otherClient = await createPersona("employee", "otherclient");
  await authPool.query(
    'UPDATE "user" SET role = \'client\', "clientCompanyId" = $2, "mustChangePassword" = false WHERE id = $1',
    [otherClient.id, otherClientCompanyId]
  );
  personas.set("otherClient", otherClient);
  personas.set("anonymous", {
    bearerToken: "",
    headers: new Headers(),
    id: "",
  });

  const projectId = randomUUID();
  const archivedProjectId = randomUUID();
  const taskId = randomUUID();
  const archivedTaskId = randomUUID();
  const fileId = randomUUID();
  const suffix = projectId.replaceAll("-", "").slice(0, 5).toUpperCase();
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `PM${suffix}`, "Harness project"]
  );
  await authPool.query(
    'INSERT INTO project (id, key, name, "archivedAt") VALUES ($1, $2, $3, now())',
    [archivedProjectId, `PA${suffix}`, "Harness archived project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4), ($5, $2, 2, $6, $4)',
    [taskId, projectId, "Owned task", owner.id, archivedTaskId, "Archived task"]
  );
  await authPool.query('UPDATE task SET "archivedAt" = now() WHERE id = $1', [
    archivedTaskId,
  ]);
  // The directly inserted tasks use numbers 1 and 2, so the next number a real
  // task creation allocates must be 3.
  await authPool.query(
    'INSERT INTO project_task_counter ("projectId", "nextNumber", "updatedAt") VALUES ($1, 3, now())',
    [projectId]
  );
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [
      fileId,
      projectId,
      taskId,
      owner.id,
      "owned.txt",
      `tasks/${fileId}/owned.txt`,
      "text/plain",
      12,
    ]
  );
  Object.assign(ids, {
    archivedProjectId,
    archivedTaskId,
    clientCompanyId,
    employeeId: owner.id,
    fileId,
    otherClientCompanyId,
    projectId,
    random: randomUUID(),
    taskId,
  });
};

export const teardownHarness = async (): Promise<void> => {
  await cleanActionFixtures(
    authPool,
    EMAIL_DOMAIN,
    startedAt,
    originalCompanySettings
  );
};
