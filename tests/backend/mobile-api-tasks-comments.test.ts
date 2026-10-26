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
import {
  newKey,
  seedClientBug,
  seedTask,
  send,
  taskState,
} from "./support/mobile-tasks-fixtures";

const portalQueries = await import("../../features/portal/portal-queries");

interface CreatedComment {
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: string;
  readonly id: string;
  readonly taskId: string;
  readonly visibility: "public" | "internal";
}

type Who = "owner" | "outsider" | "admin" | "client";

beforeAll(async () => {
  await setupHarness();
  await authPool.query(
    'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
    [randomUUID(), ids.clientCompanyId, ids.projectId]
  );
});
afterAll(teardownHarness);

const seedOwned = () =>
  seedTask({
    assignees: [personaId("owner")],
    createdById: personaId("admin"),
  });

const seedBug = async (): Promise<{ bugId: string; taskId: string }> => {
  const taskId = await seedTask({
    assignees: [personaId("owner")],
    createdById: personaId("admin"),
    type: "bug",
  });
  const bugId = await seedClientBug(taskId, ids.clientCompanyId);
  return { bugId, taskId };
};

const commentsPath = (taskId: string): string =>
  `/api/v1/workspace/tasks/${taskId}/comments`;

const comment = (
  taskId: string,
  body: unknown,
  options: { as?: Who; key?: string } = {}
) =>
  send<CreatedComment>("POST", commentsPath(taskId), {
    as: options.as ?? "owner",
    body: typeof body === "string" ? { body } : body,
    key: options.key ?? newKey(),
  });

const commentRows = async (taskId: string) => {
  const result = await authPool.query(
    'SELECT "authorId", body, visibility FROM comment WHERE "taskId" = $1 ORDER BY "createdAt"',
    [taskId]
  );
  return result.rows;
};

const notifications = async (taskId: string) => {
  const result = await authPool.query(
    'SELECT "userId", type FROM notification WHERE "taskId" = $1 ORDER BY type',
    [taskId]
  );
  return result.rows;
};

it("adds an internal comment by default and leaves the task version alone", async () => {
  const taskId = await seedOwned();

  const response = await comment(taskId, "Looks good to me");

  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({
    authorId: personaId("owner"),
    body: "Looks good to me",
    taskId,
    visibility: "internal",
  });
  expect(typeof response.body.data.createdAt).toBe("string");
  expect(Object.keys(response.body.data).toSorted()).toEqual([
    "authorId",
    "body",
    "createdAt",
    "id",
    "taskId",
    "visibility",
  ]);
  expect(await commentRows(taskId)).toEqual([
    {
      authorId: personaId("owner"),
      body: "Looks good to me",
      visibility: "internal",
    },
  ]);
  const task = await authPool.query("SELECT version FROM task WHERE id = $1", [
    taskId,
  ]);
  expect(task.rows[0].version).toBe(1);
});

it("lets the assigned handler and an admin comment publicly on a client bug", async () => {
  const { taskId } = await seedBug();

  const handler = await comment(taskId, {
    body: "We are looking into it",
    visibility: "public",
  });
  const admin = await comment(
    taskId,
    { body: "The team has picked this up", visibility: "public" },
    { as: "admin" }
  );

  expect(handler.status).toBe(200);
  expect(handler.body.data.visibility).toBe("public");
  expect(admin.status).toBe(200);
  expect(admin.body.data.visibility).toBe("public");
  const rows = await commentRows(taskId);
  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.visibility)).toEqual(["public", "public"]);
});

it("refuses a non-handler on a client bug and a public comment on a normal task", async () => {
  const { taskId: bugTaskId } = await seedBug();
  const taskId = await seedOwned();

  const nonHandler = await comment(
    bugTaskId,
    { body: "Not mine to answer", visibility: "public" },
    { as: "outsider" }
  );
  const publicOnTask = await comment(taskId, {
    body: "Everyone should see this",
    visibility: "public",
  });

  expect(nonHandler.status).toBe(403);
  expect(publicOnTask.status).toBe(422);
  expect(publicOnTask.body.error.code).toBe("VALIDATION_FAILED");
  expect(await commentRows(bugTaskId)).toHaveLength(0);
  expect(await commentRows(taskId)).toHaveLength(0);
});

it("keeps an internal comment on a client bug out of the client portal", async () => {
  const { bugId, taskId } = await seedBug();
  const suffix = randomUUID();
  const internalBody = `INTERNAL-ONLY-${suffix}`;
  const publicBody = `PUBLIC-REPLY-${suffix}`;

  const internal = await comment(taskId, internalBody);
  const visible = await comment(taskId, {
    body: publicBody,
    visibility: "public",
  });

  expect(internal.status).toBe(200);
  expect(visible.status).toBe(200);
  const detail = await callAs("client", portalQueries.getPortalBug, { bugId });
  expect(detail.ok).toBe(true);
  if (!detail.ok) {
    throw new Error(detail.error.message);
  }
  const bodies = (
    detail.data as { readonly comments: readonly { readonly body: string }[] }
  ).comments.map(({ body }) => body);
  expect(bodies).not.toContain(internalBody);
  expect(bodies).toContain(publicBody);
});

it("notifies a mentioned employee and refuses a client or deactivated mention", async () => {
  const taskId = await seedOwned();
  const activeMention = await comment(
    taskId,
    `@[${personaId("outsider")}] please review this`
  );
  expect(activeMention.status).toBe(200);
  expect(await notifications(taskId)).toContainEqual({
    type: "mention",
    userId: personaId("outsider"),
  });

  const beforeClientMention = await taskState(taskId);
  const clientMention = await comment(
    taskId,
    `@[${personaId("client")}] can you confirm?`
  );
  expect(clientMention.status).toBe(422);
  expect(await taskState(taskId)).toEqual(beforeClientMention);

  const beforeDeactivatedMention = await taskState(taskId);
  const deactivatedMention = await comment(
    taskId,
    `@[${personaId("deactivated")}] is this still open?`
  );
  expect(deactivatedMention.status).toBe(422);
  expect(await taskState(taskId)).toEqual(beforeDeactivatedMention);
  const mentionRows = await notifications(taskId);
  expect(mentionRows.filter(({ type }) => type === "mention")).toHaveLength(1);
});

it("answers 404 for an archived task and creates nothing", async () => {
  const taskId = await seedTask({
    archived: true,
    assignees: [personaId("owner")],
  });
  const before = await taskState(taskId);

  const response = await comment(taskId, "Too late");

  expect(response.status).toBe(404);
  expect(await taskState(taskId)).toEqual(before);
});

it("replays a retry with the same key as one comment and one notification", async () => {
  const taskId = await seedOwned();
  const key = newKey();
  const body = {
    body: `@[${personaId("outsider")}] please check this`,
    visibility: "internal",
  };

  const first = await comment(taskId, body, { key });
  const retry = await comment(taskId, body, { key });

  expect(first.status).toBe(200);
  expect(retry.status).toBe(200);
  expect(retry.body.data).toEqual(first.body.data);
  expect(await commentRows(taskId)).toHaveLength(1);
  const mentionRows = await notifications(taskId);
  expect(mentionRows.filter(({ type }) => type === "mention")).toHaveLength(1);
});

it("conflicts when a key is reused with a different body and creates nothing", async () => {
  const taskId = await seedOwned();
  const key = newKey();
  await comment(taskId, "Original comment", { key });
  const before = await taskState(taskId);
  const beforeNotifications = await notifications(taskId);

  const reused = await comment(taskId, "Different comment", { key });

  expect(reused.status).toBe(409);
  expect(reused.body.error.code).toBe("CONFLICT");
  expect(await taskState(taskId)).toEqual(before);
  expect(await notifications(taskId)).toEqual(beforeNotifications);
});

it("refuses clients, anonymous callers and an invalid token without writing", async () => {
  const taskId = await seedOwned();
  const before = await taskState(taskId);
  const body = { body: "Not allowed" };

  const client = await comment(taskId, body, { as: "client" });
  const anonymous = await send("POST", commentsPath(taskId), {
    body,
    key: newKey(),
  });
  const forged = await send("POST", commentsPath(taskId), {
    body,
    key: newKey(),
    token: "not-a-real-token",
  });

  expect(client.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(forged.status).toBe(401);
  expect(await taskState(taskId)).toEqual(before);
});

it("lets an unrelated employee comment on a normal task but not on a client bug", async () => {
  const taskId = await seedOwned();
  const { taskId: bugTaskId } = await seedBug();

  const onTask = await comment(taskId, "A useful note", { as: "outsider" });
  const onBug = await comment(bugTaskId, "Not my bug", { as: "outsider" });

  expect(onTask.status).toBe(200);
  expect(onBug.status).toBe(403);
  expect(await commentRows(taskId)).toHaveLength(1);
  expect(await commentRows(bugTaskId)).toHaveLength(0);
});

it("never notifies the author about their own mention", async () => {
  const taskId = await seedOwned();

  const response = await comment(
    taskId,
    `Note to self @[${personaId("owner")}] and @[${personaId("outsider")}]`
  );

  expect(response.status).toBe(200);
  const rows = await notifications(taskId);
  expect(rows).toContainEqual({
    type: "mention",
    userId: personaId("outsider"),
  });
  expect(rows.filter(({ userId }) => userId === personaId("owner"))).toEqual(
    []
  );
});

it("notifies a person mentioned twice once", async () => {
  const taskId = await seedOwned();
  const mention = `@[${personaId("outsider")}]`;

  const response = await comment(taskId, `${mention} look, ${mention} again`);

  expect(response.status).toBe(200);
  const rows = await notifications(taskId);
  expect(rows.filter(({ type }) => type === "mention")).toEqual([
    { type: "mention", userId: personaId("outsider") },
  ]);
});

it("sends a mentioned assignee the mention only, not a second comment notice", async () => {
  const taskId = await seedOwned();

  const response = await comment(
    taskId,
    `@[${personaId("owner")}] please take a look`,
    { as: "outsider" }
  );

  expect(response.status).toBe(200);
  const rows = await notifications(taskId);
  expect(rows.filter(({ userId }) => userId === personaId("owner"))).toEqual([
    { type: "mention", userId: personaId("owner") },
  ]);
});

it("keeps a client out of a public comment's mentions and notices on a client bug", async () => {
  const { taskId } = await seedBug();

  const refused = await comment(taskId, {
    body: `@[${personaId("client")}] we fixed it`,
    visibility: "public",
  });

  expect(refused.status).toBe(422);
  const rows = await notifications(taskId);
  expect(rows.filter(({ type }) => type === "mention")).toEqual([]);
});
