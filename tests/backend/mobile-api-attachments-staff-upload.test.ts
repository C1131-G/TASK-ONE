import { afterAll, beforeAll, expect, it } from "bun:test";

import { ids, setupHarness, teardownHarness } from "./support/action-harness";
import {
  intentCount,
  removeTaskObjects,
  taskPrefix,
  objectKeys,
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
