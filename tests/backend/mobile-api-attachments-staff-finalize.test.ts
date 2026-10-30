import { afterAll, beforeAll, expect, it } from "bun:test";

import { Schema } from "effect";

import { AttachmentFileSchema } from "../../src/mobile-api/routes-attachments";
import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  HTML_BYTES,
  PNG_BYTES,
  expireIntent,
  fileCount,
  intentCount,
  intentState,
  keyOfTicket,
  objectKeys,
  putObjectDirect,
  putToTicket,
  removeTaskObjects,
  taskPrefix,
} from "./support/mobile-attachments-fixtures";
import type { UploadTicketReply } from "./support/mobile-attachments-fixtures";
import { send } from "./support/mobile-bugs-fixtures";

beforeAll(setupHarness);
afterAll(async () => {
  await removeTaskObjects([ids.taskId]);
  await teardownHarness();
});

const uploadsRoute = () =>
  import("../../apps/web/app/api/v1/workspace/attachments/uploads/route");
const finalizeRoute = () =>
  import("../../apps/web/app/api/v1/workspace/attachments/uploads/[uploadIntentId]/finalize/route");

const requestTicket = async (
  name = "crash.png"
): Promise<UploadTicketReply> => {
  const { POST } = await uploadsRoute();
  const reply = await send(POST, "POST", "owner", {
    body: {
      contentType: "image/png",
      fileName: name,
      sizeBytes: PNG_BYTES.byteLength,
      taskId: ids.taskId,
    },
    key: false,
  });
  expect(reply.status).toBe(200);
  return reply.body.data as UploadTicketReply;
};

it("finalizes an uploaded object into a file the owner can see", async () => {
  const ticket = await requestTicket("finalized.png");
  const put = await putToTicket(ticket, PNG_BYTES);
  expect(put.ok).toBe(true);
  const { POST } = await finalizeRoute();
  const filesBefore = await fileCount(ids.taskId);

  const reply = await send(POST, "POST", "owner", {
    params: { uploadIntentId: ticket.uploadIntentId },
  });

  expect(reply.status).toBe(200);
  expect(Schema.is(AttachmentFileSchema)(reply.body.data)).toBe(true);
  expect(reply.body.data).toMatchObject({
    contentType: "image/png",
    name: "finalized.png",
    sizeBytes: PNG_BYTES.byteLength,
    taskId: ids.taskId,
    uploadedBy: { id: personaId("owner") },
  });
  expect(await fileCount(ids.taskId)).toBe(filesBefore + 1);
  const intent = await authPool.query<{ state: string }>(
    "SELECT state FROM upload_intent WHERE id = $1",
    [ticket.uploadIntentId]
  );
  expect(intent.rows[0]?.state).toBe("finalized");
  const objects = await objectKeys(taskPrefix(ids.taskId));
  expect(objects.length).toBeGreaterThan(0);
  expect(await intentCount(ids.taskId)).toBeGreaterThan(0);
});

const snapshot = async () => ({
  files: await fileCount(ids.taskId),
  objects: await objectKeys(taskPrefix(ids.taskId)),
});

it("returns the same file when an intent is finalized twice", async () => {
  const ticket = await requestTicket("twice.png");
  await putToTicket(ticket, PNG_BYTES);
  const { POST } = await finalizeRoute();
  const params = { uploadIntentId: ticket.uploadIntentId };

  const first = await send(POST, "POST", "owner", { params });
  const second = await send(POST, "POST", "owner", { params });
  const replayed = await send(POST, "POST", "owner", {
    key: "fixed-key-for-replay",
    params,
  });
  const replayedAgain = await send(POST, "POST", "owner", {
    key: "fixed-key-for-replay",
    params,
  });

  expect(first.status).toBe(200);
  expect(second.body.data).toEqual(first.body.data);
  expect(replayed.body.data).toEqual(first.body.data);
  expect(replayedAgain.body.data).toEqual(first.body.data);
  const files = await authPool.query(
    'SELECT id FROM file_asset WHERE "storageKey" = $1',
    [keyOfTicket(ticket)]
  );
  expect(files.rows).toHaveLength(1);
});

it("asks for an idempotency key on a finalize", async () => {
  const ticket = await requestTicket("nokey.png");
  await putToTicket(ticket, PNG_BYTES);
  const { POST } = await finalizeRoute();
  const before = await snapshot();

  const reply = await send(POST, "POST", "owner", {
    key: false,
    params: { uploadIntentId: ticket.uploadIntentId },
  });

  expect(reply.status).toBe(422);
  expect(reply.body.error.fieldErrors).toMatchObject({
    "Idempotency-Key": expect.any(String),
  });
  expect(await snapshot()).toEqual(before);
  expect(await intentState(ticket.uploadIntentId)).toBe("pending");
});

it("refuses to finalize someone else's intent", async () => {
  const ticket = await requestTicket("theirs.png");
  await putToTicket(ticket, PNG_BYTES);
  const { POST } = await finalizeRoute();
  const before = await snapshot();

  const reply = await send(POST, "POST", "admin", {
    params: { uploadIntentId: ticket.uploadIntentId },
  });

  expect(reply.status).toBe(403);
  expect(await snapshot()).toEqual(before);
  expect(await intentState(ticket.uploadIntentId)).toBe("pending");
});

it("refuses an intent that has expired", async () => {
  const ticket = await requestTicket("late.png");
  await putToTicket(ticket, PNG_BYTES);
  await expireIntent(ticket.uploadIntentId);
  const { POST } = await finalizeRoute();
  const before = await snapshot();

  const reply = await send(POST, "POST", "owner", {
    params: { uploadIntentId: ticket.uploadIntentId },
  });

  expect(reply.status).toBe(409);
  expect(await snapshot()).toEqual(before);
  expect(await intentState(ticket.uploadIntentId)).toBe("pending");
});

it("refuses bytes whose signature is not the declared type", async () => {
  const ticket = await requestTicket("fake.png");
  const disguised = await putToTicket(ticket, HTML_BYTES.slice(0, 16));
  expect(disguised.ok).toBe(true);
  const { POST } = await finalizeRoute();
  const before = await snapshot();

  const reply = await send(POST, "POST", "owner", {
    params: { uploadIntentId: ticket.uploadIntentId },
  });

  expect(reply.status).toBe(422);
  expect(await snapshot()).toEqual(before);
  expect(await intentState(ticket.uploadIntentId)).toBe("pending");
});

it("refuses an object whose size or type differs from the request", async () => {
  const wrongSize = await requestTicket("size.png");
  await putObjectDirect(
    keyOfTicket(wrongSize),
    new Uint8Array([...PNG_BYTES, 1, 2, 3]),
    "image/png"
  );
  const wrongType = await requestTicket("type.png");
  await putObjectDirect(keyOfTicket(wrongType), PNG_BYTES, "image/jpeg");
  const { POST } = await finalizeRoute();
  const before = await snapshot();

  const sizeReply = await send(POST, "POST", "owner", {
    params: { uploadIntentId: wrongSize.uploadIntentId },
  });
  const typeReply = await send(POST, "POST", "owner", {
    params: { uploadIntentId: wrongType.uploadIntentId },
  });

  expect(sizeReply.status).toBe(422);
  expect(typeReply.status).toBe(422);
  expect(await snapshot()).toEqual(before);
});

it("tells the app the file was not uploaded yet instead of failing the server", async () => {
  const ticket = await requestTicket("never-sent.png");
  const { POST } = await finalizeRoute();
  const before = await snapshot();

  const reply = await send(POST, "POST", "owner", {
    params: { uploadIntentId: ticket.uploadIntentId },
  });

  expect(reply.status).toBe(422);
  expect(reply.body.error.message).toContain("not been uploaded");
  expect(await snapshot()).toEqual(before);
  expect(await intentState(ticket.uploadIntentId)).toBe("pending");
});

it("answers 401 without a token and 403 to a client token", async () => {
  const { POST } = await finalizeRoute();
  const params = { uploadIntentId: crypto.randomUUID() };

  const anonymous = await send(POST, "POST", "anonymous", { params });
  const client = await send(POST, "POST", "client", { params });

  expect(anonymous.status).toBe(401);
  expect(client.status).toBe(403);
});

it("answers 422 for an intent id that is not an id", async () => {
  const { POST } = await finalizeRoute();

  const reply = await send(POST, "POST", "owner", {
    params: { uploadIntentId: "nope" },
  });

  expect(reply.status).toBe(422);
  expect(reply.body.error.fieldErrors).toMatchObject({
    uploadIntentId: expect.any(String),
  });
});
