import { afterAll, beforeAll, expect, it } from "bun:test";

import { Schema } from "effect";

import {
  AttachmentFileSchema,
  SignedUrlSchema,
} from "../../src/mobile-api/routes-attachments";
import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  PNG_BYTES,
  expectNoSignedUrlLogged,
  putToTicket,
  removeTaskObjects,
  watchLogs,
} from "./support/mobile-attachments-fixtures";
import type { UploadTicketReply } from "./support/mobile-attachments-fixtures";
import { send } from "./support/mobile-bugs-fixtures";

const DOWNLOAD_SECONDS = 300;
const PREVIEW_SECONDS = 300;
const CLOCK_SLACK_MS = 15_000;

beforeAll(setupHarness);
afterAll(async () => {
  await removeTaskObjects([ids.taskId]);
  await teardownHarness();
});

const uploadsRoute = () =>
  import("../../app/api/v1/workspace/attachments/uploads/route");
const finalizeRoute = () =>
  import("../../app/api/v1/workspace/attachments/uploads/[uploadIntentId]/finalize/route");
const listRoute = () => import("../../app/api/v1/workspace/attachments/route");
const downloadRoute = () =>
  import("../../app/api/v1/workspace/attachments/[fileId]/download/route");
const previewRoute = () =>
  import("../../app/api/v1/workspace/attachments/[fileId]/preview/route");

// Uploads a real PNG through the routes and returns the finished file's id.
const uploadPng = async (name: string): Promise<string> => {
  const { POST: request } = await uploadsRoute();
  const { POST: finalize } = await finalizeRoute();
  const ticketReply = await send(request, "POST", "owner", {
    body: {
      contentType: "image/png",
      fileName: name,
      sizeBytes: PNG_BYTES.byteLength,
      taskId: ids.taskId,
    },
    key: false,
  });
  const ticket = ticketReply.body.data as UploadTicketReply;
  await putToTicket(ticket, PNG_BYTES);
  const done = await send(finalize, "POST", "owner", {
    params: { uploadIntentId: ticket.uploadIntentId },
  });
  return done.body.data.id as string;
};

it("lists a task's files with name, type, size and uploader", async () => {
  const fileId = await uploadPng("listed.png");
  const { GET } = await listRoute();

  const reply = await send(GET, "GET", "outsider", {
    query: { taskId: ids.taskId },
  });

  expect(reply.status).toBe(200);
  const { items } = reply.body.data as { items: unknown[] };
  expect(items.every((item) => Schema.is(AttachmentFileSchema)(item))).toBe(
    true
  );
  expect(items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        contentType: "image/png",
        id: fileId,
        name: "listed.png",
        previewable: true,
        sizeBytes: PNG_BYTES.byteLength,
        uploadedBy: { id: personaId("owner"), name: "Harness owner" },
      }),
      expect.objectContaining({
        contentType: "text/plain",
        id: ids.fileId,
        name: "owned.txt",
        previewable: false,
      }),
    ])
  );
});

it("signs a short-lived download that returns the uploaded bytes", async () => {
  const fileId = await uploadPng("download.png");
  const { GET } = await downloadRoute();
  const before = Date.now();

  const reply = await send(GET, "GET", "outsider", { params: { fileId } });

  expect(reply.status).toBe(200);
  expect(Schema.is(SignedUrlSchema)(reply.body.data)).toBe(true);
  const expiresAt = Date.parse(reply.body.data.expiresAt as string);
  expect(expiresAt).toBeGreaterThan(
    before + DOWNLOAD_SECONDS * 1000 - CLOCK_SLACK_MS
  );
  expect(expiresAt).toBeLessThan(
    Date.now() + DOWNLOAD_SECONDS * 1000 + CLOCK_SLACK_MS
  );
  const fetched = await fetch(reply.body.data.url as string);
  expect(fetched.status).toBe(200);
  expect(fetched.headers.get("content-disposition")).toContain("attachment");
  expect(new Uint8Array(await fetched.arrayBuffer())).toEqual(PNG_BYTES);
});

it("signs an inline preview for an image and refuses one for other types", async () => {
  const fileId = await uploadPng("preview.png");
  const { GET } = await previewRoute();
  const before = Date.now();

  const image = await send(GET, "GET", "owner", { params: { fileId } });
  const text = await send(GET, "GET", "owner", {
    params: { fileId: ids.fileId },
  });

  expect(image.status).toBe(200);
  const expiresAt = Date.parse(image.body.data.expiresAt as string);
  expect(expiresAt).toBeGreaterThan(
    before + PREVIEW_SECONDS * 1000 - CLOCK_SLACK_MS
  );
  expect(expiresAt).toBeLessThan(
    Date.now() + PREVIEW_SECONDS * 1000 + CLOCK_SLACK_MS
  );
  const fetched = await fetch(image.body.data.url as string);
  expect(fetched.headers.get("content-disposition")).toBe("inline");
  expect(fetched.headers.get("content-type")).toBe("image/png");
  expect(text.status).toBe(403);
});

it("refuses a removed or unknown file when the link is requested", async () => {
  const fileId = await uploadPng("removed.png");
  await authPool.query(
    'UPDATE file_asset SET "deletedAt" = now(), "deletedById" = $2 WHERE id = $1',
    [fileId, personaId("owner")]
  );
  const { GET: download } = await downloadRoute();
  const { GET: preview } = await previewRoute();

  const removed = await send(download, "GET", "owner", { params: { fileId } });
  const removedPreview = await send(preview, "GET", "owner", {
    params: { fileId },
  });
  const unknown = await send(download, "GET", "admin", {
    params: { fileId: crypto.randomUUID() },
  });

  expect(removed.status).toBe(404);
  expect(removedPreview.status).toBe(404);
  expect(unknown.status).toBe(404);
});

it("refuses a missing task, a malformed id and a client token", async () => {
  const { GET: list } = await listRoute();
  const { GET: download } = await downloadRoute();

  const missingTask = await send(list, "GET", "owner", {
    query: { taskId: crypto.randomUUID() },
  });
  const malformed = await send(download, "GET", "owner", {
    params: { fileId: "nope" },
  });
  const noQuery = await send(list, "GET", "owner");
  const client = await send(list, "GET", "client", {
    query: { taskId: ids.taskId },
  });
  const anonymous = await send(download, "GET", "anonymous", {
    params: { fileId: ids.fileId },
  });
  const clientDownload = await send(download, "GET", "client", {
    params: { fileId: ids.fileId },
  });

  expect(missingTask.status).toBe(404);
  expect(malformed.status).toBe(422);
  expect(malformed.body.error.fieldErrors).toMatchObject({
    fileId: expect.any(String),
  });
  expect(noQuery.status).toBe(422);
  expect(client.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(clientDownload.status).toBe(403);
});

it("never writes a signed download link to the logs", async () => {
  const fileId = await uploadPng("quiet.png");
  const { GET } = await downloadRoute();
  const logs = watchLogs();

  const reply = await send(GET, "GET", "owner", { params: { fileId } });
  await send(GET, "GET", "owner", { params: { fileId: crypto.randomUUID() } });

  expect(reply.status).toBe(200);
  expectNoSignedUrlLogged(logs, reply.body.data.url as string);
  logs.stop();
});
