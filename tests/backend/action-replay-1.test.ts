/* eslint-disable no-unused-vars */
import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import {
  authPool,
  callAs,
  EMAIL_DOMAIN,
  ids,
  nextKey,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { ActionFunction, Persona } from "./support/action-harness";

const calendar = await import("../../app/actions/calendar");
const comments = await import("../../app/actions/comments");
const companySettings = await import("../../app/actions/company-settings");
const dashboard = await import("../../app/actions/dashboard");
const discovery = await import("../../app/actions/discovery");
const employees = await import("../../app/actions/employees");
const jobs = await import("../../app/actions/jobs");
const labels = await import("../../app/actions/labels");
const notifications = await import("../../app/actions/notifications");
const password = await import("../../app/actions/password");
const personalPreferences =
  await import("../../app/actions/personal-preferences");
const projects = await import("../../app/actions/projects");
const savedViews = await import("../../app/actions/saved-views");
const sessions = await import("../../app/actions/sessions");
const subtasks = await import("../../app/actions/subtasks");
const tasks = await import("../../app/actions/tasks");
const teams = await import("../../app/actions/teams");
const uploads = await import("../../app/actions/uploads");
const { Idempotency, IdempotencyLive } =
  await import("../../src/server/core/idempotency");
const { Storage } = await import("../../src/server/storage/storage");
const { AvatarUploadResultSchema, FinalizedFileSchema, Uploads } =
  await import("../../src/server/storage/uploads-contracts");
const { UploadsLive } = await import("../../src/server/storage/uploads");

const unique = (): string => randomUUID().replaceAll("-", "").slice(0, 8);
const projectKey = (): string => `R${unique().slice(0, 6)}`.toUpperCase();

/**
 * Runs an action twice with the same idempotency key and checks that the
 * second call replays the first result exactly instead of acting again.
 */
const replay = async <Data>(
  name: string,
  persona: Persona,
  action: unknown,
  input: Record<string, unknown>
): Promise<Data> => {
  const idempotencyKey = nextKey();
  const run = () =>
    callAs(persona, action as ActionFunction, { ...input, idempotencyKey });
  const first = await run();
  if (!first.ok) {
    throw new Error(
      `${name} failed on the first call: ${first.error?.code} ${first.error?.message}`
    );
  }
  const second = await run();
  if (!second.ok) {
    throw new Error(
      `${name} failed on the replay: ${second.error?.code} ${second.error?.message}`
    );
  }
  expect(JSON.stringify(second.data), `${name} replay result`).toBe(
    JSON.stringify(first.data)
  );
  return first.data as Data;
};

const taskVersion = async (taskId: string): Promise<number> => {
  const rows = await authPool.query("SELECT version FROM task WHERE id = $1", [
    taskId,
  ]);
  return rows.rows[0]?.version;
};

interface Versioned {
  readonly id: string;
  readonly version: number;
}
interface VersionOnly {
  readonly version: number;
}
interface SubtaskResult {
  readonly parentVersion: number;
  readonly subtask: { readonly id: string };
}

const state: {
  copyProjectId: string;
  projectId: string;
  taskId: string;
} = { copyProjectId: "", projectId: "", taskId: "" };

beforeAll(async () => {
  await setupHarness();
  state.projectId = ids.projectId;
  state.taskId = ids.taskId;
});
afterAll(teardownHarness);

it("replays every project mutation", async () => {
  const created = await replay<Versioned>(
    "createProjectAction",
    "admin",
    projects.createProjectAction,
    {
      description: null,
      key: projectKey(),
      name: "Replay project",
      status: "planning",
    }
  );
  state.projectId = created.id;
  const updated = await replay<Versioned>(
    "updateProjectAction",
    "admin",
    projects.updateProjectAction,
    {
      description: null,
      expectedVersion: created.version,
      name: "Replay project renamed",
      projectId: created.id,
      status: "active",
    }
  );
  const people = await replay<Versioned>(
    "setProjectPeopleAction",
    "admin",
    projects.setProjectPeopleAction,
    {
      expectedVersion: updated.version,
      leadId: personaId("owner"),
      memberIds: [personaId("owner")],
      projectId: created.id,
    }
  );
  await replay<VersionOnly>(
    "saveProjectMilestonesAction",
    "admin",
    projects.saveProjectMilestonesAction,
    {
      expectedVersion: people.version,
      milestones: [
        { completed: false, dueDate: null, id: null, name: "Kickoff" },
      ],
      projectId: created.id,
    }
  );
  const copy = await replay<Versioned>(
    "duplicateProjectAction",
    "admin",
    projects.duplicateProjectAction,
    {
      key: projectKey(),
      name: "Replay copy",
      sourceProjectId: created.id,
    }
  );
  state.copyProjectId = copy.id;
  const archived = await replay<Versioned>(
    "archiveProjectAction",
    "admin",
    projects.archiveProjectAction,
    { expectedVersion: copy.version, projectId: copy.id }
  );
  await replay<Versioned>(
    "restoreProjectAction",
    "admin",
    projects.restoreProjectAction,
    { expectedVersion: archived.version, projectId: copy.id }
  );
});
