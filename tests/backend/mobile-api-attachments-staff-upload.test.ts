import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  createPersona,
  ids,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  intentCount,
  removeTaskObjects,
  taskPrefix,
  objectKeys,
  expectNoSignedUrlLogged,
  watchLogs,
} from "./support/mobile-attachments-fixtures";
import { send } from "./support/mobile-bugs-fixtures";

const SIGNED_UPLOAD_SECONDS = 600;
const CLOCK_SLACK_MS = 15_000;

beforeAll(setupHarness);
afterAll(async () => {
  await removeTaskObjects([ids.taskId]);
  await teardownHarness();
});

const uploadsRoute = () =>
  import("../../app/api/v1/workspace/attachments/uploads/route");

const pngRequest = (taskId: string) => ({
  contentType: "image/png",
  fileName: "crash.png",
  sizeBytes: 2048,
  taskId,
});

it("gives a task editor a signed upload intent without an idempotency key", async () => {
  const { POST } = await uploadsRoute();
  const before = Date.now();

  const reply = await send(POST, "POST", "owner", {
    body: pngRequest(ids.taskId),
    key: false,
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toMatchObject({
    requiredHeaders: { "content-type": "image/png", "if-none-match": "*" },
    uploadIntentId: expect.any(String),
    uploadUrl: expect.stringContaining(taskPrefix(ids.taskId)),
  });
  const expiresAt = Date.parse(reply.body.data.expiresAt as string);
  expect(expiresAt).toBeGreaterThan(
    before + SIGNED_UPLOAD_SECONDS * 1000 - CLOCK_SLACK_MS
  );
  expect(expiresAt).toBeLessThan(
    Date.now() + SIGNED_UPLOAD_SECONDS * 1000 + CLOCK_SLACK_MS
  );
  expect(await intentCount(ids.taskId)).toBe(1);
  expect(await objectKeys(taskPrefix(ids.taskId))).toEqual([]);
});

const closedDoor = async (taskId: string) => {
  const intents = await intentCount(taskId);
  const objects = await objectKeys(taskPrefix(taskId));
  return { intents, objects };
};

it("refuses an employee who may not edit the task and leaves no trace", async () => {
  const { POST } = await uploadsRoute();
  const before = await closedDoor(ids.taskId);

  const reply = await send(POST, "POST", "outsider", {
    body: pngRequest(ids.taskId),
    key: false,
  });

  expect(reply.status).toBe(403);
  expect(reply.body.error.code).toBe("FORBIDDEN");
  expect(await closedDoor(ids.taskId)).toEqual(before);
});

it("answers 404 for a task that does not exist", async () => {
  const { POST } = await uploadsRoute();

  const reply = await send(POST, "POST", "admin", {
    body: pngRequest(crypto.randomUUID()),
    key: false,
  });

  expect(reply.status).toBe(404);
});

it("refuses an upload to archived work", async () => {
  const { POST } = await uploadsRoute();
  const before = await closedDoor(ids.archivedTaskId);

  const reply = await send(POST, "POST", "admin", {
    body: pngRequest(ids.archivedTaskId),
    key: false,
  });

  expect(reply.status).toBe(403);
  expect(await closedDoor(ids.archivedTaskId)).toEqual(before);
});

it("names the fields of a request that is malformed", async () => {
  const { POST } = await uploadsRoute();
  const before = await closedDoor(ids.taskId);

  const reply = await send(POST, "POST", "owner", {
    body: {
      ...pngRequest(ids.taskId),
      contentType: "not a type",
      fileName: "",
    },
    key: false,
  });

  expect(reply.status).toBe(422);
  expect(reply.body.error.fieldErrors).toMatchObject({
    contentType: expect.any(String),
    fileName: expect.any(String),
  });
  const huge = await send(POST, "POST", "owner", {
    body: { ...pngRequest(ids.taskId), sizeBytes: 50 * 1024 * 1024 + 1 },
    key: false,
  });
  expect(huge.status).toBe(422);
  expect(huge.body.error.fieldErrors).toMatchObject({
    sizeBytes: expect.any(String),
  });
  expect(await closedDoor(ids.taskId)).toEqual(before);
});

it("answers 401 without a bearer token and 403 to a client token", async () => {
  const { POST } = await uploadsRoute();

  const anonymous = await send(POST, "POST", "anonymous", {
    body: pngRequest(ids.taskId),
    key: false,
  });
  const client = await send(POST, "POST", "client", {
    body: pngRequest(ids.taskId),
    key: false,
  });

  expect(anonymous.status).toBe(401);
  expect(client.status).toBe(403);
});

it("answers 401 once the token's session is revoked", async () => {
  const { POST } = await uploadsRoute();
  const revoked = await createPersona("employee", "revoked");
  await authPool.query(
    'UPDATE "user" SET "mustChangePassword" = false WHERE id = $1',
    [revoked.id]
  );
  await authPool.query('DELETE FROM session WHERE "userId" = $1', [revoked.id]);

  const reply = await send(POST, "POST", "admin", {
    body: pngRequest(ids.taskId),
    key: false,
    token: revoked.bearerToken,
  });

  expect(reply.status).toBe(401);
});

it("never writes a signed URL to the logs", async () => {
  const { POST } = await uploadsRoute();
  const logs = watchLogs();

  const granted = await send(POST, "POST", "owner", {
    body: pngRequest(ids.taskId),
    key: false,
  });
  await send(POST, "POST", "outsider", {
    body: pngRequest(ids.taskId),
    key: false,
  });

  expect(granted.status).toBe(200);
  expectNoSignedUrlLogged(logs, granted.body.data.uploadUrl as string);
  logs.stop();
});
