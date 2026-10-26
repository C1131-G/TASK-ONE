import { afterAll, beforeAll, expect, it } from "bun:test";

import { taskContextRoute } from "../../src/mobile-api/routes-tasks";
import {
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  decodesAs,
  isoDay,
  seedComment,
  seedSubtask,
  seedTask,
  send,
} from "./support/mobile-tasks-fixtures";

interface Context {
  readonly id: string;
  readonly reference: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly dueDate: string | null;
  readonly version: number;
  readonly isArchived: boolean;
  readonly assignees: readonly { id: string; name: string }[];
  readonly subtasks: readonly { id: string; title: string }[];
  readonly discussion: readonly { body: string; authorName: string }[];
  readonly permittedActions: readonly string[];
}

let taskId = "";
let archivedId = "";

beforeAll(async () => {
  await setupHarness();
  taskId = await seedTask({
    assignees: [personaId("owner")],
    createdById: personaId("admin"),
    dueDate: isoDay(2),
    priority: "high",
    status: "progress",
    title: "Context task",
  });
  await seedSubtask(taskId, "Second step", 1);
  await seedSubtask(taskId, "First step", 0);
  await seedComment(taskId, personaId("admin"), "Please look at this");
  archivedId = await seedTask({
    archived: true,
    assignees: [personaId("owner")],
    title: "Archived context",
  });
});
afterAll(teardownHarness);

const read = (id: string, as: "owner" | "outsider" | "admin" | "client") =>
  send<Context>("GET", `/api/v1/workspace/tasks/${id}`, { as });

it("returns one task with its people, subtasks, discussion and version", async () => {
  const response = await read(taskId, "owner");

  expect(response.status).toBe(200);
  expect(decodesAs(taskContextRoute, response.body.data)).toBe(true);
  expect(response.body.data).toMatchObject({
    dueDate: isoDay(2),
    id: taskId,
    isArchived: false,
    priority: "high",
    projectId: ids.projectId,
    status: "progress",
    title: "Context task",
    version: 1,
  });
  expect(response.body.data.reference).toMatch(/-\d+$/u);
  expect(response.body.data.assignees.map(({ id }) => id)).toEqual([
    personaId("owner"),
  ]);
  expect(response.body.data.subtasks.map(({ title }) => title)).toEqual([
    "First step",
    "Second step",
  ]);
  expect(response.body.data.discussion).toHaveLength(1);
  expect(response.body.data.discussion[0]?.body).toBe("Please look at this");
});

it("tells each caller what they may do with the task", async () => {
  const assignee = await read(taskId, "owner");
  const admin = await read(taskId, "admin");
  const unrelated = await read(taskId, "outsider");
  const archived = await read(archivedId, "owner");

  expect(assignee.body.data.permittedActions).toContain("update");
  expect(admin.body.data.permittedActions).toContain("update");
  expect(unrelated.body.data.permittedActions).not.toContain("update");
  expect(unrelated.body.data.permittedActions).toContain("comment");
  expect(archived.body.data.isArchived).toBe(true);
  expect(archived.body.data.permittedActions).toEqual([]);
});

it("answers not found for a task that does not exist and refuses clients", async () => {
  const missing = await read("00000000-0000-4000-8000-000000000000", "owner");
  const malformed = await read("not-a-uuid", "owner");
  const client = await read(taskId, "client");
  const anonymous = await send("GET", `/api/v1/workspace/tasks/${taskId}`);

  expect(missing.status).toBe(404);
  expect(malformed.status).toBe(422);
  expect(client.status).toBe(403);
  expect(anonymous.status).toBe(401);
});
