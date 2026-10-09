import { mock } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

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
// Cache revalidation has no effect outside the Next.js runtime; recording the
// paths lets tests observe what an action asked to refresh.
export const revalidatedPaths: string[] = [];
mock.module("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidatedPaths.push(path);
  },
}));

const { auth } = await import("../../../src/server/auth/auth");
const { authPool } = await import("../../../src/server/auth/database");
const { UserManagement, UserManagementLive } =
  await import("../../../src/server/people/user-management");

export { authPool };

export type Persona =
  | "admin"
  | "anonymous"
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
  employeeId: string;
  fileId: string;
  projectId: string;
  random: string;
  taskId: string;
}

interface PersonaRecord {
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
  employeeId: "",
  fileId: "",
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

export const callAs = async (
  persona: Persona,
  action: ActionFunction,
  input: unknown
): Promise<ActionResultLike> => {
  currentHeaders = personas.get(persona)?.headers ?? new Headers();
  return await action(input);
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
  const userRow = await authPool.query(
    'SELECT id FROM "user" WHERE "emailNormalized" = $1',
    [email.toLowerCase()]
  );
  const userId: string = userRow.rows[0]?.id;
  signInCounter = (signInCounter % 254) + 1;
  const signIn = await auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/email", {
      body: JSON.stringify({ email, password: created.temporaryPassword }),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `198.51.100.${signInCounter}`,
      },
      method: "POST",
    })
  );
  if (signIn.status !== 200) {
    throw new Error(`Sign-in failed for ${label}: ${signIn.status}`);
  }
  const cookie = signIn.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { headers: new Headers({ cookie }), id: userId };
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
  personas.set("anonymous", { headers: new Headers(), id: "" });

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
    employeeId: owner.id,
    fileId,
    projectId,
    random: randomUUID(),
    taskId,
  });
};

const del = async (sql: string): Promise<void> => {
  await authPool.query(sql);
};

// Removes everything the harness and the flows run through it created. Rows
// are found by the harness email domain and by project and team name prefixes,
// so records created inside a test flow are cleaned up as well.
export const teardownHarness = async (): Promise<void> => {
  const users = `(SELECT id FROM "user" WHERE email LIKE '%@${EMAIL_DOMAIN}')`;
  const projects = `(SELECT id FROM project WHERE name LIKE 'Harness%' OR name LIKE 'Replay%')`;
  const tasks = `(SELECT id FROM task WHERE "projectId" IN ${projects} OR "createdById" IN ${users})`;
  const statements = [
    `DELETE FROM recurrence_generation WHERE "sourceTaskId" IN ${tasks} OR "successorTaskId" IN ${tasks}`,
    `DELETE FROM upload_intent WHERE "taskId" IN ${tasks} OR "projectId" IN ${projects} OR "ownerId" IN ${users}`,
    `DELETE FROM file_asset WHERE "projectId" IN ${projects} OR "taskId" IN ${tasks} OR "uploadedById" IN ${users} OR "deletedById" IN ${users}`,
    `DELETE FROM comment WHERE "taskId" IN ${tasks} OR "authorId" IN ${users} OR "deletedById" IN ${users}`,
    `DELETE FROM comment_reaction WHERE "userId" IN ${users}`,
    `DELETE FROM task_subtask WHERE "taskId" IN ${tasks} OR "assigneeId" IN ${users}`,
    `DELETE FROM task_assignee WHERE "taskId" IN ${tasks} OR "userId" IN ${users} OR "assignedById" IN ${users}`,
    `DELETE FROM notification WHERE "userId" IN ${users} OR "actorId" IN ${users}`,
    `DELETE FROM activity WHERE "actorId" IN ${users}`,
    `DELETE FROM undo_record WHERE "actorId" IN ${users}`,
    `DELETE FROM idempotency_key WHERE "actorId" IN ${users}`,
    `DELETE FROM push_delivery WHERE "userId" IN ${users}`,
    `DELETE FROM calendar_event WHERE "createdById" IN ${users}`,
    `DELETE FROM calendar_event_attendee WHERE "userId" IN ${users}`,
    `DELETE FROM project_member WHERE "projectId" IN ${projects} OR "userId" IN ${users}`,
    `DELETE FROM task WHERE id IN ${tasks}`,
    `DELETE FROM project WHERE id IN ${projects}`,
    `DELETE FROM label WHERE name LIKE 'replay-%'`,
    `DELETE FROM team WHERE name LIKE 'Replay%'`,
    `DELETE FROM "user" WHERE email LIKE '%@${EMAIL_DOMAIN}' AND "deactivatedById" IS NOT NULL`,
    `DELETE FROM "user" WHERE email LIKE '%@${EMAIL_DOMAIN}'`,
  ];
  for (const statement of statements) {
    // Order matters because of the foreign keys between these tables.
    // eslint-disable-next-line no-await-in-loop
    await del(statement);
  }
  // Actions such as file duplication queue background jobs; remove the ones
  // this run created so they never reach another test's job processor.
  await authPool.query('DELETE FROM job WHERE "createdAt" >= $1', [startedAt]);
  if (originalCompanySettings) {
    await authPool.query(
      'UPDATE company_settings SET name = $1, slug = $2, "brandColor" = $3, "brandEnabled" = $4, "timeZone" = $5',
      [
        originalCompanySettings["name"],
        originalCompanySettings["slug"],
        originalCompanySettings["brandColor"],
        originalCompanySettings["brandEnabled"],
        originalCompanySettings["timeZone"],
      ]
    );
  }
};
