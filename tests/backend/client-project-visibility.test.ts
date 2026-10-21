import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  callAs,
  ids,
  nextKey,
  replay,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const projects = await import("../../features/projects/projects-actions");
const tasks = await import("../../features/tasks/tasks-actions");

beforeAll(setupHarness);
afterAll(teardownHarness);

const projectRow = async (projectId: string) => {
  const result = await authPool.query<{
    clientVisible: boolean;
    version: number;
  }>('SELECT "clientVisible", version FROM project WHERE id = $1', [projectId]);
  return result.rows[0];
};

const taskRow = async (taskId: string) => {
  const result = await authPool.query<{
    clientVisible: boolean;
    version: number;
  }>('SELECT "clientVisible", version FROM task WHERE id = $1', [taskId]);
  return result.rows[0];
};

const newProject = async () => {
  const projectId = randomUUID();
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [
      projectId,
      `VP${projectId.replaceAll("-", "").slice(0, 6).toUpperCase()}`,
      "Harness visibility project",
    ]
  );
  return projectId;
};

it("keeps projects and tasks private to staff by default", async () => {
  expect(await projectRow(ids.projectId)).toMatchObject({
    clientVisible: false,
  });
  expect(await taskRow(ids.taskId)).toMatchObject({ clientVisible: false });
});

it("lets an administrator share and unshare a project, replaying a retry", async () => {
  const projectId = await newProject();
  const shared = await replay(
    "setProjectClientVisibilityAction",
    "admin",
    projects.setProjectClientVisibilityAction,
    { expectedVersion: 1, projectId, visible: true }
  );
  expect(shared).toMatchObject({ clientVisible: true, version: 2 });
  expect(await projectRow(projectId)).toEqual({
    clientVisible: true,
    version: 2,
  });
  const hidden = await callAs(
    "admin",
    projects.setProjectClientVisibilityAction,
    {
      expectedVersion: 2,
      idempotencyKey: nextKey(),
      projectId,
      visible: false,
    }
  );
  expect(hidden).toMatchObject({
    data: { clientVisible: false, version: 3 },
    ok: true,
  });
});

it("refuses everyone but an administrator on a project", async () => {
  const projectId = await newProject();
  for (const persona of ["owner", "outsider", "client"] as const) {
    // Sequential: personas share the mocked request headers.
    // eslint-disable-next-line no-await-in-loop
    const result = await callAs(
      persona,
      projects.setProjectClientVisibilityAction,
      {
        expectedVersion: 1,
        idempotencyKey: nextKey(),
        projectId,
        visible: true,
      }
    );
    expect(result).toMatchObject({ ok: false });
  }
  expect(await projectRow(projectId)).toEqual({
    clientVisible: false,
    version: 1,
  });
});

it("refuses a stale version and an archived project", async () => {
  const projectId = await newProject();
  const stale = await callAs(
    "admin",
    projects.setProjectClientVisibilityAction,
    {
      expectedVersion: 7,
      idempotencyKey: nextKey(),
      projectId,
      visible: true,
    }
  );
  expect(stale).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
  const archived = await callAs(
    "admin",
    projects.setProjectClientVisibilityAction,
    {
      expectedVersion: 1,
      idempotencyKey: nextKey(),
      projectId: ids.archivedProjectId,
      visible: true,
    }
  );
  expect(archived).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
});

it("lets a task's creator mark it shown to the client and replays a retry", async () => {
  const shown = await replay(
    "setTaskClientVisibilityAction",
    "owner",
    tasks.setTaskClientVisibilityAction,
    { expectedVersion: 1, taskId: ids.taskId, visible: true }
  );
  expect(shown).toMatchObject({ clientVisible: true, version: 2 });
  expect(await taskRow(ids.taskId)).toEqual({
    clientVisible: true,
    version: 2,
  });
  await authPool.query(
    'UPDATE task SET "clientVisible" = false, version = 1 WHERE id = $1',
    [ids.taskId]
  );
});

it("refuses people who cannot edit the task, clients and archived tasks", async () => {
  for (const persona of ["outsider", "client", "coworker"] as const) {
    // eslint-disable-next-line no-await-in-loop
    const result = await callAs(persona, tasks.setTaskClientVisibilityAction, {
      expectedVersion: 1,
      idempotencyKey: nextKey(),
      taskId: ids.taskId,
      visible: true,
    });
    expect(result).toMatchObject({ ok: false });
  }
  const archived = await callAs("admin", tasks.setTaskClientVisibilityAction, {
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    taskId: ids.archivedTaskId,
    visible: true,
  });
  expect(archived).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const stale = await callAs("owner", tasks.setTaskClientVisibilityAction, {
    expectedVersion: 9,
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
    visible: true,
  });
  expect(stale).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
  expect(await taskRow(ids.taskId)).toMatchObject({ clientVisible: false });
});
