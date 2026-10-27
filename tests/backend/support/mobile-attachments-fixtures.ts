import { expect, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { authPool, ids, personaId } from "./action-harness";
import type { Persona } from "./action-harness";
import { countRows, reportBody, send } from "./mobile-bugs-fixtures";

const endpoint = process.env["S3_ENDPOINT"];
const bucket = process.env["S3_BUCKET"] ?? "metsys-private";
const accessKeyId = process.env["S3_ACCESS_KEY_ID"];
const secretAccessKey = process.env["S3_SECRET_ACCESS_KEY"];

const s3 = new S3Client({
  region: process.env["S3_REGION"] ?? "us-east-1",
  ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  ...(accessKeyId && secretAccessKey
    ? { credentials: { accessKeyId, secretAccessKey } }
    : {}),
});

// Real files start with a recognizable signature; the server checks it.
export const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48,
  0x44, 0x52,
]);
export const PDF_BYTES = new TextEncoder().encode("%PDF-1.4 mobile test");
export const HTML_BYTES = new TextEncoder().encode(
  "<html><script>alert(1)</script></html>"
);

export interface UploadTicketReply {
  readonly expiresAt: string;
  readonly requiredHeaders: Record<string, string>;
  readonly uploadIntentId: string;
  readonly uploadUrl: string;
}

// Every key under a prefix, so a test can prove a refused write left the
// object store as it found it.
export const objectKeys = async (prefix: string): Promise<string[]> => {
  const listed = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
  );
  return (listed.Contents ?? []).flatMap(({ Key }) => (Key ? [Key] : []));
};

export const taskPrefix = (taskId: string): string =>
  `company/tasks/${taskId}/`;

// Sends the bytes the way the app does: straight to the signed URL.
export const putToTicket = (
  ticket: UploadTicketReply,
  bytes: Uint8Array<ArrayBuffer>
): Promise<Response> =>
  fetch(ticket.uploadUrl, {
    body: bytes,
    headers: ticket.requiredHeaders,
    method: "PUT",
  });

export const removeTaskObjects = async (taskIds: readonly string[]) => {
  for (const taskId of taskIds) {
    // eslint-disable-next-line no-await-in-loop
    for (const Key of await objectKeys(taskPrefix(taskId))) {
      // eslint-disable-next-line no-await-in-loop
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key }));
    }
  }
};

export const intentCount = (taskId: string): Promise<number> =>
  countRows("upload_intent", '"taskId" = $1', [taskId]);

export const fileCount = (taskId: string): Promise<number> =>
  countRows("file_asset", '"taskId" = $1', [taskId]);

export const evidenceCount = (bugId: string): Promise<number> =>
  countRows("bug_evidence", '"bugReportId" = $1', [bugId]);

// A task of its own, so a test can fill it, close it or hide it without
// touching the shared harness task.
export const createTask = async (
  projectId: string,
  creatorId: string
): Promise<string> => {
  const taskId = randomUUID();
  const next = await authPool.query<{ number: number }>(
    'SELECT coalesce(max("projectTaskNumber"), 0) + 1 AS number FROM task WHERE "projectId" = $1',
    [projectId]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, $3, $4, $5)',
    [taskId, projectId, next.rows[0]?.number ?? 1, "Attachment task", creatorId]
  );
  return taskId;
};

// Records everything the server writes while a request runs, so a test can
// prove a signed link never reaches a log.
export const watchLogs = () => {
  const lines: string[] = [];
  const keep = (...parts: unknown[]) => {
    lines.push(parts.map(String).join(" "));
  };
  const spies = [
    spyOn(console, "log").mockImplementation(keep),
    spyOn(console, "info").mockImplementation(keep),
    spyOn(console, "warn").mockImplementation(keep),
    spyOn(console, "error").mockImplementation(keep),
    spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      keep(chunk);
      return true;
    }),
    spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      keep(chunk);
      return true;
    }),
  ];
  return {
    lines,
    stop: () => {
      for (const spy of spies) {
        spy.mockRestore();
      }
    },
  };
};

export const expectNoSignedUrlLogged = (
  logs: { readonly lines: readonly string[] },
  url: string
): void => {
  const signature = new URL(url).searchParams.get("X-Amz-Signature") ?? "";
  expect(signature).not.toBe("");
  expect(logs.lines.some((line) => line.includes(signature))).toBe(false);
  expect(logs.lines.some((line) => line.includes("X-Amz-Signature"))).toBe(
    false
  );
};

// The object key a ticket's signed URL points at (path style: /bucket/key).
export const keyOfTicket = (ticket: UploadTicketReply): string =>
  decodeURIComponent(new URL(ticket.uploadUrl).pathname)
    .split("/")
    .slice(2)
    .join("/");

// Puts an object the way a misbehaving client with its own credentials could,
// to reach cases a signed URL would never allow (a different size or type).
export const putObjectDirect = async (
  key: string,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string
): Promise<void> => {
  await s3.send(
    new PutObjectCommand({
      Body: bytes,
      Bucket: bucket,
      ContentType: contentType,
      Key: key,
    })
  );
};

export const expireIntent = async (uploadIntentId: string): Promise<void> => {
  await authPool.query(
    `UPDATE upload_intent SET "expiresAt" = now() - interval '1 minute' WHERE id = $1`,
    [uploadIntentId]
  );
};

export const intentState = async (uploadIntentId: string): Promise<string> => {
  const result = await authPool.query<{ state: string }>(
    "SELECT state FROM upload_intent WHERE id = $1",
    [uploadIntentId]
  );
  return result.rows[0]?.state ?? "missing";
};

// A bug a client reports through the portal route, with the task behind it.
export const submitBug = async (
  persona: Persona,
  title: string
): Promise<{ bugId: string; taskId: string }> => {
  const { POST } = await import("../../../app/api/v1/portal/bugs/route");
  const reply = await send(POST, "POST", persona, { body: reportBody(title) });
  const bugId = reply.body.data.bugId as string;
  const row = await authPool.query<{ taskId: string }>(
    'SELECT "taskId" FROM bug_report WHERE id = $1',
    [bugId]
  );
  return { bugId, taskId: row.rows[0]?.taskId ?? "" };
};

// A finished file on a task without going through storage; enough for
// access checks, which never read the bytes.
export const insertFile = async (
  taskId: string,
  uploader: Persona,
  name = "seeded.png",
  contentType = "image/png"
): Promise<string> => {
  const fileId = randomUUID();
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, $7, 100)',
    [
      fileId,
      ids.projectId,
      taskId,
      personaId(uploader),
      name,
      `company/tasks/${taskId}/${fileId}`,
      contentType,
    ]
  );
  return fileId;
};

// Attaches a file to a bug as evidence, the way the web does after a finalize.
export const insertEvidence = async (
  bugId: string,
  fileId: string,
  uploader: Persona
): Promise<void> => {
  await authPool.query(
    'INSERT INTO bug_evidence (id, "bugReportId", "fileAssetId", "uploadedById", kind, caption) VALUES ($1, $2, $3, $4, \'other\', \'seeded\')',
    [randomUUID(), bugId, fileId, personaId(uploader)]
  );
};
