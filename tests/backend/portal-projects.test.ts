import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  callAs,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { ActionResultLike } from "./support/action-harness";

const portalQueries = await import("../../features/portal/portal-queries");

// Strings that exist only in staff-side data. None may reach a client.
const SECRET_COMMENT = "Internal note: the client is unhappy about pricing";
const SECRET_FILE = "confidential-contract.pdf";
const SECRET_DESCRIPTION = "Internal description with budget details";
const SECRET_TITLE = "Unshared staff-only task";
const SECRET_BUG_TITLE = "Bug filed as a task";

interface Fixture {
  readonly archivedSharedTaskId: string;
  readonly bugTaskId: string;
  readonly doneTaskId: string;
  readonly openTaskId: string;
  readonly projectId: string;
  readonly unsharedTaskId: string;
}

const fixture: Fixture = {
  archivedSharedTaskId: randomUUID(),
  bugTaskId: randomUUID(),
  doneTaskId: randomUUID(),
  openTaskId: randomUUID(),
  projectId: randomUUID(),
  unsharedTaskId: randomUUID(),
};

const keyFor = (projectId: string) =>
  `SP${projectId.replaceAll("-", "").slice(0, 6).toUpperCase()}`;

const newProject = async (
  overrides: { visible?: boolean; archived?: boolean; linkedTo?: string } = {}
) => {
  const projectId = randomUUID();
  await authPool.query(
    'INSERT INTO project (id, key, name, "clientVisible", "archivedAt") VALUES ($1, $2, $3, $4, $5)',
    [
      projectId,
      keyFor(projectId),
      "Harness portal project",
      overrides.visible ?? true,
      overrides.archived ? new Date() : null,
    ]
  );
  if (overrides.linkedTo) {
    await authPool.query(
      'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
      [randomUUID(), overrides.linkedTo, projectId]
    );
  }
  return projectId;
};

beforeAll(async () => {
  await setupHarness();
  const owner = personaId("owner");
  const { projectId } = fixture;
  await authPool.query(
    "INSERT INTO project (id, key, name, description, status, \"dueDate\", \"clientVisible\") VALUES ($1, $2, $3, $4, 'active', '2027-03-01', true)",
    [projectId, keyFor(projectId), "Harness shared project", "Website rebuild"]
  );
  await authPool.query(
    'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
    [randomUUID(), ids.clientCompanyId, projectId]
  );
  await authPool.query(
    "INSERT INTO task (id, \"projectId\", \"projectTaskNumber\", title, status, \"dueDate\", description, \"clientVisible\", \"createdById\") VALUES ($1, $2, 1, $3, 'done', '2026-11-01', $4, true, $5), ($6, $2, 2, $7, 'progress', '2026-12-15', $4, true, $5), ($8, $2, 3, $9, 'todo', null, $4, false, $5)",
    [
      fixture.doneTaskId,
      projectId,
      "Design approved",
      SECRET_DESCRIPTION,
      owner,
      fixture.openTaskId,
      "Build the pages",
      fixture.unsharedTaskId,
      SECRET_TITLE,
    ]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, status, "clientVisible", "archivedAt", "archivedById", "createdById") VALUES ($1, $2, 4, \'Archived but shared\', \'todo\', true, now(), $3, $3)',
    [fixture.archivedSharedTaskId, projectId, owner]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, type, status, "clientVisible", "createdById") VALUES ($1, $2, 5, $3, \'bug\', \'todo\', true, $4)',
    [fixture.bugTaskId, projectId, SECRET_BUG_TITLE, owner]
  );
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $2)',
    [fixture.openTaskId, owner]
  );
  await authPool.query(
    "INSERT INTO comment (id, \"taskId\", \"authorId\", body, visibility) VALUES ($1, $2, $3, $4, 'internal'), ($5, $2, $3, $4, 'public')",
    [randomUUID(), fixture.openTaskId, owner, SECRET_COMMENT, randomUUID()]
  );
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, \'application/pdf\', 10)',
    [
      randomUUID(),
      projectId,
      fixture.openTaskId,
      owner,
      SECRET_FILE,
      `tasks/${projectId}/contract.pdf`,
    ]
  );
  await authPool.query(
    "INSERT INTO project_milestone (id, \"projectId\", name, \"dueDate\", \"completedAt\", position) VALUES ($1, $2, 'Kickoff', '2026-10-01', now(), 0), ($3, $2, 'Launch', '2027-02-01', null, 2), ($4, $2, 'Beta', '2026-12-01', null, 1)",
    [randomUUID(), projectId, randomUUID(), randomUUID()]
  );
});
afterAll(teardownHarness);

const dataOf = (result: ActionResultLike): unknown => {
  if (!result.ok) {
    throw new Error(`Unexpected failure: ${result.error.code}`);
  }
  return result.data;
};

const listIds = async (persona: "client" | "coworker" | "otherClient") => {
  const result = await callAs(
    persona,
    portalQueries.listPortalSharedProjects,
    {}
  );
  const data = dataOf(result);
  return Array.isArray(data) ? data.map(({ id }: { id: string }) => id) : [];
};

const detail = async (
  persona: "client" | "coworker" | "otherClient",
  projectId: string
) => await callAs(persona, portalQueries.getPortalSharedProject, { projectId });

it("lists a shared project with its progress and next milestone", async () => {
  const result = await callAs(
    "client",
    portalQueries.listPortalSharedProjects,
    {}
  );
  const mine = (dataOf(result) as readonly Record<string, unknown>[]).find(
    ({ id }) => id === fixture.projectId
  );
  expect(mine).toEqual({
    description: "Website rebuild",
    dueDate: "2027-03-01",
    id: fixture.projectId,
    key: keyFor(fixture.projectId),
    name: "Harness shared project",
    nextMilestone: { dueDate: "2026-12-01", name: "Beta" },
    // One of the two shared, open tasks is done; the unshared, archived and
    // bug tasks do not count.
    progress: { done: 1, total: 2 },
    status: "active",
  });
});

it("shows upcoming milestones and only the tasks marked for the client", async () => {
  const result = await detail("client", fixture.projectId);
  const project = dataOf(result) as Record<string, unknown>;
  expect(project["milestones"]).toEqual([
    { dueDate: "2026-12-01", id: expect.any(String), name: "Beta" },
    { dueDate: "2027-02-01", id: expect.any(String), name: "Launch" },
  ]);
  expect(project["tasks"]).toEqual([
    {
      dueDate: "2026-11-01",
      id: fixture.doneTaskId,
      status: "done",
      title: "Design approved",
    },
    {
      dueDate: "2026-12-15",
      id: fixture.openTaskId,
      status: "progress",
      title: "Build the pages",
    },
  ]);
});

it("never sends internal comments, people, files, descriptions or unshared work", async () => {
  const everything = JSON.stringify([
    dataOf(await callAs("client", portalQueries.listPortalSharedProjects, {})),
    dataOf(await detail("client", fixture.projectId)),
  ]);
  for (const secret of [
    SECRET_COMMENT,
    SECRET_FILE,
    SECRET_DESCRIPTION,
    SECRET_TITLE,
    SECRET_BUG_TITLE,
    "Archived but shared",
    "Harness owner",
    personaId("owner"),
    fixture.unsharedTaskId,
    fixture.archivedSharedTaskId,
    fixture.bugTaskId,
  ]) {
    expect(everything.includes(secret), secret).toBe(false);
  }
});

it("shares the project with colleagues of the same company only", async () => {
  expect(await listIds("coworker")).toContain(fixture.projectId);
  expect(await listIds("otherClient")).not.toContain(fixture.projectId);
  expect(await detail("otherClient", fixture.projectId)).toMatchObject({
    error: { code: "NOT_FOUND" },
    ok: false,
  });
});

it("hides a project that is assigned to the company but not shared", async () => {
  const projectId = await newProject({
    linkedTo: ids.clientCompanyId,
    visible: false,
  });
  expect(await listIds("client")).not.toContain(projectId);
  expect(await detail("client", projectId)).toMatchObject({
    error: { code: "NOT_FOUND" },
    ok: false,
  });
});

it("hides a shared project that was never assigned to the company", async () => {
  const projectId = await newProject({ visible: true });
  await authPool.query(
    'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
    [randomUUID(), ids.otherClientCompanyId, projectId]
  );
  expect(await listIds("client")).not.toContain(projectId);
  expect(await detail("client", projectId)).toMatchObject({
    error: { code: "NOT_FOUND" },
    ok: false,
  });
  expect(await listIds("otherClient")).toContain(projectId);
});

it("hides archived projects and projects taken off the company", async () => {
  const archived = await newProject({
    archived: true,
    linkedTo: ids.clientCompanyId,
  });
  const removed = await newProject({ linkedTo: ids.clientCompanyId });
  await authPool.query(
    'UPDATE client_company_project SET "removedAt" = now() WHERE "projectId" = $1',
    [removed]
  );
  const listed = await listIds("client");
  expect(listed).not.toContain(archived);
  expect(listed).not.toContain(removed);
  expect(await detail("client", removed)).toMatchObject({
    error: { code: "NOT_FOUND" },
    ok: false,
  });
});

it("stops showing a task as soon as it is no longer marked", async () => {
  await authPool.query(
    'UPDATE task SET "clientVisible" = false WHERE id = $1',
    [fixture.openTaskId]
  );
  const project = dataOf(await detail("client", fixture.projectId)) as {
    readonly progress: unknown;
    readonly tasks: readonly { readonly id: string }[];
  };
  expect(project.tasks.map(({ id }) => id)).toEqual([fixture.doneTaskId]);
  expect(project.progress).toEqual({ done: 1, total: 1 });
  await authPool.query('UPDATE task SET "clientVisible" = true WHERE id = $1', [
    fixture.openTaskId,
  ]);
});

it("rejects malformed and unknown project ids", async () => {
  expect(
    await callAs("client", portalQueries.getPortalSharedProject, {
      projectId: "not-a-uuid",
    })
  ).toMatchObject({ error: { code: "VALIDATION_FAILED" }, ok: false });
  expect(await detail("client", randomUUID())).toMatchObject({
    error: { code: "NOT_FOUND" },
    ok: false,
  });
});

it("refuses staff without a preview, and a deactivated client", async () => {
  for (const persona of ["owner", "admin", "anonymous"] as const) {
    // Sequential: personas share the mocked request headers.
    // eslint-disable-next-line no-await-in-loop
    const list = await callAs(
      persona,
      portalQueries.listPortalSharedProjects,
      {}
    );
    expect(list.ok, persona).toBe(false);
    // eslint-disable-next-line no-await-in-loop
    const one = await callAs(persona, portalQueries.getPortalSharedProject, {
      projectId: fixture.projectId,
    });
    expect(one.ok, persona).toBe(false);
  }
  await authPool.query(
    'UPDATE "user" SET "deactivatedAt" = now(), "deactivatedById" = $2 WHERE id = $1',
    [personaId("coworker"), personaId("admin")]
  );
  expect(
    await callAs("coworker", portalQueries.listPortalSharedProjects, {})
  ).toMatchObject({ error: { code: "UNAUTHENTICATED" }, ok: false });
  expect(await detail("coworker", fixture.projectId)).toMatchObject({
    error: { code: "UNAUTHENTICATED" },
    ok: false,
  });
});
