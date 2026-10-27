import { afterAll, beforeAll, expect, it } from "bun:test";

import { Schema } from "effect";

import { PortalAttachmentSchema } from "../../src/mobile-api/routes-attachments";
import {
  authPool,
  ids,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  PNG_BYTES,
  evidenceCount,
  fileCount,
  putToTicket,
  removeTaskObjects,
  submitBug,
} from "./support/mobile-attachments-fixtures";
import type { UploadTicketReply } from "./support/mobile-attachments-fixtures";
import {
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

const uploadsRoute = () =>
  import("../../app/api/v1/portal/attachments/uploads/route");
const finalizeRoute = () =>
  import("../../app/api/v1/portal/attachments/uploads/[uploadIntentId]/finalize/route");
const listRoute = () => import("../../app/api/v1/portal/attachments/route");

it("lets a client attach a screenshot to its own bug after reporting it", async () => {
  const { bugId, taskId } = await submitBug("client", "Screenshot bug");
  touchedTasks.push(taskId);
  const { POST: request } = await uploadsRoute();
  const { POST: finalize } = await finalizeRoute();
  const { GET: list } = await listRoute();

  const ticketReply = await send(request, "POST", "client", {
    body: {
      bugId,
      contentType: "image/png",
      fileName: "screen.png",
      sizeBytes: PNG_BYTES.byteLength,
    },
    key: false,
  });
  expect(ticketReply.status).toBe(200);
  const ticket = ticketReply.body.data as UploadTicketReply;
  const put = await putToTicket(ticket, PNG_BYTES);
  expect(put.ok).toBe(true);
  const done = await send(finalize, "POST", "client", {
    body: { bugId },
    params: { uploadIntentId: ticket.uploadIntentId },
  });

  expect(done.status).toBe(200);
  expect(Schema.is(PortalAttachmentSchema)(done.body.data)).toBe(true);
  expect(done.body.data).toMatchObject({
    contentType: "image/png",
    fileName: "screen.png",
    previewable: true,
    sizeBytes: PNG_BYTES.byteLength,
    uploaderName: "Harness client",
  });
  expect(await fileCount(taskId)).toBe(1);
  expect(await evidenceCount(bugId)).toBe(1);
  const evidence = await authPool.query<{ fileAssetId: string }>(
    'SELECT "fileAssetId" FROM bug_evidence WHERE "bugReportId" = $1',
    [bugId]
  );
  expect(evidence.rows[0]?.fileAssetId).toBe(done.body.data.fileId as string);

  const listed = await send(list, "GET", "client", { query: { bugId } });
  expect(listed.body.data.items).toEqual([done.body.data]);
});
