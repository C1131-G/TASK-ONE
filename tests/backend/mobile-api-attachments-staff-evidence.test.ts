import { afterAll, beforeAll, expect, it } from "bun:test";

import { ids, setupHarness, teardownHarness } from "./support/action-harness";
import {
  PNG_BYTES,
  evidenceCount,
  putToTicket,
  removeTaskObjects,
  submitBug,
} from "./support/mobile-attachments-fixtures";
import type { UploadTicketReply } from "./support/mobile-attachments-fixtures";
import {
  bugRow,
  linkProjectToCompanies,
  send,
  setHandlers,
} from "./support/mobile-bugs-fixtures";

const touchedTasks: string[] = [];

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
  await setHandlers(ids.clientCompanyId, ["owner"]);
});
afterAll(async () => {
  await removeTaskObjects(touchedTasks);
  await teardownHarness();
});

const evidenceRoute = () =>
  import("../../app/api/v1/workspace/attachments/bug-evidence/route");

// Staff upload to the bug's task first, exactly as the web does.
const uploadToBugTask = async (taskId: string): Promise<string> => {
  const { POST: request } =
    await import("../../app/api/v1/workspace/attachments/uploads/route");
  const { POST: finalize } =
    await import("../../app/api/v1/workspace/attachments/uploads/[uploadIntentId]/finalize/route");
  const ticketReply = await send(request, "POST", "admin", {
    body: {
      contentType: "image/png",
      fileName: "after-fix.png",
      sizeBytes: PNG_BYTES.byteLength,
      taskId,
    },
    key: false,
  });
  const ticket = ticketReply.body.data as UploadTicketReply;
  await putToTicket(ticket, PNG_BYTES);
  const done = await send(finalize, "POST", "admin", {
    params: { uploadIntentId: ticket.uploadIntentId },
  });
  return done.body.data.id as string;
};

const evidenceBody = (
  bugId: string,
  fileId: string,
  expectedVersion: number
) => ({
  bugId,
  caption: "After the fix",
  expectedVersion,
  fileId,
  fixAttemptId: null,
  kind: "after",
});

it("links an uploaded file to a bug as evidence the staff context lists", async () => {
  const { bugId, taskId } = await submitBug("client", "Evidence link");
  touchedTasks.push(taskId);
  const fileId = await uploadToBugTask(taskId);
  const { POST } = await evidenceRoute();
  const { version } = await bugRow(bugId);

  const reply = await send(POST, "POST", "admin", {
    body: evidenceBody(bugId, fileId, version),
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toMatchObject({ bugId, version: version + 1 });
  expect(await evidenceCount(bugId)).toBe(1);
  const { GET } = await import("../../app/api/v1/workspace/bugs/[bugId]/route");
  const detail = await send(GET, "GET", "admin", { params: { bugId } });
  expect(detail.body.data.evidence[0].file.id).toBe(fileId);
});

it("refuses a stale version, a missing key and a client, leaving no evidence", async () => {
  const { bugId, taskId } = await submitBug("client", "Evidence refusals");
  touchedTasks.push(taskId);
  const fileId = await uploadToBugTask(taskId);
  const { POST } = await evidenceRoute();
  const { version } = await bugRow(bugId);

  const stale = await send(POST, "POST", "admin", {
    body: evidenceBody(bugId, fileId, version + 5),
  });
  const noKey = await send(POST, "POST", "admin", {
    body: evidenceBody(bugId, fileId, version),
    key: false,
  });
  const client = await send(POST, "POST", "client", {
    body: evidenceBody(bugId, fileId, version),
  });
  const foreignFile = await send(POST, "POST", "admin", {
    body: evidenceBody(bugId, ids.fileId, version),
  });

  expect(stale.status).toBe(409);
  expect(noKey.status).toBe(422);
  expect(client.status).toBe(403);
  expect(foreignFile.status).toBe(422);
  expect(await evidenceCount(bugId)).toBe(0);
  const after = await bugRow(bugId);
  expect(after.version).toBe(version);
});
